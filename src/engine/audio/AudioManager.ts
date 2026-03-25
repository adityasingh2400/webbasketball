import { Howl, Howler } from 'howler';
import type { AudioConfig, SoundEffect } from '../../types';
import { playSynthSound, resumeAudioContext } from './SynthSounds';

const DEFAULT_CONFIG: AudioConfig = {
  masterVolume: 1,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  muted: false,
};

type SoundDefinition = {
  src: string[];
  volume: number;
  pitchRange?: [number, number];
};

const SOUND_DEFINITIONS: Record<SoundEffect, SoundDefinition> = {
  swish: {
    src: ['/sounds/swish.webm', '/sounds/swish.mp3'],
    volume: 1,
    pitchRange: [0.95, 1.05],
  },
  rim: {
    src: ['/sounds/rim.webm', '/sounds/rim.mp3'],
    volume: 0.9,
    pitchRange: [0.9, 1.1],
  },
  bounce: {
    src: ['/sounds/bounce.webm', '/sounds/bounce.mp3'],
    volume: 0.7,
    pitchRange: [0.85, 1.15],
  },
  dribble: {
    src: ['/sounds/dribble.webm', '/sounds/dribble.mp3'],
    volume: 0.6,
    pitchRange: [0.9, 1.1],
  },
  crowd_cheer: {
    src: ['/sounds/cheer.webm', '/sounds/cheer.mp3'],
    volume: 0.5,
  },
  crowd_groan: {
    src: ['/sounds/groan.webm', '/sounds/groan.mp3'],
    volume: 0.4,
  },
  whoosh: {
    src: ['/sounds/whoosh.webm', '/sounds/whoosh.mp3'],
    volume: 0.5,
    pitchRange: [0.8, 1.2],
  },
  countdown: {
    src: ['/sounds/countdown.webm', '/sounds/countdown.mp3'],
    volume: 0.8,
  },
};

// Map SoundEffect to SynthSounds sound type
const SYNTH_SOUND_MAP: Record<SoundEffect, 'swish' | 'rim' | 'bounce' | 'dribble' | 'cheer' | 'groan' | 'whoosh' | 'countdown'> = {
  swish: 'swish',
  rim: 'rim',
  bounce: 'bounce',
  dribble: 'dribble',
  crowd_cheer: 'cheer',
  crowd_groan: 'groan',
  whoosh: 'whoosh',
  countdown: 'countdown',
};

export class AudioManager {
  private static instance: AudioManager | null = null;

  private sounds: Map<SoundEffect, Howl> = new Map();
  private loadedSuccessfully: Map<SoundEffect, boolean> = new Map();
  private config: AudioConfig;

  private constructor(config: Partial<AudioConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  async preload(): Promise<void> {
    resumeAudioContext();
    
    const loadPromises: Promise<void>[] = [];

    for (const [effect, def] of Object.entries(SOUND_DEFINITIONS)) {
      const howl = new Howl({
        src: def.src,
        volume: def.volume * this.config.sfxVolume,
        preload: true,
      });

      loadPromises.push(
        new Promise<void>((resolve) => {
          howl.once('load', () => {
            this.loadedSuccessfully.set(effect as SoundEffect, true);
            resolve();
          });
          howl.once('loaderror', () => {
            this.loadedSuccessfully.set(effect as SoundEffect, false);
            resolve();
          });
        })
      );

      this.sounds.set(effect as SoundEffect, howl);
    }

    await Promise.all(loadPromises);
  }

  play(effect: SoundEffect): number {
    if (this.config.muted) {
      return -1;
    }

    const loaded = this.loadedSuccessfully.get(effect);
    
    if (!loaded) {
      const synthType = SYNTH_SOUND_MAP[effect];
      if (synthType) {
        playSynthSound(synthType);
      }
      return -1;
    }

    const howl = this.sounds.get(effect);
    if (!howl) {
      return -1;
    }

    const id = howl.play();

    const definition = SOUND_DEFINITIONS[effect];
    if (definition.pitchRange) {
      const [minPitch, maxPitch] = definition.pitchRange;
      const pitch = minPitch + Math.random() * (maxPitch - minPitch);
      howl.rate(pitch, id);
    }

    return id;
  }

  stop(effect: SoundEffect, id?: number): void {
    const howl = this.sounds.get(effect);
    if (!howl) {
      return;
    }

    if (id !== undefined) {
      howl.stop(id);
    } else {
      howl.stop();
    }
  }

  setVolume(effect: SoundEffect, volume: number, id?: number): void {
    const howl = this.sounds.get(effect);
    if (!howl) {
      return;
    }

    const clampedVolume = Math.max(0, Math.min(1, volume));

    if (id !== undefined) {
      howl.volume(clampedVolume, id);
    } else {
      howl.volume(clampedVolume);
    }
  }

  // Global controls
  setMasterVolume(volume: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    Howler.volume(this.config.masterVolume);
  }

  setSfxVolume(volume: number): void {
    this.config.sfxVolume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach((howl) => {
      howl.volume(this.config.sfxVolume);
    });
  }

  mute(): void {
    this.config.muted = true;
    Howler.mute(true);
  }

  unmute(): void {
    this.config.muted = false;
    Howler.mute(false);
  }

  toggleMute(): boolean {
    if (this.config.muted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.config.muted;
  }

  isMuted(): boolean {
    return this.config.muted;
  }

  getConfig(): AudioConfig {
    return { ...this.config };
  }

  // Convenience methods for game events
  playSwish(): void {
    this.play('swish');
    this.play('crowd_cheer');
  }

  playMiss(): void {
    this.play('crowd_groan');
  }

  playRimHit(): void {
    this.play('rim');
  }

  playRelease(): void {
    this.play('whoosh');
  }

  playDribble(): void {
    this.play('dribble');
  }

  destroy(): void {
    this.sounds.forEach((howl) => {
      howl.stop();
      howl.unload();
    });
    this.sounds.clear();
    AudioManager.instance = null;
  }
}
