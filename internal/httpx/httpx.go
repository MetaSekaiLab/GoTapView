// Package httpx reassembles the HTTP/1.1 messages on a decrypted TLS flow.
//
// A tls-plaintext flow gives two byte streams (client->server and
// server->client). HTTP/1.1 keep-alive pipelines many request/response pairs
// onto those streams, so this package splits them by Content-Length or chunked
// framing, decompresses gzip/deflate bodies, and pairs requests with responses
// in order.
package httpx

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"io"
	"strconv"
	"strings"
)

// Message is one HTTP request or response with its body already dechunked and
// decompressed.
type Message struct {
	StartLine   string
	Headers     map[string]string
	Body        []byte
	StartOffset int // byte offset of this message within its stream
}

// Header returns a header value by case-insensitive name.
func (m Message) Header(name string) string { return m.Headers[strings.ToLower(name)] }

// Exchange pairs a request with its response (either may be nil if the stream
// was truncated).
type Exchange struct {
	Request  *Message
	Response *Message
}

// Split parses every message on one direction of a stream.
//
// isResponse selects response framing: a request with neither Content-Length
// nor chunked encoding has no body (e.g. GET), whereas a response without
// either runs to the end of the stream.
func Split(buf []byte, isResponse bool) []Message {
	var msgs []Message
	pos := 0
	for {
		he := indexCRLFCRLF(buf[pos:])
		if he < 0 {
			break
		}
		msgStart := pos
		headEnd := pos + he
		head := string(buf[pos:headEnd])
		pos = headEnd + 4

		lines := strings.Split(head, "\r\n")
		msg := Message{StartLine: lines[0], Headers: map[string]string{}}
		for _, ln := range lines[1:] {
			if i := strings.IndexByte(ln, ':'); i >= 0 {
				k := strings.ToLower(strings.TrimSpace(ln[:i]))
				v := strings.TrimSpace(ln[i+1:])
				msg.Headers[k] = v
			}
		}

		var body []byte
		switch {
		case strings.EqualFold(msg.Headers["transfer-encoding"], "chunked"):
			var consumed int
			body, consumed = dechunk(buf[pos:])
			pos += consumed
		case msg.Headers["content-length"] != "":
			n, _ := strconv.Atoi(msg.Headers["content-length"])
			if n < 0 || pos+n > len(buf) {
				n = len(buf) - pos
			}
			body = append([]byte(nil), buf[pos:pos+n]...)
			pos += n
		default:
			if isResponse {
				body = append([]byte(nil), buf[pos:]...)
				pos = len(buf)
			}
		}

		msg.StartOffset = msgStart
		msg.Body = decompress(body, msg.Headers["content-encoding"])
		msgs = append(msgs, msg)
		if pos >= len(buf) {
			break
		}
	}
	return msgs
}

// Pair matches requests to responses positionally, which is correct for a
// single keep-alive connection where HTTP/1.1 forbids reordering.
func Pair(reqs, resps []Message) []Exchange {
	n := len(reqs)
	if len(resps) > n {
		n = len(resps)
	}
	out := make([]Exchange, 0, n)
	for i := 0; i < n; i++ {
		var ex Exchange
		if i < len(reqs) {
			r := reqs[i]
			ex.Request = &r
		}
		if i < len(resps) {
			r := resps[i]
			ex.Response = &r
		}
		out = append(out, ex)
	}
	return out
}

// RequestLine splits "METHOD path HTTP/1.1".
func RequestLine(start string) (method, path string) {
	f := strings.Fields(start)
	if len(f) >= 2 {
		return f[0], f[1]
	}
	return "", start
}

// StatusCode extracts the numeric status from "HTTP/1.1 200 OK".
func StatusCode(start string) int {
	f := strings.Fields(start)
	if len(f) >= 2 {
		n, _ := strconv.Atoi(f[1])
		return n
	}
	return 0
}

func indexCRLFCRLF(b []byte) int { return bytes.Index(b, []byte("\r\n\r\n")) }

// dechunk decodes chunked transfer encoding, returning the body and how many
// input bytes it consumed (including the terminating 0-length chunk).
func dechunk(b []byte) ([]byte, int) {
	var out bytes.Buffer
	i := 0
	for i < len(b) {
		j := bytes.Index(b[i:], []byte("\r\n"))
		if j < 0 {
			break
		}
		sizeLine := string(b[i : i+j])
		if semi := strings.IndexByte(sizeLine, ';'); semi >= 0 {
			sizeLine = sizeLine[:semi] // ignore chunk extensions
		}
		sz, err := strconv.ParseInt(strings.TrimSpace(sizeLine), 16, 64)
		if err != nil {
			break
		}
		i += j + 2
		if sz == 0 {
			i += 2 // trailing CRLF after the last chunk
			return out.Bytes(), i
		}
		if i+int(sz) > len(b) {
			out.Write(b[i:])
			return out.Bytes(), len(b)
		}
		out.Write(b[i : i+int(sz)])
		i += int(sz) + 2
	}
	return out.Bytes(), i
}

// decompress reverses Content-Encoding, returning the input unchanged on any
// failure so a mislabeled body is still inspectable.
func decompress(body []byte, encoding string) []byte {
	switch strings.ToLower(strings.TrimSpace(encoding)) {
	case "gzip":
		if r, err := gzip.NewReader(bytes.NewReader(body)); err == nil {
			if out, err := io.ReadAll(r); err == nil {
				return out
			}
		}
	case "deflate":
		// try zlib-wrapped then raw
		if r, err := gzip.NewReader(bytes.NewReader(body)); err == nil {
			if out, err := io.ReadAll(r); err == nil {
				return out
			}
		}
		if out, err := io.ReadAll(flate.NewReader(bytes.NewReader(body))); err == nil && len(out) > 0 {
			return out
		}
	}
	return body
}
