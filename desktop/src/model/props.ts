// Static copy of the SyncProperty key maps, mirrored from the Go decoder
// (internal/diarkis/props.go — the source of truth). The Go side renames each
// property bag's integer key to its name and drops the numeric id; the UI keeps
// these maps to show the id (and to fall back for the type) in PropertyTable.
//
// If props.go changes, update this file. Type codes: 1 byte, 2 int32, 3 int64,
// 4 string, 5 float, 6 bool, 7 object.

export interface PropMeta {
  id: number;
  type: number;
}

export type PropKind = "room" | "player";

export const roomProps: Record<string, PropMeta> = {
  MESSAGE: { id: 1, type: 2 },
  STEP: { id: 2, type: 2 },
  ATYPE: { id: 3, type: 2 },
  SELECTED_MUSIC_ID: { id: 4, type: 2 },
  MASTER_LOBBY_ID: { id: 5, type: 2 },
  RECRUIT_TOTAL_POWER: { id: 6, type: 2 },
  MATCH_SCALEUP_FINISH: { id: 8, type: 1 },
  IS_PUBLISH: { id: 9, type: 1 },
  ROOM_NUMBER: { id: 10, type: 2 },
  SELECTED_MUSIC_USER_ID: { id: 11, type: 4 },
  LIVE_ID: { id: 12, type: 4 },
  RANDOM_SEED: { id: 13, type: 4 },
};

export const playerProps: Record<string, PropMeta> = {
  nickname: { id: 1, type: 4 },
  BASIC_INFO: { id: 2, type: 7 },
  TEAM_ID: { id: 3, type: 2 },
  STATUS: { id: 4, type: 2 },
  JOIN_ROUTE: { id: 5, type: 2 },
  PARTY_INDEX: { id: 6, type: 2 },
  SELECT_DIFFICULTY: { id: 7, type: 4 },
  MUSIC_ID: { id: 8, type: 2 },
  IS_ENTRUST: { id: 9, type: 2 },
  RESULT: { id: 10, type: 7 },
};

export const TYPE_NAME: Record<number, string> = {
  1: "byte",
  2: "int32",
  3: "int64",
  4: "string",
  5: "float",
  6: "bool",
  7: "object",
};

export function propMap(kind: PropKind): Record<string, PropMeta> {
  return kind === "room" ? roomProps : playerProps;
}

// lookup returns the id/type for a named key in a room/player bag, or undefined
// when the key was left numeric (unknown to the Go maps).
export function lookup(kind: PropKind, name: string): PropMeta | undefined {
  return propMap(kind)[name];
}
