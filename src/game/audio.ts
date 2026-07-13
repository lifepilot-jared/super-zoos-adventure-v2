import type { GameSound } from "./gameTypes";

const SOUND_PATHS: Partial<Record<GameSound, string>> = {
  jump: "/super-zoos-dash/sounds/jump.mp3",
  gem: "/super-zoos-dash/sounds/gem.mp3",
  heroPower: "/super-zoos-dash/sounds/hero-power.mp3",
  shield: "/super-zoos-dash/sounds/shield.mp3",
  bump: "/super-zoos-dash/sounds/bump.mp3",
  runEnd: "/super-zoos-dash/sounds/run-end.mp3",
};

export type GameAudioController = {
  unlock: () => void;
  play: (sound: GameSound) => void;
};

type SafariWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function audioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as SafariWindow).webkitAudioContext ?? null;
}

export function createGameAudio(isEnabled: () => boolean): GameAudioController {
  const uploaded = new Map<GameSound, HTMLAudioElement>();
  let context: AudioContext | null = null;
  let unlocked = false;

  function getContext(): AudioContext | null {
    const Constructor = audioContextConstructor();
    if (!Constructor) return null;
    context ??= new Constructor();
    return context;
  }

  function tone(
    ctx: AudioContext,
    frequency: number,
    start: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    endFrequency?: number,
  ) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency), start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  function noise(ctx: AudioContext, start: number, duration: number, volume: number) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1650;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start);
  }

  function synthesize(ctx: AudioContext, sound: GameSound) {
    const now = ctx.currentTime + 0.015;
    switch (sound) {
      case "jump":
        tone(ctx, 290, now, 0.15, 0.22, "sine", 760);
        tone(ctx, 470, now + 0.045, 0.12, 0.12, "triangle", 980);
        noise(ctx, now + 0.13, 0.05, 0.04);
        break;
      case "gem":
        // Peter's cheerful elephant-style trumpet and sparkle.
        tone(ctx, 190, now, 0.26, 0.22, "sawtooth", 360);
        tone(ctx, 275, now + 0.045, 0.24, 0.14, "square", 470);
        tone(ctx, 650, now + 0.18, 0.16, 0.1, "triangle", 980);
        tone(ctx, 1040, now + 0.29, 0.14, 0.07, "sine", 1420);
        break;
      case "heroPower":
        tone(ctx, 145, now, 0.48, 0.22, "sawtooth", 1050);
        tone(ctx, 330, now + 0.075, 0.4, 0.15, "square", 1450);
        tone(ctx, 760, now + 0.26, 0.3, 0.12, "triangle", 1760);
        noise(ctx, now, 0.34, 0.045);
        break;
      case "shield":
        tone(ctx, 360, now, 0.42, 0.15, "sine", 650);
        tone(ctx, 610, now + 0.04, 0.4, 0.11, "triangle", 980);
        tone(ctx, 940, now + 0.13, 0.3, 0.08, "sine", 1280);
        break;
      case "bump":
        tone(ctx, 135, now, 0.2, 0.2, "sine", 62);
        noise(ctx, now, 0.13, 0.07);
        break;
      case "runEnd":
        tone(ctx, 392, now, 0.2, 0.12, "triangle");
        tone(ctx, 523, now + 0.15, 0.21, 0.13, "triangle");
        tone(ctx, 659, now + 0.31, 0.25, 0.14, "triangle");
        tone(ctx, 784, now + 0.5, 0.32, 0.12, "sine");
        break;
    }
  }

  function uploadedAudio(sound: GameSound): HTMLAudioElement | null {
    const path = SOUND_PATHS[sound];
    if (!path) return null;
    const cached = uploaded.get(sound);
    if (cached) return cached;
    const audio = new Audio(path);
    audio.preload = "auto";
    audio.volume = sound === "bump" ? 0.42 : 0.65;
    uploaded.set(sound, audio);
    return audio;
  }

  function runSound(sound: GameSound) {
    const ctx = getContext();
    if (!ctx) return;
    const playNow = () => {
      synthesize(ctx, sound);
      const clip = uploadedAudio(sound);
      if (clip?.readyState && clip.readyState >= 2) {
        clip.currentTime = 0;
        void clip.play().catch(() => undefined);
      }
    };

    if (ctx.state === "running") {
      playNow();
      return;
    }

    void ctx.resume().then(playNow).catch(() => undefined);
  }

  return {
    unlock() {
      unlocked = true;
      const ctx = getContext();
      if (!ctx) return;
      // A silent pulse inside the user's tap primes iPad Safari audio.
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.00001;
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.02);
      void ctx.resume().catch(() => undefined);
    },
    play(sound) {
      if (!unlocked || !isEnabled()) return;
      runSound(sound);
    },
  };
}
