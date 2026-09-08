// Command tapview decodes a GoTapline .tap capture and serves it as JSON for
// the GoTapView UI, or dumps it to a file.
//
// It reassembles TLS flows and decrypts the mkcn game API (AES-128-CBC +
// MessagePack), auto-discovers Diarkis session keys from diarkis-auth
// responses, and decodes the Diarkis UDP protocol — preserving the raw bytes of
// anything it cannot fully interpret so nothing is lost.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"

	"gotapview/internal/httpapi"
	"gotapview/internal/session"
)

func main() {
	var (
		file  = flag.String("f", "", "capture file to decode (required)")
		addr  = flag.String("addr", "127.0.0.1:8787", "address to serve the session JSON on")
		out   = flag.String("json", "", "also write the decoded session to this JSON file")
		noSrv = flag.Bool("no-serve", false, "decode and (optionally) dump, but do not start the server")
	)
	flag.Parse()
	if *file == "" {
		fmt.Fprintln(os.Stderr, "usage: tapview -f capture.tap [-addr :8787] [-json out.json] [-no-serve]")
		os.Exit(2)
	}

	sess, err := session.Build(*file)
	if err != nil {
		log.Fatalf("tapview: %v", err)
	}
	m := sess.Meta
	fmt.Printf("decoded %s: %d records, %d flows, %d events (%d http, %d udp), %d diarkis key(s)%s\n",
		m.File, m.Records, m.Flows, len(sess.Events), m.HTTPEvents, m.UDPEvents, m.DiarkisKeys,
		truncNote(m.Truncated))

	if *out != "" {
		b, _ := json.MarshalIndent(sess, "", "  ")
		if err := os.WriteFile(*out, b, 0o644); err != nil {
			log.Fatalf("tapview: write %s: %v", *out, err)
		}
		fmt.Printf("wrote %s\n", *out)
	}

	if *noSrv {
		return
	}
	if err := httpapi.Serve(*addr, sess); err != nil {
		log.Fatalf("tapview: serve: %v", err)
	}
}

func truncNote(t bool) string {
	if t {
		return "  (capture truncated; decoded up to the last intact record)"
	}
	return ""
}
