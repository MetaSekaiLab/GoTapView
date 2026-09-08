// Package keyring discovers Diarkis session keys from decrypted HTTP traffic.
//
// The game fetches per-session UDP keys from GET /api/user/{id}/diarkis-auth,
// whose decrypted response carries sid/encryptionKey/encryptionIv/
// encryptionMacKey. Collecting every such response lets the UDP decoder try
// each key set against each frame (the HMAC identifies which one fits), which
// is what makes traffic on a migrated server decryptable too.
package keyring

import (
	"encoding/hex"
	"strings"

	"gotapview/internal/diarkis"
)

// FromDiarkisAuth extracts a key set from a decrypted diarkis-auth response
// body (already MessagePack-decoded to a map). Returns ok=false if the fields
// are absent.
func FromDiarkisAuth(respJSON any) (diarkis.Key, bool) {
	m, ok := respJSON.(map[string]any)
	if !ok {
		return diarkis.Key{}, false
	}
	sid, e1 := hexOrRawField(m, "sid")
	key, e2 := hexField(m, "encryptionKey")
	iv, e3 := hexField(m, "encryptionIv")
	mac, e4 := hexField(m, "encryptionMacKey")
	if !e1 || !e2 || !e3 || !e4 {
		return diarkis.Key{}, false
	}
	return diarkis.Key{SID: sid, Key: key, IV: iv, MacKey: mac}, true
}

// IsDiarkisAuthPath reports whether a request path is a diarkis-auth call.
func IsDiarkisAuthPath(path string) bool {
	return strings.Contains(path, "/diarkis-auth")
}

func hexField(m map[string]any, k string) ([]byte, bool) {
	s, ok := m[k].(string)
	if !ok {
		return nil, false
	}
	b, err := hex.DecodeString(s)
	if err != nil {
		return nil, false
	}
	return b, true
}

// hexOrRawField accepts the sid either as hex (its usual form) or, defensively,
// as raw bytes if it ever arrives non-hex.
func hexOrRawField(m map[string]any, k string) ([]byte, bool) {
	s, ok := m[k].(string)
	if !ok {
		return nil, false
	}
	if b, err := hex.DecodeString(s); err == nil {
		return b, true
	}
	return []byte(s), true
}
