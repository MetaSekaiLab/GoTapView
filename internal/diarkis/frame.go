// Package diarkis decodes the Project Sekai realtime UDP protocol (Diarkis
// v0.8.2) from captured datagrams.
//
// It works top-down and never discards data it cannot interpret: a datagram is
// split into its RUDP wrapper, then a Diarkis frame, then a secure payload,
// then application MessagePack. Whatever cannot be decoded at a given layer is
// preserved as hex on the result, so a partially understood packet still shows
// everything that was understood.
//
// The wire format was recovered in ReverseProjects/Sekai/diarkis-go
// (CAPTURE_ANALYSIS.md).
package diarkis

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
)

// Magic is the Diarkis frame preamble.
var magic = [4]byte{0xFE, 0xBE, 0xDE, 0xEF}

// RUDP flags.
var flagName = map[uint8]string{1: "UDP", 2: "SYN", 3: "DAT", 4: "ACK", 5: "RST", 6: "EACK", 7: "FIN"}

// Key is one per-session Diarkis key set, discovered from a diarkis-auth response.
type Key struct {
	SID    []byte
	Key    []byte
	IV     []byte
	MacKey []byte
}

// Datagram is the decode of one UDP payload (post-SOCKS5-header).
type Datagram struct {
	WrapSeq uint32 `json:"wrapSeq"`
	Flag    string `json:"flag"`
	IsRUDP  bool   `json:"isRudp"`
	// Split describes a fragment of an oversized payload. When Frame is also
	// set, this was the fragment that completed the payload.
	Split *SplitInfo `json:"split,omitempty"`
	Frame *Frame     `json:"frame,omitempty"`
	// Raw holds the wrapper's body when it is not a Diarkis frame (control
	// datagrams carry the bare sid; anything else is kept verbatim).
	Raw string `json:"raw,omitempty"`
}

// SplitInfo reports a payload fragment's place in its set.
type SplitInfo struct {
	ID       uint16 `json:"id"`
	Index    uint16 `json:"index"`
	Count    uint16 `json:"count"`
	Bytes    int    `json:"bytes"`
	Complete bool   `json:"complete"`
}

// Frame is a decoded Diarkis frame header plus whatever of the payload we could
// make sense of.
type Frame struct {
	Ver        uint8  `json:"ver"`
	Cmd        uint16 `json:"cmd"`
	Status     *uint8 `json:"status,omitempty"`
	Recognized bool   `json:"recognized"`
	Decoded    any    `json:"decoded,omitempty"`
	// RawPayload holds the frame payload (or the part of it) that could not be
	// decoded, so nothing is lost even when Recognized is false.
	RawPayload string `json:"rawPayload,omitempty"`
}

// SplitDatagrams separates coalesced datagrams packed into one UDP payload.
//
// The client batches several datagrams into a single send (notably ACK
// bursts). respHeader selects the 11-byte response header for inbound frames.
func SplitDatagrams(b []byte, respHeader bool) [][]byte {
	hlen := 10
	if respHeader {
		hlen = 11
	}
	var out [][]byte
	for len(b) >= 4 {
		body := b[4:]
		if len(body) >= hlen && hasMagic(body) {
			size := int(uint32(body[5])<<16 | uint32(body[6])<<8 | uint32(body[7]))
			total := 4 + hlen + size
			if total <= len(b) {
				out = append(out, b[:total])
				b = b[total:]
				continue
			}
			break
		}
		// bare control unit: 4-byte wrapper + optional 16-byte sid
		const ackUnit = 4 + 16
		if len(b) > ackUnit && b[ackUnit+3] >= 1 && b[ackUnit+3] <= 7 {
			out = append(out, b[:ackUnit])
			b = b[ackUnit:]
			continue
		}
		break
	}
	if len(b) > 0 {
		out = append(out, b)
	}
	return out
}

// Decode interprets one datagram, trying each candidate key for the secure
// payload. dirS2C selects response framing and the no-sid inbound layout.
//
// ra may be nil. When provided, oversized payloads split across datagrams are
// buffered and decoded once the final fragment arrives.
func Decode(dg []byte, dirS2C bool, keys []Key, ra *Reassembler) Datagram {
	var d Datagram
	if len(dg) < 4 {
		d.Raw = hex.EncodeToString(dg)
		return d
	}
	d.WrapSeq = uint32(dg[0]) | uint32(dg[1])<<8 | uint32(dg[2])<<16
	flag := dg[3]
	d.Flag = flagName[flag]
	if d.Flag == "" {
		d.Flag = "?"
	}
	d.IsRUDP = flag != 1
	body := dg[4:]

	if len(body) == 0 {
		return d // bare control datagram
	}

	// An oversized payload arrives as fragments; buffer until it is whole.
	if c, ok := ParseSplitChunk(body); ok {
		info := &SplitInfo{ID: c.ID, Index: c.Index, Count: c.Count, Bytes: len(c.Data)}
		d.Split = info
		if ra == nil {
			d.Raw = hex.EncodeToString(body)
			return d
		}
		whole := ra.Feed(c)
		if whole == nil {
			return d // still incomplete; the fragment is reported on its own
		}
		info.Complete = true
		info.Bytes = len(whole)
		body = whole
		if !hasMagic(body) {
			d.Raw = hex.EncodeToString(body)
			return d
		}
	}

	if !hasMagic(body) {
		d.Raw = hex.EncodeToString(body) // e.g. the sid on SYN/ACK/FIN
		return d
	}

	hlen := 10
	if dirS2C {
		hlen = 11
	}
	if len(body) < hlen {
		d.Raw = hex.EncodeToString(body)
		return d
	}
	fr := &Frame{
		Ver: body[4],
		Cmd: uint16(body[8])<<8 | uint16(body[9]),
	}
	if dirS2C {
		st := body[10]
		fr.Status = &st
	}
	payload := body[hlen:]
	decodeFramePayload(fr, payload, dirS2C, keys)
	d.Frame = fr
	return d
}

// HasFrameMagic reports whether a wrapper body begins a Diarkis frame.
func HasFrameMagic(b []byte) bool { return hasMagic(b) }

func hasMagic(b []byte) bool {
	return len(b) >= 4 && b[0] == magic[0] && b[1] == magic[1] && b[2] == magic[2] && b[3] == magic[3]
}

func padLen(n int) int {
	m := n
	if n > 15 {
		m = n & 0xf
	}
	return n + (16 - m)
}

// unseal reverses CreateSecurePayload for one key. Outbound payloads are
// sid-prefixed; inbound are not. Returns plaintext and whether the MAC matched.
func unseal(payload []byte, dirS2C bool, k Key) ([]byte, bool) {
	off := len(k.SID)
	if dirS2C {
		off = 0
	}
	if len(payload) < off+36 {
		return nil, false
	}
	if !dirS2C {
		if len(payload) < 16 || !hmac.Equal(payload[:len(k.SID)], k.SID) {
			// sid prefix must match this key
			if len(payload) < len(k.SID) || string(payload[:len(k.SID)]) != string(k.SID) {
				return nil, false
			}
		}
	}
	plainLen := int(binary.BigEndian.Uint32(payload[off : off+4]))
	mac := payload[off+4 : off+36]
	ct := payload[off+36:]
	if len(ct) == 0 || len(ct)%16 != 0 || len(ct) != padLen(plainLen) {
		return nil, false
	}
	h := hmac.New(sha256.New, k.MacKey)
	h.Write(ct)
	if !hmac.Equal(h.Sum(nil), mac) {
		return nil, false
	}
	block, err := aes.NewCipher(k.Key)
	if err != nil {
		return nil, false
	}
	out := make([]byte, len(ct))
	cipher.NewCBCDecrypter(block, k.IV).CryptBlocks(out, ct)
	if plainLen > len(out) {
		return nil, false
	}
	return out[:plainLen], true
}
