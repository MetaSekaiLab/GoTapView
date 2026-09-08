package diarkis

import (
	"encoding/binary"
	"encoding/hex"

	"gotapview/internal/mpjson"
)

const pushStatus = 255

// game message ids seen on Room broadcasts (ver=1 cmd=103), from CAPTURE_ANALYSIS.md.
var msgIDName = map[int64]string{
	1000: "countdown",
	1002: "progress",
	2000: "score-sync",
	2001: "ranking",
	2002: "player-state",
}

// decodeFramePayload fills fr.Decoded / fr.Recognized / fr.RawPayload.
//
// The strategy is layered and lossless: unseal, then unwrap a push list, then
// interpret by (ver,cmd), and at each step keep the raw hex of anything left
// undecoded so a partially understood frame still surfaces what was decoded.
func decodeFramePayload(fr *Frame, payload []byte, dirS2C bool, keys []Key) {
	plain, ok := tryUnseal(payload, dirS2C, keys)
	if !ok {
		// Could not decrypt (unknown key, or a plaintext control frame). Keep
		// the ver/cmd/status we already parsed and preserve the bytes.
		fr.RawPayload = hex.EncodeToString(payload)
		return
	}

	// Server pushes wrap the body in a BytesList (BE32 len || chunk)*.
	isPush := fr.Status != nil && *fr.Status == pushStatus
	if isPush {
		if chunks, okList := bytesList(plain); okList {
			decoded := make([]any, 0, len(chunks))
			for _, c := range chunks {
				decoded = append(decoded, interpret(fr, c, dirS2C))
			}
			fr.Recognized = true
			if len(decoded) == 1 {
				fr.Decoded = decoded[0]
			} else {
				fr.Decoded = decoded
			}
			return
		}
	}

	fr.Decoded = interpret(fr, plain, dirS2C)
	fr.Recognized = fr.Decoded != nil
	if !fr.Recognized {
		fr.RawPayload = hex.EncodeToString(plain)
	}
}

// tryUnseal attempts each key, then falls back to treating the payload as
// already-plaintext (some transport frames are unencrypted).
func tryUnseal(payload []byte, dirS2C bool, keys []Key) ([]byte, bool) {
	for _, k := range keys {
		if pt, ok := unseal(payload, dirS2C, k); ok {
			return pt, true
		}
	}
	return nil, false
}

// interpret turns one plaintext frame body into a structured value keyed on
// (ver,cmd). It returns nil when the shape is unknown, so the caller preserves
// the raw bytes.
func interpret(fr *Frame, body []byte, dirS2C bool) any {
	// ver=1 cmd=103: Room broadcast. C2S is 1-byte reliable flag + 52-byte
	// RoomID + msgpack; S2C chunks are bare msgpack [msgId, sender, data].
	if fr.Ver == 1 && fr.Cmd == 103 {
		return decodeBroadcast(body, dirS2C)
	}
	// ver=0: transport frames carry short ASCII/marker bodies.
	if fr.Ver == 0 {
		return decodeTransport(fr.Cmd, body)
	}
	// Everything else (Sekai ver=2 game commands, room properties) is msgpack.
	if v, n, err := mpjson.DecodeAll(body); err == nil && n == len(body) {
		return v
	}
	return nil
}

// decodeBroadcast handles Room broadcast bodies.
func decodeBroadcast(body []byte, dirS2C bool) any {
	inner := body
	out := map[string]any{}
	if !dirS2C {
		if len(body) < 1+52 {
			return nil
		}
		out["reliable"] = body[0] == 1
		out["roomId"] = string(trimNul(body[1:53]))
		inner = body[53:]
	}
	v, n, err := mpjson.DecodeAll(inner)
	if err != nil || n != len(inner) {
		return nil
	}
	arr, ok := v.([]any)
	if !ok || len(arr) < 3 {
		out["message"] = v
		return out
	}
	msgID, _ := toInt(arr[0])
	out["msgId"] = arr[0]
	if name := msgIDName[msgID]; name != "" {
		out["msgType"] = name
	}
	out["sender"] = arr[1]
	// the third element is itself msgpack bytes
	out["data"] = decodeInnerData(arr[2])
	return out
}

// decodeInnerData decodes the broadcast data element, which arrives as a hex
// string (bin) that is itself msgpack.
func decodeInnerData(v any) any {
	switch t := v.(type) {
	case string:
		if raw, err := hex.DecodeString(t); err == nil {
			if inner, n, err := mpjson.DecodeAll(raw); err == nil && n == len(raw) {
				return inner
			}
		}
		return t
	case map[string]any:
		// already rendered as {__msgpack__, __hex__}
		if inner, ok := t["__msgpack__"]; ok {
			return inner
		}
		return t
	default:
		return v
	}
}

// decodeTransport handles ver=0 transport commands.
func decodeTransport(cmd uint16, body []byte) any {
	switch cmd {
	case 1: // echo: float64 timestamp + BE32-length "ip:port"
		m := map[string]any{"kind": "echo"}
		if len(body) >= 12 {
			// leading byte may be a status prefix on S2C; try both offsets
			for _, off := range []int{0, 1} {
				if len(body) >= off+12 {
					n := int(binary.BigEndian.Uint32(body[off+8 : off+12]))
					if off+12+n <= len(body) && n < 64 {
						m["addr"] = string(body[off+12 : off+12+n])
						break
					}
				}
			}
		}
		return m
	case 2: // reconnect/migrate: BE EF FE ED + "host:port"
		if len(body) > 4 && body[0] == 0xBE && body[1] == 0xEF && body[2] == 0xFE && body[3] == 0xED {
			return map[string]any{"kind": "migrate", "target": string(body[4:])}
		}
	case 4: // client key
		return map[string]any{"kind": "clientKey", "value": string(body)}
	}
	if isPrintable(body) {
		return map[string]any{"kind": "text", "value": string(body)}
	}
	return nil
}

// bytesList splits a Diarkis BytesListToBytes payload (BE32 len || chunk)*.
func bytesList(b []byte) ([][]byte, bool) {
	var out [][]byte
	i := 0
	for i+4 <= len(b) {
		n := int(binary.BigEndian.Uint32(b[i : i+4]))
		i += 4
		if n < 0 || i+n > len(b) {
			return nil, false
		}
		out = append(out, b[i:i+n])
		i += n
	}
	if i != len(b) || len(out) == 0 {
		return nil, false
	}
	return out, true
}

func trimNul(b []byte) []byte {
	for i, c := range b {
		if c == 0 {
			return b[:i]
		}
	}
	return b
}

func toInt(v any) (int64, bool) {
	switch t := v.(type) {
	case int64:
		return t, true
	case uint64:
		return int64(t), true
	case int:
		return int64(t), true
	case float64:
		return int64(t), true
	}
	return 0, false
}

func isPrintable(b []byte) bool {
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
