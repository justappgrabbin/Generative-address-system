// LABELLED FIX 2026-11-05 (Pink). Original ../tool-15-diseminer.js UNTOUCHED.
// Fixes capability failures 3–4:
//  3. Cross-passage contradictions: compare new claims against ALL stored claims, not only the current batch.
//  4. CJK / Unicode terms kept: tokenize with \p{L}\p{N} so 乾 坤 陰 陽 are not stripped.
// Words remain measurements of expression (contexts + cooccurrence), not bare Latin tokens.
import {
  DiseminerEngine as BaseDiseminerEngine,
  DiseminerError,
} from '../tool-15-diseminer.js';

const NEGATION = ['not', 'no', 'never', 'none', 'without', 'against', '不', '非', '無', '无'];

export class DiseminerEngine extends BaseDiseminerEngine {
  /**
   * Unicode-aware tokenizer. Keeps letters of any script (CJK included).
   * Latin function-noise of length ≤ 2 is still dropped; single CJK characters are kept
   * because each is a full lexical item in the Yijing lexicon.
   */
  tokenize(text) {
    const raw = String(text).match(/[\p{L}\p{N}]+/gu) || [];
    return raw
      .map((t) => t.toLowerCase())
      .filter((t) => {
        // Keep any token that contains a non-Latin letter (e.g. CJK), regardless of length.
        if (/[^\u0000-\u007f]/.test(t)) return true;
        return t.length > 2;
      });
  }

  extractClaims(text, source = 'observation') {
    const sentences = String(text).split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
    const extracted = [];
    for (const sentence of sentences) {
      const claim = this.extractClaimFromSentence(sentence, source);
      if (claim) {
        extracted.push(claim);
        this.claims.set(claim.id, claim);
      }
    }
    // Capability 3: link against the whole memory, not only this batch.
    this.crossReferenceClaims([...this.claims.values()]);
    return extracted;
  }

  crossReferenceClaims(claims) {
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const a = claims[i];
        const b = claims[j];
        if (!a || !b || a.id === b.id) continue;

        const sameSubject = a.subject === b.subject;
        const aNeg = NEGATION.some((w) => a.text.toLowerCase().includes(w));
        const bNeg = NEGATION.some((w) => b.text.toLowerCase().includes(w));

        // Contradiction: same subject, opposed polarity (negation mismatch), related predicate/object.
        const relatedPredicate =
          a.predicate !== b.predicate
          || a.object !== b.object
          || aNeg !== bNeg;
        if (sameSubject && aNeg !== bNeg && relatedPredicate) {
          if (!a.contradictions.includes(b.id)) a.contradictions.push(b.id);
          if (!b.contradictions.includes(a.id)) b.contradictions.push(a.id);
          continue;
        }

        // Original support rule: same subject+predicate reinforce.
        if (sameSubject && a.predicate === b.predicate && aNeg === bNeg) {
          if (!a.supports.includes(b.id)) a.supports.push(b.id);
          if (!b.supports.includes(a.id)) b.supports.push(a.id);
        }
      }
    }
  }
}

export { DiseminerError };
export default DiseminerEngine;
