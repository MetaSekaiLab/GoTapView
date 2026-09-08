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
	d := Decode(dg, false, []Key{k}, NewReassembler())
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
	d := Decode(dg, false, []Key{other}, NewReassembler())
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
	d := Decode(dg, false, nil, NewReassembler())
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

// TestSplitReassembly covers an oversized payload arriving as fragments,
// including out-of-order delivery.
func TestSplitReassembly(t *testing.T) {
	k := testKey()
	// a real MessagePack body, since ver=2 payloads are decoded as MessagePack:
	// {"RoomID": "abc", "Index": 1}
	payload := []byte{
		0x82,
		0xa6, 'R', 'o', 'o', 'm', 'I', 'D', 0xa3, 'a', 'b', 'c',
		0xa5, 'I', 'n', 'd', 'e', 'x', 0x01,
	}
	full := seal(t, k, 2, 3001, payload)
	frame := full[4:] // drop the RUDP wrapper; fragments carry the frame

	mid := len(frame) / 2
	mk := func(idx uint16, chunk []byte) []byte {
		dg := make([]byte, 4+10+len(chunk))
		dg[3] = 3 // DAT
		copy(dg[4:8], []byte{0xFF, 0xFE, 0xFD, 0xFC})
		binary.BigEndian.PutUint16(dg[8:10], 7) // id
		binary.BigEndian.PutUint16(dg[10:12], idx)
		binary.BigEndian.PutUint16(dg[12:14], 2) // count
		copy(dg[14:], chunk)
		return dg
	}

	ra := NewReassembler()
	// deliver the second fragment first
	d1 := Decode(mk(1, frame[mid:]), false, []Key{k}, ra)
	if d1.Split == nil || d1.Split.Complete || d1.Frame != nil {
		t.Fatalf("first-seen fragment should buffer, got %+v", d1.Split)
	}
	d0 := Decode(mk(0, frame[:mid]), false, []Key{k}, ra)
	if d0.Split == nil || !d0.Split.Complete {
		t.Fatalf("set should be complete, got %+v", d0.Split)
	}
	if d0.Frame == nil || !d0.Frame.Recognized {
		t.Fatalf("reassembled frame not decoded: %+v", d0.Frame)
	}
	if d0.Frame.Ver != 2 || d0.Frame.Cmd != 3001 {
		t.Errorf("reassembled header: ver=%d cmd=%d", d0.Frame.Ver, d0.Frame.Cmd)
	}
	if m, ok := d0.Frame.Decoded.(map[string]any); !ok || m["RoomID"] != "abc" {
		t.Errorf("reassembled payload = %#v", d0.Frame.Decoded)
	}
	if ra.Pending() != 0 {
		t.Errorf("%d fragment sets still pending", ra.Pending())
	}
}

// TestIncompleteSplitIsNotEmitted guards against emitting a corrupt payload
// when a fragment never arrives.
func TestIncompleteSplitIsNotEmitted(t *testing.T) {
	ra := NewReassembler()
	dg := make([]byte, 4+10+8)
	dg[3] = 3
	copy(dg[4:8], []byte{0xFF, 0xFE, 0xFD, 0xFC})
	binary.BigEndian.PutUint16(dg[8:10], 1)
	binary.BigEndian.PutUint16(dg[10:12], 0)
	binary.BigEndian.PutUint16(dg[12:14], 3) // expects three
	d := Decode(dg, false, nil, ra)
	if d.Frame != nil {
		t.Error("emitted a frame from an incomplete set")
	}
	if ra.Pending() != 1 {
		t.Errorf("pending = %d, want 1", ra.Pending())
	}
}

// TestRoomJoinDecoded covers the Room join reply, which carries a fixed-width
// room id rather than MessagePack.
func TestRoomJoinDecoded(t *testing.T) {
	k := testKey()
	body := make([]byte, 4+52)
	copy(body[:4], []byte{0x6a, 0x9f, 0xf7, 0x35})
	copy(body[4:], "18d356562e66de3d0a7733aa1fa7")
	dg := seal(t, k, 1, 101, body)
	d := Decode(dg, false, []Key{k}, NewReassembler())
	if d.Frame == nil || !d.Frame.Recognized {
		t.Fatalf("join reply not decoded: %+v", d.Frame)
	}
	m, ok := d.Frame.Decoded.(map[string]any)
	if !ok || m["kind"] != "roomJoined" {
		t.Fatalf("decoded = %#v", d.Frame.Decoded)
	}
	if m["roomId"] != "18d356562e66de3d0a7733aa1fa7" {
		t.Errorf("roomId = %v", m["roomId"])
	}
}
