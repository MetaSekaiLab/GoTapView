package session

import (
	"encoding/hex"
	"path/filepath"
	"sort"
	"strings"

	"gotapview/internal/apicrypto"
	"gotapview/internal/diarkis"
	"gotapview/internal/httpx"
	"gotapview/internal/keyring"
	"gotapview/internal/mpjson"
	"gotapview/internal/tapfile"
)

// segment records where one DATA record's bytes landed in a reassembled stream,
// so a framed message's byte offset can be mapped back to a timeline position.
type segment struct {
	start  int
	seq    uint64
	tRelNs int64
	wallMs int64
}

type stream struct {
	buf  []byte
	segs []segment
}

func (s *stream) add(b []byte, seq uint64, tRelNs, wallMs int64) {
	s.segs = append(s.segs, segment{start: len(s.buf), seq: seq, tRelNs: tRelNs, wallMs: wallMs})
	s.buf = append(s.buf, b...)
}

// at returns the timeline position of a byte offset within the stream.
func (s *stream) at(off int) (seq uint64, tRelNs, wallMs int64) {
	// last segment whose start <= off
	i := sort.Search(len(s.segs), func(i int) bool { return s.segs[i].start > off }) - 1
	if i < 0 {
		i = 0
	}
	if len(s.segs) == 0 {
		return 0, 0, 0
	}
	sg := s.segs[i]
	return sg.seq, sg.tRelNs, sg.wallMs
}

type udpRec struct {
	seq    uint64
	tRelNs int64
	wallMs int64
	dir    uint8
	data   []byte
}

// Build reads a capture and returns the decoded, timeline-ordered Session.
func Build(path string) (*Session, error) {
	r, err := tapfile.Open(path)
	if err != nil {
		return nil, err
	}
	defer r.Close()

	hdr := r.Header()
	startedWall := hdr.WallNs / 1e6

	flows := map[uint32]*tapfile.FlowOpen{}
	streams := map[uint32]map[uint8]*stream{} // flowID -> dir -> stream
	udpByFlow := map[uint32][]udpRec{}
	packetCount := map[uint32]int{}
	var records int

	for {
		rec, err := r.Next()
		if err != nil {
			break
		}
		records++
		wallMs := (hdr.WallNs + rec.TRelNs) / 1e6
		switch rec.Type {
		case tapfile.TypeFlowOpen:
			fo, err := tapfile.ParseFlowOpen(rec.Payload)
			if err == nil {
				flows[rec.FlowID] = &fo
			}
		case tapfile.TypeData:
			packetCount[rec.FlowID]++
			fo := flows[rec.FlowID]
			if fo == nil {
				continue
			}
			if fo.Proto == tapfile.ProtoUDP {
				udpByFlow[rec.FlowID] = append(udpByFlow[rec.FlowID], udpRec{
					seq: rec.Seq, tRelNs: rec.TRelNs, wallMs: wallMs, dir: rec.Dir,
					data: append([]byte(nil), rec.Payload...),
				})
			} else if fo.Mode == tapfile.ModeTLSPlaintext {
				if streams[rec.FlowID] == nil {
					streams[rec.FlowID] = map[uint8]*stream{}
				}
				st := streams[rec.FlowID][rec.Dir]
				if st == nil {
					st = &stream{}
					streams[rec.FlowID][rec.Dir] = st
				}
				st.add(rec.Payload, rec.Seq, rec.TRelNs, wallMs)
			}
		}
	}

	sess := &Session{Meta: Meta{
		File: filepath.Base(path), StartedWall: startedWall,
		Records: records, Flows: len(flows), Truncated: r.Truncated(),
	}}

	// Flow summaries.
	var flowIDs []uint32
	for id := range flows {
		flowIDs = append(flowIDs, id)
	}
	sort.Slice(flowIDs, func(i, j int) bool { return flowIDs[i] < flowIDs[j] })
	for _, id := range flowIDs {
		fo := flows[id]
		sess.Flows = append(sess.Flows, Flow{
			ID: id, Proto: tapfile.ProtoName(fo.Proto), Mode: tapfile.ModeName(fo.Mode),
			Client: fo.Client, Remote: fo.Remote, SNI: fo.SNI, Packets: packetCount[id],
		})
	}

	// First pass over HTTP: decode exchanges and harvest Diarkis keys.
	var keys []diarkis.Key
	type pendingHTTP struct {
		ev Event
	}
	var httpEvents []Event

	for _, id := range flowIDs {
		fo := flows[id]
		if fo.Proto != tapfile.ProtoUDP && fo.Mode == tapfile.ModeTLSPlaintext {
			c2s := streams[id][tapfile.DirC2S]
			s2c := streams[id][tapfile.DirS2C]
			var reqs, resps []httpx.Message
			if c2s != nil {
				reqs = httpx.Split(c2s.buf, false)
			}
			if s2c != nil {
				resps = httpx.Split(s2c.buf, true)
			}
			for i, ex := range httpx.Pair(reqs, resps) {
				ev, k, hasKey := buildHTTPEvent(id, fo.Remote, ex, c2s, s2c, reqs, resps, i)
				httpEvents = append(httpEvents, ev)
				if hasKey {
					keys = append(keys, k)
				}
			}
		}
	}
	sess.Meta.DiarkisKeys = len(keys)

	// Second pass: decode UDP now that keys are known.
	var udpEvents []Event
	for _, id := range flowIDs {
		recs := udpByFlow[id]
		remote := ""
		if fo := flows[id]; fo != nil {
			remote = fo.Remote
		}

		// Only interpret a flow as Diarkis if it actually looks like it. A
		// capture also picks up unrelated UDP (NTP, DNS), and forcing the
		// Diarkis layout onto those invents a bogus wrapper and flag.
		if !looksLikeDiarkis(recs) {
			for _, u := range recs {
				udpEvents = append(udpEvents, Event{
					Seq: u.seq, TRelNs: u.tRelNs, WallMs: u.wallMs, Kind: "udp",
					FlowID: id, Remote: remote,
					UDP: &UDPEvent{Dir: dirName(u.dir), Other: &OtherUDP{
						Bytes: len(u.data), Hex: hex.EncodeToString(capBytes(u.data, 2048)),
					}},
				})
			}
			continue
		}

		// Oversized payloads are split across datagrams, and fragment ids are
		// only unique per direction, so each direction reassembles separately.
		ra := map[uint8]*diarkis.Reassembler{
			tapfile.DirC2S: diarkis.NewReassembler(),
			tapfile.DirS2C: diarkis.NewReassembler(),
		}
		for _, u := range recs {
			dirS2C := u.dir == tapfile.DirS2C
			for _, dg := range diarkis.SplitDatagrams(u.data, dirS2C) {
				d := diarkis.Decode(dg, dirS2C, keys, ra[u.dir])
				udpEvents = append(udpEvents, Event{
					Seq: u.seq, TRelNs: u.tRelNs, WallMs: u.wallMs, Kind: "udp",
					FlowID: id, Remote: remote,
					UDP: &UDPEvent{Dir: dirName(u.dir), Data: &d},
				})
			}
		}
	}

	sess.Meta.HTTPEvents = len(httpEvents)
	sess.Meta.UDPEvents = len(udpEvents)

	all := append(httpEvents, udpEvents...)
	sort.SliceStable(all, func(i, j int) bool {
		if all[i].Seq != all[j].Seq {
			return all[i].Seq < all[j].Seq
		}
		return all[i].Kind < all[j].Kind
	})
	sess.Events = all
	_ = pendingHTTP{}
	return sess, nil
}

// looksLikeDiarkis reports whether a UDP flow carries Diarkis traffic, judged
// by any datagram containing a frame or a split-fragment marker.
func looksLikeDiarkis(recs []udpRec) bool {
	for _, u := range recs {
		if len(u.data) < 5 {
			continue
		}
		body := u.data[4:]
		if diarkis.HasFrameMagic(body) || diarkis.IsSplitChunk(body) {
			return true
		}
	}
	return false
}

func dirName(d uint8) string {
	if d == tapfile.DirS2C {
		return "s2c"
	}
	return "c2s"
}

// buildHTTPEvent decodes one request/response pair into a timeline Event and,
// if it is a diarkis-auth response, extracts the session key.
func buildHTTPEvent(flowID uint32, remote string, ex httpx.Exchange, c2s, s2c *stream, reqs, resps []httpx.Message, idx int) (Event, diarkis.Key, bool) {
	h := &HTTPEvent{}
	var seq uint64
	var tRelNs, wallMs int64

	if ex.Request != nil {
		method, path := httpx.RequestLine(ex.Request.StartLine)
		h.Method, h.Path = method, path
		h.ReqHeaders = ex.Request.Headers
		if c2s != nil {
			seq, tRelNs, wallMs = c2s.at(ex.Request.StartOffset)
		}
		decodeBody(ex.Request, &h.ReqJSON, &h.ReqBodyText, &h.ReqBodyHex)
		if keyring.IsDiarkisAuthPath(path) {
			h.Note = "diarkis-auth"
		}
	}
	var key diarkis.Key
	var hasKey bool
	if ex.Response != nil {
		h.Status = httpx.StatusCode(ex.Response.StartLine)
		h.RespHeaders = ex.Response.Headers
		decodeBody(ex.Response, &h.RespJSON, &h.RespBodyText, &h.RespBodyHex)
		if seq == 0 && s2c != nil {
			seq, tRelNs, wallMs = s2c.at(ex.Response.StartOffset)
		}
		if h.Note == "diarkis-auth" {
			if k, ok := keyring.FromDiarkisAuth(h.RespJSON); ok {
				key, hasKey = k, true
			}
		}
	}

	return Event{
		Seq: seq, TRelNs: tRelNs, WallMs: wallMs, Kind: "http",
		FlowID: flowID, Remote: remote, HTTP: h,
	}, key, hasKey
}

// decodeBody decrypts (if octet-stream) and MessagePack-decodes a body, or
// falls back to preserving text/hex so nothing is lost.
func decodeBody(m *httpx.Message, jsonOut *any, textOut, hexOut *string) {
	if len(m.Body) == 0 {
		return
	}
	ct := m.Header("content-type")
	body := m.Body
	if strings.Contains(ct, "octet-stream") {
		// The game rotated its API-body key/iv in 6.4.0 and uses a second pair
		// for AssetBundle-info. Try every known pair against the original
		// ciphertext and keep the one whose plaintext fully MessagePack-decodes,
		// so captures from any game version (and both body kinds) are readable.
		var fallback []byte
		for _, kp := range apicrypto.Candidates {
			dec, err := apicrypto.DecryptWith(body, kp.Key, kp.IV)
			if err != nil {
				continue
			}
			if v, n, e := mpjson.DecodeAll(dec); e == nil && n == len(dec) {
				*jsonOut = v
				return
			}
			if fallback == nil {
				fallback = dec // first plausible decrypt, for the text/hex fallback
			}
		}
		if fallback != nil {
			body = fallback
		}
	}
	if v, n, err := mpjson.DecodeAll(body); err == nil && n == len(body) {
		*jsonOut = v
		return
	}
	if isText(body) {
		*textOut = string(body)
		return
	}
	*hexOut = hex.EncodeToString(capBytes(body, 4096))
}

func isText(b []byte) bool {
	if len(b) == 0 {
		return false
	}
	ok := 0
	for _, c := range b {
		if c == '\n' || c == '\r' || c == '\t' || (c >= 0x20 && c < 0x7f) {
			ok++
		}
	}
	return ok*10 >= len(b)*9
}

func capBytes(b []byte, n int) []byte {
	if len(b) > n {
		return b[:n]
	}
	return b
}
