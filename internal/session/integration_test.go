package session

import (
	"os"
	"testing"
)

// TestRealCapture decodes a real Project Sekai capture end to end and asserts
// the whole chain worked: the login response decrypted, a Diarkis key was
// discovered from it, and that key decoded the gameplay UDP.
//
// The .tap fixture is a genuine capture; if it is absent the test is skipped so
// the suite still runs in a clean checkout.
func TestRealCapture(t *testing.T) {
	const path = "../../testdata/sample.tap"
	if _, err := os.Stat(path); err != nil {
		t.Skip("no sample capture at " + path)
	}
	sess, err := Build(path)
	if err != nil {
		t.Fatal(err)
	}

	if sess.Meta.HTTPEvents == 0 || sess.Meta.UDPEvents == 0 {
		t.Fatalf("expected both http and udp events, got %d/%d", sess.Meta.HTTPEvents, sess.Meta.UDPEvents)
	}
	if sess.Meta.DiarkisKeys < 1 {
		t.Fatalf("no diarkis keys discovered")
	}

	// the login must have decrypted to a sessionToken
	var sawSessionToken, sawDiarkisAuth bool
	for _, e := range sess.Events {
		if e.HTTP == nil {
			continue
		}
		if e.HTTP.Path == "/api/user/auth" {
			if m, ok := e.HTTP.RespJSON.(map[string]any); ok {
				if _, ok := m["sessionToken"]; ok {
					sawSessionToken = true
				}
			}
		}
		if e.HTTP.Note == "diarkis-auth" {
			sawDiarkisAuth = true
		}
	}
	if !sawSessionToken {
		t.Error("did not decrypt a sessionToken from /api/user/auth")
	}
	if !sawDiarkisAuth {
		t.Error("did not see a diarkis-auth exchange")
	}

	// UDP must decode well with the discovered key, and unknown frames must
	// still carry their parsed header and raw bytes (lossless).
	var recognized, total, broadcast int
	for _, e := range sess.Events {
		if e.UDP == nil || e.UDP.Data == nil || e.UDP.Data.Frame == nil {
			continue
		}
		total++
		if e.UDP.Data.Frame.Recognized {
			recognized++
		}
		if e.UDP.Data.Frame.Ver == 1 && e.UDP.Data.Frame.Cmd == 103 {
			broadcast++
		}
	}
	if total < 500 {
		t.Fatalf("only %d udp frames parsed, expected >500", total)
	}
	if recognized*100/total < 95 {
		t.Errorf("recognized rate %d%% below 95%%", recognized*100/total)
	}
	if broadcast == 0 {
		t.Error("no Room broadcast frames decoded")
	}

	// timeline invariant: events are ordered by seq
	var last uint64
	for _, e := range sess.Events {
		if e.Seq < last {
			t.Fatalf("events out of order: seq %d after %d", e.Seq, last)
		}
		last = e.Seq
	}
	// Oversized payloads must be reassembled rather than dropped: the room
	// sync arrives split across datagrams and is the densest message present.
	var reassembled int
	for _, e := range sess.Events {
		if e.UDP != nil && e.UDP.Data != nil && e.UDP.Data.Split != nil && e.UDP.Data.Split.Complete {
			reassembled++
			if e.UDP.Data.Frame == nil || !e.UDP.Data.Frame.Recognized {
				t.Error("a reassembled split payload did not decode")
			}
		}
	}
	if reassembled == 0 {
		t.Error("no split payload was reassembled")
	}

	t.Logf("http=%d udp=%d keys=%d recognized=%d/%d broadcasts=%d reassembled=%d",
		sess.Meta.HTTPEvents, sess.Meta.UDPEvents, sess.Meta.DiarkisKeys, recognized, total, broadcast, reassembled)
}
