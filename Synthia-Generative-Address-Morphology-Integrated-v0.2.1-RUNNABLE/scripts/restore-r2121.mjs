#!/usr/bin/env node
// Additive, opt-in r21.21 recovery. Never rewrites the live v0.4.2 assembly.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'recovered-donors/recovery-manifest.json'), 'utf8'));
const core = manifest.files.find(x => x.role === 'optional-legacy-bridge');
const input = process.argv.find((x,i,a) => i>1 && a[i-1] === '--zip') ?? path.join(root, 'vendor/cynthia-original/r21.21', core.name);
const target = path.join(root, 'vendor/cynthia-original/r21.21');
const fail = msg => { console.error(msg); process.exitCode = 1; };
if (!fs.existsSync(input)) {
  fail('Missing r21.21 ZIP: ' + input + '\nUse --zip /path/to/original.zip --install to restore it.');
} else {
  const bytes = fs.readFileSync(input);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== core.bytes || digest !== core.sha256) {
    fail('Fingerprint mismatch; refusing to activate or extract.');
  } else {
    const listing = spawnSync('unzip', ['-Z', '-1', input], {encoding:'utf8', maxBuffer:10*1024*1024});
    if (listing.status !== 0) {
      fail('Cannot list ZIP; install unzip or check archive integrity.');
    } else {
      const entries = listing.stdout.split(/\r?\n/).filter(Boolean);
      const unsafe = entries.find(x => x.startsWith('/') || x.includes('\\') || x.split('/').includes('..') || /^[a-zA-Z]:/.test(x));
      if (unsafe || !entries.includes(core.entry)) {
        fail('Unsafe or incomplete archive; refusing extraction.');
      } else if (process.argv.includes('--install')) {
        fs.mkdirSync(target, {recursive:true});
        const dest = path.join(target, core.name);
        if (path.resolve(input) !== path.resolve(dest)) {
          if (fs.existsSync(dest)) {
            const existing = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
            if (existing !== digest) { fail('Destination archive differs; refusing overwrite.'); process.exit(); }
          } else fs.copyFileSync(input, dest, fs.constants.COPYFILE_EXCL);
        }
        const check = spawnSync('unzip', ['-tqq', dest], {encoding:'utf8'});
        if (check.status !== 0) fail('Archive failed CRC validation.');
        else {
          const extracted = spawnSync('unzip', ['-n', '-qq', dest, '-d', target], {encoding:'utf8'});
          if (extracted.status !== 0 || !fs.existsSync(path.join(target, core.entry))) fail('Extraction failed; existing files were not overwritten.');
          else console.log(JSON.stringify({ok:true, installed:true, target, entry:core.entry, sha256:digest}));
        }
      } else console.log(JSON.stringify({ok:true, installed:false, sha256:digest, entry:core.entry, entries:entries.length}));
    }
  }
}
