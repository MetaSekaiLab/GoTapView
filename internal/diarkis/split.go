package diarkis

import "encoding/binary"

// splitMagic marks a fragment of a payload too large for one datagram
// (Diarkis.Lib.SplitPacket). Layout, recovered from captured traffic:
//
//	FF FE FD FC | id u16 BE | index u16 BE | count u16 BE | chunk (<= 1300 bytes)
//
// Chunks share an id, are ordered by index, and the payload is complete once
// count of them have arrived. Reassembled, the result is an ordinary Diarkis
// frame beginning with the frame magic.
var splitMagic = [4]byte{0xFF, 0xFE, 0xFD, 0xFC}

const splitHeaderLen = 10

// IsSplitChunk reports whether a wrapper body is a split fragment.
func IsSplitChunk(body []byte) bool {
	return len(body) >= splitHeaderLen &&
		body[0] == splitMagic[0] && body[1] == splitMagic[1] &&
		body[2] == splitMagic[2] && body[3] == splitMagic[3]
}

// SplitChunk describes one fragment.
type SplitChunk struct {
	ID    uint16
	Index uint16
	Count uint16
	Data  []byte
}

// ParseSplitChunk decodes a fragment header.
func ParseSplitChunk(body []byte) (SplitChunk, bool) {
	if !IsSplitChunk(body) {
		return SplitChunk{}, false
	}
	return SplitChunk{
		ID:    binary.BigEndian.Uint16(body[4:6]),
		Index: binary.BigEndian.Uint16(body[6:8]),
		Count: binary.BigEndian.Uint16(body[8:10]),
		Data:  body[splitHeaderLen:],
	}, true
}

// Reassembler collects split fragments until a payload is whole.
//
// One instance belongs to one flow and direction, since ids are only unique
// within a stream. Fragments can arrive out of order, so they are held by index
// and joined once all of them are present.
type Reassembler struct {
	pending map[uint16]*pendingSplit
}

type pendingSplit struct {
	count uint16
	parts map[uint16][]byte
}

// NewReassembler creates an empty reassembler.
func NewReassembler() *Reassembler {
	return &Reassembler{pending: map[uint16]*pendingSplit{}}
}

// Feed adds a fragment. It returns the reassembled payload once the last
// fragment of a set arrives, and nil while the set is still incomplete.
func (r *Reassembler) Feed(c SplitChunk) []byte {
	if c.Count == 0 {
		return nil
	}
	p := r.pending[c.ID]
	if p == nil || p.count != c.Count {
		p = &pendingSplit{count: c.Count, parts: map[uint16][]byte{}}
		r.pending[c.ID] = p
	}
	if _, seen := p.parts[c.Index]; !seen {
		p.parts[c.Index] = append([]byte(nil), c.Data...)
	}
	if len(p.parts) < int(p.count) {
		return nil
	}
	var out []byte
	for i := uint16(0); i < p.count; i++ {
		part, ok := p.parts[i]
		if !ok {
			return nil // a gap: keep waiting rather than emit a corrupt payload
		}
		out = append(out, part...)
	}
	delete(r.pending, c.ID)
	return out
}

// Pending reports how many incomplete fragment sets are still held, which shows
// up as truncated traffic at the end of a capture.
func (r *Reassembler) Pending() int { return len(r.pending) }
