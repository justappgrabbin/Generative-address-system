import { readFile } from 'node:fs/promises';

/** File-format adapter only. This function neither reconstructs nor learns. */
export async function readPGM(path) {
  const tokens = (await readFile(path, 'utf8')).replace(/#[^\n]*/g, '').trim().split(/\s+/);
  if (tokens.shift() !== 'P2') throw Error('Only ASCII PGM (P2) input is currently supported');
  const [width, height, maximum] = tokens.splice(0, 3).map(Number);
  if (![width, height, maximum].every(Number.isInteger) || width <= 0 || height <= 0 || width * height > 65536 || maximum <= 0 || maximum > 65535 || tokens.length !== width * height) throw Error('Invalid PGM dimensions or sample count');
  const samples = tokens.map(Number);
  if (samples.some(v => !Number.isInteger(v) || v < 0 || v > maximum)) throw Error('Invalid PGM sample');
  return { width, height, samples: samples.map(v => v / maximum), provenance: String(path) };
}
