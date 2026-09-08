// Package mpjson decodes MessagePack into JSON-friendly Go values.
//
// Two behaviours matter for a capture viewer and are not what a stock decoder
// gives you:
//
//   - MessagePack bin values (used by Diarkis SyncData blobs) become raw bytes,
//     which json.Marshal would base64-encode into something unreadable. Here a
//     bin value is rendered as an uppercase hex string instead.
//   - A bin value that is itself valid MessagePack is decoded one level deeper,
//     since Diarkis nests msgpack inside property blobs.
package mpjson

import (
	"github.com/vmihailenco/msgpack/v5"
)

// Decode turns a MessagePack document into a JSON-marshalable value. It returns
// an error only when the top-level bytes are not valid MessagePack.
func Decode(b []byte) (any, error) {
	dec := msgpack.NewDecoder(nil)
	dec.Reset(bytesReader(b))
	dec.SetMapDecoder(decodeMap)
	v, err := decodeValue(dec)
	if err != nil {
		return nil, err
	}
	return v, nil
}

// DecodeAll is like Decode but tolerates trailing bytes, returning the first
// value and how many bytes it consumed. Useful for streams that concatenate
// documents.
func DecodeAll(b []byte) (any, int, error) {
	r := bytesReader(b)
	dec := msgpack.NewDecoder(r)
	dec.SetMapDecoder(decodeMap)
	v, err := decodeValue(dec)
	if err != nil {
		return nil, 0, err
	}
	return v, len(b) - r.Len(), nil
}
