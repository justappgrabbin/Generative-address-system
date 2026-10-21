# Reassemble Synthia-Hands-v0.3.0-with-r22-runtime-2.zip

Original: 109,080,938 bytes, sha256 14025d857505ad56d831096e0a857f8a037455850c6330d85c97f936ff99ed00.
Split unchanged with `split -b 90m -d -a 2` because GitHub rejects files over 100 MB (Git LFS not available).

```bash
cd "Synthia-Hands-v0.3.0-with-r22-runtime-2"   # this folder
sha256sum -c PARTS.sha256
cat Synthia-Hands-v0.3.0-with-r22-runtime-2.zip.part* > Synthia-Hands-v0.3.0-with-r22-runtime-2.zip
sha256sum -c Synthia-Hands-v0.3.0-with-r22-runtime-2.zip.sha256
```
