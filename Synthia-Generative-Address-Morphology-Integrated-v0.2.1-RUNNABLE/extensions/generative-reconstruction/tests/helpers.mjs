import fs from 'node:fs'; import path from 'node:path';
import * as G from '../src/index.mjs';
export const HERE = import.meta.dirname;
export const JPG = ['/workspace/v05/n4/uc/grok_1786623505617.jpg', path.join(HERE, '..', '..', 'morphmir-memory', 'fixtures', 'photo.jpg')].find((p) => fs.existsSync(p));
export const jpegBytes = () => new Uint8Array(fs.readFileSync(JPG));
/** Generated test image: gradient + disc + stripes. */
export function synthetic(w = 96, h = 64, cx = 40) { const d = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, inDisc = (x - cx) ** 2 + (y - 32) ** 2 < 300; d[i] = inDisc ? 230 : (x * 255) / w; d[i + 1] = inDisc ? 60 : (y * 255) / h; d[i + 2] = (x >> 3) % 2 ? 180 : 90; d[i + 3] = 255; } return { width: w, height: h, data: d }; }
export { G };
