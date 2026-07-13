import { STORAGE_KEYS } from "./gameConstants";

export function readBestScore(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.bestScore);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(score: number): number {
  const current = readBestScore();
  const best = Math.max(current, score);
  try {
    window.localStorage.setItem(STORAGE_KEYS.bestScore, String(best));
  } catch {
    // localStorage can be unavailable in some private browser modes.
  }
  return best;
}
