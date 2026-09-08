// Package session assembles a decoded, timeline-ordered view of a capture.
//
// It reads a .tap file once, reassembles TLS streams and collects UDP
// datagrams per flow, then produces a Session whose Events are ordered by the
// capture's global sequence number — the single true timeline that HTTP and
// UDP share.
package session

import "gotapview/internal/diarkis"

// Session is the whole decoded capture, ready to serialise to the UI.
type Session struct {
	Meta   Meta    `json:"meta"`
	Flows  []Flow  `json:"flows"`
	Events []Event `json:"events"`
}

// Meta is capture-level summary information.
type Meta struct {
	File        string `json:"file"`
	StartedWall int64  `json:"startedWall"` // unix millis of t0
	Records     int    `json:"records"`
	Flows       int    `json:"flows"`
	Truncated   bool   `json:"truncated"`
	DiarkisKeys int    `json:"diarkisKeys"`
	HTTPEvents  int    `json:"httpEvents"`
	UDPEvents   int    `json:"udpEvents"`
}

// Flow is one connection.
type Flow struct {
	ID      uint32 `json:"id"`
	Proto   string `json:"proto"`
	Mode    string `json:"mode"`
	Client  string `json:"client"`
	Remote  string `json:"remote"`
	SNI     string `json:"sni"`
	Packets int    `json:"packets"`
}

// Event is one timeline entry: either an HTTP exchange or a UDP datagram.
type Event struct {
	Seq    uint64     `json:"seq"`
	TRelNs int64      `json:"tRelNs"`
	WallMs int64      `json:"wallMs"`
	Kind   string     `json:"kind"` // "http" | "udp"
	FlowID uint32     `json:"flowId"`
	Remote string     `json:"remote"`
	HTTP   *HTTPEvent `json:"http,omitempty"`
	UDP    *UDPEvent  `json:"udp,omitempty"`
}

// HTTPEvent is a decoded request/response pair.
type HTTPEvent struct {
	Method       string            `json:"method"`
	Path         string            `json:"path"`
	Status       int               `json:"status"`
	Note         string            `json:"note,omitempty"`
	ReqHeaders   map[string]string `json:"reqHeaders,omitempty"`
	RespHeaders  map[string]string `json:"respHeaders,omitempty"`
	ReqJSON      any               `json:"reqJson,omitempty"`
	RespJSON     any               `json:"respJson,omitempty"`
	ReqBodyHex   string            `json:"reqBodyHex,omitempty"`
	RespBodyHex  string            `json:"respBodyHex,omitempty"`
	ReqBodyText  string            `json:"reqBodyText,omitempty"`
	RespBodyText string            `json:"respBodyText,omitempty"`
}

// UDPEvent is a decoded datagram.
type UDPEvent struct {
	Dir  string            `json:"dir"` // "c2s" | "s2c"
	Data *diarkis.Datagram `json:"data,omitempty"`
	// Other carries a datagram from a flow that is not Diarkis at all (a
	// capture also sees NTP, DNS and so on), preserved rather than misparsed.
	Other *OtherUDP `json:"other,omitempty"`
}

// OtherUDP is an uninterpreted datagram.
type OtherUDP struct {
	Bytes int    `json:"bytes"`
	Hex   string `json:"hex"`
}
