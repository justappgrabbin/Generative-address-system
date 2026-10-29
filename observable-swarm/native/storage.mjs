import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Substrate } from './substrate.mjs';

export async function save(path, substrate) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(substrate.snapshot()), { mode: 0o600 });
  await rename(temporary, path);
}
export async function restore(path) { return Substrate.restore(JSON.parse(await readFile(path, 'utf8'))); }
