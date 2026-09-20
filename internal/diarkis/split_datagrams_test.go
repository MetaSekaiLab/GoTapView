package diarkis

import "testing"

// ack builds a bare control datagram: a 4-byte wrapper plus the 16-byte sid.
func ack(seq byte) []byte {
	return append([]byte{seq, 0, 0, 4}, make([]byte, 16)...)
}

// framed builds a minimal framed datagram carrying a 4-byte payload.
func framed() []byte {
	return append([]byte{0, 0, 0, 3},
		[]byte{0xFE, 0xBE, 0xDE, 0xEF, 0, 0, 0, 4, 0, 1, 0, 1, 2, 3, 4}...)
}

// TestSplitDatagramsNeverPanics walks every prefix of a few plausible payloads.
// A flow is treated as Diarkis when any one of its datagrams carries the frame
// magic, so a short or truncated datagram in that same flow lands here too --
// and this runs while decoding a capture, where a panic loses the whole file.
func TestSplitDatagramsNeverPanics(t *testing.T) {
	seeds := [][]byte{
		ack(0),
		framed(),
		append(ack(0), ack(1)...),
		append(ack(0), framed()...),
		make([]byte, 48),            // an NTP-sized run of zeroes
		{0x23, 0, 0, 0, 0, 0, 0, 0}, // an NTP header
	}
	for _, s := range seeds {
		for n := 0; n <= len(s); n++ {
			for _, resp := range []bool{false, true} {
				func() {
					defer func() {
						if r := recover(); r != nil {
							t.Fatalf("panic on %d-byte input (respHeader=%v): %v", n, resp, r)
						}
					}()
					SplitDatagrams(s[:n], resp)
				}()
			}
		}
	}
}

// TestSplitDatagramsLosesNothing pins the contract that matters for a viewer:
// whatever the split decides, the pieces concatenate back to the input. A run
// it cannot interpret -- say 23 bytes, which could be one datagram or an ACK
// with a 3-byte tail -- is handed back whole rather than guessed at or dropped.
func TestSplitDatagramsLosesNothing(t *testing.T) {
	seeds := [][]byte{
		ack(0),
		framed(),
		append(ack(0), ack(1)...),
		append(ack(0), framed()...),
		append(ack(0), 1, 2, 3),
		make([]byte, 48),
	}
	for _, s := range seeds {
		for n := 0; n <= len(s); n++ {
			for _, resp := range []bool{false, true} {
				var joined []byte
				for _, dg := range SplitDatagrams(s[:n], resp) {
					joined = append(joined, dg...)
				}
				if string(joined) != string(s[:n]) {
					t.Fatalf("%d-byte input (respHeader=%v) came back as %x, want %x",
						n, resp, joined, s[:n])
				}
			}
		}
	}
}
