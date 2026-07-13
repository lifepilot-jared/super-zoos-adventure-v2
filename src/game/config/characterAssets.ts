export type HeroId = "peter" | "judy";
export type HeroForm = "normal" | "super" | "aura";
export type HeroView = "front" | "side" | "back";

export type CharacterAssetSet = Record<HeroForm, Record<HeroView, string>>;

const BASE_PATH =
  typeof window !== "undefined" && window.location.pathname.startsWith("/super-zoos-dash")
    ? "/super-zoos-dash/"
    : "/";

function asset(path: string): string {
  return `${BASE_PATH}${path.replace(/^\/+/, "")}`;
}

/**
 * v0.6 character asset contract.
 *
 * The rear PNG filenames are the intended final runner assets. Until those files
 * are uploaded, every missing view falls back to the current canonical SVG so
 * the build remains playable and does not show broken images.
 */
export const CHARACTER_ASSETS: Record<HeroId, CharacterAssetSet> = {
  peter: {
    normal: {
      front: asset("images/characters/peter.svg"),
      side: asset("images/characters/peter.svg"),
      back: asset("images/characters/peter-normal-back.png"),
    },
    super: {
      front: asset("images/characters/peter.svg"),
      side: asset("images/characters/peter.svg"),
      back: asset("images/characters/peter-super-back.png"),
    },
    aura: {
      front: asset("images/characters/peter.svg"),
      side: asset("images/characters/peter.svg"),
      back: asset("images/characters/peter-super-aura-back.png"),
    },
  },
  judy: {
    normal: {
      front: asset("images/characters/judy.svg"),
      side: asset("images/characters/judy.svg"),
      back: asset("images/characters/judy-normal-back.png"),
    },
    super: {
      front: asset("images/characters/judy.svg"),
      side: asset("images/characters/judy.svg"),
      back: asset("images/characters/judy-super-back.png"),
    },
    aura: {
      front: asset("images/characters/judy.svg"),
      side: asset("images/characters/judy.svg"),
      back: asset("images/characters/judy-super-aura-back.png"),
    },
  },
};

export const CHARACTER_FALLBACKS: Record<HeroId, string> = {
  peter: asset("images/characters/peter.svg"),
  judy: asset("images/characters/judy.svg"),
};

export function getCharacterAsset(hero: HeroId, form: HeroForm, view: HeroView): string {
  return CHARACTER_ASSETS[hero][form][view];
}
