import fs from 'node:fs'; import path from 'node:path';
import * as T from '../src/index.mjs';
export const HERE = import.meta.dirname;
export const SRC = path.join(HERE, '..', 'src', 'index.mjs');
export const JPG = ['/workspace/v05/n4/uc/grok_1786623505617.jpg', path.join(HERE, '..', '..', 'morphmir-memory', 'fixtures', 'photo.jpg')].find((p) => fs.existsSync(p));
export const SIZE = 16;
/** Crops of her photo: source crop + address -> a different target crop. Gates are just numbers fed to her encoder. */
export function photoPairs() {
  const img = T.decodeImageBytes(new Uint8Array(fs.readFileSync(JPG)));
  const side = Math.floor(Math.min(img.width, img.height) / 2);
  const at = (fx, fy) => T.toField(img, SIZE, { x: Math.floor((img.width - side) * fx), y: Math.floor((img.height - side) * fy), side });
  const A = at(0, 0), B = at(1, 0), C = at(0, 1), D = at(1, 1);
  return [
    { name: 'A->B@gate1', source: A, target: B, address: { ...T.DEFAULT_ADDRESS, gate: 1 } },
    { name: 'A->C@gate33', source: A, target: C, address: { ...T.DEFAULT_ADDRESS, gate: 33 } },
    { name: 'A->D@gate64', source: A, target: D, address: { ...T.DEFAULT_ADDRESS, gate: 64 } },
    { name: 'B->D@gate33', source: B, target: D, address: { ...T.DEFAULT_ADDRESS, gate: 33 } },
  ];
}
export { T };
