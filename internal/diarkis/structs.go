package diarkis

import "strconv"

// Named field layouts for the OBJECT-typed property values, which arrive as
// positional MessagePack arrays. These mirror the [MessagePackObject] structs in
// the il2cpp dump (Sekai.MultiLive) — the source of truth. A field with a
// non-empty schema is itself a struct (or, with a "[]" prefix, an array of that
// struct) and is labelled recursively.
//
//   RoomUserBasicInfo  -> PlayerProperty "BASIC_INFO" (the deck/appearance)
//   RoomUserHonorInfo  -> its MainHonor / SubHonors
//   MemberCharacterRank already serialises with string keys, so needs no schema.

type structField struct {
	name   string
	schema string // "" scalar; "RoomUserHonorInfo" nested; "[]RoomUserHonorInfo" array of nested
}

var structSchemas = map[string][]structField{
	// Sekai.MultiLive.RoomUserBasicInfo, [Key(0..18)]
	"RoomUserBasicInfo": {
		{name: "CardId"},
		{name: "CardLevel"},
		{name: "CardSkillLv"},
		{name: "CardMasterRank"},
		{name: "SubCardIds"},
		{name: "SubCardSkillLv"},
		{name: "SubCardImages"},
		{name: "TotalPowerIncludeBuff"},
		{name: "DefaultImage"},
		{name: "IsTraining"},
		{name: "MainHonor", schema: "RoomUserHonorInfo"},
		{name: "SubHonors", schema: "[]RoomUserHonorInfo"},
		{name: "CostumeUnitType"},
		{name: "HairCostumeId"},
		{name: "BodyCostumeId"},
		{name: "AccessoryCostumeId"},
		{name: "friendRequestStatus"},
		{name: "MemberCharacterRank"},
		{name: "UserPlayerFrameId"},
	},
	// Sekai.MultiLive.RoomUserHonorInfo, [Key(0..5)]
	"RoomUserHonorInfo": {
		{name: "Type"},
		{name: "Id"},
		{name: "Level"},
		{name: "BondsWordId"},
		{name: "BondsViewType"},
		{name: "HonorMissionProgress"},
	},
}

// propStructSchema maps a named property key to the struct schema of its OBJECT
// value, per property kind ("room" / "player").
var propStructSchema = map[string]map[string]string{
	"player": {"BASIC_INFO": "RoomUserBasicInfo"},
}

// labelStructValue turns a positional array into a field-named object using the
// given schema, recursing into nested-struct fields. Extra elements beyond the
// schema are kept under their numeric index so nothing is lost.
func labelStructValue(schema string, v any) any {
	fields, ok := structSchemas[schema]
	if !ok {
		return v
	}
	arr, ok := v.([]any)
	if !ok {
		return v
	}
	out := make(map[string]any, len(arr))
	for i, e := range arr {
		if i < len(fields) {
			out[fields[i].name] = labelStructField(fields[i], e)
		} else {
			out[strconv.Itoa(i)] = e
		}
	}
	return out
}

func labelStructField(f structField, child any) any {
	switch {
	case f.schema == "":
		return child
	case len(f.schema) > 2 && f.schema[:2] == "[]":
		elem := f.schema[2:]
		arr, ok := child.([]any)
		if !ok {
			return child
		}
		out := make([]any, len(arr))
		for i, e := range arr {
			out[i] = labelStructValue(elem, e)
		}
		return out
	default:
		return labelStructValue(f.schema, child)
	}
}

// labelObjectProperty relabels a property value that carries a struct schema.
// The value is the { "__sync__": "msgpack", "v": [...] } wrapper produced by the
// SyncData decoder (or a bare array); the array is replaced with a named object.
func labelObjectProperty(schema string, val any) any {
	if m, ok := val.(map[string]any); ok {
		if m["__sync__"] == "msgpack" {
			m["v"] = labelStructValue(schema, m["v"])
			return m
		}
	}
	if _, ok := val.([]any); ok {
		return labelStructValue(schema, val)
	}
	return val
}
