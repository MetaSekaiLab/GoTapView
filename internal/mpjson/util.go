package mpjson

import "fmt"

// toStr renders a scalar map key. MessagePack integer keys arrive in whatever
// width the encoder chose (int8..int64, uint8..uint64), so fmt.Sprint is used
// rather than a type switch that would miss a width and fall through to "?".
func toStr(v any) string {
	switch v.(type) {
	case nil:
		return "null"
	case string:
		return v.(string)
	default:
		return fmt.Sprint(v)
	}
}
