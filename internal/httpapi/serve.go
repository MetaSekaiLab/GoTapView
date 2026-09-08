// Package httpapi serves a decoded Session to the viewer over localhost.
package httpapi

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"gotapview/internal/session"
)

// Serve starts an HTTP server exposing the session as JSON.
//
// GET /session returns the whole decoded capture; GET /health is a liveness
// probe. CORS is wide open because the Expo web dev server fetches from a
// different origin, and this only ever binds localhost.
func Serve(addr string, sess *session.Session) error {
	body, err := json.Marshal(sess)
	if err != nil {
		return err
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/session", func(w http.ResponseWriter, r *http.Request) {
		cors(w)
		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	})
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		cors(w)
		w.Write([]byte(`{"ok":true}`))
	})

	srv := &http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	log.Printf("serving session on http://%s/session  (%d events)", addr, len(sess.Events))
	return srv.ListenAndServe()
}

func cors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
}
