// Generates the Mind Reset audio from the original bell; provenance in assets/audio/README.md.
import { writeFileSync, readFileSync } from 'node:fs';
import { buildTrack, decodeWav, encodeWav, processCue, RATE, synthesizeBell } from './mindResetBell.mjs';

const directory = new URL('../assets/audio/', import.meta.url);
const sourceUrl = new URL('mind-reset-bell-source.wav', directory);

writeFileSync(sourceUrl, encodeWav(synthesizeBell()));
// Read back through the same strict format check used for any source file.
const source = decodeWav(readFileSync(sourceUrl));
if (source.length <= 0 || source.length >= RATE * 10) throw new Error('Cue must fit inside 10 seconds');
// Native timeline: 0, 60, ... 300. The final bell plays after visual completion; the
// remaining silence keeps the 310 s end used by playback's missed-end fallback.
writeFileSync(new URL('mind-reset-provisional.wav', directory), encodeWav(buildTrack(processCue(source))));
