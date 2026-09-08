package mpjson

import (
	"encoding/hex"
	"fmt"
	"testing"
)

func TestSmoke(t *testing.T) {
	b, _ := hex.DecodeString("82ab6163636573735f746f6b656ea3616263a26f6ba3796573")
	v, err := Decode(b)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Printf("map: %#v\n", v)

	inner := []byte{0x93, 0x01, 0x02, 0x03}
	wrap := append([]byte{0xc4, byte(len(inner))}, inner...)
	v2, _ := Decode(wrap)
	fmt.Printf("nested bin: %#v\n", v2)

	plain := []byte{0xc4, 0x03, 0xde, 0xad, 0xff}
	v3, _ := Decode(plain)
	fmt.Printf("plain bin: %#v\n", v3)
}
