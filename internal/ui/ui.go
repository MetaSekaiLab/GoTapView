// Package ui embeds the exported viewer web bundle so the desktop app is a
// single self-contained binary.
//
// The bundle is produced by `expo export --platform web` from ./app and copied
// into dist/ by scripts/build-app.sh. When dist/ holds only the placeholder,
// Handler reports that the UI was not bundled, which keeps `go build` working
// for the headless CLI without requiring Node.
package ui

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed all:dist
var files embed.FS

// Available reports whether a real UI bundle was embedded.
func Available() bool {
	f, err := files.Open("dist/index.html")
	if err != nil {
		return false
	}
	f.Close()
	return true
}

// Handler serves the embedded bundle, falling back to index.html so the
// single-page app keeps working on any path.
func Handler() http.Handler {
	sub, err := fs.Sub(files, "dist")
	if err != nil {
		return http.NotFoundHandler()
	}
	fileServer := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/")
		if p == "" {
			p = "index.html"
		}
		if _, err := fs.Stat(sub, p); err != nil {
			r = r.Clone(r.Context())
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	})
}
