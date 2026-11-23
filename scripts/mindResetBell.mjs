// Original Mind Reset bell, created for Dad Health by additive synthesis.
// No recorded or third-party audio is used. Pure functions: generation and tests share them.

export const RATE = 16000;
export const TRACK_SECONDS = 310; // playback's missed-end fallback ends the session at 310 s
export const CUE_SECONDS = [0, 60, 120, 180, 240, 300]; // minute chimes; 300 marks completion

const F0 = 392; // G4
const PARTIALS = [ // [frequency ratio, relative amplitude, decay time constant (s)]
  [1.000, 1.00, 1.60],
  [1.004, 0.55, 1.60], // gentle ~1.6 Hz shimmer against the fundamental
  [2.756, 0.30, 0.90],
  [5.404, 0.09, 0.45],
  [8.933, 0.03, 0.25],
];
const DURATION = 4.0;
const ATTACK = 0.012; // soft mallet, no click
const RELEASE = 0.35;

/** The bell as 16-bit PCM samples at 16 kHz (source level 0.5 of full scale). */
export function synthesizeBell() {
  const length = Math.round(RATE * DURATION);
  const values = Array.from({ length }, (_, i) => {
    const t = i / RATE;
    let value = 0;
    for (const [ratio, amplitude, decay] of PARTIALS) {
      value += amplitude * Math.exp(-t / decay) * Math.sin(2 * Math.PI * F0 * ratio * t);
    }
    const attack = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, t / ATTACK));
    const release = Math.min(1, (DURATION - t) / RELEASE);
    return value * attack * release;
  });
  const peak = values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  return Int16Array.from(values, (value) => Math.max(-32767, Math.min(32767, Math.round(value / peak * 0.5 * 32767))));
}

/** Playback processing: 20 ms attack fade, 100 ms end fade, peak normalised to 0.6 full scale. */
export function processCue(samples) {
  const length = samples.length;
  const faded = Array.from(samples, (value, i) =>
    value * Math.min(1, i / (RATE * 0.02)) * Math.min(1, (length - 1 - i) / (RATE * 0.1)));
  const peak = faded.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  if (!peak) throw new Error('Cue is silent');
  return Int16Array.from(faded, (value) => Math.round(value / peak * 0.6 * 32767));
}

/** 310-second track with one complete cue at each cue second and silence elsewhere. */
export function buildTrack(cue) {
  if (CUE_SECONDS.some((second) => second * RATE + cue.length > TRACK_SECONDS * RATE)) {
    throw new Error('Every cue must finish inside the track');
  }
  const track = new Int16Array(RATE * TRACK_SECONDS);
  for (const second of CUE_SECONDS) track.set(cue, second * RATE);
  return track;
}

/** Mono 16-bit PCM WAV with the standard 44-byte header. */
export function encodeWav(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0, 'ascii'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii'); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(RATE, 24); buffer.writeUInt32LE(RATE * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii'); buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, i) => buffer.writeInt16LE(value, 44 + i * 2));
  return buffer;
}

/** Samples from a mono 16-bit 16 kHz WAV; rejects anything else. */
export function decodeWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.readUInt16LE(20) !== 1 || buffer.readUInt16LE(22) !== 1
    || buffer.readUInt32LE(24) !== RATE || buffer.readUInt16LE(34) !== 16 || buffer.toString('ascii', 36, 40) !== 'data') {
    throw new Error('Expected mono 16-bit 16kHz WAV');
  }
  const length = (buffer.length - 44) / 2;
  return Int16Array.from({ length }, (_, i) => buffer.readInt16LE(44 + i * 2));
}
