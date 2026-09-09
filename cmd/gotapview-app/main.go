// Command gotapview-app is the windowed macOS build of GoTapView.
//
// It is one self-contained binary: the .tap decoder, an HTTP server, and the
// viewer UI (a React Native app exported through React Native Web) embedded via
// go:embed. On launch it binds a free localhost port, serves the UI there, and
// opens it in a WKWebView window.
//
// Note this renders the React Native source through React Native Web rather
// than react-native-macos: the UI code is shared verbatim with the mobile app,
// but the rendering layer is web inside a native window.
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	webview "github.com/webview/webview_go"

	"gotapview/internal/httpapi"
	"gotapview/internal/ui"
)

func main() {
	var (
		file   = flag.String("f", "", "capture to open at startup (optional; otherwise use Choose capture…)")
		width  = flag.Int("w", 1180, "window width")
		height = flag.Int("h", 820, "window height")
		debug  = flag.Bool("debug", false, "enable the WebView inspector")
	)
	flag.Parse()

	// A double-clicked app gets no arguments, but an "open with" or a shell
	// invocation may pass a path positionally.
	path := *file
	if path == "" && flag.NArg() > 0 {
		path = flag.Arg(0)
	}

	if !ui.Available() {
		log.Fatal("gotapview-app: the UI bundle is not embedded; build with scripts/build-app.sh")
	}

	srv := httpapi.New(ui.Handler())
	if path != "" {
		abs, _ := filepath.Abs(path)
		if err := srv.Load(abs); err != nil {
			// Not fatal: the window still opens so a capture can be chosen.
			log.Printf("gotapview-app: could not open %s: %v", abs, err)
		} else if desc, ok := srv.Meta(); ok {
			log.Printf("loaded %s", desc)
		}
	}

	// Prefer a stable port so the page origin (and thus its localStorage — where
	// theme and layout preferences live) is the same across launches. Fall back
	// to any free port if it is taken (e.g. a second instance).
	ln, url, err := httpapi.Listen("127.0.0.1:8787")
	if err != nil {
		ln, url, err = httpapi.Listen("127.0.0.1:0")
	}
	if err != nil {
		log.Fatalf("gotapview-app: listen: %v", err)
	}
	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Printf("gotapview-app: serve: %v", err)
		}
	}()
	log.Printf("serving %s", url)

	w := webview.New(*debug)
	defer w.Destroy()
	w.SetTitle("GoTapView")
	w.SetSize(*width, *height, webview.HintNone)
	// Tell the page where its API lives; the same UI also runs standalone
	// against a separately started tapview, so this is only a hint.
	w.Navigate(fmt.Sprintf("%s/?api=%s", url, url))
	w.Run()
	os.Exit(0)
}
