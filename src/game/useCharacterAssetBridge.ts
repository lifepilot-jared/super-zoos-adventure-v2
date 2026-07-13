import { useEffect } from "react";
import { CHARACTER_FALLBACKS, getCharacterAsset, type HeroId } from "./config/characterAssets";

const BASE_PATH = typeof window !== "undefined" && window.location.pathname.startsWith("/super-zoos-dash")
  ? "/super-zoos-dash/"
  : "/";

const FRAMES: Record<HeroId, { normal: string[]; super: string[] }> = {
  peter: {
    normal: ["peter-normal-run-01.png", "peter-normal-run-02.png", "peter-normal-run-03.png", "peter-normal-run-04.png"],
    super: ["peter-super-run-01.png", "peter-super-turn-01.png", "peter-super-turn-02.png"],
  },
  judy: {
    normal: ["judy-normal-run-01.png", "judy-normal-run-02.png", "judy-normal-run-03.png", "judy-normal-run-04.png"],
    super: ["judy-super-run-01.png", "judy-super-turn-01.png"],
  },
};

function framePath(filename: string): string {
  return `${BASE_PATH}images/characters/animation/${filename}`;
}

export function useCharacterAssetBridge(): void {
  useEffect(() => {
    const prepared = new WeakSet<HTMLImageElement>();
    const unavailable = new WeakSet<HTMLImageElement>();
    let request = 0;

    function update(runner: Element, now: number): void {
      const image = runner.querySelector<HTMLImageElement>("img.hero-sprite");
      if (!image) return;
      const hero: HeroId = runner.classList.contains("judy") ? "judy" : "peter";
      const aura = runner.classList.contains("shielded");
      const superMode = runner.classList.contains("super");

      image.dataset.hero = hero;
      if (!prepared.has(image)) {
        prepared.add(image);
        image.addEventListener("error", () => {
          unavailable.add(image);
          image.src = CHARACTER_FALLBACKS[hero];
          image.classList.add("using-character-fallback");
        });
      }

      if (unavailable.has(image)) return;

      let source: string;
      if (aura) {
        source = getCharacterAsset(hero, "aura", "back");
      } else {
        const frames = FRAMES[hero][superMode ? "super" : "normal"];
        source = framePath(frames[Math.floor(now / 125) % frames.length]);
      }

      if (!image.src.endsWith(source)) image.src = source;
    }

    function animate(now: number): void {
      document.querySelectorAll(".hero-runner").forEach((runner) => update(runner, now));
      request = requestAnimationFrame(animate);
    }

    request = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(request);
  }, []);
}
