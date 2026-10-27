// Explicit local-only bridge from Trident to the existing Klein contact loop.
// Run: node trident-contact-server.mjs (inside execution-spine).
import http from 'node:http';
import { SynthiaAutomata } from './src/pure-synthia/engine/synthia.js';

const engine = new SynthiaAutomata();
const HOST = '127.0.0.1';
const PORT = 8765;
const server = http.createServer(async (req, res) => {
  const respond = (status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  };
  if (req.method === 'GET' && req.url === '/health') {
    respond(200, { ok: true, engine: 'SynthiaAutomata', mode: 'deep-klein-contact-loop' }); return;
  }
  if (req.method !== 'POST' || req.url !== '/contact') {
    respond(404, { error: 'not-found' }); return;
  }
  try {
    let text = '';
    for await (const chunk of req) {
      text += chunk.toString('utf8');
      if (text.length > 16384) { respond(413, { error: 'input-too-large' }); return; }
    }
    const input = JSON.parse(text);
    if (typeof input.text !== 'string' || !input.text.trim()) {
      respond(400, { error: 'text-required' }); return;
    }
    const result = engine.contact({ text: input.text, seed: 1 });
    const utterance = result?.stages?.chat?.utterance;
    if (typeof utterance !== 'string' || !utterance) {
      respond(500, { error: 'missing-chat-utterance' }); return;
    }
    respond(200, {
      ok: true, utterance,
      mode: result.mode,
      delivered: result.transport?.delivered === true,
      evaluationId: result.kleinEvaluation?.evaluationId ?? null
    });
  } catch (error) {
    respond(500, { error: 'contact-failed', detail: String(error?.message || error) });
  }
});
server.listen(PORT, HOST, () => console.log(`Synthia contact bridge: http://${HOST}:${PORT}/health`));
