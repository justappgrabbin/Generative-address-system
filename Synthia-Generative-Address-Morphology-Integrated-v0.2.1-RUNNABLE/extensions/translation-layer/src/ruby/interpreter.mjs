// Pure-JS Ruby subset emulator. Sovereign: no host I/O, no network, no workers.
export class RubyError extends Error { constructor(cls, msg) { super(msg); this.rbClass = cls; } }
const KW = new Set('def end class module if elsif else unless while until for in do return true false nil self and or not then yield break next begin rescue ensure case when attr_reader attr_accessor attr_writer'.split(' ').filter((k) => !k.startsWith('attr')));
function tokenize(src) {
  const toks = []; let i = 0, line = 1; let parenDepth = 0;
  const push = (type, value, extra = {}) => toks.push({ type, value, line, ...extra });
  const spaceBefore = () => i > 0 && /[ \t]/.test(src[i - 1]);
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { push('NL', '\n'); line++; i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; line++; continue; }
    if (/[ \t\r]/.test(c)) { i++; continue; }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (/[0-9]/.test(c)) { const m = /^[0-9][0-9_]*(\.[0-9]+)?(e[+-]?[0-9]+)?/.exec(src.slice(i))[0]; push('NUM', { v: Number(m.replace(/_/g, '')), float: /[.e]/.test(m) }); i += m.length; continue; }
    if (c === '@') { const m = /^@@?[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))[0]; push('IVAR', m); i += m.length; continue; }
    if (c === '$') { const m = /^\$[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))[0]; push('GVAR', m); i += m.length; continue; }
    if (c === ':' && /[A-Za-z_]/.test(src[i + 1] ?? '') && src[i - 1] !== ':') { const m = /^:[A-Za-z_][A-Za-z0-9_]*[?!]?/.exec(src.slice(i))[0]; push('SYM', m.slice(1)); i += m.length; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let m = /^[A-Za-z_][A-Za-z0-9_]*[?!]?/.exec(src.slice(i))[0];
      if (/[?!]$/.test(m) && src[i + m.length] === '=' && src[i + m.length + 1] !== '=') m = m.slice(0, -1);
      if (src[i + m.length] === ':' && src[i + m.length + 1] !== ':' && toks.length && !(toks.at(-1).type === 'OP' && toks.at(-1).value === '?')) { push('LABEL', m); i += m.length + 1; continue; }
      push(KW.has(m) ? 'KW' : /^[A-Z]/.test(m) ? 'CONST' : 'ID', m, { sp: spaceBefore(), spAfter: /[ \t]/.test(src[i + m.length] ?? '') }); i += m.length; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1; const parts = []; let s = '';
      while (src[j] !== c) {
        if (src[j] === '\\') { const e = src[j + 1]; if (c === "'") { s += e === "'" || e === '\\' ? e : '\\' + e; } else s += { n: '\n', t: '\t', r: '\r', '0': '\0', e: '\x1b', s: ' ' }[e] ?? e; j += 2; continue; }
        if (c === '"' && src[j] === '#' && src[j + 1] === '{') { parts.push(s); s = ''; let depth = 1, k = j + 2; while (depth) { if (src[k] === '{') depth++; else if (src[k] === '}') depth--; k++; } parts.push({ code: src.slice(j + 2, k - 1) }); j = k; continue; }
        if (src[j] === '\n') line++;
        s += src[j++];
      }
      parts.push(s); push('STR', parts); i = j + 1; continue;
    }
    const ops = ['**=', '<=>', '===', '...', '||=', '&&=', '..', '==', '!=', '>=', '<=', '&&', '||', '<<', '>>', '+=', '-=', '*=', '/=', '%=', '=>', '->', '::', '**', '=~', '+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^', '~', '?', ':', ',', '.', '(', ')', '[', ']', '{', '}', ';'];
    const op = ops.find((o) => src.startsWith(o, i)); if (!op) throw new RubyError('SyntaxError', `unexpected '${c}' at line ${line}`);
    push('OP', op, { sp: spaceBefore(), spAfter: /[ \t]/.test(src[i + op.length] ?? '') }); i += op.length;
  }
  push('NL', '\n'); push('EOF', null); return toks;
}
class Parser {
  constructor(t) { this.t = t; this.p = 0; this.locals = [new Set()]; }
  get c() { return this.t[this.p]; }
  is(type, v) { const t = this.c; return t.type === type && (v === undefined || t.value === v); }
  acc(type, v) { if (this.is(type, v)) return this.t[this.p++]; return null; }
  eat(type, v) { if (!this.is(type, v)) throw new RubyError('SyntaxError', `line ${this.c.line}: expected ${v ?? type}, got ${JSON.stringify(this.c.value)}`); return this.t[this.p++]; }
  skipNL() { while (this.is('NL') || this.is('OP', ';')) this.p++; }
  isLocal(n) { return this.locals.some((s) => s.has(n)); }
  declare(n) { this.locals.at(-1).add(n); }
  program() { const b = this.body(['EOF']); return b; }
  body(enders) { const out = []; this.skipNL(); while (!enders.some((e) => (e === 'EOF' ? this.is('EOF') : this.is('KW', e)))) { out.push(this.stmt()); this.skipNL(); } return out; }
  stmt() {
    let s = this.exprStmt();
    for (;;) {
      if (this.acc('KW', 'if')) { const c = this.exprStmt(); s = { t: 'If', cond: c, then: [s], else: [] }; }
      else if (this.acc('KW', 'unless')) { const c = this.exprStmt(); s = { t: 'If', cond: { t: 'Not', e: c }, then: [s], else: [] }; }
      else if (this.acc('KW', 'while')) { const c = this.exprStmt(); s = { t: 'While', cond: c, body: [s] }; }
      else if (this.acc('KW', 'until')) { const c = this.exprStmt(); s = { t: 'While', cond: { t: 'Not', e: c }, body: [s] }; }
      else break;
    }
    return s;
  }
  exprStmt() { let e = this.notExpr(); while (this.is('KW', 'and') || this.is('KW', 'or')) { const op = this.t[this.p++].value === 'and' ? '&&' : '||'; e = { t: 'Logic', op, l: e, r: this.notExpr() }; } return e; }
  notExpr() { if (this.acc('KW', 'not')) return { t: 'Not', e: this.notExpr() }; return this.expr(); }
  expr() {
    if (this.is('KW', 'return')) { this.p++; const v = this.endOfArg() ? null : this.expr(); return { t: 'Return', v }; }
    if (this.is('KW', 'break')) { this.p++; return { t: 'Break' }; }
    if (this.is('KW', 'next')) { this.p++; const v = this.endOfArg() ? null : this.expr(); return { t: 'Next', v }; }
    const start = this.p;
    // multiple assignment a, b = ...
    if (this.is('ID') && this.t[this.p + 1].type === 'OP' && this.t[this.p + 1].value === ',') {
      const save = this.p; const names = [];
      while (this.is('ID')) { names.push(this.t[this.p++].value); if (!this.acc('OP', ',')) break; }
      if (this.acc('OP', '=')) { names.forEach((n) => this.declare(n)); const vals = [this.ternary()]; while (this.acc('OP', ',')) vals.push(this.ternary()); return { t: 'MAssign', names, vals }; }
      this.p = save;
    }
    const left = this.ternary();
    if (this.is('OP', '=') && ['Var', 'IVar', 'GVar', 'Index', 'Call', 'Const'].includes(left.t)) {
      this.p++; this.skipNL();
      if (left.t === 'Var' || (left.t === 'Call' && !left.recv && !left.args.length)) { const name = left.name; this.declare(name); return { t: 'Assign', target: { t: 'Var', name }, v: this.expr() }; }
      if (left.t === 'Call' && left.recv) return { t: 'Call', recv: left.recv, name: left.name + '=', args: [this.expr()] };
      return { t: 'Assign', target: left, v: this.expr() };
    }
    const aug = ['+=', '-=', '*=', '/=', '%=', '**=', '||=', '&&=', '<<'].find((o) => this.is('OP', o) && o !== '<<');
    if (aug) { this.p++; this.skipNL(); let target = left; if (left.t === 'Call' && !left.recv && !left.args.length) { target = { t: 'Var', name: left.name }; this.declare(left.name); } const v = this.expr(); const op = aug.slice(0, -1); if (op === '||' || op === '&&') return { t: 'OpAssign', target, op, v }; return { t: 'OpAssign', target, op, v }; }
    return left;
  }
  endOfArg() { return this.is('NL') || this.is('EOF') || this.is('OP', ';') || this.is('KW', 'end') || this.is('KW', 'if') || this.is('KW', 'unless') || this.is('OP', '}'); }
  ternary() { const c = this.range(); if (this.is('OP', '?')) { this.p++; this.skipNL(); const a = this.ternary(); this.skipNL(); this.eat('OP', ':'); this.skipNL(); const b = this.ternary(); return { t: 'If', cond: c, then: [a], else: [b] }; } return c; }
  range() { const l = this.bin(0); if (this.is('OP', '..') || this.is('OP', '...')) { const excl = this.t[this.p++].value === '...'; return { t: 'Range', l, r: this.bin(0), excl }; } return l; }
  bin(minPrec) {
    const P = { '||': 1, '&&': 2, '<=>': 4, '==': 4, '!=': 4, '===': 4, '=~': 4, '<': 5, '>': 5, '<=': 5, '>=': 5, '|': 6, '^': 6, '&': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10, '**': 12 };
    let l = this.unary();
    for (;;) {
      const t = this.c; if (t.type !== 'OP' || !(t.value in P)) break; const pr = P[t.value]; if (pr < minPrec) break;
      this.p++; this.skipNL(); const r = this.bin(t.value === '**' ? pr : pr + 1);
      l = t.value === '&&' || t.value === '||' ? { t: 'Logic', op: t.value, l, r } : { t: 'Bin', op: t.value, l, r };
    }
    return l;
  }
  unary() { if (this.acc('OP', '!')) return { t: 'Not', e: this.unary() }; if (this.is('OP', '-') && !(this.t[this.p + 1].type === 'NUM' && false)) { this.p++; const e = this.unary(); return e.t === 'Num' ? { ...e, v: -e.v } : { t: 'Call', recv: e, name: '-@', args: [] }; } return this.postfix(); }
  canStartArg() {
    const t = this.c;
    if (['NUM', 'STR', 'SYM', 'IVAR', 'GVAR', 'CONST', 'ID', 'LABEL'].includes(t.type)) return true;
    if (t.type === 'KW') return ['true', 'false', 'nil', 'self', 'not'].includes(t.value);
    if (t.type === 'OP') { if (t.value === '[' ) return t.sp; if (['-', '*', '&', ':'].includes(t.value)) return t.sp && !t.spAfter; return ['!', '->'].includes(t.value) || (t.value === '(' && false); }
    return false;
  }
  callArgsNoParen() { const args = []; do { this.skipNLIfComma(); args.push(this.argExpr()); } while (this.acc('OP', ',')); return args; }
  skipNLIfComma() {}
  argExpr() {
    if (this.is('LABEL')) { return this.hashArgs(); }
    if (this.acc('OP', '&')) return { t: 'BlockPass', e: this.ternary() };
    if (this.is('OP', '*') ) { this.p++; return { t: 'Splat', e: this.ternary() }; }
    const e = this.ternary();
    if (this.is('OP', '=>')) { this.p++; const pairs = [[e, this.ternary()]]; while (this.is('OP', ',') && this.t[this.p + 1] && !(this.t[this.p + 1].type === 'OP' && this.t[this.p + 1].value === '&')) { const save = this.p; this.p++; const k = this.ternary(); if (!this.acc('OP', '=>')) { this.p = save; break; } pairs.push([k, this.ternary()]); } return { t: 'Hash', pairs }; }
    return e;
  }
  hashArgs() { const pairs = []; while (this.is('LABEL')) { const k = { t: 'Sym', v: this.t[this.p++].value }; this.skipNL(); pairs.push([k, this.ternary()]); if (!(this.is('OP', ',') && this.t[this.p + 1].type === 'LABEL')) break; this.p++; } return { t: 'Hash', pairs }; }
  parenArgs() { this.eat('OP', '('); this.skipNL(); const args = []; while (!this.is('OP', ')')) { args.push(this.argExpr()); this.skipNL(); if (!this.acc('OP', ',')) break; this.skipNL(); } this.eat('OP', ')'); return args; }
  block() {
    let close;
    if (this.acc('OP', '{')) close = '}'; else if (this.acc('KW', 'do')) close = 'end'; else return null;
    this.locals.push(new Set(this.locals.at(-1)));
    const params = []; this.skipNL();
    if (this.acc('OP', '|')) { while (!this.is('OP', '|')) { if (this.acc('OP', '(')) { const inner = []; while (!this.is('OP', ')')) { inner.push(this.eat('ID').value); this.acc('OP', ','); } this.eat('OP', ')'); inner.forEach((n) => this.declare(n)); params.push({ destructure: inner }); } else { const n = this.eat('ID').value; this.declare(n); params.push(n); } this.acc('OP', ','); } this.eat('OP', '|'); }
    const body = close === '}' ? (() => { const out = []; this.skipNL(); while (!this.is('OP', '}')) { out.push(this.stmt()); this.skipNL(); } this.eat('OP', '}'); return out; })() : (() => { const b = this.body(['end']); this.eat('KW', 'end'); return b; })();
    this.locals.pop();
    return { t: 'Block', params, body };
  }
  postfix() {
    let e = this.primary();
    for (;;) {
      if (this.is('OP', '.') || (this.is('NL') && this.t[this.p + 1]?.type === 'OP' && this.t[this.p + 1].value === '.')) {
        if (this.is('NL')) this.p++;
        this.p++; this.skipNL();
        const nameTok = this.t[this.p++]; const name = nameTok.value;
        let args = []; if (this.is('OP', '(') && !this.c.sp) args = this.parenArgs(); else if (this.c.sp && this.canStartArg() && !this.is('OP', '[')) args = this.callArgsNoParen();
        const blk = this.block();
        e = { t: 'Call', recv: e, name, args, block: blk };
      } else if (this.is('OP', '::')) { this.p++; e = { t: 'Scope', recv: e, name: this.t[this.p++].value }; }
      else if (this.is('OP', '[') && !this.c.sp) { this.p++; this.skipNL(); const args = []; while (!this.is('OP', ']')) { args.push(this.ternary()); this.skipNL(); this.acc('OP', ','); this.skipNL(); } this.eat('OP', ']'); e = { t: 'Index', recv: e, args }; }
      else return e;
    }
  }
  primary() {
    const t = this.c;
    switch (t.type) {
      case 'NUM': this.p++; return { t: 'Num', v: t.value.v, float: t.value.float };
      case 'STR': { this.p++; let node = { t: 'Str', parts: t.value.map((x) => (typeof x === 'string' ? x : { t: 'Interp', code: x.code })) }; while (this.is('STR')) { node.parts.push(...this.t[this.p++].value.map((x) => (typeof x === 'string' ? x : { t: 'Interp', code: x.code }))); } return node; }
      case 'SYM': this.p++; return { t: 'Sym', v: t.value };
      case 'IVAR': this.p++; return { t: 'IVar', name: t.value };
      case 'GVAR': this.p++; return { t: 'GVar', name: t.value };
      case 'LABEL': return this.hashArgs();
      case 'CONST': { this.p++; if (this.is('OP', '(') && !this.c.sp) return { t: 'Call', recv: null, name: t.value, args: this.parenArgs(), block: this.block() }; return { t: 'Const', name: t.value }; }
      case 'ID': {
        this.p++; const name = t.value;
        if (this.is('OP', '(') && !this.c.sp) { const args = this.parenArgs(); return { t: 'Call', recv: null, name, args, block: this.block() }; }
        if (this.isLocal(name)) return { t: 'Var', name };
        if (['attr_reader', 'attr_accessor', 'attr_writer', 'puts', 'print', 'p', 'require', 'require_relative', 'raise', 'include', 'extend', 'private', 'public', 'protected', 'loop', 'lambda', 'proc', 'format', 'sprintf', 'pp'].includes(name) || (this.canStartArg() && t.spAfter)) {
          const args = this.endOfArg() || this.is('OP', '{') || this.is('KW', 'do') ? [] : this.callArgsNoParen();
          return { t: 'Call', recv: null, name, args, block: this.block() };
        }
        return { t: 'Call', recv: null, name, args: [], block: this.block(), bare: true };
      }
      case 'KW': {
        switch (t.value) {
          case 'true': this.p++; return { t: 'Lit', v: true };
          case 'false': this.p++; return { t: 'Lit', v: false };
          case 'nil': this.p++; return { t: 'Lit', v: null };
          case 'self': this.p++; return { t: 'Self' };
          case 'def': return this.def();
          case 'class': return this.classDef();
          case 'module': return this.moduleDef();
          case 'if': case 'unless': return this.ifExpr();
          case 'while': case 'until': { this.p++; let c = this.exprStmt(); if (t.value === 'until') c = { t: 'Not', e: c }; this.acc('KW', 'do'); const body = this.body(['end']); this.eat('KW', 'end'); return { t: 'While', cond: c, body }; }
          case 'for': { this.p++; const n = this.eat('ID').value; this.declare(n); this.eat('KW', 'in'); const it = this.exprStmt(); this.acc('KW', 'do'); const body = this.body(['end']); this.eat('KW', 'end'); return { t: 'Call', recv: it, name: 'each', args: [], block: { t: 'Block', params: [n], body, shareScope: true } }; }
          case 'case': return this.caseExpr();
          case 'begin': { this.p++; const body = this.body(['rescue', 'ensure', 'end']); const rescues = []; let ensure = null; while (this.acc('KW', 'rescue')) { const classes = []; let as = null; while (this.is('CONST')) { classes.push(this.t[this.p++].value); this.acc('OP', ','); } if (this.acc('OP', '=>')) { as = this.eat('ID').value; this.declare(as); } rescues.push({ classes, as, body: this.body(['rescue', 'ensure', 'end']) }); } if (this.acc('KW', 'ensure')) ensure = this.body(['end']); this.eat('KW', 'end'); return { t: 'Begin', body, rescues, ensure }; }
          case 'yield': { this.p++; const args = this.is('OP', '(') && !this.c.sp ? this.parenArgs() : this.endOfArg() ? [] : this.callArgsNoParen(); return { t: 'Yield', args }; }
        }
        break;
      }
      case 'OP': {
        if (t.value === '(') { this.p++; this.skipNL(); const stmts = []; while (!this.is('OP', ')')) { stmts.push(this.stmt()); this.skipNL(); } this.eat('OP', ')'); return stmts.length === 1 ? stmts[0] : { t: 'Seq', body: stmts }; }
        if (t.value === '[') { this.p++; this.skipNL(); const items = []; while (!this.is('OP', ']')) { items.push(this.argExpr()); this.skipNL(); this.acc('OP', ','); this.skipNL(); } this.eat('OP', ']'); return { t: 'Array', items }; }
        if (t.value === '{') { this.p++; this.skipNL(); const pairs = []; while (!this.is('OP', '}')) { let k; if (this.is('LABEL')) { k = { t: 'Sym', v: this.t[this.p++].value }; } else { k = this.ternary(); this.eat('OP', '=>'); } this.skipNL(); pairs.push([k, this.ternary()]); this.skipNL(); this.acc('OP', ','); this.skipNL(); } this.eat('OP', '}'); return { t: 'Hash', pairs }; }
        if (t.value === '->') { this.p++; const params = []; if (this.acc('OP', '(')) { while (!this.is('OP', ')')) { const n = this.eat('ID').value; params.push(n); this.acc('OP', ','); } this.eat('OP', ')'); } this.locals.push(new Set([...this.locals.at(-1), ...params])); const b = this.block(); this.locals.pop(); b.params = params; return { t: 'Lambda', block: b }; }
        if (t.value === '::') { this.p++; return { t: 'Const', name: this.t[this.p++].value }; }
      }
    }
    throw new RubyError('SyntaxError', `line ${t.line}: unexpected ${JSON.stringify(t.value)}`);
  }
  ifExpr() {
    const neg = this.t[this.p++].value === 'unless';
    let cond = this.exprStmt(); if (neg) cond = { t: 'Not', e: cond }; this.acc('KW', 'then');
    const then = this.body(['elsif', 'else', 'end']); let els = [];
    if (this.is('KW', 'elsif')) { els = [this.ifExpr()]; return { t: 'If', cond, then, else: els }; }
    if (this.acc('KW', 'else')) els = this.body(['end']);
    this.eat('KW', 'end'); return { t: 'If', cond, then, else: els };
  }
  caseExpr() { this.p++; const subj = this.is('NL') ? null : this.exprStmt(); this.skipNL(); const whens = []; let els = null; while (this.acc('KW', 'when')) { const vals = [this.ternary()]; while (this.acc('OP', ',')) vals.push(this.ternary()); this.acc('KW', 'then'); whens.push({ vals, body: this.body(['when', 'else', 'end']) }); } if (this.acc('KW', 'else')) els = this.body(['end']); this.eat('KW', 'end'); return { t: 'Case', subj, whens, els }; }
  def() {
    this.p++; let singleton = false; let name = this.t[this.p++].value;
    if (name === 'self' && this.acc('OP', '.')) { singleton = true; name = this.t[this.p++].value; }
    if (this.is('OP', '=') && !this.c.sp) { this.p++; name += '='; }
    if (['+', '-', '*', '/', '==', '<', '>', '<=', '>=', '<=>', '[', '%'].includes(name)) { if (name === '[') { this.eat('OP', ']'); name = '[]'; } }
    this.locals.push(new Set()); const params = [];
    const parseParams = (closer) => { while (!(closer ? this.is('OP', closer) : this.is('NL'))) { let kind = 'req'; if (this.acc('OP', '*')) kind = 'rest'; else if (this.acc('OP', '&')) kind = 'block'; else if (this.acc('OP', '**')) kind = 'kwrest'; if (this.is('LABEL')) { const n = this.t[this.p++].value; this.declare(n); const d = this.is('OP', ',') || this.is('OP', ')') ? null : this.ternary(); params.push({ name: n, kind: 'kw', default: d }); } else { const n = this.eat('ID').value; this.declare(n); let d = null; if (this.acc('OP', '=')) { d = this.ternary(); kind = 'opt'; } params.push({ name: n, kind, default: d }); } if (!this.acc('OP', ',')) break; } };
    if (this.acc('OP', '(')) { parseParams(')'); this.eat('OP', ')'); } else if (!this.is('NL')) parseParams(null);
    const body = this.bodyWithRescue(); this.locals.pop();
    return { t: 'Def', name, params, body, singleton };
  }
  bodyWithRescue() { const body = this.body(['rescue', 'ensure', 'end']); if (this.is('KW', 'rescue') || this.is('KW', 'ensure')) { const rescues = []; let ensure = null; while (this.acc('KW', 'rescue')) { const classes = []; let as = null; while (this.is('CONST')) { classes.push(this.t[this.p++].value); this.acc('OP', ','); } if (this.acc('OP', '=>')) { as = this.eat('ID').value; this.declare(as); } rescues.push({ classes, as, body: this.body(['rescue', 'ensure', 'end']) }); } if (this.acc('KW', 'ensure')) ensure = this.body(['end']); this.eat('KW', 'end'); return [{ t: 'Begin', body, rescues, ensure }]; } this.eat('KW', 'end'); return body; }
  classDef() { this.p++; const name = this.eat('CONST').value; let sup = null; if (this.acc('OP', '<')) sup = this.ternary(); this.locals.push(new Set()); const body = this.body(['end']); this.eat('KW', 'end'); this.locals.pop(); return { t: 'Class', name, sup, body }; }
  moduleDef() { this.p++; const name = this.eat('CONST').value; this.locals.push(new Set()); const body = this.body(['end']); this.eat('KW', 'end'); this.locals.pop(); return { t: 'Module', name, body }; }
}
// ---------------- runtime
class RObject { constructor(cls) { this.cls = cls; this.ivars = new Map(); } }
class RClass { constructor(name, sup, isModule = false) { this.name = name; this.sup = sup; this.methods = new Map(); this.smethods = new Map(); this.consts = new Map(); this.includes = []; this.isModule = isModule; }
  find(n) { for (let c = this; c; c = c.sup) { if (c.methods.has(n)) return c.methods.get(n); for (const m of c.includes) if (m.methods.has(n)) return m.methods.get(n); } return null; }
  findS(n) { for (let c = this; c; c = c.sup) if (c.smethods.has(n)) return c.smethods.get(n); return null; }
  isA(o) { for (let c = this; c; c = c.sup) { if (c === o) return true; if (c.includes.includes(o)) return true; } return false; } }
class RFloat { constructor(v) { this.v = v; } }
class RSym { constructor(n) { this.n = n; } }
const syms = new Map(); const sym = (n) => { if (!syms.has(n)) syms.set(n, new RSym(n)); return syms.get(n); };
class RRange { constructor(a, b, excl) { this.a = a; this.b = b; this.excl = excl; } toArray() { const out = []; const end = num(this.b) - (this.excl ? 1 : 0); for (let i = num(this.a); i <= end; i++) out.push(i); return out; } }
class RHash { constructor() { this.m = new Map(); } key(k) { return k instanceof RSym ? 'y' + k.n : typeof k === 'string' ? 's' + k : k instanceof RFloat ? 'n' + k.v : typeof k === 'number' ? 'n' + k : Array.isArray(k) ? 'a' + k.map((x) => this.key(x)).join(',') : k; } get(k) { const e = this.m.get(this.key(k)); return e ? e[1] : undefined; } set(k, v) { this.m.set(this.key(k), [k, v]); } has(k) { return this.m.has(this.key(k)); } entries() { return [...this.m.values()]; } }
class RStr { constructor(s) { this.s = s; } }
class RProc { constructor(block, env, self, I, lambda = false) { this.block = block; this.env = env; this.self = self; this.I = I; this.lambda = lambda; } }
class RMethodDef { constructor(node, owner) { this.node = node; this.owner = owner; } }
class Native { constructor(fn) { this.fn = fn; } }
const num = (x) => (x instanceof RFloat ? x.v : x);
const isNum = (x) => typeof x === 'number' || x instanceof RFloat;
const strv = (x) => (x instanceof RStr ? x.s : x);
class BreakSig { constructor(v) { this.v = v; } } class NextSig { constructor(v) { this.v = v; } } class ReturnSig { constructor(v, frame) { this.v = v; this.frame = frame; } }
class Env { constructor(parent, frame) { this.vars = new Map(); this.parent = parent; this.frame = frame ?? parent?.frame; } find(n) { let e = this; while (e) { if (e.vars.has(n)) return e; e = e.parent; } return null; } }

export class RubyInterpreter {
  constructor({ maxSteps = 5e7 } = {}) {
    this.stdout = []; this.buf = ''; this.steps = 0; this.maxSteps = maxSteps; this.rulesUsed = new Set();
    this.Object = new RClass('Object', null); this.consts = this.Object.consts;
    for (const n of ['Integer', 'Float', 'String', 'Symbol', 'Array', 'Hash', 'Range', 'NilClass', 'TrueClass', 'FalseClass', 'Proc', 'Comparable', 'Enumerable', 'Kernel', 'Math', 'Numeric']) this.consts.set(n, new RClass(n, this.Object));
    const se = new RClass('StandardError', this.Object); this.consts.set('Exception', se); this.consts.set('StandardError', se);
    for (const n of ['RuntimeError', 'ArgumentError', 'TypeError', 'NameError', 'ZeroDivisionError', 'KeyError', 'IndexError', 'NotImplementedError']) this.consts.set(n, new RClass(n, se));
    this.consts.set('NoMethodError', new RClass('NoMethodError', this.consts.get('NameError')));
    this.consts.get('Math').consts.set('PI', new RFloat(Math.PI)); this.consts.get('Math').consts.set('E', new RFloat(Math.E));
    this.main = new RObject(this.Object); this.globals = new Map();
  }
  rule(n) { this.rulesUsed.add(n); }
  write(s) { this.buf += s; let i; while ((i = this.buf.indexOf('\n')) >= 0) { this.stdout.push(this.buf.slice(0, i)); this.buf = this.buf.slice(i + 1); } }
  run(src) { const tree = new Parser(tokenize(src)).program(); const frame = { self: this.main, cls: this.Object, block: null }; const env = new Env(null, frame); this.execBody(tree, env); if (this.buf) { this.stdout.push(this.buf); this.buf = ''; } }
  execBody(body, env) { let v = null; for (const s of body) v = this.eval(s, env); return v; }
  err(cls, msg) { return new RubyError(cls, msg); }
  classOf(v) {
    const C = (n) => this.consts.get(n);
    if (v === null || v === undefined) return C('NilClass'); if (v === true) return C('TrueClass'); if (v === false) return C('FalseClass');
    if (typeof v === 'number') return C('Integer'); if (v instanceof RFloat) return C('Float'); if (v instanceof RStr) return C('String'); if (v instanceof RSym) return C('Symbol');
    if (Array.isArray(v)) return C('Array'); if (v instanceof RHash) return C('Hash'); if (v instanceof RRange) return C('Range'); if (v instanceof RProc) return C('Proc');
    if (v instanceof RObject) return v.cls; if (v instanceof RClass) return v; return this.Object;
  }
  eval(n, env) {
    if (++this.steps > this.maxSteps) throw this.err('RuntimeError', 'step budget exhausted');
    const frame = env.frame;
    switch (n.t) {
      case 'Num': return n.float ? new RFloat(n.v) : n.v;
      case 'Str': this.rule('rb-strings'); return new RStr(n.parts.map((p) => (typeof p === 'string' ? p : this.toS(this.evalInterp(p.code, env)))).join(''));
      case 'Sym': return sym(n.v);
      case 'Lit': return n.v;
      case 'Self': return frame.self;
      case 'Seq': return this.execBody(n.body, env);
      case 'Var': { const e = env.find(n.name); return e ? e.vars.get(n.name) : null; }
      case 'IVar': return frame.self instanceof RObject || frame.self instanceof RClass ? ((frame.self.ivars ??= new Map()).get(n.name) ?? null) : null;
      case 'GVar': return this.globals.get(n.name) ?? null;
      case 'Const': { for (let c = frame.cls; c; c = c.sup) if (c.consts.has(n.name)) return c.consts.get(n.name); if (this.consts.has(n.name)) return this.consts.get(n.name); throw this.err('NameError', `uninitialized constant ${n.name}`); }
      case 'Scope': { const r = this.eval(n.recv, env); if (r instanceof RClass && r.consts.has(n.name)) return r.consts.get(n.name); return this.send(r, n.name, [], null); }
      case 'Assign': { this.rule('rb-assign'); const v = this.eval(n.v, env); this.assign(n.target, v, env); return v; }
      case 'MAssign': { const vals = n.vals.length === 1 ? (Array.isArray(this.eval(n.vals[0], env)) ? this.eval(n.vals[0], env) : [this.eval(n.vals[0], env)]) : n.vals.map((v) => this.eval(v, env)); n.names.forEach((nm, i) => this.assign({ t: 'Var', name: nm }, vals[i] ?? null, env)); return vals; }
      case 'OpAssign': {
        const cur = n.target.t === 'Var' ? (env.find(n.target.name)?.vars.get(n.target.name) ?? null) : this.eval(n.target, env);
        let v;
        if (n.op === '||') v = this.truthy(cur) ? cur : this.eval(n.v, env); else if (n.op === '&&') v = this.truthy(cur) ? this.eval(n.v, env) : cur; else v = this.send(cur, n.op, [this.eval(n.v, env)], null);
        if (n.target.t === 'Call' && n.target.recv) this.send(this.eval(n.target.recv, env), n.target.name + '=', [v], null); else this.assign(n.target, v, env); return v;
      }
      case 'Array': { const out = []; for (const it of n.items) { if (it.t === 'Splat') out.push(...this.toA(this.eval(it.e, env))); else out.push(this.eval(it, env)); } return out; }
      case 'Hash': { this.rule('rb-hashes'); const h = new RHash(); for (const [k, v] of n.pairs) h.set(this.eval(k, env), this.eval(v, env)); return h; }
      case 'Range': return new RRange(this.eval(n.l, env), this.eval(n.r, env), n.excl);
      case 'Not': return !this.truthy(this.eval(n.e, env));
      case 'Logic': { const l = this.eval(n.l, env); if (n.op === '&&') return this.truthy(l) ? this.eval(n.r, env) : l; return this.truthy(l) ? l : this.eval(n.r, env); }
      case 'Bin': this.rule('rb-operators'); return this.send(this.eval(n.l, env), n.op, [this.eval(n.r, env)], null);
      case 'If': this.rule('rb-control-branch'); return this.truthy(this.eval(n.cond, env)) ? this.execBody(n.then, env) : this.execBody(n.else, env);
      case 'While': { this.rule('rb-control-loop'); try { while (this.truthy(this.eval(n.cond, env))) { try { this.execBody(n.body, env); } catch (e) { if (!(e instanceof NextSig)) throw e; } } } catch (e) { if (e instanceof BreakSig) return e.v; throw e; } return null; }
      case 'Case': { const s = n.subj ? this.eval(n.subj, env) : null; for (const w of n.whens) for (const v of w.vals) { const vv = this.eval(v, env); if (n.subj ? this.caseEq(vv, s) : this.truthy(vv)) return this.execBody(w.body, env); } return n.els ? this.execBody(n.els, env) : null; }
      case 'Return': throw new ReturnSig(n.v ? this.eval(n.v, env) : null, frame);
      case 'Break': throw new BreakSig(null);
      case 'Next': throw new NextSig(n.v ? this.eval(n.v, env) : null);
      case 'Index': { const r = this.eval(n.recv, env); return this.send(r, '[]', n.args.map((a) => this.eval(a, env)), null); }
      case 'Def': {
        this.rule('rb-methods');
        const m = new RMethodDef(n, frame.cls);
        if (n.singleton) frame.cls.smethods.set(n.name, m); else if (frame.self === this.main) this.Object.methods.set(n.name, m); else frame.cls.methods.set(n.name, m);
        return sym(n.name);
      }
      case 'Class': case 'Module': {
        this.rule('rb-classes');
        let cls = (frame.cls.consts.get(n.name) ?? this.consts.get(n.name));
        if (!cls) { const sup = n.sup ? this.eval(n.sup, env) : n.t === 'Module' ? null : this.Object; cls = new RClass(n.name, sup, n.t === 'Module'); cls.lexParent = frame.cls; (frame.cls === this.Object ? this.consts : frame.cls.consts).set(n.name, cls); }
        const cenv = new Env(null, { self: cls, cls, block: null });
        this.execBody(n.body, cenv); return null;
      }
      case 'Yield': { if (!frame.block) throw this.err('LocalJumpError', 'no block given (yield)'); return this.callProc(frame.block, n.args.map((a) => this.eval(a, env))); }
      case 'Lambda': return new RProc(n.block, env, frame.self, this, true);
      case 'Begin': {
        try { return this.execBody(n.body, env); }
        catch (e) {
          if (!(e instanceof RubyError)) throw e;
          const cls = this.consts.get(e.rbClass) ?? this.consts.get('StandardError');
          const r = n.rescues.find((r) => !r.classes.length || r.classes.some((c) => cls.isA(this.consts.get(c))));
          if (!r) throw e;
          if (r.as) { const ex = new RObject(cls); ex.ivars.set('@message', new RStr(e.message)); env.vars.set(r.as, ex); }
          return this.execBody(r.body, env);
        } finally { if (n.ensure) this.execBody(n.ensure, env); }
      }
      case 'Call': {
        if (!n.recv && n.bare) { const e = env.find(n.name); if (e) return e.vars.get(n.name); }
        const recv = n.recv ? this.eval(n.recv, env) : frame.self;
        const args = []; let blk = n.block ? new RProc(n.block, env, frame.self, this) : null;
        for (const a of n.args) { if (a.t === 'BlockPass') { const b = this.eval(a.e, env); blk = b instanceof RSym ? this.symProc(b) : b; } else if (a.t === 'Splat') args.push(...this.toA(this.eval(a.e, env))); else args.push(this.eval(a, env)); }
        if (!n.recv) { const k = this.kernel(n.name, args, blk, env); if (k !== undefined) return k; }
        return this.send(recv, n.name, args, blk, !n.recv);
      }
    }
    throw this.err('NotImplementedError', `node ${n.t}`);
  }
  evalInterp(code, env) { const p = new Parser(tokenize(code)); p.locals = [new Set(collectLocals(env))]; const body = p.program(); return this.execBody(body, env); }
  assign(t, v, env) {
    if (t.t === 'Var') { const e = env.find(t.name); (e ?? env).vars.set(t.name, v); return; }
    if (t.t === 'IVar') { const s = env.frame.self; (s.ivars ??= new Map()).set(t.name, v); return; }
    if (t.t === 'GVar') { this.globals.set(t.name, v); return; }
    if (t.t === 'Const') { (env.frame.cls === this.Object ? this.consts : env.frame.cls.consts).set(t.name, v); return; }
    if (t.t === 'Index') { this.send(this.eval(t.recv, env), '[]=', [...t.args.map((a) => this.eval(a, env)), v], null); return; }
    throw this.err('SyntaxError', 'cannot assign');
  }
  symProc(s) { return new RProc(null, null, null, this, false, s); }
  callProc(p, args) {
    if (p instanceof Native) return p.fn(args);
    if (!p.block) return this.send(args[0], (p.sym ?? arguments[2])?.n ?? p.symName, args.slice(1), null);
    const b = p.block; const env = b.shareScope ? p.env : new Env(p.env); env.frame = p.env.frame;
    let vals = args;
    if (b.params.length > 1 && args.length === 1 && Array.isArray(args[0])) vals = args[0];
    b.params.forEach((pr, i) => { if (typeof pr === 'string') env.vars.set(pr, vals[i] ?? null); else { const arr = Array.isArray(vals[i]) ? vals[i] : [vals[i]]; pr.destructure.forEach((n, j) => env.vars.set(n, arr[j] ?? null)); } });
    try { return this.execBody(b.body, env); } catch (e) { if (e instanceof NextSig) return e.v; if (p.lambda && e instanceof ReturnSig) return e.v; throw e; }
  }
  invoke(m, self, args, blk) {
    if (m instanceof Native) return m.fn(args, blk, self);
    const node = m.node; const frame = { self, cls: self instanceof RClass ? self : this.classOf(self), block: blk, method: m };
    if (self instanceof RObject) frame.cls = m.owner;
    const env = new Env(null, frame);
    let ai = 0; const kwHash = args.length && args.at(-1) instanceof RHash && node.params.some((p) => p.kind === 'kw') ? args.pop() : null;
    const req = node.params.filter((p) => p.kind === 'req').length;
    if (args.length < req) throw this.err('ArgumentError', `wrong number of arguments (given ${args.length}, expected ${req})`);
    let optAvail = args.length - req;
    for (const p of node.params) {
      if (p.kind === 'req') env.vars.set(p.name, args[ai++]);
      else if (p.kind === 'opt') { if (optAvail-- > 0) env.vars.set(p.name, args[ai++]); else env.vars.set(p.name, this.eval(p.default, env)); }
      else if (p.kind === 'rest') { const restN = args.length - ai - node.params.slice(node.params.indexOf(p) + 1).filter((q) => q.kind === 'req').length; env.vars.set(p.name, args.slice(ai, ai + restN)); ai += restN; }
      else if (p.kind === 'kw') env.vars.set(p.name, kwHash && kwHash.has(sym(p.name)) ? kwHash.get(sym(p.name)) : p.default ? this.eval(p.default, env) : null);
      else if (p.kind === 'block') env.vars.set(p.name, blk);
    }
    if (!node.params.some((p) => p.kind === 'rest') && ai < args.length) throw this.err('ArgumentError', `wrong number of arguments (given ${args.length}, expected ${req})`);
    try { return this.execBody(node.body, env); } catch (e) { if (e instanceof ReturnSig && e.frame === frame) return e.v; throw e; }
  }
  kernel(name, args, blk, env) {
    switch (name) {
      case 'puts': this.rule('rb-io'); if (!args.length) this.write('\n'); for (const a of args) { if (Array.isArray(a)) { for (const x of a.flat(Infinity)) this.write(this.toS(x) + '\n'); } else { const s = this.toS(a); this.write(s.endsWith('\n') ? s : s + '\n'); } } return null;
      case 'print': for (const a of args) this.write(this.toS(a)); return null;
      case 'p': for (const a of args) this.write(this.inspect(a) + '\n'); return args.length === 1 ? args[0] : args.length ? args : null;
      case 'pp': for (const a of args) this.write(this.inspect(a) + '\n'); return args[0] ?? null;
      case 'format': case 'sprintf': return new RStr(this.format(strv(args[0]), args.slice(1)));
      case 'require': case 'require_relative': return true;
      case 'raise': { const a = args[0]; if (a instanceof RClass) throw this.err(a.name, args[1] ? this.toS(args[1]) : a.name); throw this.err('RuntimeError', a === undefined ? 'unhandled exception' : this.toS(a)); }
      case 'loop': try { for (;;) this.callProc(blk, []); } catch (e) { if (e instanceof BreakSig) return e.v; throw e; }
      case 'lambda': case 'proc': return new RProc(blk.block, blk.env, blk.self, this, name === 'lambda');
      case 'block_given?': return !!env.frame.block;
      case 'attr_reader': case 'attr_accessor': case 'attr_writer': {
        const cls = env.frame.cls;
        for (const s of args) { const n = s instanceof RSym ? s.n : strv(s); if (name !== 'attr_writer') cls.methods.set(n, new Native((a, b, self) => self.ivars.get('@' + n) ?? null)); if (name !== 'attr_reader') cls.methods.set(n + '=', new Native(([v], b, self) => { self.ivars.set('@' + n, v); return v; })); }
        return null;
      }
      case 'include': for (const m of args) env.frame.cls.includes.push(m); return env.frame.cls;
      case 'private': case 'public': case 'protected': case 'extend': return null;
      case 'rand': case 'gets': case 'sleep': case 'system': case 'exec': case 'open': throw this.err('NotImplementedError', `${name} is not available in the sovereign sandbox`);
    }
    return undefined;
  }
  send(r, name, args, blk, fcall = false) {
    this.rule('rb-dispatch');
    if (r instanceof RObject || r === this.main) {
      const m = r.cls.find(name); if (m) return this.invoke(m, r, args, blk);
    }
    if (r instanceof RClass) {
      const m = r.findS(name); if (m) return this.invoke(m, r, args, blk);
      if (name === 'new') { const o = new RObject(r); const init = r.find('initialize'); if (init) this.invoke(init, o, args, blk); else if (r.isA(this.consts.get('StandardError'))) o.ivars.set('@message', args[0] ?? new RStr(r.name)); return o; }
      if (name === 'name' || name === 'to_s' || name === 'inspect') return new RStr(r.name);
      if (name === 'sqrt' && r.name === 'Math') return new RFloat(Math.sqrt(num(args[0])));
      if (r.name === 'Math' && typeof Math[name] === 'function') return new RFloat(Math[name](...args.map(num)));
      if (name === '===') return r.isA === undefined ? false : this.classOf(args[0]).isA(r);
    }
    const userM = !(r instanceof RObject) && this.Object.find(name);
    if (userM && fcall) return this.invoke(userM, r, args, blk);
    const v = builtin(this, r, name, args, blk);
    if (v !== undefined) return v;
    if (r instanceof RObject) { const mm = r.cls.find('method_missing'); if (mm) return this.invoke(mm, r, [sym(name), ...args], blk); if (name === 'message' && r.ivars.has('@message')) return r.ivars.get('@message'); }
    const generic = { class: () => this.classOf(r), inspect: () => new RStr(this.inspect(r)), to_s: () => new RStr(this.toS(r)), nil: () => r === null, 'nil?': () => r === null, '==': () => this.eq(r, args[0]), '!=': () => !this.eq(r, args[0]), 'is_a?': () => this.classOf(r).isA(args[0]), 'kind_of?': () => this.classOf(r).isA(args[0]), 'respond_to?': () => !!(r instanceof RObject && r.cls.find(args[0].n)), 'instance_of?': () => this.classOf(r) === args[0], equal: () => r === args[0], 'frozen?': () => true, freeze: () => r, dup: () => r, tap: () => { this.callProc(blk, [r]); return r; }, then: () => this.callProc(blk, [r]), send: () => this.send(r, args[0].n ?? strv(args[0]), args.slice(1), blk), public_send: () => this.send(r, args[0].n, args.slice(1), blk), object_id: () => 0, hash: () => 0, instance_variable_get: () => r.ivars.get(args[0].n ?? strv(args[0])) ?? null, '!': () => !this.truthy(r), '===': () => this.eq(r, args[0]), 'eql?': () => this.eq(r, args[0]) };
    if (generic[name]) return generic[name]();
    throw this.err('NoMethodError', `undefined method '${name}' for ${this.inspect(r)}`);
  }
  truthy(v) { return v !== null && v !== false && v !== undefined; }
  eq(a, b) { if (isNum(a) && isNum(b)) return num(a) === num(b); if (a instanceof RStr && b instanceof RStr) return a.s === b.s; if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => this.eq(x, b[i])); if (a instanceof RHash && b instanceof RHash) return a.m.size === b.m.size && a.entries().every(([k, v]) => b.has(k) && this.eq(v, b.get(k))); if (a instanceof RObject) { const m = a.cls.find('=='); if (m) return this.truthy(this.invoke(m, a, [b], null)); } return a === b; }
  caseEq(pat, v) { if (pat instanceof RClass) return this.classOf(v).isA(pat); if (pat instanceof RRange) return num(v) >= num(pat.a) && (pat.excl ? num(v) < num(pat.b) : num(v) <= num(pat.b)); return this.eq(pat, v); }
  cmp(a, b) { if (isNum(a) && isNum(b)) return num(a) < num(b) ? -1 : num(a) > num(b) ? 1 : 0; if (a instanceof RStr && b instanceof RStr) return a.s < b.s ? -1 : a.s > b.s ? 1 : 0; if (Array.isArray(a) && Array.isArray(b)) { for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = this.cmp(a[i], b[i]); if (c) return c; } return a.length - b.length; } return num(this.send(a, '<=>', [b], null)); }
  toA(v) { if (Array.isArray(v)) return v; if (v instanceof RRange) return v.toArray(); if (v instanceof RHash) return v.entries().map(([k, x]) => [k, x]); if (v === null) return []; return [v]; }
  toS(v) {
    if (v === null || v === undefined) return ''; if (v instanceof RStr) return v.s; if (typeof v === 'string') return v; if (v instanceof RSym) return v.n;
    if (v instanceof RFloat) return fmtFloat(v.v); if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (v instanceof RObject) { const m = v.cls.find('to_s'); if (m) return this.toS(this.invoke(m, v, [], null)); if (v.ivars.has('@message')) return this.toS(v.ivars.get('@message')); return `#<${v.cls.name}>`; }
    if (v instanceof RClass) return v.name;
    return this.inspect(v);
  }
  inspect(v) {
    if (v === null || v === undefined) return 'nil'; if (v instanceof RStr) return JSON.stringify(v.s); if (v instanceof RSym) return ':' + v.n;
    if (Array.isArray(v)) return '[' + v.map((x) => this.inspect(x)).join(', ') + ']';
    if (v instanceof RHash) return '{' + v.entries().map(([k, x]) => (k instanceof RSym ? `${k.n}: ` : `${this.inspect(k)} => `) + this.inspect(x)).join(', ') + '}';
    if (v instanceof RRange) return `${this.inspect(v.a)}${v.excl ? '...' : '..'}${this.inspect(v.b)}`;
    if (v instanceof RObject) { const m = v.cls.find('inspect'); if (m) return this.toS(this.invoke(m, v, [], null)); const iv = [...v.ivars].map(([k, x]) => `${k}=${this.inspect(x)}`).join(', '); return `#<${v.cls.name}${iv ? ' ' + iv : ''}>`; }
    return this.toS(v);
  }
  format(fmt, args) { let i = 0; return fmt.replace(/%([-+ 0]*)(\d*)(?:\.(\d+))?([sdfixXeEgbo%])/g, (all, flags, w, prec, type) => { if (type === '%') return '%'; const a = args[i++]; let s; switch (type) { case 'd': case 'i': s = String(Math.trunc(num(a))); break; case 'f': s = num(a).toFixed(prec === undefined ? 6 : Number(prec)); break; case 'e': case 'E': s = num(a).toExponential(prec === undefined ? 6 : Number(prec)).replace(/e([+-])(\d)$/, 'e$10$2'); break; case 'g': s = String(Number(num(a).toPrecision(prec === undefined ? 6 : Number(prec)))); break; case 'x': s = num(a).toString(16); break; case 'X': s = num(a).toString(16).toUpperCase(); break; case 'b': s = num(a).toString(2); break; case 'o': s = num(a).toString(8); break; default: s = this.toS(a); if (prec !== undefined) s = s.slice(0, Number(prec)); } if (flags.includes('+') && isNum(a) && num(a) >= 0) s = '+' + s; const W = Number(w || 0); if (s.length < W) s = flags.includes('-') ? s.padEnd(W) : flags.includes('0') ? s.padStart(W, '0') : s.padStart(W); return s; }); }
}
function collectLocals(env) { const out = []; let e = env; while (e) { out.push(...e.vars.keys()); e = e.parent; } return out; }
function fmtFloat(v) { if (Number.isInteger(v) && Math.abs(v) < 1e16) return v.toFixed(1); if (!Number.isFinite(v)) return Number.isNaN(v) ? 'NaN' : v > 0 ? 'Infinity' : '-Infinity'; let s = String(v); if (s.includes('e')) { s = s.replace(/e\+?/, 'e+').replace('e+-', 'e-'); if (!/\.\d/.test(s.split('e')[0])) s = s.replace('e', '.0e'); s = s.replace(/e([+-])(\d)$/, 'e$10$2'); } return s; }
function builtin(I, r, name, args, blk) {
  const F = (v) => new RFloat(v); const S = (s) => new RStr(s);
  const call = (...a) => I.callProc(blk ?? args.at(-1), a);
  if (blk && blk.sym === undefined && blk.block === null && blk.symName === undefined) blk = null;
  if (isNum(r)) {
    const fl = r instanceof RFloat || args.some((a) => a instanceof RFloat); const x = num(r), y = args.length ? num(args[0]) : undefined; const w = (v) => (fl ? F(v) : v);
    switch (name) {
      case '+': return w(x + y); case '-': return w(x - y); case '*': return w(x * y);
      case '/': if (!fl) { if (y === 0) throw I.err('ZeroDivisionError', 'divided by 0'); return Math.floor(x / y); } return F(x / y);
      case '%': case 'modulo': { if (!fl && y === 0) throw I.err('ZeroDivisionError', 'divided by 0'); return w(x - Math.floor(x / y) * y); }
      case '**': return !fl && y >= 0 ? x ** y : F(x ** y);
      case '-@': return w(-x); case '==': return isNum(args[0]) && x === y; case '<': return x < y; case '>': return x > y; case '<=': return x <= y; case '>=': return x >= y; case '<=>': return x < y ? -1 : x > y ? 1 : 0;
      case '&': return x & y; case '|': return x | y; case '^': return x ^ y; case '<<': return x << y; case '>>': return x >> y;
      case 'to_s': return S(args.length ? x.toString(y) : I.toS(r)); case 'inspect': return S(I.toS(r)); case 'to_i': case 'floor': case 'truncate': return args.length && name === 'floor' ? F(Math.floor(x * 10 ** y) / 10 ** y) : Math.trunc(name === 'floor' ? Math.floor(x) : x); case 'to_f': return F(x); case 'ceil': return Math.ceil(x);
      case 'round': return args.length ? F(Number(x.toFixed(y))) : Math.sign(x) * Math.round(Math.abs(x));
      case 'abs': return w(Math.abs(x)); case 'even?': return x % 2 === 0; case 'odd?': return Math.abs(x % 2) === 1; case 'zero?': return x === 0; case 'positive?': return x > 0; case 'negative?': return x < 0;
      case 'times': { I.rule('rb-blocks'); try { for (let i = 0; i < x; i++) I.callProc(blk, [i]); } catch (e) { if (e instanceof BreakSig) return e.v; throw e; } return r; }
      case 'upto': for (let i = x; i <= y; i++) I.callProc(blk, [i]); return r; case 'downto': for (let i = x; i >= y; i--) I.callProc(blk, [i]); return r;
      case 'step': for (let i = x; i <= y; i += num(args[1])) I.callProc(blk, [i]); return r;
      case 'succ': case 'next': return x + 1; case 'pred': return x - 1; case 'divmod': return [Math.floor(x / y), x - Math.floor(x / y) * y]; case 'gcd': { let a = Math.abs(x), b = Math.abs(y); while (b) [a, b] = [b, a % b]; return a; }
      case 'clamp': return Math.min(Math.max(x, y), num(args[1])); case 'between?': return x >= y && x <= num(args[1]); case 'integer?': return !(r instanceof RFloat); case 'chr': return S(String.fromCharCode(x)); case 'digits': return String(x).split('').reverse().map(Number);
      case 'coerce': return [F(y), F(x)]; case 'hash': return x;
    }
  }
  if (r instanceof RStr) {
    const s = r.s; const a0 = args[0];
    switch (name) {
      case '+': return S(s + strv(a0)); case '*': return S(s.repeat(num(a0))); case '%': return S(I.format(s, Array.isArray(a0) ? a0 : [a0]));
      case '==': return a0 instanceof RStr && a0.s === s; case '<=>': return s < a0.s ? -1 : s > a0.s ? 1 : 0; case '<': return s < a0.s; case '>': return s > a0.s;
      case '<<': r.s += I.toS(a0); return r; case 'concat': r.s += I.toS(a0); return r;
      case 'length': case 'size': return [...s].length; case 'upcase': return S(s.toUpperCase()); case 'downcase': return S(s.toLowerCase()); case 'capitalize': return S(s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()); case 'swapcase': return S([...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(''));
      case 'reverse': return S([...s].reverse().join('')); case 'strip': return S(s.trim()); case 'lstrip': return S(s.trimStart()); case 'rstrip': return S(s.trimEnd()); case 'chomp': return S(s.replace(/\r?\n$/, '')); case 'chars': return [...s].map(S); case 'bytes': return [...new TextEncoder().encode(s)];
      case 'split': return (a0 === undefined ? s.trim().split(/\s+/) : s.split(strv(a0))).filter((x, i, arr) => !(x === '' && i === arr.length - 1 && a0 !== undefined)).map(S);
      case 'include?': return s.includes(strv(a0)); case 'start_with?': return args.some((x) => s.startsWith(strv(x))); case 'end_with?': return args.some((x) => s.endsWith(strv(x)));
      case 'to_s': case 'to_str': return r; case 'to_sym': return sym(s); case 'to_i': return parseInt(s, 10) || 0; case 'to_f': return F(parseFloat(s) || 0); case 'inspect': return S(I.inspect(r)); case 'empty?': return s.length === 0;
      case 'sub': return S(s.replace(strv(a0), strv(args[1]))); case 'gsub': return S(s.split(strv(a0)).join(strv(args[1]))); case 'tr': return S([...s].map((c) => { const i = strv(a0).indexOf(c); return i < 0 ? c : strv(args[1])[Math.min(i, strv(args[1]).length - 1)]; }).join(''));
      case 'center': return S(s.padStart(Math.floor((num(a0) + s.length) / 2), strv(args[1] ?? S(' '))).padEnd(num(a0), strv(args[1] ?? S(' ')))); case 'ljust': return S(s.padEnd(num(a0), strv(args[1] ?? S(' ')))); case 'rjust': return S(s.padStart(num(a0), strv(args[1] ?? S(' '))));
      case '[]': { if (a0 instanceof RRange) { const st = num(a0.a) < 0 ? s.length + num(a0.a) : num(a0.a); let en = num(a0.b) < 0 ? s.length + num(a0.b) : num(a0.b); if (!a0.excl) en++; return S(s.slice(st, en)); } let i = num(a0); if (i < 0) i += s.length; if (args.length > 1) return S(s.substr(i, num(args[1]))); return i < s.length ? S(s[i]) : null; }
      case 'each_char': for (const c of s) I.callProc(blk, [S(c)]); return r; case 'count': return s.split(strv(a0)).length - 1; case 'index': { const i = s.indexOf(strv(a0)); return i < 0 ? null : i; }
      case 'freeze': case 'dup': return r; case 'hash': return s.length; case 'ord': return s.codePointAt(0); case 'lines': return s.split(/(?<=\n)/).map(S); case 'eql?': return a0 instanceof RStr && a0.s === s;
    }
  }
  if (r instanceof RSym) { if (name === 'to_s' || name === 'id2name' || name === 'name') return S(r.n); if (name === 'to_sym') return r; if (name === 'to_proc') { const p = new RProc(null, null, null, I); p.symName = r.n; return p; } if (name === '<=>') return r.n < args[0].n ? -1 : r.n > args[0].n ? 1 : 0; }
  if (r instanceof RProc) { if (name === 'call' || name === '()' || name === 'yield' || name === '[]') return I.callProc(r, args); if (name === 'to_proc') return r; if (name === 'arity') return r.block.params.length; if (name === 'lambda?') return r.lambda; }
  if (r === null) { if (name === 'to_s') return S(''); if (name === 'to_a') return []; if (name === 'to_i') return 0; if (name === 'inspect') return S('nil'); }
  if (r instanceof RHash) {
    const ents = r.entries();
    switch (name) {
      case '[]': { const v = r.get(args[0]); return v === undefined ? (r.defaultProc ? I.callProc(r.defaultProc, [r, args[0]]) : r.default ?? null) : v; }
      case '[]=': case 'store': r.set(args[0], args[1]); return args[1];
      case 'each': case 'each_pair': I.rule('rb-blocks'); for (const [k, v] of ents) I.callProc(blk, [[k, v]]); return r;
      case 'map': case 'collect': case 'flat_map': { const out = ents.map(([k, v]) => I.callProc(blk, [[k, v]])); return name === 'flat_map' ? out.flat() : out; }
      case 'keys': return ents.map((e) => e[0]); case 'values': return ents.map((e) => e[1]); case 'length': case 'size': case 'count': return ents.length; case 'empty?': return ents.length === 0;
      case 'key?': case 'has_key?': case 'include?': case 'member?': return r.has(args[0]); case 'value?': return ents.some((e) => I.eq(e[1], args[0]));
      case 'fetch': { const v = r.get(args[0]); if (v !== undefined) return v; if (args.length > 1) return args[1]; if (blk) return I.callProc(blk, [args[0]]); throw I.err('KeyError', `key not found: ${I.inspect(args[0])}`); }
      case 'delete': { const v = r.get(args[0]); r.m.delete(r.key(args[0])); return v ?? null; }
      case 'select': case 'filter': case 'reject': { const h = new RHash(); for (const [k, v] of ents) if (I.truthy(I.callProc(blk, [[k, v]])) === (name !== 'reject')) h.set(k, v); return h; }
      case 'to_a': return ents.map(([k, v]) => [k, v]); case 'to_h': return r; case 'inspect': case 'to_s': return S(I.inspect(r));
      case 'merge': { const h = new RHash(); for (const [k, v] of ents) h.set(k, v); for (const [k, v] of args[0].entries()) h.set(k, v); return h; }
      case 'transform_values': { const h = new RHash(); for (const [k, v] of ents) h.set(k, I.callProc(blk, [v])); return h; }
      case 'sort_by': return ents.map(([k, v]) => [k, v]).map((e) => [I.callProc(blk, [e]), e]).sort((a, b) => I.cmp(a[0], b[0])).map((x) => x[1]);
      case 'min_by': case 'max_by': case 'sum': case 'each_with_index': case 'find': case 'detect': case 'any?': case 'all?': case 'group_by': case 'each_with_object': case 'reduce': case 'inject': return builtin(I, ents.map(([k, v]) => [k, v]), name, args, blk);
      case '==': return I.eq(r, args[0]); case 'dig': { let v = r; for (const k of args) { v = v instanceof RHash ? v.get(k) ?? null : Array.isArray(v) ? v[num(k)] ?? null : null; } return v; }
    }
  }
  if (r instanceof RRange) { if (name === 'to_a' || name === 'entries') return r.toArray(); if (name === 'first' && !args.length) return r.a; if (name === 'last' && !args.length) return r.b; if (name === 'include?' || name === 'member?' || name === 'cover?' || name === '===') return I.caseEq(r, args[0]); if (name === 'size' || name === 'count' && !blk) return r.toArray().length; if (name === 'step') { const out = []; for (let i = num(r.a); r.excl ? i < num(r.b) : i <= num(r.b); i += num(args[0])) out.push(i); if (blk) { out.forEach((x) => I.callProc(blk, [x])); return r; } return out; } if (name === 'inspect' || name === 'to_s') return S(I.inspect(r)); return builtin(I, r.toArray(), name, args, blk); }
  if (Array.isArray(r)) {
    const a = r; const cb = (x, i) => I.callProc(blk, [x, i]);
    const cbv = blk ? (blk.symName ? (x) => I.send(x, blk.symName, [], null) : (x) => I.callProc(blk, [x])) : null;
    const brk = (fn) => { try { return fn(); } catch (e) { if (e instanceof BreakSig) return e.v; throw e; } };
    switch (name) {
      case 'each': I.rule('rb-blocks'); return brk(() => { for (const x of [...a]) cbv(x); return a; });
      case 'each_with_index': return brk(() => { a.forEach((x, i) => I.callProc(blk, [x, i])); return a; });
      case 'each_with_object': { const memo = args[0]; a.forEach((x) => I.callProc(blk, [x, memo])); return memo; }
      case 'map': case 'collect': I.rule('rb-blocks'); return a.map((x) => cbv(x)); case 'flat_map': return a.flatMap((x) => cbv(x));
      case 'map!': a.splice(0, a.length, ...a.map((x) => cbv(x))); return a;
      case 'each_slice': { const out = []; for (let i = 0; i < a.length; i += num(args[0])) out.push(a.slice(i, i + num(args[0]))); if (blk) { out.forEach((x) => cbv(x)); return null; } return out; }
      case 'each_cons': { const out = []; for (let i = 0; i + num(args[0]) <= a.length; i++) out.push(a.slice(i, i + num(args[0]))); if (blk) { out.forEach((x) => cbv(x)); return a; } return out; }
      case 'select': case 'filter': return a.filter((x) => I.truthy(cbv(x))); case 'reject': return a.filter((x) => !I.truthy(cbv(x)));
      case 'find': case 'detect': return a.find((x) => I.truthy(cbv(x))) ?? null; case 'find_index': case 'index': { const i = blk ? a.findIndex((x) => I.truthy(cbv(x))) : a.findIndex((x) => I.eq(x, args[0])); return i < 0 ? null : i; }
      case 'any?': return blk ? a.some((x) => I.truthy(cbv(x))) : a.some((x) => I.truthy(x)); case 'all?': return blk ? a.every((x) => I.truthy(cbv(x))) : a.every((x) => I.truthy(x)); case 'none?': return !a.some((x) => I.truthy(blk ? cbv(x) : x));
      case 'count': return blk ? a.filter((x) => I.truthy(cbv(x))).length : args.length ? a.filter((x) => I.eq(x, args[0])).length : a.length;
      case 'reduce': case 'inject': { let items = [...a]; let acc; let opSym = args.find((x) => x instanceof RSym); const init = args.find((x) => !(x instanceof RSym)); acc = init !== undefined ? init : items.shift(); for (const x of items) acc = opSym ? I.send(acc, opSym.n, [x], null) : I.callProc(blk, [acc, x]); return acc ?? null; }
      case 'sum': { let acc = args[0] ?? 0; for (const x of a) acc = I.send(acc, '+', [blk ? cbv(x) : x], null); return acc; }
      case 'join': return S(a.flat(Infinity).map((x) => I.toS(x)).join(args.length ? strv(args[0]) : ''));
      case 'length': case 'size': return a.length; case 'empty?': return a.length === 0; case 'first': return args.length ? a.slice(0, num(args[0])) : a[0] ?? null; case 'last': return args.length ? a.slice(-num(args[0])) : a.at(-1) ?? null;
      case 'push': case 'append': a.push(...args); return a; case '<<': a.push(args[0]); return a; case 'pop': return a.pop() ?? null; case 'shift': return a.shift() ?? null; case 'unshift': case 'prepend': a.unshift(...args); return a; case 'insert': a.splice(num(args[0]), 0, ...args.slice(1)); return a;
      case '[]': { const k = args[0]; if (k instanceof RRange) { const st = num(k.a) < 0 ? a.length + num(k.a) : num(k.a); let en = num(k.b) < 0 ? a.length + num(k.b) : num(k.b); if (!k.excl) en++; return a.slice(st, en); } let i = num(k); if (i < 0) i += a.length; if (args.length > 1) return a.slice(i, i + num(args[1])); return a[i] ?? null; }
      case '[]=': { let i = num(args[0]); if (i < 0) i += a.length; while (a.length < i) a.push(null); a[i] = args[1]; return args[1]; }
      case 'at': return a.at(num(args[0])) ?? null; case 'dig': { let v = a; for (const k of args) v = Array.isArray(v) ? v[num(k)] ?? null : v instanceof RHash ? v.get(k) ?? null : null; return v; } case 'fetch': { const v = a.at(num(args[0])); if (v === undefined) { if (args.length > 1) return args[1]; throw I.err('IndexError', `index ${num(args[0])} outside of array bounds`); } return v; }
      case 'include?': case 'member?': return a.some((x) => I.eq(x, args[0])); case 'reverse': return [...a].reverse(); case 'rotate': { const n = ((num(args[0] ?? 1) % a.length) + a.length) % a.length; return [...a.slice(n), ...a.slice(0, n)]; }
      case 'sort': return [...a].sort((x, y) => (blk ? num(I.callProc(blk, [x, y])) : I.cmp(x, y))); case 'sort!': a.sort((x, y) => I.cmp(x, y)); return a; case 'sort_by': return a.map((x) => [cbv(x), x]).sort((p, q) => I.cmp(p[0], q[0])).map((p) => p[1]);
      case 'min': return a.length ? a.reduce((m, x) => (I.cmp(x, m) < 0 ? x : m)) : null; case 'max': return a.length ? a.reduce((m, x) => (I.cmp(x, m) > 0 ? x : m)) : null;
      case 'min_by': return a.length ? a.reduce((m, x) => (I.cmp(cbv(x), cbv(m)) < 0 ? x : m)) : null; case 'max_by': return a.length ? a.reduce((m, x) => (I.cmp(cbv(x), cbv(m)) > 0 ? x : m)) : null; case 'minmax': return [builtin(I, a, 'min', [], null), builtin(I, a, 'max', [], null)];
      case 'uniq': { const out = []; for (const x of a) if (!out.some((y) => I.eq(x, y))) out.push(x); return out; } case 'compact': return a.filter((x) => x !== null); case 'flatten': return a.flat(args.length ? num(args[0]) : Infinity);
      case 'zip': return a.map((x, i) => [x, ...args.map((o) => I.toA(o)[i] ?? null)]); case 'take': return a.slice(0, num(args[0])); case 'drop': return a.slice(num(args[0])); case 'take_while': { const out = []; for (const x of a) { if (!I.truthy(cbv(x))) break; out.push(x); } return out; }
      case 'group_by': { const h = new RHash(); for (const x of a) { const k = cbv(x); const cur = h.get(k); if (cur) cur.push(x); else h.set(k, [x]); } return h; } case 'partition': { const t = [], f = []; for (const x of a) (I.truthy(cbv(x)) ? t : f).push(x); return [t, f]; }
      case 'tally': { const h = new RHash(); for (const x of a) h.set(x, (h.get(x) ?? 0) + 1); return h; } case 'to_h': { const h = new RHash(); for (const p of a) { const [k, v] = blk ? cbv(p) : p; h.set(k, v); } return h; } case 'each_index': a.forEach((_, i) => cbv(i)); return a;
      case 'to_a': case 'entries': return a; case 'inspect': case 'to_s': return S(I.inspect(a)); case '+': return [...a, ...args[0]]; case '-': return a.filter((x) => !args[0].some((y) => I.eq(x, y))); case '*': return typeof args[0] === 'number' ? Array.from({ length: args[0] }, () => a).flat() : S(a.map((x) => I.toS(x)).join(strv(args[0])));
      case '&': return a.filter((x) => args[0].some((y) => I.eq(x, y))); case '|': return builtin(I, [...a, ...args[0]], 'uniq', [], null); case '==': return I.eq(a, args[0]); case 'clear': a.length = 0; return a; case 'delete': { const before = a.length; for (let i = a.length - 1; i >= 0; i--) if (I.eq(a[i], args[0])) a.splice(i, 1); return before === a.length ? null : args[0]; }
      case 'delete_at': return a.splice(num(args[0]), 1)[0] ?? null; case 'slice': return builtin(I, a, '[]', args, blk); case 'combination': { const k = num(args[0]); const out = []; const rec = (s, acc) => { if (acc.length === k) { out.push(acc); return; } for (let i = s; i < a.length; i++) rec(i + 1, [...acc, a[i]]); }; rec(0, []); return out; } case 'product': return a.flatMap((x) => args[0].map((y) => [x, y])); case 'transpose': return a[0] ? a[0].map((_, i) => a.map((row) => row[i])) : []; case 'freeze': case 'dup': case 'clone': return name === 'freeze' ? a : [...a]; case 'hash': return a.length; case 'sample': case 'shuffle': throw I.err('NotImplementedError', `${name} needs randomness (not provided in the sovereign sandbox)`);
      case 'each_char': break; case 'cycle': break; case 'with_index': break;
    }
  }
  return undefined;
}
export { RStr, RFloat, RSym, RHash };
