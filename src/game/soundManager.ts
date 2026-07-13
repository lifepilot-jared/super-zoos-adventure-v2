import type { GameSound } from "./gameTypes";

type BrowserWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

/**
 * iPad-safe sound manager.
 *
 * It plays uploaded audio files when available and otherwise generates a small,
 * child-friendly Web Audio fallback. The implementation is intentionally
 * self-contained so a missing helper module cannot break the production build.
 */
export class SoundManager {
  private readonly fileBasedSounds = new Map<GameSound, HTMLAudioElement>();
  private enabled = true;
  private masterVolume = 0.7;
  private context: AudioContext | null = null;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;

    const browserWindow = window as BrowserWindow;
    const AudioContextClass = window.AudioContext ?? browserWindow.webkitAudioContext;
    if (!AudioContextClass) return null;

    this.context = new AudioContextClass();
    return this.context;
  }

  /** Must be called from a user gesture on iPad Safari. */
  async unlock(): Promise<void> {
    const context = this.getAudioContext();
    if (context?.state === "suspended") {
      await context.resume();
    }
  }

  play(sound: GameSound): void {
    if (!this.enabled) return;

    const fileSound = this.fileBasedSounds.get(sound);
    if (fileSound?.readyState && fileSound.readyState >= 2) {
      fileSound.currentTime = 0;
      fileSound.volume = this.masterVolume;
      void fileSound.play().catch(() => this.playGeneratedFallback(sound));
      return;
    }

    this.playGeneratedFallback(sound);
  }

  private playGeneratedFallback(sound: GameSound): void {
    const context = this.getAudioContext();
    if (!context) return;

    const playAfterResume = () => {
      const now = context.currentTime + 0.01;
      const volume = this.masterVolume;

      switch (sound) {
        case "jump":
          this.tone(context, 320, 720, now, 0.16, volume * 0.22, "sine");
          break;
        case "gem":
          // Short, playful elephant-like celebration.
          this.tone(context, 220, 390, now, 0.26, volume * 0.2, "sawtooth");
          this.tone(context, 520, 820, now + 0.12, 0.2, volume * 0.1, "triangle");
          break;
        case "heroPower":
          this.tone(context, 180, 980, now, 0.42, volume * 0.2, "sawtooth");
          this.tone(context, 420, 1320, now + 0.08, 0.34, volume * 0.12, "triangle");
          break;
        case "shield":
          this.tone(context, 430, 720, now, 0.38, volume * 0.13, "sine");
          this.tone(context, 720, 1050, now + 0.06, 0.32, volume * 0.09, "triangle");
          break;
        case "bump":
          this.tone(context, 150, 72, now, 0.18, volume * 0.18, "sine");
          break;
        case "runEnd":
          this.tone(context, 392, 392, now, 0.15, volume * 0.11, "triangle");
          this.tone(context, 523, 523, now + 0.14, 0.17, volume * 0.12, "triangle");
          this.tone(context, 659, 659, now + 0.3, 0.24, volume * 0.13, "triangle");
          break;
      }
    };

    if (context.state === "suspended") {
      void context.resume().then(playAfterResume).catch(() => undefined);
    } else {
      playAfterResume();
    }
  }

  private tone(
    context: AudioContext,
    startFrequency: number,
    endFrequency: number,
    startTime: number,
    duration: number,
    volume: number,
    type: OscillatorType,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(30, endFrequency),
      startTime + duration,
    );

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volume),
      startTime + Math.min(0.025, duration * 0.2),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
  }

  preloadSound(sound: GameSound, filePath: string): void {
    if (this.fileBasedSounds.has(sound) || typeof Audio === "undefined") return;

    const audio = new Audio(filePath);
    audio.preload = "auto";
    audio.volume = this.masterVolume;
    audio.addEventListener("error", () => this.fileBasedSounds.delete(sound));
    this.fileBasedSounds.set(sound, audio);
  }

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.fileBasedSounds.forEach((audio) => {
      audio.volume = this.masterVolume;
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stopAll();
  }

  stopAll(): void {
    this.fileBasedSounds.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  getStatus(): {
    enabled: boolean;
    volume: number;
    fileBasedCount: number;
    audioContextState: string | null;
  } {
    return {
      enabled: this.enabled,
      volume: this.masterVolume,
      fileBasedCount: this.fileBasedSounds.size,
      audioContextState: this.context?.state ?? null,
    };
  }
}
