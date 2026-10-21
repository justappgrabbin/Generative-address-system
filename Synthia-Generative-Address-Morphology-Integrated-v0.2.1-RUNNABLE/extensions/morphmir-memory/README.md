# MorphMir memory (additive, v0.1.0)

`MorphMirMemory` extends `MorphMemoryEngine` from `tool-16-morph-mir.js` without editing it. The
original stitches chunks back together by guessing overlaps, which drops bytes from photos and other
binary data.

* **Binary artifacts** are detected automatically (NUL bytes, invalid UTF-8, or more than 10% control
  bytes), or you can set `mode:'binary'`. Each one is cut into 16 KiB chunks.
  * Every chunk is stored at its own address, `morphmir://chunk/<fileSha256>/<index>`, together with
    its sha256, index, start offset, byte length and a `supersedes` link.
  * A manifest is stored at `morphmir://manifest/<fileSha256>` with the name, byte length, whole-file
    sha256, ordered chunk addresses and `supersedes`.
* **Exact regeneration**: `regenerate(id, {mode:'exact'})` rebuilds the file from the stored chunks in
  order. It checks every chunk's hash and the whole-file sha256. A corrupted chunk raises
  `CHUNK_INTEGRITY` and a whole-file mismatch raises `FILE_INTEGRITY`.
* **Text and code** (or `mode:'text'`) go through MorphMir's original code paths unchanged.
* **Chunk recall**: `recallChunk(address)` returns one verified chunk.
* **Persistence**: `memory.export()` and `ExactChunkMemory.import()` give a JSON snapshot (base64 bytes),
  suitable for localStorage or IndexedDB.
* Pure JS. It uses a pure-JS sha256 and needs no network, Workers, WASM or Node APIs.

Tests: `npm test` (10/10). The 323,631-byte JPEG (`389481fa…`), a PNG (`af294b42…`) and 1,000,003
random bytes all round-trip byte-exact. Text/code results are deep-equal to the original engine.
Single-chunk recall, corruption detection, supersedes links and snapshot restore are also covered.
