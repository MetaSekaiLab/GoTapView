package diarkis

import "strconv"

// SyncProperty keyMap for Sekai multi-live, recovered at runtime by hooking
// CP.Realtime.SyncProperty.ImportKeyMap / CreateIdToKeyMap in UnityFramework
// (Frida). These maps are built data-driven at room join, so they cannot be
// read statically from the il2cpp dump — the values below are the live truth.
//
// Each entry is id -> {name, wire type}. Wire type codes match SyncProperty:
// 1 byte, 2 int32, 3 int64, 4 string, 5 float, 6 bool, 7 object (nested msgpack).
type propMeta struct {
	name string
	typ  byte
}

// CP.Realtime.RoomProperty
var roomProps = map[int64]propMeta{
	1:  {"MESSAGE", 2},
	2:  {"STEP", 2},
	3:  {"ATYPE", 2},
	4:  {"SELECTED_MUSIC_ID", 2},
	5:  {"MASTER_LOBBY_ID", 2},
	6:  {"RECRUIT_TOTAL_POWER", 2},
	8:  {"MATCH_SCALEUP_FINISH", 1},
	9:  {"IS_PUBLISH", 1},
	10: {"ROOM_NUMBER", 2},
	11: {"SELECTED_MUSIC_USER_ID", 4},
	12: {"LIVE_ID", 4},
	13: {"RANDOM_SEED", 4},
}

// CP.Realtime.PlayerProperty
var playerProps = map[int64]propMeta{
	1:  {"nickname", 4},
	2:  {"BASIC_INFO", 7},
	3:  {"TEAM_ID", 2},
	4:  {"STATUS", 2},
	5:  {"JOIN_ROUTE", 2},
	6:  {"PARTY_INDEX", 2},
	7:  {"SELECT_DIFFICULTY", 4},
	8:  {"MUSIC_ID", 2},
	9:  {"IS_ENTRUST", 2},
	10: {"RESULT", 7},
}

// syncTypeCode maps the __sync__ label mpjson emits back to its wire type code,
// so a property blob's decoded type can be checked against the key maps.
var syncTypeCode = map[string]byte{
	"byte": 1, "int32": 2, "int64": 3, "str": 4, "float": 5, "bool": 6, "msgpack": 7,
}

// cmdHint maps a ver=2 command to the property kind its bags belong to, for
// commands whose payload is purely one kind. Confirmed against the capture with
// no counterexamples: cmd 10010 room deltas (9:0), cmd 10030 player deltas
// (76:0). Mixed commands (3000/3001/3090, which carry both) are not listed and
// fall back to parent-field / (id,type) classification.
var cmdHint = map[uint16]string{
	10010: "room",
	10030: "player",
}

// labelProps walks a decoded ver=2 game payload and renames the integer keys of
// every property bag ({R: revision, Values: {id -> blob}}) to their SyncProperty
// names. A bag is tagged room or player by, in order: the command (for pure
// delta commands), its parent field name (RoomProperty / PlayerProperty), or
// matching each entry's (id, type) against the two key maps — the types
// disambiguate all but the handful of ids that are int32 in both. Nothing is
// dropped: unknown ids and still-ambiguous bags keep their numeric keys.
func labelProps(v any, cmd uint16) any { return relabel(v, cmdHint[cmd]) }

func relabel(v any, hint string) any {
	switch t := v.(type) {
	case map[string]any:
		if vals, ok := propBag(t); ok {
			kind := hint
			if kind == "" {
				kind = classifyBag(vals)
			}
			t["Values"] = renameValues(vals, kind)
			if kind != "" {
				t["__props__"] = kind
			}
			return t
		}
		for k, val := range t {
			// An explicit RoomProperty/PlayerProperty field overrides the
			// inherited hint; other fields carry the hint down unchanged.
			h := hint
			if ch := childHint(k); ch != "" {
				h = ch
			}
			t[k] = relabel(val, h)
		}
		return t
	case []any:
		for i := range t {
			t[i] = relabel(t[i], hint)
		}
		return t
	default:
		return v
	}
}

// propBag reports whether m is a property bag and returns its Values map.
func propBag(m map[string]any) (map[string]any, bool) {
	if _, hasR := m["R"]; !hasR {
		return nil, false
	}
	vals, ok := m["Values"].(map[string]any)
	return vals, ok
}

func childHint(key string) string {
	switch key {
	case "RoomProperty":
		return "room"
	case "PlayerProperty":
		return "player"
	}
	return ""
}

// classifyBag decides room vs player from the (id, type) pairs present. An entry
// counts as a conflict for a map if that id is absent or carries a different
// type, so a single map-unique key (e.g. RoomProperty's string keys 12/13, or
// PlayerProperty's key 7) settles it. Ties (only ids that are int32 in both) and
// unknown keys yield "".
func classifyBag(vals map[string]any) string {
	roomOK, playerOK := true, true
	roomHits, playerHits := 0, 0
	any := false
	for k, val := range vals {
		id, err := strconv.ParseInt(k, 10, 64)
		if err != nil {
			continue
		}
		typ, ok := blobType(val)
		if !ok {
			continue
		}
		any = true
		if m, in := roomProps[id]; in && m.typ == typ {
			roomHits++
		} else {
			roomOK = false
		}
		if m, in := playerProps[id]; in && m.typ == typ {
			playerHits++
		} else {
			playerOK = false
		}
	}
	if !any {
		return ""
	}
	if roomOK && !playerOK && roomHits > 0 {
		return "room"
	}
	if playerOK && !roomOK && playerHits > 0 {
		return "player"
	}
	return ""
}

// blobType extracts the wire type code from a decoded property value, which
// mpjson renders as {"__sync__": <label>, "v": ...}.
func blobType(val any) (byte, bool) {
	m, ok := val.(map[string]any)
	if !ok {
		return 0, false
	}
	label, ok := m["__sync__"].(string)
	if !ok {
		return 0, false
	}
	c, ok := syncTypeCode[label]
	return c, ok
}

// renameValues returns a copy of vals with integer keys replaced by their
// property names for the chosen map; unknown ids and untyped values are kept
// under their original key so nothing is lost.
func renameValues(vals map[string]any, kind string) map[string]any {
	m := pickMap(kind)
	if m == nil {
		return vals
	}
	out := make(map[string]any, len(vals))
	for k, val := range vals {
		name := k
		if id, err := strconv.ParseInt(k, 10, 64); err == nil {
			if meta, ok := m[id]; ok {
				name = meta.name
			}
		}
		out[name] = val
	}
	return out
}

func pickMap(kind string) map[int64]propMeta {
	switch kind {
	case "room":
		return roomProps
	case "player":
		return playerProps
	}
	return nil
}
