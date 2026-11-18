// User-supplied recording; provenance in assets/audio/README.md.
import { readFileSync, writeFileSync } from 'node:fs';
const directory = new URL('../assets/audio/', import.meta.url);
const source = readFileSync(new URL('mind-reset-chime-source.wav', directory));
const rate = 16000;
if (source.toString('ascii', 0, 4) !== 'RIFF' || source.readUInt16LE(20) !== 1
  || source.readUInt16LE(22) !== 1 || source.readUInt32LE(24) !== rate
  || source.readUInt16LE(34) !== 16 || source.toString('ascii', 36, 40) !== 'data') {
  throw new Error('Expected mono 16-bit 16kHz source WAV');
}
const length = (source.length - 44) / 2;
if (length <= 0 || length >= rate * 10) throw new Error('Cue must fit inside 10 seconds');
const cue = Array.from({ length }, (_, i) => {
  // Preserve the full recording, with short edge fades to prevent clicks.
  const attack = Math.min(1, i / (rate * 0.02));
  const tail = Math.min(1, (length - 1 - i) / (rate * 0.1));
  return source.readInt16LE(44 + i * 2) * attack * tail;
});
const peak = cue.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
if (!peak) throw new Error('Source is silent');
const wav = Buffer.alloc(44 + rate * 310 * 2);
source.copy(wav, 0, 0, 44);
wav.writeUInt32LE(wav.length - 8, 4);
wav.writeUInt32LE(wav.length - 44, 40);
// Native timeline: 0, 10, ... 300. Preserve the last cue after visual completion.
for (let second = 0; second <= 300; second += 10) {
  cue.forEach((value, i) => wav.writeInt16LE(Math.round(value / peak * 0.6 * 32767), 44 + (second * rate + i) * 2));
}
writeFileSync(new URL('mind-reset-provisional.wav', directory), wav);
