package diarkis

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"testing"
)

func padLenT(n int) int {
	m := n
	if n > 15 {
		m = n & 0xf
	}
	return n + (16 - m)
}

// seal builds a client->server secure frame the way the game client would, so
// the decoder can be tested without a real capture.
func seal(t *testing.T, k Key, ver uint8, cmd uint16, plain []byte) []byte {
	t.Helper()
	ct := make([]byte, padLenT(len(plain)))
	copy(ct, plain)
	blk, _ := aes.NewCipher(k.Key)
	cipher.NewCBCEncrypter(blk, k.IV).CryptBlocks(ct, ct)
	mac := hmac.New(sha256.New, k.MacKey)
	mac.Write(ct)

	sealed := make([]byte, 4+32+len(ct))
	binary.BigEndian.PutUint32(sealed[0:4], uint32(len(plain)))
	copy(sealed[4:36], mac.Sum(nil))
	copy(sealed[36:], ct)

	secure := append(append([]byte(nil), k.SID...), sealed...)

	frame := make([]byte, 10+len(secure))
	frame[0], frame[1], frame[2], frame[3] = 0xFE, 0xBE, 0xDE, 0xEF
	binary.BigEndian.PutUint32(frame[4:8], uint32(len(secure)))
	frame[4] = ver
	binary.BigEndian.PutUint16(frame[8:10], cmd)
	copy(frame[10:], secure)

	dg := make([]byte, 4+len(frame))
	binary.LittleEndian.PutUint32(dg[0:4], 7)
	dg[3] = 3 // DAT
	copy(dg[4:], frame)
	return dg
}

func testKey() Key {
	return Key{
		SID:    []byte("0123456789abcdef"),
		Key:    []byte("keykeykeykeykey!"),
		IV:     []byte("iviviviviviviviv"),
		MacKey: []byte("macmacmacmacmac!"),
	}
}

func TestDecodeSecureFrame(t *testing.T) {
	k := testKey()
	// a client-key transport frame (ver=0 cmd=4)
	dg := seal(t, k, 0, 4, []byte("788aebb0-a457-4704"))
	d := Decode(dg, false, []Key{k})
	if d.Frame == nil || !d.Frame.Recognized {
		t.Fatalf("frame not recognized: %+v", d)
	}
	if d.Flag != "DAT" || d.WrapSeq != 7 {
		t.Errorf("wrapper: flag=%s seq=%d", d.Flag, d.WrapSeq)
	}
	m, ok := d.Frame.Decoded.(map[string]any)
	if !ok || m["kind"] != "clientKey" || m["value"] != "788aebb0-a457-4704" {
		t.Errorf("decoded = %#v", d.Frame.Decoded)
	}
}

func TestWrongKeyPreservesRaw(t *testing.T) {
	k := testKey()
	dg := seal(t, k, 2, 3000, []byte("secret"))
	other := testKey()
	other.MacKey = []byte("DIFFERENTmackey!")
	d := Decode(dg, false, []Key{other})
	if d.Frame == nil {
		t.Fatal("frame header should still parse")
	}
	if d.Frame.Recognized {
		t.Error("should not decode with the wrong key")
	}
	if d.Frame.RawPayload == "" {
		t.Error("undecodable payload must be preserved as raw hex")
	}
	// ver/cmd are still readable even without the key
	if d.Frame.Ver != 2 || d.Frame.Cmd != 3000 {
		t.Errorf("header lost: ver=%d cmd=%d", d.Frame.Ver, d.Frame.Cmd)
	}
}

func TestControlDatagramKeepsSID(t *testing.T) {
	// a bare SYN: wrapper + 16-byte sid, no frame
	dg := make([]byte, 4+16)
	dg[3] = 2 // SYN
	copy(dg[4:], []byte("0123456789abcdef"))
	d := Decode(dg, false, nil)
	if d.Flag != "SYN" || d.Frame != nil {
		t.Fatalf("expected bare SYN, got %+v", d)
	}
	if d.Raw == "" {
		t.Error("sid bytes must be preserved in Raw")
	}
}

func TestSplitCoalescedACKs(t *testing.T) {
	// three 20-byte ACK units in one datagram
	var buf []byte
	for i := 0; i < 3; i++ {
		u := make([]byte, 20)
		u[0] = byte(i)
		u[3] = 4 // ACK
		copy(u[4:], []byte("0123456789abcdef"))
		buf = append(buf, u...)
	}
	units := SplitDatagrams(buf, false)
	if len(units) != 3 {
		t.Fatalf("split into %d, want 3", len(units))
	}
}
