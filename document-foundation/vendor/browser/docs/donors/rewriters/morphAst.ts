// ============================================================
// AST ENGINE v2 — Ported from ast-engine.js
// Real tokenizer + token stream transformer.
// ============================================================
export interface Token {
  type: string;
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
  original?: string;
}

export interface AstNode {
  type: string;
  value: string;
  start: number;
  end: number;
  children?: AstNode[];
  parent?: AstNode | null;
  attributes?: Record<string, any>;
}

export class Tokenizer {
  rules: Array<{ type: string; regex: RegExp; priority: number }> = [];
  constructor() { this.setupDefaultRules(); }
  addRule(type: string, regex: RegExp, priority = 0) { this.rules.push({ type, regex, priority }); }
  setupDefaultRules() {
    this.rules = [
      { type: 'COMMENT', regex: /^(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/, priority: 10 },
      { type: 'STRING', regex: /^(["'])(?:\\\1|.)*?\1/, priority: 10 },
      { type: 'TEMPLATE', regex: /^`(?:[^`\\]|\\.|\$\{[^}]*\})*`/, priority: 10 },
      { type: 'NUMBER', regex: /^(?:0[xX][0-9a-fA-F]+|0[oO]?[0-7]+|0[bB][01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)/, priority: 10 },
      { type: 'KEYWORD', regex: /^(?:if|else|for|while|do|switch|case|break|continue|return|function|class|extends|import|export|from|as|default|async|await|yield|new|this|super|try|catch|finally|throw|const|let|var|static|get|set|typeof|instanceof|in|of|void|delete|debugger|with)\b/, priority: 10 },
      { type: 'BOOLEAN', regex: /^(?:true|false|null|undefined|NaN|Infinity)\b/, priority: 10 },
      { type: 'IDENTIFIER', regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*/, priority: 5 },
      { type: 'OPERATOR', regex: /^(?:\+\+|--|===|!==|==|!=|=>|&&|\|\||<<<?|>>>?|[+\-*/%&|^~!<>=]=?)/, priority: 10 },
      { type: 'PUNCTUATION', regex: /^[{}[\];(),.:?@#]/, priority: 10 },
      { type: 'WHITESPACE', regex: /^\s+/, priority: 0 },
      { type: 'UNKNOWN', regex: /^./, priority: -1 }
    ];
    this.rules.sort((a, b) => b.priority - a.priority);
  }
  tokenize(code: string): Token[] {
    const tokens: Token[] = [];
    let pos = 0; let line = 1; let column = 0;
    while (pos < code.length) {
      let matched = false;
      for (const rule of this.rules) {
        const src = rule.regex.source.startsWith('^') ? rule.regex.source.slice(1) : rule.regex.source;
        const regex = new RegExp(src, 'y');
        regex.lastIndex = pos;
        const match = regex.exec(code);
        if (match && match.index === pos) {
          if (rule.type !== 'WHITESPACE') {
            tokens.push({ type: rule.type, value: match[0], start: pos, end: pos + match[0].length, line, column, original: match[0] });
          }
          const lines = match[0].split('\n');
          if (lines.length > 1) { line += lines.length - 1; column = lines[lines.length - 1].length; }
          else { column += match[0].length; }
          pos += match[0].length; matched = true; break;
        }
      }
      if (!matched) { tokens.push({ type: 'UNKNOWN', value: code[pos], start: pos, end: pos + 1, line, column }); pos++; column++; }
    }
    return tokens;
  }
  analyze(code: string) {
    const tokens = this.tokenize(code);
    const functions = tokens.filter(t => t.type === 'IDENTIFIER' && (t.value === 'function' || (t as any).next?.type === 'PUNCTUATION' && (t as any).next?.value === '('));
    const classes = tokens.filter(t => t.type === 'KEYWORD' && t.value === 'class');
    const imports = tokens.filter(t => t.type === 'KEYWORD' && t.value === 'import');
    const exports = tokens.filter(t => t.type === 'KEYWORD' && t.value === 'export');
    const comments = tokens.filter(t => t.type === 'COMMENT');
    const strings = tokens.filter(t => t.type === 'STRING' || t.type === 'TEMPLATE');
    const complexity = this.calculateComplexity(tokens);
    return { tokens, functions, classes, imports, exports, comments, strings, complexity };
  }
  calculateComplexity(tokens: Token[]) {
    const cyclomatic = 1 + tokens.filter(t => ['if', 'else', 'for', 'while', 'case', 'catch', '&&', '||', '?'].includes(t.value)).length;
    const nesting = this.calculateNestingDepth(tokens);
    const halstead = this.calculateHalstead(tokens);
    return { score: Math.round((cyclomatic * 0.3 + nesting * 0.3 + halstead * 0.4) * 10) / 10, cyclomatic, nesting, halstead, tokenCount: tokens.length };
  }
  calculateNestingDepth(tokens: Token[]): number {
    let maxDepth = 0, currentDepth = 0;
    for (const token of tokens) {
      if (['{', '[', '('].includes(token.value)) { currentDepth++; maxDepth = Math.max(maxDepth, currentDepth); }
      else if (['}', ']', ')'].includes(token.value)) currentDepth--;
    }
    return maxDepth;
  }
  calculateHalstead(tokens: Token[]): number {
    const operators = tokens.filter(t => t.type === 'OPERATOR' || t.type === 'KEYWORD').map(t => t.value);
    const operands = tokens.filter(t => t.type === 'IDENTIFIER' || t.type === 'NUMBER' || t.type === 'STRING').map(t => t.value);
    const n1 = new Set(operators).size; const n2 = new Set(operands).size;
    const N1 = operators.length; const N2 = operands.length;
    return n1 + n2 === 0 ? 0 : Math.round((N1 + N2) * Math.log2(n1 + n2 || 1) * 10) / 10;
  }
}

export class TokenStreamTransformer {
  transforms = new Map<string, ((token: Token) => Token | null)>();
  apply(code: string, transformNames: string[]): { code: string; applied: string[] } {
    const tokenizer = new Tokenizer();
    let tokens = tokenizer.tokenize(code);
    const applied: string[] = [];
    for (const name of transformNames) {
      const transform = this.transforms.get(name);
      if (transform) { tokens = tokens.map(t => transform(t) || t).filter(Boolean); applied.push(name); }
    }
    return { code: this.reconstruct(tokens), applied };
  }
  reconstruct(tokens: Token[]): string { return tokens.map(t => t.value).join(' ').replace(/\s*([{}();,:.])\s*/g, '$1').replace(/\s+/g, ' ').trim(); }
  register(name: string, fn: (token: Token) => Token | null) { this.transforms.set(name, fn); }
}

export function createDefaultTransforms(): Map<string, (token: Token) => Token | null> {
  const transforms = new Map<string, (token: Token) => Token | null>();
  transforms.set('modernize', (token: Token) => {
    if (token.type === 'KEYWORD' && token.value === 'var') return { ...token, value: 'let', original: token.value };
    return token;
  });
  transforms.set('strictEquality', (token: Token) => {
    if (token.type === 'OPERATOR' && token.value === '==') return { ...token, value: '===', original: token.value };
    if (token.type === 'OPERATOR' && token.value === '!=') return { ...token, value: '!==', original: token.value };
    return token;
  });
  transforms.set('removeConsole', (token: Token) => {
    if (token.type === 'IDENTIFIER' && token.value === 'console') return null;
    return token;
  });
  transforms.set('addComments', (token: Token) => {
    if (token.type === 'KEYWORD' && (token.value === 'function' || token.value === 'class')) {
      return { ...token, value: `/**\n * @morph-generated\n */\n${token.value}`, original: token.value };
    }
    return token;
  });
  transforms.set('arrowFunctions', (token: Token) => {
    if (token.type === 'KEYWORD' && token.value === 'function') return { ...token, value: 'const fn = () =>', original: token.value };
    return token;
  });
  transforms.set('templateLiterals', (token: Token) => {
    if (token.type === 'STRING') return { ...token, value: token.value.replace(/"/g, '`'), original: token.value };
    return token;
  });
  transforms.set('destructure', (token: Token) => {
    if (token.type === 'IDENTIFIER' && token.value === 'Object') return { ...token, value: 'const { keys, values } = Object', original: token.value };
    return token;
  });
  transforms.set('modules', (token: Token) => {
    if (token.type === 'IDENTIFIER' && token.value === 'require') return { ...token, value: 'import', original: token.value };
    return token;
  });
  transforms.set('strictMode', (token: Token) => {
    if (token.type === 'KEYWORD' && token.value === 'function') return { ...token, value: "'use strict';\nfunction", original: token.value };
    return token;
  });
  transforms.set('promises', (token: Token) => {
    if (token.type === 'KEYWORD' && token.value === 'callback') return { ...token, value: 'async/await', original: token.value };
    return token;
  });
  transforms.set('constDefault', (token: Token) => {
    if (token.type === 'KEYWORD' && token.value === 'let') return { ...token, value: 'const', original: token.value };
    return token;
  });
  return transforms;
}

export const tokenizer = new Tokenizer();
export const transformer = new TokenStreamTransformer();
