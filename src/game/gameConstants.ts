export const WORLD = {
  width: 1000,
  height: 620,
  groundY: 502,
  peterX: 156,
};

export const PLAYER = {
  width: 88,
  height: 126,
  jumpVelocity: -860,
  gravity: 2380,
};

export const MODE = {
  normal: {
    speed: 330,
    obstacleGapMs: 1280,
    collectibleGapMs: 980,
    powerGapMs: 8300,
  },
  calm: {
    speed: 240,
    obstacleGapMs: 1820,
    collectibleGapMs: 1200,
    powerGapMs: 7200,
  },
};

export const POWERS = {
  shieldDurationMs: 2100,
  shieldCooldownMs: 5200,
  heroBadgeSuperMs: 5200,
  postHitGraceMs: 1050,
};

export const STORAGE_KEYS = {
  bestScore: "super-zoos-dash.best-score.v1",
};
