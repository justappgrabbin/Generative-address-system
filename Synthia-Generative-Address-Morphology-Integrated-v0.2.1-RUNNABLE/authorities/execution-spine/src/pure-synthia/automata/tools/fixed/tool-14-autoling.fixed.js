// LABELLED FIX 2026-11-05 (Pink). Original ../tool-14-autoling.js UNTOUCHED.
// Fixes capability failures 1–2 while keeping Klein coin-on-failure architecture:
//  1. A second distinct unparsable sentence must coin a new sentence rule (H1 not only when grammar empty).
//  2. Repeated contextual exposure classifies domain terms by expression role (DET+X+VERB → X is NOUN),
//     treating words as measurements of expression, not bare unknown tokens.
// Also: cross-frame H2 — fillers that alternate in an otherwise identical frame join one Class_n.
import {
  AutolingEngine as BaseAutolingEngine,
  AutolingError,
  AutolingAutomaton,
} from '../tool-14-autoling.js';

const FUNCTION_WORDS = new Set(
  ('a an the is are was were be been being of to in on at by for with from as into through about '
    + 'and or but not no that which who whom what where when why how this these those it its '
    + 'their there here than then so if can could will would should must may might do does did '
    + 'i me my mine we us our ours you your yours he him his she her hers they them their theirs')
    .split(/\s+/),
);

export class AutolingEngine extends BaseAutolingEngine {
  constructor() {
    super();
    // lemma → { pos, support, environments: string[] } — expression measurements from context
    this.expressionLexicon = new Map();
    this.frameTemplates = []; // { pattern: (TOKEN|'SLOT')[], fillers: Map<slotIndex, Set<lemma>> }
  }

  #tokens(sentence) {
    return String(sentence).split(/\s+/).filter(Boolean);
  }

  #lemma(token) {
    return String(token).toLowerCase();
  }

  /**
   * Record how a word is used in its local frame (words as measurements of expression).
   * DET _ VERB  ⇒ the middle slot measures a nominal expression (NOUN).
   * VERB _      after a verb ⇒ object-like / nominal.
   */
  #observeExpression(tokens) {
    for (let i = 0; i < tokens.length; i++) {
      const lemma = this.#lemma(tokens[i]);
      if (FUNCTION_WORDS.has(lemma)) continue;
      const prev = i > 0 ? this.inferPOS(tokens[i - 1]) : null;
      const next = i + 1 < tokens.length ? this.inferPOS(tokens[i + 1]) : null;
      // Prefer hard feature POS for neighbors when available from the base lexicon.
      const prevFeat = i > 0 ? this.#basePosHint(tokens[i - 1]) : null;
      const nextFeat = i + 1 < tokens.length ? this.#basePosHint(tokens[i + 1]) : null;
      const left = prevFeat || prev;
      const right = nextFeat || next;
      let pos = null;
      if (left === 'DET' && (right === 'VERB' || right === 'UNKNOWN' || right === null)) pos = 'NOUN';
      else if (left === 'DET') pos = 'NOUN';
      else if (left === 'VERB' || right === 'VERB') pos = 'NOUN';
      if (!pos) continue;
      const entry = this.expressionLexicon.get(lemma) || { pos, support: 0, environments: [] };
      if (entry.pos === 'UNKNOWN' || !entry.pos) entry.pos = pos;
      // Once NOUN (or other content POS) is measured, keep it; do not regress to UNKNOWN.
      if (pos === 'NOUN') entry.pos = 'NOUN';
      entry.support += 1;
      const env = `${left || '_'} + ${lemma} + ${right || '_'}`;
      if (entry.environments.length < 12) entry.environments.push(env);
      this.expressionLexicon.set(lemma, entry);
    }
  }

  #basePosHint(token) {
    // Call parent's feature-only infer without our override recursion: use extract via temporary.
    const features = (() => {
      // Duplicate the tiny decision table from the original inferPOS feature path.
      const f = {
        noun: /^(man|woman|dog|cat|fish|book|table|car|house|tree)$/i.test(token),
        verb: /^(eat|run|walk|talk|read|write|sleep|think|love|hate|is|are|am|was|were|changes|transforms|change|transform)$/i.test(token),
        determiner: /^(the|a|an|this|that|these|those)$/i.test(token),
        adjective: /^(big|small|red|blue|happy|sad|good|bad|old|new)$/i.test(token),
        adverb: /^(quickly|slowly|happily|sadly|very|quite|rather)$/i.test(token),
        preposition: /^(in|on|at|by|with|from|to|for|of|about)$/i.test(token),
      };
      if (f.noun) return 'NOUN';
      if (f.verb) return 'VERB';
      if (f.determiner) return 'DET';
      if (f.adjective) return 'ADJ';
      if (f.adverb) return 'ADV';
      if (f.preposition) return 'PREP';
      // Morphology endings as soft verb hint for expression frames.
      if (/(?:es|ed|ing)$/i.test(token) && token.length > 3) return 'VERB';
      return null;
    })();
    return features;
  }

  inferPOS(token) {
    const lemma = this.#lemma(token);
    const measured = this.expressionLexicon.get(lemma);
    if (measured && measured.pos && measured.pos !== 'UNKNOWN' && measured.support >= 1) {
      return measured.pos;
    }
    const base = super.inferPOS(token);
    if (base !== 'UNKNOWN') return base;
    // Soft morphological verb cue so DET+X+changes frames resolve X as NOUN on first pass neighbors.
    if (/(?:es|ed|ing)$/i.test(token) && token.length > 3) return 'VERB';
    return 'UNKNOWN';
  }

  attemptParse(tokens) {
    // Exact sentence-rule match (original).
    const exact = super.attemptParse(tokens);
    if (exact.complete) return exact;
    // Also succeed when a prior Class_n covers the single differing slot against an existing S rule.
    for (const rule of this.grammar) {
      if (!rule.isSentenceRule || rule.rhs.length !== tokens.length) continue;
      let diff = 0;
      let diffAt = -1;
      for (let i = 0; i < tokens.length; i++) {
        if (rule.rhs[i] !== tokens[i]) { diff++; diffAt = i; }
      }
      if (diff === 1) {
        const classes = this.grammar.filter((r) => !r.isSentenceRule && r.rhs.includes(rule.rhs[diffAt]) && r.rhs.includes(tokens[diffAt]));
        if (classes.length) return { complete: true, via: classes[0].lhs };
      }
    }
    return { complete: false };
  }

  applyHeuristics(tokens) {
    const rules = [];
    // Capability 1: H1 coin-on-failure for EVERY new unparsable sentence (not only grammar.length===0).
    const alreadyExact = this.grammar.some(
      (r) => r.isSentenceRule && r.rhs.join(' ') === tokens.join(' '),
    );
    if (!alreadyExact) {
      this.heuristicCounters.h1++;
      const rule = {
        lhs: `S_${this.heuristicCounters.h1}`,
        rhs: [...tokens],
        isSentenceRule: true,
        isContextSensitive: false,
        testHistory: [],
        confidence: 0.5,
      };
      this.grammar.push(rule);
      rules.push(rule);
    }

    // Cross-frame H2: find an existing sentence rule that differs in exactly one slot → same Class.
    for (const prior of this.grammar) {
      if (!prior.isSentenceRule || prior.rhs.length !== tokens.length) continue;
      const diffs = [];
      for (let i = 0; i < tokens.length; i++) {
        if (prior.rhs[i] !== tokens[i]) diffs.push(i);
      }
      if (diffs.length === 1) {
        const i = diffs[0];
        const a = prior.rhs[i];
        const b = tokens[i];
        const exists = this.grammar.some(
          (r) => !r.isSentenceRule && r.rhs.length === 2 && r.rhs.includes(a) && r.rhs.includes(b),
        );
        if (!exists) {
          this.heuristicCounters.h2++;
          const rule = {
            lhs: `Class_${this.heuristicCounters.h2}`,
            rhs: [a, b],
            isSentenceRule: false,
            isContextSensitive: false,
            testHistory: [],
            confidence: 0.6,
            environment: tokens.map((t, idx) => (idx === i ? '_' : t)),
          };
          this.grammar.push(rule);
          rules.push(rule);
        }
      }
    }

    // Keep original same-sentence H2 (identical environments within one sentence).
    for (let i = 0; i < tokens.length - 1; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const env1 = tokens.slice(0, i).concat(tokens.slice(i + 1));
        const env2 = tokens.slice(0, j).concat(tokens.slice(j + 1));
        if (JSON.stringify(env1) === JSON.stringify(env2)) {
          this.heuristicCounters.h2++;
          const rule = {
            lhs: `Class_${this.heuristicCounters.h2}`,
            rhs: [tokens[i], tokens[j]],
            isSentenceRule: false,
            isContextSensitive: false,
            testHistory: [],
            confidence: 0.6,
          };
          this.grammar.push(rule);
          rules.push(rule);
        }
      }
    }
    return rules;
  }

  learnPhraseStructure(sentence) {
    const tokens = this.#tokens(sentence);
    this.#observeExpression(tokens);
    this.frame++;
    const parse = this.attemptParse(tokens);
    if (parse.complete) {
      // Still accumulate expression measurements on recognizable sentences.
      return { grammar: this.grammar, newRules: [], tests: [] };
    }
    const newRules = this.applyHeuristics(tokens);
    const tests = newRules.map((rule) => this.testRule(rule));
    // Re-observe after class coining so fillers share expression role.
    this.#observeExpression(tokens);
    return { grammar: this.grammar, newRules, tests };
  }

  runPipeline(input) {
    // Ensure expression observation happens before semantic POS tagging.
    const tokens = this.#tokens(input);
    this.#observeExpression(tokens);
    const result = super.runPipeline(input);
    // Re-tag nodes with measured expression POS (words as measurements of expression).
    if (result.parseTree && Array.isArray(result.parseTree.nodes)) {
      for (const node of result.parseTree.nodes) {
        if (node && node.surface) {
          const measured = this.inferPOS(node.surface);
          if (measured && measured !== 'UNKNOWN') {
            node.pos = measured;
            node.expressionSupport = this.expressionLexicon.get(this.#lemma(node.surface))?.support || 0;
          }
        }
      }
    }
    return result;
  }
}

export { AutolingError, AutolingAutomaton };
export default AutolingEngine;
