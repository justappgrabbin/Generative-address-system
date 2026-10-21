// Pure-JS C subset emulator (ints/doubles/chars, arrays, structs, pointers, functions, printf).
// Sovereign: no compiler, no WASM, no host I/O, no network.
export class CError extends Error {}
const TYPE_WORDS = new Set(['int', 'long', 'short', 'char', 'double', 'float', 'void', 'unsigned', 'signed', 'const', 'static', 'struct', 'size_t', 'bool', '_Bool', 'extern', 'register', 'volatile', 'inline', 'uint8_t', 'uint16_t', 'uint32_t', 'int32_t', 'int64_t', 'uint64_t', 'int8_t', 'int16_t', 'enum']);
const KW = new Set(['if', 'else', 'for', 'while', 'do', 'return', 'break', 'continue', 'switch', 'case', 'default', 'sizeof', 'typedef', ...TYPE_WORDS]);
function tokenize(src, defines) {
  const toks = []; let i = 0, line = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '#') { let j = i; while (j < src.length && src[j] !== '\n') j++; const d = /^#\s*define\s+([A-Za-z_]\w*)\s+(.*)$/.exec(src.slice(i, j)); if (d) defines.set(d[1], d[2].trim()); i = j; continue; }
    if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); line += (src.slice(i, e).match(/\n/g) || []).length; i = e + 2; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) { const m = /^(0[xX][0-9a-fA-F]+|[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?)([uUlLfF]*)/.exec(src.slice(i)); const s = m[1]; toks.push({ type: 'NUM', value: Number(s), float: /[.eE]/.test(s) && !/^0x/i.test(s) || /f/i.test(m[2]) && /[.eE]/.test(s), line }); i += m[0].length; continue; }
    if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_]\w*/.exec(src.slice(i))[0]; i += m.length; if (defines.has(m)) { const sub = tokenize(defines.get(m), defines); sub.pop(); toks.push(...sub.map((t) => ({ ...t, line }))); continue; } toks.push({ type: KW.has(m) ? 'KW' : 'ID', value: m, line }); continue; }
    if (c === '"' || c === "'") { let j = i + 1, s = ''; while (src[j] !== c) { if (src[j] === '\\') { const e = src[j + 1]; if (/[0-7]/.test(e)) { const m = /^[0-7]{1,3}/.exec(src.slice(j + 1))[0]; s += String.fromCharCode(parseInt(m, 8)); j += 1 + m.length; continue; } if (e === 'x') { const m = /^[0-9a-fA-F]+/.exec(src.slice(j + 2))[0]; s += String.fromCharCode(parseInt(m, 16)); j += 2 + m.length; continue; } s += { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", a: '\x07', b: '\b', f: '\f', v: '\v', '0': '\0' }[e] ?? e; j += 2; } else s += src[j++]; } if (c === "'") toks.push({ type: 'NUM', value: s.charCodeAt(0), line, char: true }); else if (toks.length && toks.at(-1).type === 'STR') toks.at(-1).value += s; else toks.push({ type: 'STR', value: s, line }); i = j + 1; continue; }
    const ops = ['<<=', '>>=', '...', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '+', '-', '*', '/', '%', '<', '>', '=', '!', '~', '&', '|', '^', '?', ':', ';', ',', '.', '(', ')', '[', ']', '{', '}'];
    const op = ops.find((o) => src.startsWith(o, i)); if (!op) throw new CError(`line ${line}: unexpected '${c}'`); toks.push({ type: 'OP', value: op, line }); i += op.length;
  }
  toks.push({ type: 'EOF', value: null, line }); return toks;
}
class Parser {
  constructor(t) { this.t = t; this.p = 0; this.structs = new Map(); this.typedefs = new Map(); }
  get c() { return this.t[this.p]; }
  is(type, v) { return this.c.type === type && (v === undefined || this.c.value === v); }
  acc(type, v) { if (this.is(type, v)) return this.t[this.p++]; return null; }
  eat(type, v) { if (!this.is(type, v)) throw new CError(`line ${this.c.line}: expected '${v ?? type}' got '${this.c.value}'`); return this.t[this.p++]; }
  isTypeStart() { return (this.c.type === 'KW' && TYPE_WORDS.has(this.c.value)) || (this.c.type === 'ID' && this.typedefs.has(this.c.value)); }
  baseType() {
    let base = 'int', struct = null, unsigned = false; let saw = false;
    for (;;) {
      if (this.c.type === 'ID' && this.typedefs.has(this.c.value) && !saw) { const td = this.typedefs.get(this.t[this.p++].value); return { ...td }; }
      if (!(this.c.type === 'KW' && TYPE_WORDS.has(this.c.value))) break;
      const w = this.t[this.p++].value; saw = true;
      if (w === 'struct') { const name = this.acc('ID')?.value ?? `__anon${this.p}`; if (this.is('OP', '{')) this.structs.set(name, this.structBody()); struct = name; base = 'struct'; }
      else if (w === 'enum') { const name = this.acc('ID')?.value; if (this.acc('OP', '{')) { let v = 0; this.enums ??= new Map(); while (!this.is('OP', '}')) { const n = this.eat('ID').value; if (this.acc('OP', '=')) v = this.constExpr(); this.enums.set(n, v++); this.acc('OP', ','); } this.eat('OP', '}'); } base = 'int'; }
      else if (w === 'unsigned') unsigned = true;
      else if (['int', 'long', 'short', 'char', 'double', 'float', 'void', 'bool', '_Bool', 'size_t', 'uint8_t', 'uint16_t', 'uint32_t', 'int32_t', 'int64_t', 'uint64_t', 'int8_t', 'int16_t'].includes(w)) { if (!(w === 'int' && (base === 'long' || base === 'short'))) base = w === 'float' ? 'double' : ['_Bool', 'bool'].includes(w) ? 'int' : w; if (w.startsWith('uint') || w === 'size_t') unsigned = true; }
    }
    return { base, struct, unsigned, ptr: 0 };
  }
  constExpr() { const e = this.ternary(); return evalConst(e); }
  structBody() { this.eat('OP', '{'); const fields = []; while (!this.acc('OP', '}')) { const bt = this.baseType(); do { const d = this.declarator(bt); fields.push(d); } while (this.acc('OP', ',')); this.eat('OP', ';'); } return fields; }
  declarator(bt) {
    let ptr = 0; while (this.acc('OP', '*')) { ptr++; this.acc('KW', 'const'); }
    let name = null, fnParams = null;
    if (this.acc('OP', '(')) { this.eat('OP', '*'); name = this.eat('ID').value; this.eat('OP', ')'); this.eat('OP', '('); while (!this.acc('OP', ')')) this.p++; return { name, type: { base: 'fnptr', ptr: 1 }, dims: [] }; }
    name = this.eat('ID').value;
    const dims = []; while (this.acc('OP', '[')) { dims.push(this.is('OP', ']') ? null : this.ternary()); this.eat('OP', ']'); }
    if (this.is('OP', '(')) fnParams = this.params();
    return { name, type: { ...bt, ptr: bt.ptr + ptr }, dims, fnParams };
  }
  params() { this.eat('OP', '('); const ps = []; if (this.is('KW', 'void') && this.t[this.p + 1].value === ')') { this.p++; } while (!this.acc('OP', ')')) { if (this.acc('OP', '...')) { ps.push({ vararg: true }); continue; } const bt = this.baseType(); let ptr = 0; while (this.acc('OP', '*')) { ptr++; this.acc('KW', 'const'); } const name = this.acc('ID')?.value ?? null; let arr = 0; while (this.acc('OP', '[')) { while (!this.acc('OP', ']')) this.p++; arr++; } ps.push({ name, type: { ...bt, ptr: bt.ptr + ptr + arr } }); this.acc('OP', ','); } return ps; }
  program() {
    const items = [];
    while (!this.is('EOF')) {
      if (this.acc('KW', 'typedef')) { const bt = this.baseType(); const d = this.declarator(bt); this.typedefs.set(d.name, d.type); this.eat('OP', ';'); continue; }
      const bt = this.baseType();
      if (this.acc('OP', ';')) continue;
      const d = this.declarator(bt);
      if (d.fnParams) { if (this.acc('OP', ';')) continue; items.push({ t: 'Func', name: d.name, ret: d.type, params: d.fnParams, body: this.compound() }); continue; }
      const decls = [this.initDecl(d)]; while (this.acc('OP', ',')) decls.push(this.initDecl(this.declarator(bt))); this.eat('OP', ';');
      items.push({ t: 'Decl', decls });
    }
    return items;
  }
  initDecl(d) { let init = null; if (this.acc('OP', '=')) init = this.initializer(); return { ...d, init }; }
  initializer() { if (this.acc('OP', '{')) { const items = []; while (!this.acc('OP', '}')) { if (this.acc('OP', '.')) { const f = this.eat('ID').value; this.eat('OP', '='); items.push({ field: f, v: this.initializer() }); } else items.push(this.initializer()); this.acc('OP', ','); } return { t: 'InitList', items }; } return this.assign(); }
  compound() { this.eat('OP', '{'); const body = []; while (!this.acc('OP', '}')) body.push(this.stmt()); return { t: 'Block', body }; }
  stmt() {
    const line = this.c.line;
    if (this.is('OP', '{')) return this.compound();
    if (this.acc('OP', ';')) return { t: 'Empty' };
    if (this.isTypeStart()) { const bt = this.baseType(); if (this.acc('OP', ';')) return { t: 'Empty' }; const decls = [this.initDecl(this.declarator(bt))]; while (this.acc('OP', ',')) decls.push(this.initDecl(this.declarator(bt))); this.eat('OP', ';'); return { t: 'Decl', decls, line }; }
    if (this.acc('KW', 'if')) { this.eat('OP', '('); const cond = this.expr(); this.eat('OP', ')'); const then = this.stmt(); const els = this.acc('KW', 'else') ? this.stmt() : null; return { t: 'If', cond, then, els, line }; }
    if (this.acc('KW', 'while')) { this.eat('OP', '('); const cond = this.expr(); this.eat('OP', ')'); return { t: 'While', cond, body: this.stmt(), line }; }
    if (this.acc('KW', 'do')) { const body = this.stmt(); this.eat('KW', 'while'); this.eat('OP', '('); const cond = this.expr(); this.eat('OP', ')'); this.eat('OP', ';'); return { t: 'DoWhile', cond, body, line }; }
    if (this.acc('KW', 'for')) { this.eat('OP', '('); let init = null; if (this.isTypeStart()) { const bt = this.baseType(); const decls = [this.initDecl(this.declarator(bt))]; while (this.acc('OP', ',')) decls.push(this.initDecl(this.declarator(bt))); init = { t: 'Decl', decls }; } else if (!this.is('OP', ';')) init = { t: 'Expr', e: this.expr() }; this.eat('OP', ';'); const cond = this.is('OP', ';') ? null : this.expr(); this.eat('OP', ';'); const step = this.is('OP', ')') ? null : this.expr(); this.eat('OP', ')'); return { t: 'For', init, cond, step, body: this.stmt(), line }; }
    if (this.acc('KW', 'return')) { const v = this.is('OP', ';') ? null : this.expr(); this.eat('OP', ';'); return { t: 'Return', v, line }; }
    if (this.acc('KW', 'break')) { this.eat('OP', ';'); return { t: 'Break' }; }
    if (this.acc('KW', 'continue')) { this.eat('OP', ';'); return { t: 'Continue' }; }
    if (this.acc('KW', 'switch')) { this.eat('OP', '('); const subj = this.expr(); this.eat('OP', ')'); this.eat('OP', '{'); const cases = []; let cur = null; while (!this.acc('OP', '}')) { if (this.acc('KW', 'case')) { const v = this.ternary(); this.eat('OP', ':'); cur = { v, body: [] }; cases.push(cur); } else if (this.acc('KW', 'default')) { this.eat('OP', ':'); cur = { v: null, body: [] }; cases.push(cur); } else cur.body.push(this.stmt()); } return { t: 'Switch', subj, cases, line }; }
    const e = this.expr(); this.eat('OP', ';'); return { t: 'Expr', e, line };
  }
  expr() { let e = this.assign(); while (this.acc('OP', ',')) e = { t: 'Comma', l: e, r: this.assign() }; return e; }
  assign() { const l = this.ternary(); const ops = ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']; const op = ops.find((o) => this.is('OP', o)); if (op) { this.p++; return { t: 'Assign', op, l, r: this.assign() }; } return l; }
  ternary() { const c = this.bin(0); if (this.acc('OP', '?')) { const a = this.expr(); this.eat('OP', ':'); const b = this.ternary(); return { t: 'Cond', c, a, b }; } return c; }
  bin(min) {
    const P = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 };
    let l = this.unary();
    for (;;) { const t = this.c; if (t.type !== 'OP' || !(t.value in P) || P[t.value] < min) break; this.p++; const r = this.bin(P[t.value] + 1); l = { t: 'Bin', op: t.value, l, r }; }
    return l;
  }
  unary() {
    if (this.is('OP', '(') && this.isTypeAt(this.p + 1)) { this.p++; const bt = this.baseType(); let ptr = 0; while (this.acc('OP', '*')) ptr++; this.eat('OP', ')'); if (this.is('OP', '{')) { const init = this.initializer(); return { t: 'CompoundLit', type: { ...bt, ptr: bt.ptr + ptr }, init }; } return { t: 'Cast', type: { ...bt, ptr: bt.ptr + ptr }, e: this.unary() }; }
    for (const op of ['++', '--']) if (this.acc('OP', op)) return { t: 'PreInc', op, e: this.unary() };
    for (const op of ['-', '+', '!', '~', '*', '&']) if (this.acc('OP', op)) return { t: 'Un', op, e: this.unary() };
    if (this.acc('KW', 'sizeof')) { if (this.is('OP', '(') && this.isTypeAt(this.p + 1)) { this.p++; const bt = this.baseType(); let ptr = 0; while (this.acc('OP', '*')) ptr++; this.eat('OP', ')'); return { t: 'SizeofType', type: { ...bt, ptr: bt.ptr + ptr } }; } return { t: 'SizeofExpr', e: this.unary() }; }
    return this.postfix();
  }
  isTypeAt(k) { const t = this.t[k]; return (t.type === 'KW' && TYPE_WORDS.has(t.value)) || (t.type === 'ID' && this.typedefs.has(t.value)); }
  postfix() {
    let e = this.primary();
    for (;;) {
      if (this.acc('OP', '[')) { const i = this.expr(); this.eat('OP', ']'); e = { t: 'Index', a: e, i }; }
      else if (this.acc('OP', '(')) { const args = []; while (!this.acc('OP', ')')) { args.push(this.assign()); this.acc('OP', ','); } e = { t: 'Call', fn: e, args }; }
      else if (this.acc('OP', '.')) e = { t: 'Member', o: e, f: this.eat('ID').value };
      else if (this.acc('OP', '->')) e = { t: 'Member', o: { t: 'Un', op: '*', e }, f: this.eat('ID').value };
      else if (this.is('OP', '++') || this.is('OP', '--')) e = { t: 'PostInc', op: this.t[this.p++].value, e };
      else return e;
    }
  }
  primary() {
    const t = this.c;
    if (t.type === 'NUM') { this.p++; return { t: 'Num', v: t.value, float: t.float }; }
    if (t.type === 'STR') { this.p++; return { t: 'Str', v: t.value }; }
    if (t.type === 'ID') { this.p++; if (this.enums?.has(t.value)) return { t: 'Num', v: this.enums.get(t.value) }; return { t: 'Name', id: t.value }; }
    if (this.acc('OP', '(')) { const e = this.expr(); this.eat('OP', ')'); return e; }
    throw new CError(`line ${t.line}: unexpected '${t.value}'`);
  }
}
function evalConst(e) { if (e.t === 'Num') return e.v; if (e.t === 'Un' && e.op === '-') return -evalConst(e.e); if (e.t === 'Bin') { const a = evalConst(e.l), b = evalConst(e.r); return { '+': a + b, '-': a - b, '*': a * b, '/': Math.trunc(a / b), '<<': a << b, '|': a | b }[e.op]; } throw new CError('constant expression expected'); }

// ---- values: numbers (with ctype), pointers {mem, idx}, structs (Map of cells)
class Cell { constructor(v, type) { this.v = v; this.type = type; } }
class Ptr { constructor(mem, idx, type) { this.mem = mem; this.idx = idx; this.type = type; } }
class StructVal { constructor(name, fields) { this.name = name; this.fields = fields; } }
class FuncRef { constructor(f) { this.f = f; } }
class BreakSig {} class ContinueSig {} class ReturnSig { constructor(v) { this.v = v; } }
const BREAK = new BreakSig(), CONT = new ContinueSig();
const isFloatT = (t) => t && !t.ptr && (t.base === 'double');
function wrapInt(v, t) {
  if (!t || t.ptr) return v;
  switch (t.base) {
    case 'char': return t.unsigned ? v & 0xff : (v << 24) >> 24;
    case 'short': case 'int16_t': return t.unsigned ? v & 0xffff : (v << 16) >> 16;
    case 'int': case 'int32_t': case 'uint32_t': return t.unsigned || t.base === 'uint32_t' ? v >>> 0 : v | 0;
    case 'uint8_t': return v & 0xff; case 'uint16_t': return v & 0xffff;
    case 'long': case 'int64_t': case 'uint64_t': case 'size_t': return Number.isSafeInteger(v) ? v : Number(BigInt.asIntN(64, BigInt(Math.trunc(v))));
  }
  return v;
}
const INT = { base: 'int', ptr: 0 }, DBL = { base: 'double', ptr: 0 }, CHARP = { base: 'char', ptr: 1 };
class Scope { constructor(parent) { this.vars = new Map(); this.parent = parent; } find(n) { let s = this; while (s) { if (s.vars.has(n)) return s.vars.get(n); s = s.parent; } return null; } }

export class CInterpreter {
  constructor({ maxSteps = 5e7 } = {}) { this.stdout = []; this.buf = ''; this.steps = 0; this.maxSteps = maxSteps; this.rulesUsed = new Set(); }
  rule(n) { this.rulesUsed.add(n); }
  write(s) { this.buf += s; let i; while ((i = this.buf.indexOf('\n')) >= 0) { this.stdout.push(this.buf.slice(0, i)); this.buf = this.buf.slice(i + 1); } }
  run(src) {
    const parser = new Parser(tokenize(src, new Map())); const items = parser.program(); this.structs = parser.structs;
    this.funcs = new Map(); this.globals = new Scope(null);
    for (const it of items) { if (it.t === 'Func') this.funcs.set(it.name, it); else this.declare(it, this.globals); }
    const main = this.funcs.get('main'); if (!main) throw new CError('no main() function');
    const code = this.callFunc(main, main.params.length ? [0, new Ptr([], 0, CHARP)] : []);
    if (this.buf) { this.stdout.push(this.buf); this.buf = ''; }
    this.exitCode = typeof code === 'number' ? code : 0;
    return this.exitCode;
  }
  zero(type, dims = []) {
    if (dims.length) { const n = dims[0]; const mem = []; for (let i = 0; i < n; i++) mem.push(dims.length > 1 ? new Cell(this.zero(type, dims.slice(1)), { ...type, arr: dims.slice(1) }) : new Cell(this.zeroScalar(type), type)); return mem; }
    return this.zeroScalar(type);
  }
  zeroScalar(type) { if (type.ptr) return null; if (type.base === 'struct') { const fields = new Map(); for (const f of this.structs.get(type.struct)) fields.set(f.name, new Cell(f.dims.length ? this.zero(f.type, f.dims.map((d) => evalConst(d))) : this.zeroScalar(f.type), f.dims.length ? { ...f.type, arr: f.dims } : f.type)); return new StructVal(type.struct, fields); } return isFloatT(type) ? 0 : 0; }
  declare(stmt, scope) {
    this.rule('c-declarations');
    for (const d of stmt.decls) {
      let dims = d.dims.map((x) => (x ? num(this.eval(x, scope)) : null));
      if (dims.length && dims[0] === null) { if (d.init?.t === 'InitList') dims[0] = d.init.items.length; else if (d.init?.t === 'Str') dims[0] = d.init.v.length + 1; }
      if (dims.length) {
        const mem = this.zero(d.type, dims);
        if (d.init?.t === 'InitList') d.init.items.forEach((it, i) => { mem[i].v = it.t === 'InitList' ? this.initAggregate(mem[i].v, it, scope, d.type) : this.convert(this.eval(it, scope), d.type); });
        else if (d.init?.t === 'Str') [...d.init.v].forEach((ch, i) => { mem[i].v = ch.charCodeAt(0); });
        scope.vars.set(d.name, new Cell(new Ptr(mem, 0, d.type), { ...d.type, arr: dims }));
      } else {
        let v = this.zero(d.type);
        if (d.init) v = d.init.t === 'InitList' ? this.initAggregate(v, d.init, scope, d.type) : this.convert(this.copy(this.eval(d.init, scope)), d.type);
        scope.vars.set(d.name, new Cell(v, d.type));
      }
    }
  }
  initAggregate(target, list, scope, type) {
    if (target instanceof StructVal) { const names = [...target.fields.keys()]; list.items.forEach((it, i) => { const name = it.field ?? names[i]; const cell = target.fields.get(name); const v = it.field ? it.v : it; cell.v = v.t === 'InitList' ? this.initAggregate(cell.v, v, scope, cell.type) : this.convert(this.eval(v, scope), cell.type); }); return target; }
    if (Array.isArray(target)) { list.items.forEach((it, i) => { target[i].v = this.convert(this.eval(it, scope), type); }); return target; }
    if (target instanceof Ptr) { list.items.forEach((it, i) => { target.mem[i].v = it.t === 'InitList' ? this.initAggregate(target.mem[i].v, it, scope, type) : this.convert(this.eval(it, scope), type); }); return target; }
    return this.convert(this.eval(list.items[0], scope), type);
  }
  copy(v) { if (v instanceof StructVal) { const f = new Map(); for (const [k, c] of v.fields) f.set(k, new Cell(this.copy(c.v), c.type)); return new StructVal(v.name, f); } return v; }
  convert(v, type) {
    if (!type || type.ptr || type.base === 'struct' || type.base === 'fnptr') return v;
    if (v instanceof Ptr) return v;
    if (typeof v !== 'number') return v;
    if (isFloatT(type)) return v;
    return wrapInt(Math.trunc(v), type);
  }
  callFunc(fn, args) {
    if (++this.depth > 5000) throw new CError('stack overflow'); this.depth ??= 0;
    const scope = new Scope(this.globals);
    fn.params.forEach((p, i) => { if (p.name) scope.vars.set(p.name, new Cell(this.convert(this.copy(args[i]), p.type), p.type)); });
    try { this.exec(fn.body, scope); } catch (e) { if (e instanceof ReturnSig) { this.depth--; return this.convert(e.v, fn.ret); } this.depth--; throw e; }
    this.depth--; return fn.ret.base === 'void' ? null : 0;
  }
  exec(s, scope) {
    if (++this.steps > this.maxSteps) throw new CError('step budget exhausted');
    switch (s.t) {
      case 'Block': { const inner = new Scope(scope); for (const x of s.body) this.exec(x, inner); return; }
      case 'Decl': this.declare(s, scope); return;
      case 'Expr': this.eval(s.e, scope); return;
      case 'Empty': return;
      case 'If': this.rule('c-control-branch'); if (truth(this.eval(s.cond, scope))) this.exec(s.then, scope); else if (s.els) this.exec(s.els, scope); return;
      case 'While': this.rule('c-control-loop'); while (truth(this.eval(s.cond, scope))) { try { this.exec(s.body, scope); } catch (e) { if (e === BREAK) break; if (e === CONT) continue; throw e; } } return;
      case 'DoWhile': this.rule('c-control-loop'); do { try { this.exec(s.body, scope); } catch (e) { if (e === BREAK) break; if (e === CONT) continue; throw e; } } while (truth(this.eval(s.cond, scope))); return;
      case 'For': { this.rule('c-control-loop'); const fs = new Scope(scope); if (s.init) this.exec(s.init, fs); for (; s.cond ? truth(this.eval(s.cond, fs)) : true; s.step && this.eval(s.step, fs)) { try { this.exec(s.body, fs); } catch (e) { if (e === BREAK) break; if (e === CONT) continue; throw e; } } return; }
      case 'Return': throw new ReturnSig(s.v ? this.copy(this.eval(s.v, scope)) : null);
      case 'Break': throw BREAK;
      case 'Continue': throw CONT;
      case 'Switch': { const v = num(this.eval(s.subj, scope)); let start = s.cases.findIndex((c) => c.v && num(this.eval(c.v, scope)) === v); if (start < 0) start = s.cases.findIndex((c) => !c.v); if (start < 0) return; try { for (const c of s.cases.slice(start)) for (const x of c.body) this.exec(x, scope); } catch (e) { if (e !== BREAK) throw e; } return; }
    }
    throw new CError(`unsupported statement ${s.t}`);
  }
  // lvalue -> Cell
  lval(e, scope) {
    switch (e.t) {
      case 'Name': { const c = scope.find(e.id); if (!c) throw new CError(`'${e.id}' undeclared`); return c; }
      case 'Index': { const base = this.eval(e.a, scope); const i = num(this.eval(e.i, scope)); if (!(base instanceof Ptr)) throw new CError('subscripted value is not an array or pointer'); const cell = base.mem[base.idx + i]; if (!cell) throw new CError(`out-of-bounds access [${base.idx + i}] (length ${base.mem.length})`); return cell; }
      case 'Member': { const sv = e.o.t === 'Un' && e.o.op === '*' ? this.derefCell(this.eval(e.o.e, scope)).v : this.lval(e.o, scope).v; if (!(sv instanceof StructVal)) throw new CError(`request for member '${e.f}' in something not a structure`); const c = sv.fields.get(e.f); if (!c) throw new CError(`no member named '${e.f}'`); return c; }
      case 'Un': if (e.op === '*') return this.derefCell(this.eval(e.e, scope)); break;
    }
    throw new CError('lvalue required');
  }
  derefCell(p) { if (!(p instanceof Ptr)) throw new CError('invalid pointer dereference (NULL or non-pointer)'); const c = p.mem[p.idx]; if (!c) throw new CError('pointer dereference out of bounds'); return c; }
  typeOf(e, scope) {
    switch (e.t) {
      case 'Num': return e.float ? DBL : INT;
      case 'Str': return CHARP;
      case 'Name': { const c = scope.find(e.id); return c ? (c.type.arr ? { ...c.type, ptr: c.type.ptr + 1, arr: undefined } : c.type) : INT; }
      case 'Cast': return e.type;
      case 'Index': { const t = this.typeOf(e.a, scope); return t.arr && t.arr.length > 1 ? { ...t, arr: t.arr.slice(1) } : { ...t, ptr: Math.max(0, t.ptr - 1), arr: undefined }; }
      case 'Member': { try { return this.lval(e, scope).type; } catch { return INT; } }
      case 'Bin': { if (['<', '>', '<=', '>=', '==', '!=', '&&', '||'].includes(e.op)) return INT; const a = this.typeOf(e.l, scope), b = this.typeOf(e.r, scope); if (a.ptr) return a; if (b.ptr && e.op === '+') return b; return isFloatT(a) || isFloatT(b) ? DBL : a.base === 'long' || b.base === 'long' ? { base: 'long', ptr: 0 } : (a.unsigned || b.unsigned) ? { base: 'int', unsigned: true, ptr: 0 } : INT; }
      case 'Un': { if (e.op === '*') { const t = this.typeOf(e.e, scope); return { ...t, ptr: t.ptr - 1 }; } if (e.op === '&') { const t = this.typeOf(e.e, scope); return { ...t, ptr: t.ptr + 1 }; } if (e.op === '!') return INT; const t = this.typeOf(e.e, scope); return t.base === 'char' ? INT : t; }
      case 'Call': { if (e.fn.t === 'Name' && this.funcs.has(e.fn.id)) return this.funcs.get(e.fn.id).ret; const lib = { sqrt: DBL, pow: DBL, sin: DBL, cos: DBL, fabs: DBL, floor: DBL, ceil: DBL, exp: DBL, log: DBL, atof: DBL, tan: DBL, atan2: DBL, fmod: DBL, round: DBL }; return lib[e.fn.id] ?? INT; }
      case 'Assign': return this.typeOf(e.l, scope);
      case 'Cond': { const a = this.typeOf(e.a, scope), b = this.typeOf(e.b, scope); return isFloatT(a) || isFloatT(b) ? DBL : a; }
      case 'PreInc': case 'PostInc': return this.typeOf(e.e, scope);
      case 'Comma': return this.typeOf(e.r, scope);
    }
    return INT;
  }
  eval(e, scope) {
    switch (e.t) {
      case 'Num': return e.v;
      case 'Str': { const mem = [...e.v].map((ch) => new Cell(ch.charCodeAt(0), { base: 'char', ptr: 0 })); mem.push(new Cell(0, { base: 'char', ptr: 0 })); return new Ptr(mem, 0, { base: 'char', ptr: 0 }); }
      case 'Name': {
        const c = scope.find(e.id);
        if (c) return c.type.arr ? c.v : c.v;
        if (this.funcs.has(e.id)) return new FuncRef(this.funcs.get(e.id));
        if (e.id === 'NULL') return null; if (e.id === 'true') return 1; if (e.id === 'false') return 0; if (e.id === 'EOF') return -1;
        if (e.id === 'INT_MAX') return 2147483647; if (e.id === 'INT_MIN') return -2147483648; if (e.id === 'RAND_MAX') return 2147483647;
        throw new CError(`'${e.id}' undeclared`);
      }
      case 'Index': case 'Member': { const c = this.lval(e, scope); return c.type.arr ? c.v instanceof Ptr ? c.v : new Ptr(c.v, 0, c.type) : c.v; }
      case 'Assign': {
        this.rule('c-assign');
        const cell = this.lval(e.l, scope);
        let v = this.eval(e.r, scope);
        if (e.op !== '=') v = this.arith(e.op.slice(0, -1), cell.v, v, cell.type, this.typeOf(e.r, scope));
        cell.v = this.convert(this.copy(v), cell.type); return cell.v;
      }
      case 'PreInc': case 'PostInc': { const cell = this.lval(e.e, scope); const old = cell.v; const d = e.op === '++' ? 1 : -1; cell.v = old instanceof Ptr ? new Ptr(old.mem, old.idx + d, old.type) : this.convert(old + d, cell.type); return e.t === 'PreInc' ? cell.v : old; }
      case 'Cond': return truth(this.eval(e.c, scope)) ? this.eval(e.a, scope) : this.eval(e.b, scope);
      case 'Comma': this.eval(e.l, scope); return this.eval(e.r, scope);
      case 'Cast': { const v = this.eval(e.e, scope); return this.convert(v, e.type); }
      case 'SizeofType': return sizeOf(e.type, this.structs);
      case 'SizeofExpr': { if (e.e.t === 'Name') { const c = scope.find(e.e.id); if (c?.type.arr) return c.type.arr.reduce((a, b) => a * b, 1) * sizeOf({ ...c.type, arr: undefined }, this.structs); } return sizeOf(this.typeOf(e.e, scope), this.structs); }
      case 'CompoundLit': return this.initAggregate(this.zero(e.type), e.init, scope, e.type);
      case 'Un': {
        if (e.op === '&') { this.rule('c-pointers'); if (e.e.t === 'Index') { const base = this.eval(e.e.a, scope); return new Ptr(base.mem, base.idx + num(this.eval(e.e.i, scope)), base.type); } if (e.e.t === 'Name' && this.funcs.has(e.e.id) && !scope.find(e.e.id)) return new FuncRef(this.funcs.get(e.e.id)); const c = this.lval(e.e, scope); return new Ptr([c], 0, c.type); }
        if (e.op === '*') { this.rule('c-pointers'); const c = this.derefCell(this.eval(e.e, scope)); return c.type.arr ? new Ptr(c.v, 0, c.type) : c.v; }
        const v = this.eval(e.e, scope);
        if (e.op === '-') return this.convert(-v, this.typeOf(e.e, scope)); if (e.op === '+') return v; if (e.op === '!') return truth(v) ? 0 : 1; if (e.op === '~') return ~v;
        break;
      }
      case 'Bin': {
        if (e.op === '&&') return truth(this.eval(e.l, scope)) && truth(this.eval(e.r, scope)) ? 1 : 0;
        if (e.op === '||') return truth(this.eval(e.l, scope)) || truth(this.eval(e.r, scope)) ? 1 : 0;
        this.rule('c-arithmetic');
        return this.arith(e.op, this.eval(e.l, scope), this.eval(e.r, scope), this.typeOf(e.l, scope), this.typeOf(e.r, scope));
      }
      case 'Call': {
        this.rule('c-functions');
        const args = e.args.map((a) => this.eval(a, scope));
        if (e.fn.t === 'Name' && !scope.find(e.fn.id) && !this.funcs.has(e.fn.id)) return this.libcall(e.fn.id, args, e.args, scope);
        const f = this.eval(e.fn, scope);
        const fn = f instanceof FuncRef ? f.f : f instanceof Ptr && f.mem[f.idx]?.v instanceof FuncRef ? f.mem[f.idx].v.f : null;
        if (!fn) throw new CError('called object is not a function');
        return this.callFunc(fn, args);
      }
    }
    throw new CError(`unsupported expression ${e.t}`);
  }
  arith(op, a, b, ta, tb) {
    if (a instanceof Ptr || b instanceof Ptr) {
      if (op === '+') return a instanceof Ptr ? new Ptr(a.mem, a.idx + num(b), a.type) : new Ptr(b.mem, b.idx + num(a), b.type);
      if (op === '-') return b instanceof Ptr ? a.idx - b.idx : new Ptr(a.mem, a.idx - num(b), a.type);
      const ai = a instanceof Ptr ? a.idx + (a.mem.__id ??= ++ptrIds) * 1e9 : a ?? 0, bi = b instanceof Ptr ? b.idx + (b.mem.__id ??= ++ptrIds) * 1e9 : b ?? 0;
      return cmpOp(op, ai, bi);
    }
    if (a === null) a = 0; if (b === null) b = 0;
    const fl = isFloatT(ta) || isFloatT(tb);
    const unsigned = !fl && ((ta?.unsigned && !['char', 'short'].includes(ta.base)) || (tb?.unsigned && !['char', 'short'].includes(tb.base)));
    const long = ta?.base === 'long' || tb?.base === 'long';
    const rt = fl ? DBL : long ? { base: 'long', ptr: 0, unsigned } : { base: 'int', ptr: 0, unsigned };
    if (unsigned && !long) { a = a >>> 0; b = b >>> 0; }
    switch (op) {
      case '+': return this.convert(a + b, rt); case '-': return this.convert(a - b, rt);
      case '*': return fl ? a * b : long ? this.convert(a * b, rt) : this.convert(unsigned ? Number((BigInt(a) * BigInt(b)) & 0xffffffffn) : Math.imul(a, b), rt);
      case '/': if (!fl && b === 0) throw new CError('division by zero'); return fl ? a / b : this.convert(Math.trunc(a / b), rt);
      case '%': if (b === 0) throw new CError('division by zero'); return this.convert(a % b, rt);
      case '<<': return this.convert(long ? a * 2 ** b : a << b, rt); case '>>': return this.convert(unsigned ? a >>> b : long ? Math.floor(a / 2 ** b) : a >> b, rt);
      case '&': return this.convert(a & b, rt); case '|': return this.convert(a | b, rt); case '^': return this.convert(a ^ b, rt);
      default: return cmpOp(op, a, b);
    }
  }
  readStr(p) { if (p === null) return '(null)'; if (!(p instanceof Ptr)) throw new CError('%s expects a char*'); let s = ''; for (let i = p.idx; i < p.mem.length && p.mem[i].v !== 0; i++) s += String.fromCharCode(p.mem[i].v & 0xff); return s; }
  libcall(name, args, argNodes, scope) {
    this.rule('c-stdlib');
    const D = Math;
    switch (name) {
      case 'printf': this.write(this.printf(this.readStr(args[0]), args.slice(1), argNodes.slice(1), scope)); return 0;
      case 'puts': this.write(this.readStr(args[0]) + '\n'); return 0;
      case 'putchar': this.write(String.fromCharCode(args[0])); return args[0];
      case 'sprintf': case 'snprintf': { const fmtIdx = name === 'sprintf' ? 1 : 2; const out = this.printf(this.readStr(args[fmtIdx]), args.slice(fmtIdx + 1), argNodes.slice(fmtIdx + 1), scope); const dst = args[0]; [...out].forEach((ch, i) => { dst.mem[dst.idx + i].v = ch.charCodeAt(0); }); dst.mem[dst.idx + out.length].v = 0; return out.length; }
      case 'strlen': return this.readStr(args[0]).length;
      case 'strcmp': { const a = this.readStr(args[0]), b = this.readStr(args[1]); return a < b ? -1 : a > b ? 1 : 0; }
      case 'strcpy': { const s = this.readStr(args[1]); [...s, '\0'].forEach((ch, i) => { args[0].mem[args[0].idx + i].v = ch.charCodeAt(0); }); return args[0]; }
      case 'strcat': { const base = this.readStr(args[0]).length; const s = this.readStr(args[1]); [...s, '\0'].forEach((ch, i) => { args[0].mem[args[0].idx + base + i].v = ch.charCodeAt(0); }); return args[0]; }
      case 'memset': for (let i = 0; i < args[2] / 4 && args[0].idx + i < args[0].mem.length; i++) args[0].mem[args[0].idx + i].v = args[1]; return args[0];
      case 'malloc': case 'calloc': { const n = name === 'calloc' ? args[0] : Math.ceil(args[0] / 4); const mem = Array.from({ length: Math.max(1, n) }, () => new Cell(0, INT)); return new Ptr(mem, 0, INT); }
      case 'free': return null;
      case 'abs': return Math.abs(args[0]); case 'labs': return Math.abs(args[0]);
      case 'atoi': return parseInt(this.readStr(args[0]), 10) || 0; case 'atof': return parseFloat(this.readStr(args[0])) || 0;
      case 'sqrt': case 'sin': case 'cos': case 'tan': case 'exp': case 'log': case 'floor': case 'ceil': case 'fabs': case 'round': case 'log10': case 'log2': case 'atan': return D[name === 'fabs' ? 'abs' : name](args[0]);
      case 'pow': return D.pow(args[0], args[1]); case 'atan2': return D.atan2(args[0], args[1]); case 'fmod': return args[0] % args[1];
      case 'exit': throw new ReturnSig(args[0]);
      case 'rand': case 'srand': case 'time': case 'scanf': case 'fopen': case 'getchar': case 'system': throw new CError(`${name}() is not available in the sovereign sandbox`);
    }
    throw new CError(`implicit declaration of function '${name}'`);
  }
  printf(fmt, args, nodes, scope) {
    let i = 0;
    return fmt.replace(/%([-+ #0]*)(\*|\d+)?(?:\.(\*|\d+))?(hh|h|ll|l|z|L)?([diouxXeEfgGcsp%])/g, (all, flags, width, prec, len, type) => {
      if (type === '%') return '%';
      if (width === '*') width = String(args[i++]); if (prec === '*') prec = String(args[i++]);
      const node = nodes[i]; let a = args[i++]; let s;
      switch (type) {
        case 'd': case 'i': s = String(Math.trunc(a)); break;
        case 'u': s = String(len === 'l' || len === 'll' ? a : a >>> 0); break;
        case 'f': s = fixedC(a, prec === undefined ? 6 : Number(prec)); break;
        case 'e': case 'E': s = a.toExponential(prec === undefined ? 6 : Number(prec)).replace(/e([+-])(\d)$/, 'e$10$2'); if (type === 'E') s = s.toUpperCase(); break;
        case 'g': case 'G': { const P = prec === undefined ? 6 : Math.max(1, Number(prec)); const ex = a === 0 ? 0 : Math.floor(Math.log10(Math.abs(a))); s = ex < -4 || ex >= P ? a.toExponential(P - 1).replace(/\.?0+e/, 'e').replace(/e([+-])(\d)$/, 'e$10$2') : String(Number(a.toPrecision(P))); break; }
        case 'x': s = (a >>> 0).toString(16); break; case 'X': s = (a >>> 0).toString(16).toUpperCase(); break; case 'o': s = (a >>> 0).toString(8); break;
        case 'c': s = String.fromCharCode(a & 0xff); break;
        case 's': s = this.readStr(a); if (prec !== undefined) s = s.slice(0, Number(prec)); break;
        case 'p': s = '0x' + ((a?.idx ?? 0) * 4 + 0x1000).toString(16); break;
      }
      if (/[dif]/.test(type) && !s.startsWith('-')) { if (flags.includes('+')) s = '+' + s; else if (flags.includes(' ')) s = ' ' + s; }
      const W = Number(width || 0);
      if (s.length < W) s = flags.includes('-') ? s.padEnd(W) : flags.includes('0') && type !== 's' ? (/^[+-]/.test(s) ? s[0] + s.slice(1).padStart(W - 1, '0') : s.padStart(W, '0')) : s.padStart(W);
      return s;
    });
  }
}
let ptrIds = 0;
function fixedC(v, p) { if (!Number.isFinite(v)) return Number.isNaN(v) ? 'nan' : v > 0 ? 'inf' : '-inf'; return v.toFixed(p); }
const truth = (v) => (v instanceof Ptr || v instanceof FuncRef ? true : v !== 0 && v !== null && v !== undefined);
const num = (v) => (typeof v === 'number' ? v : v instanceof Ptr ? v.idx : 0);
const cmpOp = (op, a, b) => ({ '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b, '==': a === b, '!=': a !== b }[op] ? 1 : 0);
function sizeOf(t, structs) { if (t.ptr) return 8; switch (t.base) { case 'char': case 'uint8_t': case 'int8_t': return 1; case 'short': case 'uint16_t': case 'int16_t': return 2; case 'int': case 'uint32_t': case 'int32_t': return 4; case 'long': case 'double': case 'size_t': case 'int64_t': case 'uint64_t': return 8; case 'struct': return structs.get(t.struct).reduce((s, f) => s + sizeOf(f.type, structs) * (f.dims.length ? f.dims.reduce((a, d) => a * evalConst(d), 1) : 1), 0); } return 4; }
