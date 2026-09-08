package diarkis

import "testing"

// blob builds a decoded property value as mpjson renders it: {__sync__, v}.
func blob(label string, v any) map[string]any {
	return map[string]any{"__sync__": label, "v": v}
}

func bag(vals map[string]any) map[string]any {
	return map[string]any{"R": 1, "Values": vals}
}

func TestLabelProps(t *testing.T) {
	tests := []struct {
		name     string
		in       map[string]any
		wantKind string            // "" means left unclassified
		wantKeys map[string]string // renamed key -> its __sync__ label
	}{
		{
			name: "room bag with string keys settles room",
			in: bag(map[string]any{
				"1":  blob("int32", int32(7)),
				"12": blob("str", "L123"),
				"13": blob("str", "seedseed"),
			}),
			wantKind: "room",
			wantKeys: map[string]string{"MESSAGE": "int32", "LIVE_ID": "str", "RANDOM_SEED": "str"},
		},
		{
			name: "player bag with nickname+object settles player",
			in: bag(map[string]any{
				"1": blob("str", "晚夜微雨问海棠"),
				"2": blob("msgpack", []any{1, 2, 3}),
				"5": blob("int32", int32(1)),
			}),
			wantKind: "player",
			wantKeys: map[string]string{"nickname": "str", "BASIC_INFO": "msgpack", "JOIN_ROUTE": "int32"},
		},
		{
			name:     "delta int32 id10 is room ROOM_NUMBER",
			in:       bag(map[string]any{"10": blob("int32", int32(82653))}),
			wantKind: "room",
			wantKeys: map[string]string{"ROOM_NUMBER": "int32"},
		},
		{
			name:     "delta object id10 is player RESULT",
			in:       bag(map[string]any{"10": blob("msgpack", []any{})}),
			wantKind: "player",
			wantKeys: map[string]string{"RESULT": "msgpack"},
		},
		{
			name:     "ambiguous int32 id3 stays numeric",
			in:       bag(map[string]any{"3": blob("int32", int32(5))}),
			wantKind: "",
			wantKeys: map[string]string{"3": "int32"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			out := labelProps(tt.in, 0).(map[string]any)
			kind, _ := out["__props__"].(string)
			if kind != tt.wantKind {
				t.Fatalf("kind = %q, want %q", kind, tt.wantKind)
			}
			vals := out["Values"].(map[string]any)
			if len(vals) != len(tt.wantKeys) {
				t.Fatalf("Values has %d keys, want %d: %v", len(vals), len(tt.wantKeys), vals)
			}
			for k, wantLabel := range tt.wantKeys {
				v, ok := vals[k]
				if !ok {
					t.Fatalf("missing renamed key %q in %v", k, vals)
				}
				if lbl := v.(map[string]any)["__sync__"]; lbl != wantLabel {
					t.Fatalf("key %q label = %v, want %v", k, lbl, wantLabel)
				}
			}
		})
	}
}

// A bag nested under an explicit RoomProperty/PlayerProperty field uses that hint
// even when its keys alone would be ambiguous.
func TestLabelPropsParentHint(t *testing.T) {
	in := map[string]any{
		"RoomProperty":   bag(map[string]any{"3": blob("int32", int32(9))}),
		"PlayerProperty": bag(map[string]any{"3": blob("int32", int32(4))}),
	}
	out := labelProps(in, 0).(map[string]any)
	rp := out["RoomProperty"].(map[string]any)
	if rp["__props__"] != "room" {
		t.Fatalf("RoomProperty kind = %v, want room", rp["__props__"])
	}
	if _, ok := rp["Values"].(map[string]any)["ATYPE"]; !ok {
		t.Fatalf("RoomProperty id 3 not renamed to ATYPE: %v", rp["Values"])
	}
	pp := out["PlayerProperty"].(map[string]any)
	if pp["__props__"] != "player" {
		t.Fatalf("PlayerProperty kind = %v, want player", pp["__props__"])
	}
	if _, ok := pp["Values"].(map[string]any)["TEAM_ID"]; !ok {
		t.Fatalf("PlayerProperty id 3 not renamed to TEAM_ID: %v", pp["Values"])
	}
}

// A lone int32 id-4 delta is ambiguous by type alone, but the delta command
// (10010 room / 10030 player) settles it. Confirmed against the capture.
func TestLabelPropsCmdHint(t *testing.T) {
	mk := func() map[string]any { return bag(map[string]any{"4": blob("int32", int32(1))}) }
	room := labelProps(mk(), 10010).(map[string]any)
	if room["__props__"] != "room" {
		t.Fatalf("cmd 10010 kind = %v, want room", room["__props__"])
	}
	if _, ok := room["Values"].(map[string]any)["SELECTED_MUSIC_ID"]; !ok {
		t.Fatalf("cmd 10010 id 4 not SELECTED_MUSIC_ID: %v", room["Values"])
	}
	player := labelProps(mk(), 10030).(map[string]any)
	if player["__props__"] != "player" {
		t.Fatalf("cmd 10030 kind = %v, want player", player["__props__"])
	}
	if _, ok := player["Values"].(map[string]any)["STATUS"]; !ok {
		t.Fatalf("cmd 10030 id 4 not STATUS: %v", player["Values"])
	}
}
