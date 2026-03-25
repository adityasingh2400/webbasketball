type SoundType = 'swish' | 'rim' | 'bounce' | 'dribble' | 'cheer' | 'groan' | 'whoosh' | 'countdown';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function playNoise(
  duration: number,
  startFreq: number,
  endFreq: number,
  volume: number,
  type: OscillatorType = 'sine',
): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

function playWhiteNoise(duration: number, volume: number): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2000, now);
  filter.Q.setValueAtTime(1, now);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(now);
}

export function playSynthSound(sound: SoundType, pitchVariation = 1): void {
  const pitch = 0.9 + Math.random() * 0.2 * pitchVariation;

  switch (sound) {
    case 'swish':
      playWhiteNoise(0.3, 0.15);
      playNoise(0.2, 800 * pitch, 400, 0.1, 'sine');
      break;

    case 'rim':
      playNoise(0.15, 1200 * pitch, 600, 0.2, 'triangle');
      playNoise(0.1, 2400 * pitch, 1200, 0.1, 'sine');
      break;

    case 'bounce':
      playNoise(0.1, 150 * pitch, 80, 0.25, 'sine');
      playNoise(0.05, 300 * pitch, 150, 0.1, 'triangle');
      break;

    case 'dribble':
      playNoise(0.08, 200 * pitch, 100, 0.2, 'sine');
      break;

    case 'cheer':
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          playWhiteNoise(0.4, 0.08);
          playNoise(0.3, 400 + Math.random() * 200, 300, 0.05, 'sine');
        }, i * 50);
      }
      break;

    case 'groan':
      playWhiteNoise(0.5, 0.06);
      playNoise(0.4, 200, 150, 0.08, 'sawtooth');
      break;

    case 'whoosh':
      playWhiteNoise(0.2, 0.1);
      playNoise(0.15, 400 * pitch, 800, 0.08, 'sine');
      break;

    case 'countdown':
      playNoise(0.1, 880 * pitch, 880 * pitch, 0.15, 'square');
      break;
  }
}

export function resumeAudioContext(): void {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
}
