package mpjson

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"math"

	"github.com/vmihailenco/msgpack/v5"
	"github.com/vmihailenco/msgpack/v5/msgpcode"
)

// bytesReader is the reader type msgpack.Decoder wants.
func bytesReader(b []byte) *bytes.Reader { return bytes.NewReader(b) }

// decodeValue reads one value, peeking at the code so bin can be special-cased.
func decodeValue(dec *msgpack.Decoder) (any, error) {
	code, err := dec.PeekCode()
	if err != nil {
		return nil, err
	}
	switch {
	case msgpcode.IsBin(code):
		raw, err := dec.DecodeBytes()
		if err != nil {
			return nil, err
		}
		return renderBin(raw), nil
	default:
		// Let the library handle everything else, then normalise []byte (which
		// str8/str16/str32 never produce here, but ext might) to hex.
		v, err := dec.DecodeInterface()
		if err != nil {
			return nil, err
		}
		return normalise(v), nil
	}
}

// decodeMap keeps map keys as strings where possible and preserves int keys
// (Diarkis property maps are keyed by small ints).
func decodeMap(dec *msgpack.Decoder) (any, error) {
	n, err := dec.DecodeMapLen()
	if err != nil {
		return nil, err
	}
	out := make(map[string]any, n)
	for i := 0; i < n; i++ {
		k, err := dec.DecodeInterface()
		if err != nil {
			return nil, err
		}
		v, err := decodeValue(dec)
		if err != nil {
			return nil, err
		}
		out[keyString(k)] = v
	}
	return out, nil
}

// renderBin turns a bin blob into a readable value. Diarkis stores two kinds of
// bytes in bin fields: SyncData property blobs (type|BE32 len|data) and, inside
// those, nested MessagePack. Both are decoded here so a property surfaces as
// its real value (a player name, a number) instead of an opaque hex string;
// anything unrecognised falls back to hex, losing nothing.
func renderBin(raw []byte) any {
	if len(raw) == 0 {
		return ""
	}
	if v, ok := decodeSyncBlob(raw); ok {
		return v
	}
	if inner, n, err := DecodeAll(raw); err == nil && n == len(raw) && isCompound(inner) {
		return map[string]any{"__msgpack__": inner, "__hex__": hexStr(raw)}
	}
	return hexStr(raw)
}

// decodeSyncBlob decodes a Diarkis SyncData value: a 1-byte type, a big-endian
// uint32 length, then that many data bytes. Types: 1 byte, 2 int32, 4 UTF-8
// string, 7 nested MessagePack. It only claims the blob when the declared
// length matches exactly, which makes false positives on arbitrary bytes rare.
func decodeSyncBlob(raw []byte) (any, bool) {
	if len(raw) < 5 {
		return nil, false
	}
	t := raw[0]
	n := int(uint32(raw[1])<<24 | uint32(raw[2])<<16 | uint32(raw[3])<<8 | uint32(raw[4]))
	data := raw[5:]
	if n != len(data) {
		return nil, false
	}
	// SyncProperty type codes (CP.Realtime.SyncProperty): 1 byte, 2 int32,
	// 3 int64, 4 string, 5 float, 6 bool, 7 object (nested MessagePack). All
	// integers are big-endian on the wire.
	switch t {
	case 1: // byte
		if n == 1 {
			return map[string]any{"__sync__": "byte", "v": int(data[0])}, true
		}
	case 2: // int32
		if n == 4 {
			return map[string]any{"__sync__": "int32", "v": int32(binary.BigEndian.Uint32(data))}, true
		}
	case 3: // int64
		if n == 8 {
			return map[string]any{"__sync__": "int64", "v": int64(binary.BigEndian.Uint64(data))}, true
		}
	case 4: // string
		return map[string]any{"__sync__": "str", "v": string(data)}, true
	case 5: // float32
		if n == 4 {
			return map[string]any{"__sync__": "float", "v": math.Float32frombits(binary.BigEndian.Uint32(data))}, true
		}
	case 6: // bool
		if n == 1 {
			return map[string]any{"__sync__": "bool", "v": data[0] != 0}, true
		}
	case 7: // object: nested MessagePack
		if inner, m, err := DecodeAll(data); err == nil && m == len(data) {
			return map[string]any{"__sync__": "msgpack", "v": inner}, true
		}
	}
	return nil, false
}

// normalise walks a decoded value converting any []byte to hex.
func normalise(v any) any {
	switch t := v.(type) {
	case []byte:
		return renderBin(t)
	case []any:
		for i := range t {
			t[i] = normalise(t[i])
		}
		return t
	case map[string]any:
		for k := range t {
			t[k] = normalise(t[k])
		}
		return t
	case map[any]any:
		out := make(map[string]any, len(t))
		for k, val := range t {
			out[keyString(k)] = normalise(val)
		}
		return out
	default:
		return v
	}
}

func isCompound(v any) bool {
	switch v.(type) {
	case []any, map[string]any, map[any]any:
		return true
	}
	return false
}

func hexStr(b []byte) string { return hex.EncodeToString(b) }

func keyString(k any) string {
	switch t := k.(type) {
	case string:
		return t
	case []byte:
		return string(t)
	default:
		return toStr(t)
	}
}
