// Pure-JS Python tokenizer (subset). No host APIs; runs in Node, browsers and WebViews.
const OPS = ['**=', '//=', '>>=', '<<=', '->', '**', '//', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', ':=',
  '+', '-', '*', '/', '%', '@', '<', '>', '=', '.', ',', ':', ';', '(', ')', '[', ']', '{', '}', '&', '|', '^', '~'];
const KEYWORDS = new Set(['False', 'None', 'True', 'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
  'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield']);

export class PySyntaxError extends Error {
  constructor(message, line) { super(`${message} (line ${line})`); this.name = 'SyntaxError'; this.line = line; }
}

const isIdStart = (c) => /[A-Za-z_\u00C0-\uFFFF]/.test(c);
const isId = (c) => /[A-Za-z0-9_\u00C0-\uFFFF]/.test(c);

export function tokenize(src) {
  const toks = [];
  const indents = [0];
  let i = 0, line = 1, depth = 0, atLineStart = true;
  const push = (type, value, extra = {}) => toks.push({ type, value, line, ...extra });
  src = src.replace(/\r\n?/g, '\n');
  while (i < src.length) {
    if (atLineStart && depth === 0) {
      let col = 0, j = i;
      while (j < src.length && (src[j] === ' ' || src[j] === '\t')) { col += src[j] === '\t' ? 8 - (col % 8) : 1; j++; }
      if (src[j] === '\n' || src[j] === '#' || j >= src.length) { // blank/comment line
        i = j;
        if (src[i] === '#') while (i < src.length && src[i] !== '\n') i++;
        if (src[i] === '\n') { i++; line++; }
        continue;
      }
      i = j; atLineStart = false;
      if (col > indents[indents.length - 1]) { indents.push(col); push('INDENT', col); }
      else {
        while (col < indents[indents.length - 1]) { indents.pop(); push('DEDENT', col); }
        if (col !== indents[indents.length - 1]) throw new PySyntaxError('unindent does not match any outer indentation level', line);
      }
    }
    const c = src[i];
    if (c === '\n') { i++; if (depth === 0) { push('NEWLINE'); atLineStart = true; } line++; continue; }
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; line++; continue; }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    // strings with optional prefixes
    let m = /^([rRbBuUfF]{0,2})('''|"""|'|")/.exec(src.slice(i, i + 5));
    if (m && (m[1] === '' || /^[rbuf]{1,2}$/i.test(m[1])) && (m[1] === '' || !isId(src[i - 1] ?? ' '))) {
      const prefix = m[1].toLowerCase(), q = m[2];
      let j = i + m[0].length, s = '';
      const raw = prefix.includes('r');
      const startLine = line;
      for (;;) {
        if (j >= src.length) throw new PySyntaxError('unterminated string literal', startLine);
        if (src.startsWith(q, j)) { j += q.length; break; }
        const ch = src[j];
        if (ch === '\n') { if (q.length === 1) throw new PySyntaxError('unterminated string literal', startLine); line++; }
        if (ch === '\\' && !raw) {
          const n = src[j + 1];
          const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', '0': '\0', a: '\x07', b: '\b', f: '\f', v: '\v' };
          if (n === '\n') { j += 2; line++; continue; }
          if (n === 'x') { s += String.fromCharCode(parseInt(src.substr(j + 2, 2), 16)); j += 4; continue; }
          if (n === 'u') { s += String.fromCharCode(parseInt(src.substr(j + 2, 4), 16)); j += 6; continue; }
          if (n in map) { s += map[n]; j += 2; continue; }
          s += ch; j++; continue;
        }
        if (ch === '\\' && raw) { s += ch + (src[j + 1] ?? ''); j += 2; continue; }
        s += ch; j++;
      }
      push(prefix.includes('f') ? 'FSTRING' : 'STRING', s, { startLine });
      i = j; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
      m = /^(0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|(?:[0-9][0-9_]*)?\.?[0-9_]*(?:[eE][+-]?[0-9_]+)?)(j|J)?/.exec(src.slice(i));
      const text = m[1].replace(/_/g, '');
      let isFloat = /[.eE]/.test(text) && !/^0[xXoObB]/.test(text);
      const value = /^0[xXoObB]/.test(text) ? Number(text.toLowerCase()) : Number(text);
      push('NUMBER', value, { isFloat });
      i += m[0].length; continue;
    }
    if (isIdStart(c)) {
      let j = i; while (j < src.length && isId(src[j])) j++;
      const w = src.slice(i, j);
      push(KEYWORDS.has(w) ? 'KW' : 'NAME', w);
      i = j; continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      if ('([{'.includes(op)) depth++;
      if (')]}'.includes(op)) depth = Math.max(0, depth - 1);
      push('OP', op); i += op.length; continue;
    }
    throw new PySyntaxError(`invalid character '${c}'`, line);
  }
  if (toks.length && toks[toks.length - 1].type !== 'NEWLINE') push('NEWLINE');
  while (indents.length > 1) { indents.pop(); push('DEDENT', 0); }
  push('EOF');
  return toks;
}
