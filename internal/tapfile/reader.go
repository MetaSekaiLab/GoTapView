// Package tapfile is a read-only reader for the GoTapline .tap capture format.
//
// The format is specified in the GoTapline repository's FORMAT.md. This is an
// independent re-implementation of the reader half so GoTapView does not depend
// on that repository: a 48-byte header followed by length-prefixed,
// CRC32C-checked records, little-endian throughout.
package tapfile

import (
	"bufio"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"io"
	"os"
	"time"
)

// Magic identifies a capture file.
var Magic = [8]byte{'G', 'O', 'T', 'A', 'P', 'L', 'N', 0x00}

const (
	headerLen   = 48
	recFixedLen = 32 // recLen(4) seq(8) tRelNs(8) type(1) dir(1) flags(2) flowID(4) payLen(4)
	crcLen      = 4
	maxPayload  = 64 << 20
)

// Record types.
const (
	TypeFlowOpen  uint8 = 1
	TypeData      uint8 = 2
	TypeFlowClose uint8 = 3
	TypeMeta      uint8 = 4
)

// Directions.
const (
	DirC2S  uint8 = 0
	DirS2C  uint8 = 1
	DirNone uint8 = 2
)

// Flow protocols and modes, carried in a FlowOpen payload.
const (
	ProtoTCP uint8 = 1
	ProtoUDP uint8 = 2

	ModeRaw          uint8 = 1
	ModeTLSPlaintext uint8 = 2
	ModeTLSOpaque    uint8 = 3
)

var crcTable = crc32.MakeTable(crc32.Castagnoli)

// Header is the file preamble.
type Header struct {
	Version uint16
	Flags   uint32
	WallNs  int64
	MonoNs  int64
	PID     uint32
}

// Record is one entry.
type Record struct {
	Seq     uint64
	TRelNs  int64
	Type    uint8
	Dir     uint8
	Flags   uint16
	FlowID  uint32
	Payload []byte
}

// FlowOpen is the decoded payload of a TypeFlowOpen record.
type FlowOpen struct {
	Proto  uint8
	Mode   uint8
	Client string
	Remote string
	SNI    string
}

// Errors.
var (
	ErrBadMagic    = errors.New("tapfile: bad magic")
	ErrBadVersion  = errors.New("tapfile: unsupported version")
	ErrShortHeader = errors.New("tapfile: truncated header")
	ErrMalformed   = errors.New("tapfile: malformed flow-open payload")
)

// Reader walks the records of a capture.
type Reader struct {
	br        *bufio.Reader
	c         io.Closer
	hdr       Header
	truncated bool
}

// Open opens a capture file.
func Open(path string) (*Reader, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	r, err := NewReader(f)
	if err != nil {
		f.Close()
		return nil, err
	}
	r.c = f
	return r, nil
}

// NewReader reads the header from r.
func NewReader(r io.Reader) (*Reader, error) {
	br := bufio.NewReaderSize(r, 1<<20)
	raw := make([]byte, headerLen)
	if _, err := io.ReadFull(br, raw); err != nil {
		return nil, ErrShortHeader
	}
	if string(raw[0:8]) != string(Magic[:]) {
		return nil, ErrBadMagic
	}
	h := Header{
		Version: binary.LittleEndian.Uint16(raw[8:10]),
		Flags:   binary.LittleEndian.Uint32(raw[12:16]),
		WallNs:  int64(binary.LittleEndian.Uint64(raw[16:24])),
		MonoNs:  int64(binary.LittleEndian.Uint64(raw[24:32])),
		PID:     binary.LittleEndian.Uint32(raw[32:36]),
	}
	if h.Version != 1 {
		return nil, ErrBadVersion
	}
	hl := int(binary.LittleEndian.Uint16(raw[10:12]))
	if hl > headerLen {
		if _, err := br.Discard(hl - headerLen); err != nil {
			return nil, ErrShortHeader
		}
	}
	return &Reader{br: br, hdr: h}, nil
}

// Close releases the file if this Reader owns one.
func (r *Reader) Close() error {
	if r.c != nil {
		return r.c.Close()
	}
	return nil
}

// Header returns the file header.
func (r *Reader) Header() Header { return r.hdr }

// Truncated reports whether iteration stopped on a partial or corrupt record.
func (r *Reader) Truncated() bool { return r.truncated }

// WallTime converts a record's monotonic offset to absolute time.
func (r *Reader) WallTime(rec Record) time.Time {
	return time.Unix(0, r.hdr.WallNs).Add(time.Duration(rec.TRelNs))
}

// Next returns the next record, or io.EOF at a clean or truncated end.
func (r *Reader) Next() (Record, error) {
	var rec Record
	var lenBuf [4]byte
	if _, err := io.ReadFull(r.br, lenBuf[:]); err != nil {
		if !errors.Is(err, io.EOF) {
			r.truncated = true
		}
		return rec, io.EOF
	}
	recLen := int(binary.LittleEndian.Uint32(lenBuf[:]))
	minLen := recFixedLen - 4 + crcLen
	if recLen < minLen || recLen > maxPayload+minLen {
		r.truncated = true
		return rec, io.EOF
	}
	body := make([]byte, recLen)
	if _, err := io.ReadFull(r.br, body); err != nil {
		r.truncated = true
		return rec, io.EOF
	}
	want := binary.LittleEndian.Uint32(body[recLen-crcLen:])
	h := crc32.New(crcTable)
	h.Write(lenBuf[:])
	h.Write(body[:recLen-crcLen])
	if h.Sum32() != want {
		r.truncated = true
		return rec, io.EOF
	}
	rec.Seq = binary.LittleEndian.Uint64(body[0:8])
	rec.TRelNs = int64(binary.LittleEndian.Uint64(body[8:16]))
	rec.Type = body[16]
	rec.Dir = body[17]
	rec.Flags = binary.LittleEndian.Uint16(body[18:20])
	rec.FlowID = binary.LittleEndian.Uint32(body[20:24])
	payLen := int(binary.LittleEndian.Uint32(body[24:28]))
	if payLen != recLen-minLen {
		r.truncated = true
		return rec, io.EOF
	}
	if payLen > 0 {
		rec.Payload = body[28 : 28+payLen]
	}
	return rec, nil
}

// ParseFlowOpen decodes a FlowOpen payload.
func ParseFlowOpen(b []byte) (FlowOpen, error) {
	var f FlowOpen
	if len(b) < 3 {
		return f, ErrMalformed
	}
	f.Proto, f.Mode = b[0], b[1]
	i := 2
	take8 := func() (string, bool) {
		if i >= len(b) {
			return "", false
		}
		n := int(b[i])
		i++
		if i+n > len(b) {
			return "", false
		}
		s := string(b[i : i+n])
		i += n
		return s, true
	}
	var ok bool
	if f.Client, ok = take8(); !ok {
		return f, ErrMalformed
	}
	if f.Remote, ok = take8(); !ok {
		return f, ErrMalformed
	}
	if i+2 > len(b) {
		return f, ErrMalformed
	}
	n := int(binary.LittleEndian.Uint16(b[i : i+2]))
	i += 2
	if i+n > len(b) {
		return f, ErrMalformed
	}
	f.SNI = string(b[i : i+n])
	return f, nil
}

// ProtoName / ModeName render constants for display.
func ProtoName(p uint8) string {
	switch p {
	case ProtoTCP:
		return "tcp"
	case ProtoUDP:
		return "udp"
	}
	return "proto?"
}

// ModeName renders a capture mode.
func ModeName(m uint8) string {
	switch m {
	case ModeRaw:
		return "raw"
	case ModeTLSPlaintext:
		return "tls-plaintext"
	case ModeTLSOpaque:
		return "tls-opaque"
	}
	return "mode?"
}
