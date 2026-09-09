// Command tapview decodes a GoTapline .tap capture and serves it as JSON, for
// use from the terminal or by an external viewer.
//
// The windowed macOS build is cmd/gotapview-app, which embeds the UI and this
// same decoder in one binary.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"gotapview/internal/httpapi"
	"gotapview/internal/session"
	"gotapview/internal/ui"
)

func main() {
	var (
		file  = flag.String("f", "", "capture file to decode (required)")
		addr  = flag.String("addr", "127.0.0.1:8787", "address to serve on")
		out   = flag.String("json", "", "write the decoded session as JSON to this file, or \"-\" for stdout")
		noSrv = flag.Bool("no-serve", false, "decode and (optionally) dump, but do not serve")
	)
	flag.Parse()
	if *file == "" {
		fmt.Fprintln(os.Stderr, "usage: tapview -f capture.tap [-addr :8787] [-json out.json] [-no-serve]")
		os.Exit(2)
	}

	if *out != "" || *noSrv {
		sess, err := session.Build(*file)
		if err != nil {
			log.Fatalf("tapview: %v", err)
		}
		m := sess.Meta
		// "-" streams compact JSON to stdout (for the Electron sidecar). The
		// status line then goes to stderr so it does not corrupt the JSON.
		toStdout := *out == "-"
		status := os.Stdout
		if toStdout {
			status = os.Stderr
		}
		fmt.Fprintf(status, "decoded %s: %d records, %d flows, %d events (%d http, %d udp), %d diarkis key(s)%s\n",
			m.File, m.Records, m.Flows, len(sess.Events), m.HTTPEvents, m.UDPEvents, m.DiarkisKeys, truncNote(m.Truncated))
		if *out != "" {
			if toStdout {
				if err := json.NewEncoder(os.Stdout).Encode(sess); err != nil {
					log.Fatalf("tapview: encode: %v", err)
				}
			} else {
				b, _ := json.MarshalIndent(sess, "", "  ")
				if err := os.WriteFile(*out, b, 0o644); err != nil {
					log.Fatalf("tapview: write %s: %v", *out, err)
				}
				fmt.Printf("wrote %s\n", *out)
			}
		}
		if *noSrv {
			return
		}
	}

	var uiHandler = http.Handler(nil)
	if ui.Available() {
		uiHandler = ui.Handler()
	}
	srv := httpapi.New(uiHandler)
	if err := srv.Load(*file); err != nil {
		log.Fatalf("tapview: %v", err)
	}
	if desc, ok := srv.Meta(); ok {
		fmt.Printf("decoded %s\n", desc)
	}
	ln, url, err := httpapi.Listen(*addr)
	if err != nil {
		log.Fatalf("tapview: listen: %v", err)
	}
	fmt.Printf("serving %s/session\n", url)
	if ui.Available() {
		fmt.Printf("viewer  %s\n", url)
	}
	log.Fatal(srv.Serve(ln))
}

func truncNote(t bool) string {
	if t {
		return "  (capture truncated; decoded up to the last intact record)"
	}
	return ""
}
