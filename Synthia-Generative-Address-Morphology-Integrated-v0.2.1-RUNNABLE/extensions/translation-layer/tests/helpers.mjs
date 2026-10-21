import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIX = path.join(HERE, '..', 'fixtures');
export const DONOR = path.join(HERE, '..', '..', 'generative-address-morphology', 'vendor', 'address_space_engine.py');
export const read = (p) => fs.readFileSync(p, 'utf8');
export function deepClose(a, b, tol, p = '$', out = []) {
  if (typeof a === 'number' && typeof b === 'number') { const rel = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300); if (rel > tol && Math.abs(a - b) > tol) out.push(`${p}: ${a} vs ${b}`); return out; }
  if (a && b && typeof a === 'object' && typeof b === 'object') { const keys = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of keys) deepClose(a[k], b[k], tol, `${p}.${k}`, out); return out; }
  if (a !== b) out.push(`${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  return out;
}
