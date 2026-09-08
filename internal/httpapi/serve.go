// Package httpapi serves a decoded session, and the viewer UI, over localhost.
//
// The session is mutable: a capture can be opened after the server is already
// running, which is what the desktop app needs since a double-clicked app gets
// no command-line arguments.
package httpapi

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"gotapview/internal/session"
)

// Server holds the currently loaded capture and serves it.
type Server struct {
	mu      sync.RWMutex
	sess    *session.Session
	body    []byte // pre-marshaled session, so repeat fetches are cheap
	path    string
	loadErr string

	ui http.Handler // optional embedded UI
}

// New creates a server with no capture loaded.
func New(ui http.Handler) *Server { return &Server{ui: ui} }

// Load decodes a capture and makes it the current session.
func (s *Server) Load(path string) error {
	sess, err := session.Build(path)
	if err != nil {
		s.mu.Lock()
		s.loadErr = err.Error()
		s.mu.Unlock()
		return err
	}
	body, err := json.Marshal(sess)
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.sess, s.body, s.path, s.loadErr = sess, body, path, ""
	s.mu.Unlock()
	return nil
}

// Meta returns a short description of what is loaded, for logging.
func (s *Server) Meta() (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.sess == nil {
		return "", false
	}
	m := s.sess.Meta
	return fmt.Sprintf("%s: %d events (%d http, %d udp), %d diarkis key(s)",
		m.File, len(s.sess.Events), m.HTTPEvents, m.UDPEvents, m.DiarkisKeys), true
}

// Handler builds the HTTP routes.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/session", func(w http.ResponseWriter, r *http.Request) {
		cors(w)
		s.mu.RLock()
		body, loadErr := s.body, s.loadErr
		s.mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		if body == nil {
			w.WriteHeader(http.StatusNotFound)
			writeJSON(w, map[string]any{"error": orDefault(loadErr, "no capture loaded")})
			return
		}
		w.Write(body)
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		cors(w)
		s.mu.RLock()
		loaded := s.body != nil
		path := s.path
		s.mu.RUnlock()
		writeJSON(w, map[string]any{"ok": true, "loaded": loaded, "path": path})
	})

	// /pick opens a native file dialog and loads whatever the user chose. This
	// is how the desktop app gets a capture, since a double-clicked app has no
	// argv to read a path from.
	mux.HandleFunc("/pick", func(w http.ResponseWriter, r *http.Request) {
		cors(w)
		if r.Method == http.MethodOptions {
			return
		}
		path, err := pickFile()
		if err != nil {
			writeJSON(w, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		if path == "" {
			writeJSON(w, map[string]any{"ok": false, "cancelled": true})
			return
		}
		if err := s.Load(path); err != nil {
			writeJSON(w, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, map[string]any{"ok": true, "path": path})
	})

	// /open loads a capture by path, for scripting and for reloading.
	mux.HandleFunc("/open", func(w http.ResponseWriter, r *http.Request) {
		cors(w)
		if r.Method == http.MethodOptions {
			return
		}
		path := r.URL.Query().Get("path")
		if path == "" {
			s.mu.RLock()
			path = s.path
			s.mu.RUnlock()
		}
		if path == "" {
			writeJSON(w, map[string]any{"ok": false, "error": "no path given and nothing loaded"})
			return
		}
		if err := s.Load(path); err != nil {
			writeJSON(w, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, map[string]any{"ok": true, "path": path})
	})

	if s.ui != nil {
		mux.Handle("/", s.ui)
	}
	return mux
}

// Listen binds an address, returning the listener and the URL to open. Port 0
// picks a free port, which avoids clashing with another instance.
func Listen(addr string) (net.Listener, string, error) {
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, "", err
	}
	host := ln.Addr().(*net.TCPAddr).IP.String()
	if host == "::" || host == "0.0.0.0" {
		host = "127.0.0.1"
	}
	return ln, fmt.Sprintf("http://%s:%d", host, ln.Addr().(*net.TCPAddr).Port), nil
}

// Serve runs the HTTP server on ln.
func (s *Server) Serve(ln net.Listener) error {
	srv := &http.Server{Handler: s.Handler(), ReadHeaderTimeout: 5 * time.Second}
	return srv.Serve(ln)
}

// pickFile shows the macOS open dialog via osascript, which keeps the native
// look without pulling in another CGO dependency.
func pickFile() (string, error) {
	const script = `try
	set f to choose file with prompt "Choose a .tap capture" of type {"tap", "public.data"}
	POSIX path of f
on error number -128
	return ""
end try`
	out, err := exec.Command("osascript", "-e", script).Output()
	if err != nil {
		return "", fmt.Errorf("file dialog failed: %w", err)
	}
	p := strings.TrimSpace(string(out))
	if p == "" {
		return "", nil
	}
	if _, err := os.Stat(p); err != nil {
		return "", err
	}
	return p, nil
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	b, _ := json.Marshal(v)
	w.Write(b)
}

func cors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
}

func orDefault(s, def string) string {
	if s == "" {
		return def
	}
	return s
}
