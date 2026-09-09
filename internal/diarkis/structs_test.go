package diarkis

import "testing"

// A player bag's BASIC_INFO msgpack array is labelled into the RoomUserBasicInfo
// field names, recursing into the nested honor structs.
func TestBasicInfoLabelled(t *testing.T) {
	// A trimmed but representative RoomUserBasicInfo positional array.
	arr := []any{
		1223,                               // CardId
		60,                                 // CardLevel
		1,                                  // CardSkillLv
		0,                                  // CardMasterRank
		[]any{284, 175, 638, 67},           // SubCardIds
		[]any{1, 1, 4, 1},                  // SubCardSkillLv
		[]any{"a", "b"},                    // SubCardImages
		273760,                             // TotalPowerIncludeBuff
		"special_training",                 // DefaultImage
		true,                               // IsTraining
		[]any{2, 1192001, 5, 0, 4, 0},      // MainHonor -> RoomUserHonorInfo
		[]any{[]any{1, 5099, 1, 0, 0, 48}}, // SubHonors -> []RoomUserHonorInfo
		6,                                  // CostumeUnitType
		694165,                             // HairCostumeId
		694128,                             // BodyCostumeId
		694127,                             // AccessoryCostumeId
		0,                                  // friendRequestStatus
		[]any{},                            // MemberCharacterRank
		0,                                  // UserPlayerFrameId
	}
	bag := map[string]any{
		"R":      1,
		"Values": map[string]any{"2": map[string]any{"__sync__": "msgpack", "v": arr}},
	}
	out := labelProps(bag, 0).(map[string]any)
	vals := out["Values"].(map[string]any)
	bi, ok := vals["BASIC_INFO"].(map[string]any)
	if !ok {
		t.Fatalf("BASIC_INFO not present/renamed: %v", vals)
	}
	named, ok := bi["v"].(map[string]any)
	if !ok {
		t.Fatalf("BASIC_INFO value not labelled into an object: %v", bi)
	}
	if named["CardId"] != 1223 {
		t.Fatalf("CardId = %v, want 1223", named["CardId"])
	}
	if named["TotalPowerIncludeBuff"] != 273760 {
		t.Fatalf("TotalPowerIncludeBuff = %v, want 273760", named["TotalPowerIncludeBuff"])
	}
	main, ok := named["MainHonor"].(map[string]any)
	if !ok || main["Id"] != 1192001 {
		t.Fatalf("MainHonor not labelled: %v", named["MainHonor"])
	}
	subs, ok := named["SubHonors"].([]any)
	if !ok || len(subs) != 1 {
		t.Fatalf("SubHonors not an array of 1: %v", named["SubHonors"])
	}
	if h0 := subs[0].(map[string]any); h0["HonorMissionProgress"] != 48 {
		t.Fatalf("SubHonors[0] not labelled: %v", subs[0])
	}
}
