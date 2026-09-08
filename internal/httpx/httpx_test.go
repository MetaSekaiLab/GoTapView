package httpx

import (
	"bytes"
	"testing"
)

func TestSplitPipelinedRequests(t *testing.T) {
	// two requests on one keep-alive stream: a POST with a body, then a GET
	// with none. Correct framing must recover exactly two messages.
	stream := "POST /api/user/auth HTTP/1.1\r\nContent-Length: 5\r\n\r\nHELLO" +
		"GET /api/system HTTP/1.1\r\nHost: x\r\n\r\n"
	msgs := Split([]byte(stream), false)
	if len(msgs) != 2 {
		t.Fatalf("got %d messages, want 2", len(msgs))
	}
	if m, p := RequestLine(msgs[0].StartLine); m != "POST" || p != "/api/user/auth" {
		t.Errorf("req0 = %q %q", m, p)
	}
	if !bytes.Equal(msgs[0].Body, []byte("HELLO")) {
		t.Errorf("req0 body = %q", msgs[0].Body)
	}
	if len(msgs[1].Body) != 0 {
		t.Errorf("GET should have no body, got %q", msgs[1].Body)
	}
	if msgs[1].StartOffset <= msgs[0].StartOffset {
		t.Errorf("offsets not increasing: %d, %d", msgs[0].StartOffset, msgs[1].StartOffset)
	}
}

func TestChunked(t *testing.T) {
	stream := "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n" +
		"5\r\nHELLO\r\n3\r\n WO\r\n0\r\n\r\n"
	msgs := Split([]byte(stream), true)
	if len(msgs) != 1 {
		t.Fatalf("got %d, want 1", len(msgs))
	}
	if got := string(msgs[0].Body); got != "HELLO WO" {
		t.Errorf("dechunked = %q", got)
	}
	if StatusCode(msgs[0].StartLine) != 200 {
		t.Errorf("status = %d", StatusCode(msgs[0].StartLine))
	}
}

func TestResponseNoLengthRunsToEnd(t *testing.T) {
	stream := "HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nrest of the body"
	msgs := Split([]byte(stream), true)
	if len(msgs) != 1 || string(msgs[0].Body) != "rest of the body" {
		t.Fatalf("got %d msgs, body=%q", len(msgs), msgs[0].Body)
	}
}

func TestPairPositional(t *testing.T) {
	reqs := []Message{{StartLine: "GET /a HTTP/1.1"}, {StartLine: "GET /b HTTP/1.1"}}
	resps := []Message{{StartLine: "HTTP/1.1 200 OK"}}
	ex := Pair(reqs, resps)
	if len(ex) != 2 || ex[0].Response == nil || ex[1].Response != nil {
		t.Fatalf("pairing wrong: %+v", ex)
	}
}
