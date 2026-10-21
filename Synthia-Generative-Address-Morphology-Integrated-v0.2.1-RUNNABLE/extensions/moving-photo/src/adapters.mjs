// STAND-IN ADAPTERS for Alexis's VideoGenerator (her geometry/grammar/transitions modules were not provided).
// These are minimal placeholders, NOT her rules. Which address field drives which motion is hers to define: "investigating".
export const DIMS = ['movement', 'evolution', 'being', 'design', 'space'];
export const stubGeometry = { dimensions: Object.fromEntries(DIMS.map((d) => [d, {}])), getFrequency: (_d, v) => v };
// Linear (or eased) trajectory with exactly `frames` keyframes from start to end state.
export function stubTransitions(frames = 24) {
  return { createTrajectory(start, end, duration, kind = 'linear') {
    const keyframes = [];
    for (let i = 0; i < frames; i++) { let t = frames === 1 ? 0 : i / (frames - 1); if (kind === 'ease') t = 0.5 - 0.5 * Math.cos(Math.PI * t);
      const state = {}; for (const d of DIMS) state[d] = (start[d] || 0) + ((end[d] || 0) - (start[d] || 0)) * t;
      keyframes.push({ timestamp: (duration * i) / Math.max(1, frames - 1), state, t }); }
    return { keyframes };
  } };
}
// PLACEHOLDER mapping state -> warp parameters (investigating; replace with her mapping).
export const stubGrammar = { generateScene(s) { return {
  panX: (s.movement || 0) * 0.04, panY: (s.evolution || 0) * 0.02, zoom: 1 + (s.being || 0) * 0.08,
  waveAmp: (s.design || 0) * 0.006, wavePhase: (s.space || 0) * Math.PI * 2, rotate: (s.space || 0) * 0.03, state: s, mapping: 'placeholder-investigating' }; } };
