export type ScreenState = "start" | "playing" | "paused" | "ended";

export type ObstacleKind = "meteor" | "lightning" | "ice";

export type CollectibleKind = "star" | "heroBadge";

export type PeterMode = "normal" | "super";

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Obstacle = Rect & {
  id: number;
  kind: ObstacleKind;
};

export type Collectible = Rect & {
  id: number;
  kind: CollectibleKind;
};

export type FloatingMessage = {
  id: number;
  text: string;
  createdAt: number;
};

export type GameSound =
  | "jump"
  | "gem"
  | "heroPower"
  | "shield"
  | "bump"
  | "runEnd";
