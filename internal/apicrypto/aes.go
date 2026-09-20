// Package apicrypto decrypts Project Sekai game-API bodies.
//
// The /api/* endpoints carry MessagePack encrypted with AES-128-CBC + PKCS#7
// under a static key/iv recovered from the game binary. This is distinct from
// the Diarkis UDP scheme (that one is per-session and adds an HMAC); see
// internal/diarkis.
package apicrypto

import (
	"crypto/aes"
	"crypto/cipher"
	"errors"
)

// Static key material for the mkcn-prod game API, recovered from the il2cpp
// dump (APIManager / FastAESCrypt). Both request and response bodies are plain
// AES-128-CBC + PKCS#7 over MessagePack; there is no per-message envelope.
//
// ★6.4.0 rotated the API-body key/iv. Verified on a live 6.4.0 capture: both the
// auth request ({accessToken}) and response ({userId, sessionToken}) decrypt
// with the 6.4.0 pair, and 107/111 responses + every non-empty request body in
// that capture decode cleanly. The old 6.0.0 pair was kept for AssetBundle-info
// (APIManager.abdummydata/abstab). To read captures from either game version,
// callers try every pair in Candidates and keep the one that MessagePack-decodes.
var (
	Key = []byte("PFSeUG9v6MpohZKO") // 6.4.0 APIManager.dummydata
	IV  = []byte("rJn6VC6vJhEX2xLO") // 6.4.0 APIManager.stab

	// ABKey/ABIV: 6.4.0 AssetBundle-info (APIManager.abdummydata/abstab); this is
	// also the 6.0.0 /api/* body pair, so it doubles as the 6.0.0 fallback.
	ABKey = []byte("g2fcC0ZczN9MTJ61")
	ABIV  = []byte("msx3IV0i9XE5uYZ1")
)

// KeyPair is one named AES-128-CBC key/iv candidate.
type KeyPair struct {
	Name string
	Key  []byte
	IV   []byte
}

// Candidates are tried in order when decoding a body; the first whose plaintext
// fully MessagePack-decodes wins. Listing both versions makes the reader
// version-agnostic across the 6.4.0 key rotation.
var Candidates = []KeyPair{
	{"api-6.4.0", Key, IV},
	{"api-6.0.0/ab", ABKey, ABIV},
}

var errBadBlock = errors.New("apicrypto: ciphertext not a multiple of the block size")

// Decrypt returns the PKCS#7-unpadded plaintext of an /api/* body using the
// primary (Crypt) key pair.
//
// It tolerates trailing bytes that are not a whole block (some captures include
// a few stray bytes after the final block) by decrypting only the block-aligned
// prefix, which is what the game itself effectively does.
func Decrypt(body []byte) ([]byte, error) {
	return DecryptWith(body, Key, IV)
}

// DecryptAB decrypts an AssetBundle-info body using the ABCrypt key pair. Since
// 6.4.0 the game uses a second key pair for AssetBundle-info responses; callers
// that cannot tell the two apart should try Decrypt first and fall back here.
func DecryptAB(body []byte) ([]byte, error) {
	return DecryptWith(body, ABKey, ABIV)
}

// DecryptWith decrypts an AES-128-CBC/PKCS#7 body under an explicit key/iv.
func DecryptWith(body, key, iv []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	n := len(body) - (len(body) % aes.BlockSize)
	if n == 0 {
		return nil, errBadBlock
	}
	out := make([]byte, n)
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(out, body[:n])
	return unpadPKCS7(out), nil
}

// unpadPKCS7 strips PKCS#7 padding, leaving the buffer untouched if the padding
// byte is out of range (so a mis-decrypt still yields inspectable bytes).
func unpadPKCS7(b []byte) []byte {
	if len(b) == 0 {
		return b
	}
	pad := int(b[len(b)-1])
	if pad < 1 || pad > aes.BlockSize || pad > len(b) {
		return b
	}
	for _, c := range b[len(b)-pad:] {
		if int(c) != pad {
			return b // not valid padding; return as-is
		}
	}
	return b[:len(b)-pad]
}
