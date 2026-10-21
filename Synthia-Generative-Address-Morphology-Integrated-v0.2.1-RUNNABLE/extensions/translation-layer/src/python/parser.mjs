// Pure-JS Python parser (subset) producing a plain-object AST.
import { tokenize, PySyntaxError } from './tokenizer.mjs';

export function parse(src) { return new Parser(tokenize(src)).module(); }

class Parser {
  constructor(toks) { this.toks = toks; this.p = 0; }
  get cur() { return this.toks[this.p]; }
  peek(k = 1) { return this.toks[this.p + k]; }
  at(type, value) { const t = this.cur; return t.type === type && (value === undefined || t.value === value); }
  atOp(v) { return this.at('OP', v); }
  atKw(v) { return this.at('KW', v); }
  eat(type, value) {
    if (!this.at(type, value)) throw new PySyntaxError(`expected ${value ?? type} but found ${this.cur.value ?? this.cur.type}`, this.cur.line);
    return this.toks[this.p++];
  }
  accept(type, value) { if (this.at(type, value)) return this.toks[this.p++]; return null; }

  module() {
    const body = [];
    while (!this.at('EOF')) { if (this.accept('NEWLINE')) continue; body.push(...this.statement()); }
    return { t: 'Module', body };
  }
  block() {
    if (!this.at('NEWLINE')) { return this.simpleStatements(); }
    this.eat('NEWLINE'); this.eat('INDENT');
    const body = [];
    while (!this.at('DEDENT') && !this.at('EOF')) { if (this.accept('NEWLINE')) continue; body.push(...this.statement()); }
    this.accept('DEDENT');
    return body;
  }
  statement() {
    const t = this.cur;
    if (t.type === 'OP' && t.value === '@') return [this.decorated()];
    if (t.type === 'KW') {
      switch (t.value) {
        case 'def': return [this.funcdef([])];
        case 'class': return [this.classdef([])];
        case 'if': return [this.ifStmt()];
        case 'for': return [this.forStmt()];
        case 'while': return [this.whileStmt()];
        case 'try': return [this.tryStmt()];
        case 'with': return [this.withStmt()];
      }
    }
    return this.simpleStatements();
  }
  simpleStatements() {
    const out = [this.smallStatement()];
    while (this.accept('OP', ';')) { if (this.at('NEWLINE') || this.at('EOF')) break; out.push(this.smallStatement()); }
    if (!this.at('EOF') && !this.at('DEDENT')) this.eat('NEWLINE');
    return out;
  }
  smallStatement() {
    const line = this.cur.line;
    const node = this.smallStatementInner();
    node.line = line;
    return node;
  }
  smallStatementInner() {
    const t = this.cur;
    if (t.type === 'KW') {
      switch (t.value) {
        case 'pass': this.p++; return { t: 'Pass' };
        case 'break': this.p++; return { t: 'Break' };
        case 'continue': this.p++; return { t: 'Continue' };
        case 'return': this.p++; return { t: 'Return', value: this.endOfSimple() ? null : this.exprList() };
        case 'raise': this.p++; return { t: 'Raise', exc: this.endOfSimple() ? null : this.expr() };
        case 'global': case 'nonlocal': { this.p++; const names = [this.eat('NAME').value]; while (this.accept('OP', ',')) names.push(this.eat('NAME').value); return { t: t.value === 'global' ? 'Global' : 'Nonlocal', names }; }
        case 'del': this.p++; return { t: 'Del', targets: this.exprList() };
        case 'assert': { this.p++; const test = this.expr(); const msg = this.accept('OP', ',') ? this.expr() : null; return { t: 'Assert', test, msg }; }
        case 'import': {
          this.p++; const names = [];
          do { const name = this.dotted(); const as = this.accept('KW', 'as') ? this.eat('NAME').value : null; names.push({ name, as }); } while (this.accept('OP', ','));
          return { t: 'Import', names };
        }
        case 'from': {
          this.p++; let level = 0; while (this.accept('OP', '.')) level++;
          const module = this.at('KW', 'import') ? '' : this.dotted(); this.eat('KW', 'import');
          const names = []; const paren = this.accept('OP', '(');
          if (this.accept('OP', '*')) names.push({ name: '*', as: null });
          else do { if (paren && this.at('OP', ')')) break; const name = this.eat('NAME').value; const as = this.accept('KW', 'as') ? this.eat('NAME').value : null; names.push({ name, as }); } while (this.accept('OP', ','));
          if (paren) this.eat('OP', ')');
          return { t: 'ImportFrom', module, names, level };
        }
      }
    }
    const first = this.exprListStar();
    if (this.atOp(':') ) { // annotated assignment
      this.p++; const annotation = this.expr(); const value = this.accept('OP', '=') ? this.exprList() : null;
      return { t: 'AnnAssign', target: first, annotation, value };
    }
    const aug = ['+=', '-=', '*=', '/=', '//=', '%=', '**=', '&=', '|=', '^=', '<<=', '>>='];
    if (this.cur.type === 'OP' && aug.includes(this.cur.value)) { const op = this.cur.value.slice(0, -1); this.p++; return { t: 'AugAssign', target: first, op, value: this.exprList() }; }
    if (this.atOp('=')) {
      const targets = [first]; let value;
      while (this.accept('OP', '=')) { value = this.at('KW', 'yield') ? this.yieldExpr() : this.exprListStar(); targets.push(value); }
      targets.pop();
      return { t: 'Assign', targets, value };
    }
    return { t: 'Expr', value: first };
  }
  endOfSimple() { return this.at('NEWLINE') || this.atOp(';') || this.at('EOF') || this.at('DEDENT'); }
  dotted() { let n = this.eat('NAME').value; while (this.accept('OP', '.')) n += '.' + this.eat('NAME').value; return n; }
  decorated() {
    const decorators = [];
    while (this.accept('OP', '@')) { decorators.push(this.expr()); this.eat('NEWLINE'); }
    if (this.atKw('def')) return this.funcdef(decorators);
    if (this.atKw('class')) return this.classdef(decorators);
    throw new PySyntaxError('decorator must precede def or class', this.cur.line);
  }
  funcdef(decorators) {
    const line = this.eat('KW', 'def').line; const name = this.eat('NAME').value;
    this.eat('OP', '('); const params = this.params(')'); this.eat('OP', ')');
    if (this.accept('OP', '->')) this.expr();
    this.eat('OP', ':');
    return { t: 'FunctionDef', name, params, body: this.block(), decorators, line };
  }
  params(close) {
    const params = [];
    while (!this.atOp(close)) {
      if (this.accept('OP', '/')) { this.accept('OP', ','); continue; }
      let kind = 'normal';
      if (this.accept('OP', '**')) kind = 'kwargs'; else if (this.accept('OP', '*')) { kind = 'varargs'; if (this.atOp(',')) { this.p++; params.push({ kind: 'kwonly-marker' }); continue; } }
      const name = this.eat('NAME').value;
      if (close === ')' && this.accept('OP', ':')) this.expr();
      const dflt = this.accept('OP', '=') ? this.expr() : null;
      params.push({ name, kind, default: dflt });
      if (!this.accept('OP', ',')) break;
    }
    return params;
  }
  classdef(decorators) {
    const line = this.eat('KW', 'class').line; const name = this.eat('NAME').value; let bases = [], keywords = [];
    if (this.accept('OP', '(')) { ({ args: bases, keywords } = this.callArgs()); this.eat('OP', ')'); }
    this.eat('OP', ':');
    return { t: 'ClassDef', name, bases, keywords, body: this.block(), decorators, line };
  }
  ifStmt() {
    const line = this.cur.line; this.p++; const test = this.namedExpr(); this.eat('OP', ':'); const body = this.block(); let orelse = [];
    if (this.atKw('elif')) orelse = [this.ifStmt()];
    else if (this.accept('KW', 'else')) { this.eat('OP', ':'); orelse = this.block(); }
    return { t: 'If', test, body, orelse, line };
  }
  forStmt() {
    const line = this.eat('KW', 'for').line; const target = this.targetList(); this.eat('KW', 'in'); const iter = this.exprList(); this.eat('OP', ':');
    const body = this.block(); let orelse = []; if (this.accept('KW', 'else')) { this.eat('OP', ':'); orelse = this.block(); }
    return { t: 'For', target, iter, body, orelse, line };
  }
  whileStmt() {
    const line = this.eat('KW', 'while').line; const test = this.namedExpr(); this.eat('OP', ':'); const body = this.block(); let orelse = [];
    if (this.accept('KW', 'else')) { this.eat('OP', ':'); orelse = this.block(); }
    return { t: 'While', test, body, orelse, line };
  }
  tryStmt() {
    const line = this.eat('KW', 'try').line; this.eat('OP', ':'); const body = this.block(); const handlers = []; let orelse = [], finalbody = [];
    while (this.accept('KW', 'except')) {
      let type = null, name = null;
      if (!this.atOp(':')) { type = this.expr(); if (this.accept('KW', 'as')) name = this.eat('NAME').value; }
      this.eat('OP', ':'); handlers.push({ type, name, body: this.block() });
    }
    if (this.accept('KW', 'else')) { this.eat('OP', ':'); orelse = this.block(); }
    if (this.accept('KW', 'finally')) { this.eat('OP', ':'); finalbody = this.block(); }
    return { t: 'Try', body, handlers, orelse, finalbody, line };
  }
  withStmt() {
    const line = this.eat('KW', 'with').line; const items = [];
    do { const ctx = this.expr(); const as = this.accept('KW', 'as') ? this.target() : null; items.push({ ctx, as }); } while (this.accept('OP', ','));
    this.eat('OP', ':'); return { t: 'With', items, body: this.block(), line };
  }
  targetList() {
    const first = this.target();
    if (!this.atOp(',')) return first;
    const elts = [first];
    while (this.accept('OP', ',')) { if (this.atKw('in') || this.atOp('=')) break; elts.push(this.target()); }
    return { t: 'Tuple', elts };
  }
  target() {
    if (this.accept('OP', '*')) return { t: 'Starred', value: this.target() };
    if (this.atOp('(') || this.atOp('[')) { const e = this.atom(); return this.trailers(e); }
    return this.trailers(this.atom());
  }
  // expressions
  exprList() {
    const first = this.expr();
    if (!this.atOp(',')) return first;
    const elts = [first];
    while (this.accept('OP', ',')) { if (this.endOfSimple() || this.atOp('=') || this.atOp(')') || this.atOp(':')) break; elts.push(this.expr()); }
    return { t: 'Tuple', elts };
  }
  exprListStar() {
    const one = () => (this.accept('OP', '*') ? { t: 'Starred', value: this.expr() } : this.expr());
    const first = one();
    if (!this.atOp(',')) return first;
    const elts = [first];
    while (this.accept('OP', ',')) { if (this.endOfSimple() || this.atOp('=') || this.atOp(':')) break; elts.push(one()); }
    return { t: 'Tuple', elts };
  }
  yieldExpr() { this.eat('KW', 'yield'); return { t: 'Yield', value: this.endOfSimple() || this.atOp(')') ? null : this.exprList() }; }
  namedExpr() {
    if (this.at('NAME') && this.peek().type === 'OP' && this.peek().value === ':=') { const name = this.eat('NAME').value; this.p++; return { t: 'NamedExpr', name, value: this.expr() }; }
    return this.expr();
  }
  expr() {
    if (this.atKw('lambda')) {
      this.p++; const params = this.params(':'); this.eat('OP', ':');
      return { t: 'Lambda', params, body: this.expr() };
    }
    const body = this.orTest();
    if (this.atKw('if')) {
      const save = this.p; this.p++;
      const test = this.orTest();
      if (this.accept('KW', 'else')) return { t: 'IfExp', test, body, orelse: this.expr() };
      this.p = save;
    }
    return body;
  }
  orTest() { let l = this.andTest(); while (this.accept('KW', 'or')) l = { t: 'BoolOp', op: 'or', left: l, right: this.andTest() }; return l; }
  andTest() { let l = this.notTest(); while (this.accept('KW', 'and')) l = { t: 'BoolOp', op: 'and', left: l, right: this.notTest() }; return l; }
  notTest() { if (this.accept('KW', 'not')) return { t: 'Not', value: this.notTest() }; return this.comparison(); }
  comparison() {
    const left = this.bitOr(); const ops = [], comparators = [];
    for (;;) {
      let op = null; const c = this.cur;
      if (c.type === 'OP' && ['<', '>', '==', '>=', '<=', '!='].includes(c.value)) { op = c.value; this.p++; }
      else if (this.atKw('in')) { op = 'in'; this.p++; }
      else if (this.atKw('not') && this.peek().type === 'KW' && this.peek().value === 'in') { op = 'not in'; this.p += 2; }
      else if (this.atKw('is')) { this.p++; op = this.accept('KW', 'not') ? 'is not' : 'is'; }
      if (!op) break;
      ops.push(op); comparators.push(this.bitOr());
    }
    return ops.length ? { t: 'Compare', left, ops, comparators } : left;
  }
  binLevel(next, ops) { let l = next(); while (this.cur.type === 'OP' && ops.includes(this.cur.value)) { const op = this.cur.value; this.p++; l = { t: 'BinOp', op, left: l, right: next() }; } return l; }
  bitOr() { return this.binLevel(() => this.bitXor(), ['|']); }
  bitXor() { return this.binLevel(() => this.bitAnd(), ['^']); }
  bitAnd() { return this.binLevel(() => this.shift(), ['&']); }
  shift() { return this.binLevel(() => this.arith(), ['<<', '>>']); }
  arith() { return this.binLevel(() => this.term(), ['+', '-']); }
  term() { return this.binLevel(() => this.factor(), ['*', '/', '//', '%', '@']); }
  factor() {
    if (this.cur.type === 'OP' && ['-', '+', '~'].includes(this.cur.value)) { const op = this.cur.value; this.p++; return { t: 'UnaryOp', op, value: this.factor() }; }
    return this.power();
  }
  power() {
    const base = this.trailers(this.atom());
    if (this.accept('OP', '**')) return { t: 'BinOp', op: '**', left: base, right: this.factor() };
    return base;
  }
  trailers(e) {
    for (;;) {
      if (this.accept('OP', '(')) { const { args, keywords } = this.callArgs(); this.eat('OP', ')'); e = { t: 'Call', func: e, args, keywords, line: this.cur.line }; }
      else if (this.accept('OP', '[')) { e = { t: 'Subscript', value: e, slice: this.subscriptList() }; this.eat('OP', ']'); }
      else if (this.atOp('.') && this.peek().type === 'NAME') { this.p++; e = { t: 'Attribute', value: e, attr: this.eat('NAME').value }; }
      else if (this.atOp('.') && this.peek().type === 'KW') { this.p++; e = { t: 'Attribute', value: e, attr: this.eat('KW').value }; }
      else return e;
    }
  }
  subscriptList() {
    const one = () => {
      let lower = null, upper = null, step = null;
      if (!this.atOp(':')) { lower = this.expr(); if (!this.atOp(':')) return lower; }
      this.eat('OP', ':');
      if (!this.atOp(']') && !this.atOp(':') && !this.atOp(',')) upper = this.expr();
      if (this.accept('OP', ':')) { if (!this.atOp(']') && !this.atOp(',')) step = this.expr(); }
      return { t: 'Slice', lower, upper, step };
    };
    const first = one();
    if (!this.atOp(',')) return first;
    const elts = [first]; while (this.accept('OP', ',')) { if (this.atOp(']')) break; elts.push(one()); }
    return { t: 'Tuple', elts };
  }
  callArgs() {
    const args = [], keywords = [];
    while (!this.atOp(')')) {
      if (this.accept('OP', '**')) keywords.push({ name: null, value: this.expr() });
      else if (this.accept('OP', '*')) args.push({ t: 'Starred', value: this.expr() });
      else if (this.at('NAME') && this.peek().type === 'OP' && this.peek().value === '=') { const name = this.eat('NAME').value; this.p++; keywords.push({ name, value: this.expr() }); }
      else {
        let e = this.namedExpr();
        if (this.atKw('for')) e = { t: 'GeneratorExp', elt: e, generators: this.comprehension() };
        args.push(e);
      }
      if (!this.accept('OP', ',')) break;
    }
    return { args, keywords };
  }
  comprehension() {
    const gens = [];
    while (this.atKw('for')) {
      this.p++; const target = this.targetList(); this.eat('KW', 'in'); const iter = this.orTest(); const ifs = [];
      while (this.atKw('if')) { this.p++; ifs.push(this.orTestNoCond()); }
      gens.push({ target, iter, ifs });
    }
    return gens;
  }
  orTestNoCond() { return this.orTest(); }
  atom() {
    const t = this.cur;
    if (t.type === 'NAME') { this.p++; return { t: 'Name', id: t.value, line: t.line }; }
    if (t.type === 'NUMBER') { this.p++; return { t: 'Num', value: t.value, isFloat: t.isFloat }; }
    if (t.type === 'STRING' || t.type === 'FSTRING') {
      const parts = [];
      while (this.at('STRING') || this.at('FSTRING')) {
        const s = this.toks[this.p++];
        if (s.type === 'STRING') parts.push({ t: 'Str', value: s.value });
        else parts.push(...parseFString(s.value, s.line));
      }
      if (parts.every((x) => x.t === 'Str')) return { t: 'Str', value: parts.map((x) => x.value).join('') };
      return { t: 'JoinedStr', parts };
    }
    if (t.type === 'KW') {
      if (t.value === 'True') { this.p++; return { t: 'Const', value: true }; }
      if (t.value === 'False') { this.p++; return { t: 'Const', value: false }; }
      if (t.value === 'None') { this.p++; return { t: 'Const', value: null }; }
      if (t.value === 'yield') return this.yieldExpr();
      if (t.value === 'lambda') return this.expr();
    }
    if (t.type === 'OP') {
      if (t.value === '(') {
        this.p++;
        if (this.accept('OP', ')')) return { t: 'Tuple', elts: [] };
        if (this.atKw('yield')) { const y = this.yieldExpr(); this.eat('OP', ')'); return y; }
        const first = this.accept('OP', '*') ? { t: 'Starred', value: this.expr() } : this.namedExpr();
        if (this.atKw('for')) { const g = { t: 'GeneratorExp', elt: first, generators: this.comprehension() }; this.eat('OP', ')'); return g; }
        if (this.accept('OP', ')')) return first.t === 'Starred' ? { t: 'Tuple', elts: [first] } : { t: 'Paren', value: first };
        const elts = [first];
        while (this.accept('OP', ',')) { if (this.atOp(')')) break; elts.push(this.accept('OP', '*') ? { t: 'Starred', value: this.expr() } : this.expr()); }
        this.eat('OP', ')'); return { t: 'Tuple', elts };
      }
      if (t.value === '[') {
        this.p++; if (this.accept('OP', ']')) return { t: 'List', elts: [] };
        const first = this.accept('OP', '*') ? { t: 'Starred', value: this.expr() } : this.namedExpr();
        if (this.atKw('for')) { const g = { t: 'ListComp', elt: first, generators: this.comprehension() }; this.eat('OP', ']'); return g; }
        const elts = [first]; while (this.accept('OP', ',')) { if (this.atOp(']')) break; elts.push(this.accept('OP', '*') ? { t: 'Starred', value: this.expr() } : this.expr()); }
        this.eat('OP', ']'); return { t: 'List', elts };
      }
      if (t.value === '{') {
        this.p++; if (this.accept('OP', '}')) return { t: 'Dict', keys: [], values: [] };
        if (this.accept('OP', '**')) { const keys = [null], values = [this.expr()]; this.dictRest(keys, values); return { t: 'Dict', keys, values }; }
        const k = this.expr();
        if (this.accept('OP', ':')) {
          const v = this.expr();
          if (this.atKw('for')) { const g = { t: 'DictComp', key: k, value: v, generators: this.comprehension() }; this.eat('OP', '}'); return g; }
          const keys = [k], values = [v]; this.dictRest(keys, values); return { t: 'Dict', keys, values };
        }
        if (this.atKw('for')) { const g = { t: 'SetComp', elt: k, generators: this.comprehension() }; this.eat('OP', '}'); return g; }
        const elts = [k]; while (this.accept('OP', ',')) { if (this.atOp('}')) break; elts.push(this.expr()); }
        this.eat('OP', '}'); return { t: 'Set', elts };
      }
      if (t.value === '.' && this.peek().value === '.' ) { /* Ellipsis */ this.p += 3; return { t: 'Const', value: null }; }
    }
    throw new PySyntaxError(`invalid syntax near ${t.value ?? t.type}`, t.line);
  }
  dictRest(keys, values) {
    while (this.accept('OP', ',')) {
      if (this.atOp('}')) break;
      if (this.accept('OP', '**')) { keys.push(null); values.push(this.expr()); continue; }
      keys.push(this.expr()); this.eat('OP', ':'); values.push(this.expr());
    }
    this.eat('OP', '}');
  }
}

function parseFString(s, line) {
  const parts = []; let i = 0, lit = '';
  while (i < s.length) {
    const c = s[i];
    if (c === '{' && s[i + 1] === '{') { lit += '{'; i += 2; continue; }
    if (c === '}' && s[i + 1] === '}') { lit += '}'; i += 2; continue; }
    if (c === '{') {
      if (lit) { parts.push({ t: 'Str', value: lit }); lit = ''; }
      let depth = 0, j = i + 1, quote = null;
      for (; j < s.length; j++) {
        const d = s[j];
        if (quote) { if (d === quote) quote = null; continue; }
        if (d === '"' || d === "'") { quote = d; continue; }
        if ('([{'.includes(d)) depth++;
        else if (')]}'.includes(d)) { if (depth === 0) break; depth--; }
        else if ((d === ':' || d === '!') && depth === 0 && s[j + 1] !== '=') break;
      }
      const exprSrc = s.slice(i + 1, j);
      let conversion = null, spec = '';
      if (s[j] === '!') { conversion = s[j + 1]; j += 2; }
      if (s[j] === ':') {
        let k = j + 1, d2 = 0; for (; k < s.length; k++) { if (s[k] === '{') d2++; else if (s[k] === '}') { if (d2 === 0) break; d2--; } }
        spec = s.slice(j + 1, k); j = k;
      }
      if (s[j] !== '}') throw new PySyntaxError("f-string: expecting '}'", line);
      const p = new Parser(tokenize('(' + exprSrc + ')'));
      const value = p.expr();
      parts.push({ t: 'FormattedValue', value, conversion, spec: spec.includes('{') ? parseFString(spec, line) : spec });
      i = j + 1; continue;
    }
    lit += c; i++;
  }
  if (lit) parts.push({ t: 'Str', value: lit });
  return parts;
}
