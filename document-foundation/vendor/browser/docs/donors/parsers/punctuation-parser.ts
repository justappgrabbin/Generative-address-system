
/**
 * CONTEXT-AWARE PUNCTUATION PARSER
 * 
 * The symbolic punctuation language is powerful but context-dependent.
 * A period can mean sentence end, hierarchical operator, or transition marker.
 * 
 * Disambiguation Rules:
 * 1. Numeric tokens surrounding '.' → hierarchical operator (Gate.Line)
 * 2. Preceded by Gate identifier → coordinate delimiter
 * 3. At end of clause → sentence terminator
 * 4. Standalone with space → transition marker
 * 5. Between words without numbers → sentence end
 */

export type PunctuationToken = 
  | 'SINGULARITY'      // • - Big Bang seed, sentence start
  | 'TRANSITION'       // . - Phase transition, clause boundary
  | 'COLLAPSE'         // ° - Wavefunction collapse, period end
  | 'PORTAL'           // : - Threshold crossing, introduce
  | 'FORK'             // ; - Branching path, parallel
  | 'BREATH'           // , - Decoherence moment, pause
  | 'CURRENT'          // – - Continuity operator, span
  | 'PULSE'            // ′ - Arcminute tick, apostrophe
  | 'FLICKER'          // ″ - Arcsecond shimmer, quote
  | 'MIRROR'           // = - State superposition, equivalence
  | 'VECTOR'           // → - Transformation operator, becomes
  | 'HIERARCHICAL'     // . - Gate.Line delimiter (contextual)
  | 'TERMINATOR'       // . - Sentence end (contextual)
  | 'UNKNOWN';

export interface ParsedToken {
  type: PunctuationToken;
  char: string;
  position: number;
  context: string;
  confidence: number;
}

export class PunctuationParser {
  private readonly SYMBOLS: Record<string, PunctuationToken> = {
    '•': 'SINGULARITY',
    '°': 'COLLAPSE',
    ':': 'PORTAL',
    ';': 'FORK',
    ',': 'BREATH',
    '–': 'CURRENT',
    '′': 'PULSE',
    '″': 'FLICKER',
    '=': 'MIRROR',
    '→': 'VECTOR'
  };

  /**
   * Parse a string containing symbolic punctuation.
   * Returns disambiguated tokens with context and confidence scores.
   */
  parse(input: string): ParsedToken[] {
    const tokens: ParsedToken[] = [];
    const chars = input.split('');

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];

      // Handle period specially (most ambiguous)
      if (char === '.') {
        const token = this.disambiguatePeriod(input, i);
        tokens.push(token);
        continue;
      }

      // Handle other symbols directly
      if (this.SYMBOLS[char]) {
        tokens.push({
          type: this.SYMBOLS[char],
          char,
          position: i,
          context: this.extractContext(input, i),
          confidence: 1.0
        });
      }
    }

    return tokens;
  }

  /**
   * Disambiguate period based on context.
   */
  private disambiguatePeriod(input: string, position: number): ParsedToken {
    const before = input.slice(0, position).trim();
    const after = input.slice(position + 1).trim();

    // Rule 1: Numeric tokens surrounding '.' → hierarchical operator
    // Pattern: digit.digit (e.g., "25.1", "3.60")
    const beforeMatch = before.match(/(\d+)$/);
    const afterMatch = after.match(/^(\d+)/);
    if (beforeMatch && afterMatch) {
      return {
        type: 'HIERARCHICAL',
        char: '.',
        position,
        context: `${beforeMatch[1]}.${afterMatch[1]}`,
        confidence: 0.95
      };
    }

    // Rule 2: Preceded by Gate identifier → coordinate delimiter
    // Pattern: "Gate 25." or "Line 3."
    if (before.match(/(?:Gate|Line|Color|Tone|Base)\s*\d+$/i)) {
      return {
        type: 'HIERARCHICAL',
        char: '.',
        position,
        context: this.extractContext(input, position),
        confidence: 0.9
      };
    }

    // Rule 3: At end of clause (followed by space + capital or end of string)
    if (after.match(/^\s+(?:[A-Z]|$)/) || after === '') {
      return {
        type: 'TERMINATOR',
        char: '.',
        position,
        context: this.extractContext(input, position),
        confidence: 0.85
      };
    }

    // Rule 4: Standalone with space around → transition marker
    if (before.match(/\s$/) && after.match(/^\s/)) {
      return {
        type: 'TRANSITION',
        char: '.',
        position,
        context: this.extractContext(input, position),
        confidence: 0.7
      };
    }

    // Default: transition (safer than terminator in symbolic language)
    return {
      type: 'TRANSITION',
      char: '.',
      position,
      context: this.extractContext(input, position),
      confidence: 0.5
    };
  }

  /**
   * Extract surrounding context for a token.
   */
  private extractContext(input: string, position: number, radius: number = 10): string {
    const start = Math.max(0, position - radius);
    const end = Math.min(input.length, position + radius + 1);
    return input.slice(start, end);
  }

  /**
   * Parse coordinate syntax: Gate.Line.Color.Tone.Base°Degree′Minute″Second
   */
  parseCoordinate(input: string): {
    gate: number;
    line: number;
    color: number;
    tone: number;
    base: number;
    degree: number;
    minute: number;
    second: number;
    axis: string;
    confidence: number;
  } | null {
    // Pattern: digits.digits.digits.digits.digits°digits′digits″digits
    const pattern = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?°?(\d+)?′?(\d+)?″?(\d+)?\s*(.*)?$/;
    const match = input.match(pattern);

    if (!match) return null;

    return {
      gate: parseInt(match[1]) || 1,
      line: parseInt(match[2]) || 1,
      color: parseInt(match[3]) || 1,
      tone: parseInt(match[4]) || 1,
      base: parseInt(match[5]) || 1,
      degree: parseInt(match[6]) || 0,
      minute: parseInt(match[7]) || 0,
      second: parseInt(match[8]) || 0,
      axis: match[9] || '',
      confidence: match[2] ? (match[5] ? 1.0 : 0.7) : 0.4
    };
  }

  /**
   * Parse a full sentence with symbolic punctuation.
   * Returns structured AST of the sentence.
   */
  parseSentence(input: string): {
    tokens: ParsedToken[];
    coordinate?: ReturnType<typeof this.parseCoordinate>;
    structure: string[];
  } {
    const tokens = this.parse(input);
    const coordinate = this.parseCoordinate(input);

    // Build structure from token sequence
    const structure: string[] = [];
    let currentClause: string[] = [];

    for (const token of tokens) {
      if (token.type === 'TERMINATOR' || token.type === 'COLLAPSE') {
        if (currentClause.length > 0) {
          structure.push(currentClause.join(' → '));
          currentClause = [];
        }
      } else {
        currentClause.push(token.type);
      }
    }

    if (currentClause.length > 0) {
      structure.push(currentClause.join(' → '));
    }

    return { tokens, coordinate, structure };
  }

  /**
   * Convert parsed tokens to dimensional operations.
   * Each punctuation mark maps to a quantum operation.
   */
  toOperations(tokens: ParsedToken[]): {
    operation: string;
    dimension: string;
    effect: string;
  }[] {
    const operations: { operation: string; dimension: string; effect: string }[] = [];

    for (const token of tokens) {
      switch (token.type) {
        case 'SINGULARITY':
          operations.push({ operation: 'INIT', dimension: 'Space', effect: 'Big Bang seed' });
          break;
        case 'TRANSITION':
          operations.push({ operation: 'PHASE_SHIFT', dimension: 'Evolution', effect: 'Phase transition' });
          break;
        case 'COLLAPSE':
          operations.push({ operation: 'MEASURE', dimension: 'Movement', effect: 'Wavefunction collapse' });
          break;
        case 'PORTAL':
          operations.push({ operation: 'THRESHOLD', dimension: 'Design', effect: 'Threshold crossing' });
          break;
        case 'FORK':
          operations.push({ operation: 'BRANCH', dimension: 'Being', effect: 'Parallel path' });
          break;
        case 'BREATH':
          operations.push({ operation: 'DECOHERE', dimension: 'Evolution', effect: 'Momentary pause' });
          break;
        case 'CURRENT':
          operations.push({ operation: 'FLOW', dimension: 'Movement', effect: 'Continuity' });
          break;
        case 'PULSE':
          operations.push({ operation: 'TICK', dimension: 'Space', effect: 'Arcminute pulse' });
          break;
        case 'FLICKER':
          operations.push({ operation: 'SHIMMER', dimension: 'Space', effect: 'Arcsecond flicker' });
          break;
        case 'MIRROR':
          operations.push({ operation: 'SUPERPOSE', dimension: 'Being', effect: 'State equivalence' });
          break;
        case 'VECTOR':
          operations.push({ operation: 'TRANSFORM', dimension: 'Design', effect: 'Becomes operator' });
          break;
        case 'HIERARCHICAL':
          operations.push({ operation: 'NEST', dimension: 'Design', effect: 'Substructure delimiter' });
          break;
        case 'TERMINATOR':
          operations.push({ operation: 'CLOSE', dimension: 'Space', effect: 'Sentence closure' });
          break;
      }
    }

    return operations;
  }
}

export default PunctuationParser;
