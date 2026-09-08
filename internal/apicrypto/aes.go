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
// dump (APIManager / FastAESCrypt).
var (
	Key = []byte("g2fcC0ZczN9MTJ61")
	IV  = []byte("msx3IV0i9XE5uYZ1")
)

var errBadBlock = errors.New("apicrypto: ciphertext not a multiple of the block size")

// Decrypt returns the PKCS#7-unpadded plaintext of an /api/* body.
//
// It tolerates trailing bytes that are not a whole block (some captures include
// a few stray bytes after the final block) by decrypting only the block-aligned
// prefix, which is what the game itself effectively does.
func Decrypt(body []byte) ([]byte, error) {
	block, err := aes.NewCipher(Key)
	if err != nil {
		return nil, err
	}
	n := len(body) - (len(body) % aes.BlockSize)
	if n == 0 {
		return nil, errBadBlock
	}
	out := make([]byte, n)
	cipher.NewCBCDecrypter(block, IV).CryptBlocks(out, body[:n])
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
