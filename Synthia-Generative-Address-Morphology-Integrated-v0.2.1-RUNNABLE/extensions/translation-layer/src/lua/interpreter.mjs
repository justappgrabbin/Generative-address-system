// Pure-JS Lua 5.4 subset emulator. Sovereign: no host I/O, no network, no workers.
const KW = new Set('and break do else elseif end false for function goto if in local nil not or repeat return then true until while'.split(' '));
export class LuaError extends Error {}
function tokenize(src) {
  const toks = []; let i = 0, line = 1;
  const push = (type, value) => toks.push({ type, value, line });
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (src.startsWith('--', i)) {
      const lb = /^--\[(=*)\[/.exec(src.slice(i));
      if (lb) { const close = ']' + lb[1] + ']'; const e = src.indexOf(close, i); line += (src.slice(i, e).match(/\n/g) || []).length; i = e + close.length; }
      else { while (i < src.length && src[i] !== '\n') i++; }
      continue;
    }
    const lstr = /^\[(=*)\[/.exec(src.slice(i));
    if (lstr) { const close = ']' + lstr[1] + ']'; const e = src.indexOf(close, i); let s = src.slice(i + lstr[0].length, e); if (s[0] === '\n') s = s.slice(1); line += (s.match(/\n/g) || []).length; push('STR', s); i = e + close.length; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
      const m = /^(0[xX][0-9a-fA-F]+|[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?)/.exec(src.slice(i)); let s = m[0];
      if (src[i + s.length] === '.' && !/^0x/i.test(s) && !s.includes('.') && src[i + s.length + 1] !== '.') { const m2 = /^[0-9]+\.[0-9]*(?:[eE][+-]?[0-9]+)?/.exec(src.slice(i)); s = m2[0]; }
      push('NUM', { v: Number(s), float: /[.eE]/.test(s) && !/^0x/i.test(s) }); i += s.length; continue;
    }
    if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))[0]; push(KW.has(m) ? 'KW' : 'NAME', m); i += m.length; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (src[j] !== c) { if (src[j] === '\\') { j++; const e = src[j]; const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", a: '\x07', b: '\b', f: '\f', v: '\v', '0': '\0' }; if (/[0-9]/.test(e)) { const m = /^[0-9]{1,3}/.exec(src.slice(j))[0]; s += String.fromCharCode(Number(m)); j += m.length; continue; } s += map[e] ?? e; j++; } else s += src[j++]; }
      push('STR', s); i = j + 1; continue;
    }
    const ops = ['...', '..', '==', '~=', '<=', '>=', '//', '::', '<<', '>>', '+', '-', '*', '/', '%', '^', '#', '&', '~', '|', '<', '>', '=', '(', ')', '{', '}', '[', ']', ';', ':', ',', '.'];
    const op = ops.find((o) => src.startsWith(o, i)); if (!op) throw new LuaError(`unexpected symbol '${c}' near line ${line}`);
    push('OP', op); i += op.length;
  }
  push('EOF', null); return toks;
}
class Parser {
  constructor(t) { this.t = t; this.p = 0; }
  get c() { return this.t[this.p]; }
  is(type, v) { const t = this.c; return t.type === type && (v === undefined || t.value === v); }
  acc(type, v) { if (this.is(type, v)) return this.t[this.p++]; return null; }
  eat(type, v) { if (!this.is(type, v)) throw new LuaError(`line ${this.c.line}: '${v ?? type}' expected near '${this.c.value?.v ?? this.c.value}'`); return this.t[this.p++]; }
  chunk() { const b = this.block(); this.eat('EOF'); return b; }
  blockEnd() { return this.is('EOF') || ['end', 'else', 'elseif', 'until'].some((k) => this.is('KW', k)); }
  block() { const body = []; while (!this.blockEnd()) { if (this.is('KW', 'return')) { this.p++; const vals = this.blockEnd() || this.is('OP', ';') ? [] : this.exprList(); this.acc('OP', ';'); body.push({ t: 'Return', vals }); break; } const s = this.stat(); if (s) body.push(s); } return body; }
  stat() {
    const line = this.c.line;
    if (this.acc('OP', ';')) return null;
    if (this.acc('KW', 'if')) { const clauses = []; const cond = this.expr(); this.eat('KW', 'then'); clauses.push([cond, this.block()]); let orelse = null; for (;;) { if (this.acc('KW', 'elseif')) { const c = this.expr(); this.eat('KW', 'then'); clauses.push([c, this.block()]); } else if (this.acc('KW', 'else')) { orelse = this.block(); } else break; } this.eat('KW', 'end'); return { t: 'If', clauses, orelse, line }; }
    if (this.acc('KW', 'while')) { const cond = this.expr(); this.eat('KW', 'do'); const body = this.block(); this.eat('KW', 'end'); return { t: 'While', cond, body, line }; }
    if (this.acc('KW', 'do')) { const body = this.block(); this.eat('KW', 'end'); return { t: 'Do', body, line }; }
    if (this.acc('KW', 'repeat')) { const body = this.block(); this.eat('KW', 'until'); return { t: 'Repeat', body, cond: this.expr(), line }; }
    if (this.acc('KW', 'for')) {
      const n1 = this.eat('NAME').value;
      if (this.acc('OP', '=')) { const start = this.expr(); this.eat('OP', ','); const stop = this.expr(); const step = this.acc('OP', ',') ? this.expr() : null; this.eat('KW', 'do'); const body = this.block(); this.eat('KW', 'end'); return { t: 'NumFor', name: n1, start, stop, step, body, line }; }
      const names = [n1]; while (this.acc('OP', ',')) names.push(this.eat('NAME').value); this.eat('KW', 'in'); const exprs = this.exprList(); this.eat('KW', 'do'); const body = this.block(); this.eat('KW', 'end'); return { t: 'GenFor', names, exprs, body, line };
    }
    if (this.acc('KW', 'function')) { let target = { t: 'Name', id: this.eat('NAME').value }; let method = false; while (this.is('OP', '.') || this.is('OP', ':')) { const colon = this.t[this.p++].value === ':'; target = { t: 'Index', obj: target, key: { t: 'Str', v: this.eat('NAME').value } }; if (colon) { method = true; break; } } const fn = this.funcBody(method); return { t: 'Assign', targets: [target], vals: [fn], line }; }
    if (this.acc('KW', 'local')) {
      if (this.acc('KW', 'function')) { const name = this.eat('NAME').value; return { t: 'LocalFunc', name, fn: this.funcBody(false), line }; }
      const names = []; do { names.push(this.eat('NAME').value); if (this.acc('OP', '<')) { this.eat('NAME'); this.eat('OP', '>'); } } while (this.acc('OP', ','));
      const vals = this.acc('OP', '=') ? this.exprList() : []; return { t: 'Local', names, vals, line };
    }
    if (this.acc('KW', 'return')) throw new LuaError('return must be last statement');
    if (this.acc('KW', 'break')) return { t: 'Break', line };
    if (this.acc('KW', 'goto')) throw new LuaError('goto is not supported by this emulator');
    const e = this.suffixed();
    if (this.is('OP', '=') || this.is('OP', ',')) { const targets = [e]; while (this.acc('OP', ',')) targets.push(this.suffixed()); this.eat('OP', '='); return { t: 'Assign', targets, vals: this.exprList(), line }; }
    if (e.t !== 'Call') throw new LuaError(`line ${line}: syntax error near '${this.c.value}'`);
    return { t: 'ExprStat', e, line };
  }
  funcBody(method) { this.eat('OP', '('); const params = method ? ['self'] : []; let vararg = false; if (!this.is('OP', ')')) do { if (this.acc('OP', '...')) { vararg = true; break; } params.push(this.eat('NAME').value); } while (this.acc('OP', ',')); this.eat('OP', ')'); const body = this.block(); this.eat('KW', 'end'); return { t: 'Function', params, vararg, body }; }
  exprList() { const l = [this.expr()]; while (this.acc('OP', ',')) l.push(this.expr()); return l; }
  primary() { if (this.is('NAME')) return { t: 'Name', id: this.t[this.p++].value }; if (this.acc('OP', '(')) { const e = this.expr(); this.eat('OP', ')'); return { t: 'Paren', e }; } throw new LuaError(`line ${this.c.line}: unexpected symbol near '${this.c.value}'`); }
  suffixed() {
    let e = this.primary();
    for (;;) {
      if (this.acc('OP', '.')) e = { t: 'Index', obj: e, key: { t: 'Str', v: this.eat('NAME').value } };
      else if (this.acc('OP', '[')) { const k = this.expr(); this.eat('OP', ']'); e = { t: 'Index', obj: e, key: k }; }
      else if (this.acc('OP', ':')) { const name = this.eat('NAME').value; e = { t: 'Call', fn: e, method: name, args: this.callArgs() }; }
      else if (this.is('OP', '(') || this.is('STR') || this.is('OP', '{')) e = { t: 'Call', fn: e, args: this.callArgs() };
      else return e;
    }
  }
  callArgs() { if (this.is('STR')) return [{ t: 'Str', v: this.t[this.p++].value }]; if (this.is('OP', '{')) return [this.table()]; this.eat('OP', '('); const a = this.is('OP', ')') ? [] : this.exprList(); this.eat('OP', ')'); return a; }
  table() { this.eat('OP', '{'); const items = []; while (!this.is('OP', '}')) { if (this.acc('OP', '[')) { const k = this.expr(); this.eat('OP', ']'); this.eat('OP', '='); items.push({ k, v: this.expr() }); } else if (this.is('NAME') && this.t[this.p + 1].type === 'OP' && this.t[this.p + 1].value === '=') { const k = { t: 'Str', v: this.t[this.p].value }; this.p += 2; items.push({ k, v: this.expr() }); } else items.push({ k: null, v: this.expr() }); if (!this.acc('OP', ',') && !this.acc('OP', ';')) break; } this.eat('OP', '}'); return { t: 'Table', items }; }
  simple() {
    const t = this.c;
    if (t.type === 'NUM') { this.p++; return { t: 'Num', v: t.value.v, float: t.value.float }; }
    if (t.type === 'STR') { this.p++; return { t: 'Str', v: t.value }; }
    if (this.acc('KW', 'nil')) return { t: 'Nil' }; if (this.acc('KW', 'true')) return { t: 'True' }; if (this.acc('KW', 'false')) return { t: 'False' };
    if (this.acc('OP', '...')) return { t: 'Vararg' };
    if (this.is('OP', '{')) return this.table();
    if (this.acc('KW', 'function')) return this.funcBody(false);
    return this.suffixed();
  }
  expr(limit = 0) {
    const UN = 12; const BIN = { or: [1, 1], and: [2, 2], '<': [3, 3], '>': [3, 3], '<=': [3, 3], '>=': [3, 3], '~=': [3, 3], '==': [3, 3], '|': [4, 4], '~': [5, 5], '&': [6, 6], '<<': [7, 7], '>>': [7, 7], '..': [9, 8], '+': [10, 10], '-': [10, 10], '*': [11, 11], '/': [11, 11], '//': [11, 11], '%': [11, 11], '^': [14, 13] };
    let left;
    if (this.is('KW', 'not') || this.is('OP', '-') || this.is('OP', '#') || this.is('OP', '~')) { const op = this.t[this.p++].value; left = { t: 'Un', op, e: this.expr(UN) }; }
    else left = this.simple();
    for (;;) { const t = this.c; const op = (t.type === 'OP' || t.type === 'KW') ? t.value : null; const pr = BIN[op]; if (!pr || pr[0] <= limit) break; this.p++; const right = this.expr(pr[1]); left = { t: 'Bin', op, l: left, r: right }; }
    return left;
  }
}
export class LuaTable { constructor() { this.hash = new Map(); this.meta = null; } get(k) { return this.hash.get(normKey(k)); } set(k, v) { if (v === undefined || v === null) this.hash.delete(normKey(k)); else this.hash.set(normKey(k), v); } length() { let n = 0; while (this.hash.has(n + 1)) n++; return n; } }
class LuaFloat { constructor(v) { this.v = v; } }
const normKey = (k) => (k instanceof LuaFloat ? (Number.isInteger(k.v) ? k.v : 'f' + k.v) : k);
const fv = (x) => (x instanceof LuaFloat ? x.v : x);
const isNumber = (x) => typeof x === 'number' || x instanceof LuaFloat;
class LuaFunction { constructor(node, env, I) { this.node = node; this.env = env; this.I = I; } }
class Native { constructor(name, fn) { this.name = name; this.fn = fn; } }
class BreakSig {} const BREAK = new BreakSig();
class ReturnSig { constructor(v) { this.v = v; } }
class Env { constructor(parent) { this.vars = new Map(); this.parent = parent; } find(n) { let e = this; while (e) { if (e.vars.has(n)) return e; e = e.parent; } return null; } }

export class LuaInterpreter {
  constructor({ maxSteps = 5e7 } = {}) { this.stdout = []; this.buf = ''; this.steps = 0; this.maxSteps = maxSteps; this.G = new LuaTable(); this.rulesUsed = new Set(); installStdlib(this); }
  rule(n) { this.rulesUsed.add(n); }
  write(s) { this.buf += s; let i; while ((i = this.buf.indexOf('\n')) >= 0) { this.stdout.push(this.buf.slice(0, i)); this.buf = this.buf.slice(i + 1); } }
  run(src) { const tree = new Parser(tokenize(src)).chunk(); try { this.execBlock(tree, new Env(null)); } catch (e) { if (!(e instanceof ReturnSig)) throw e; } if (this.buf) { this.stdout.push(this.buf); this.buf = ''; } }
  execBlock(body, env) { for (const s of body) this.exec(s, env); }
  exec(s, env) {
    if (++this.steps > this.maxSteps) throw new LuaError('step budget exhausted');
    switch (s.t) {
      case 'Local': { this.rule('lua-local'); const vals = this.evalList(s.vals, env); s.names.forEach((n, i) => env.vars.set(n, vals[i] ?? null)); return; }
      case 'LocalFunc': { this.rule('lua-functions'); env.vars.set(s.name, null); env.vars.set(s.name, new LuaFunction(s.fn, env, this)); return; }
      case 'Assign': { this.rule('lua-assign'); const vals = this.evalList(s.vals, env); s.targets.forEach((t, i) => this.assign(t, vals[i] ?? null, env)); return; }
      case 'ExprStat': this.evalMulti(s.e, env); return;
      case 'If': this.rule('lua-control-branch'); for (const [c, b] of s.clauses) if (truthy(this.eval(c, env))) { this.execBlock(b, new Env(env)); return; } if (s.orelse) this.execBlock(s.orelse, new Env(env)); return;
      case 'While': this.rule('lua-control-loop'); try { while (truthy(this.eval(s.cond, env))) this.execBlock(s.body, new Env(env)); } catch (e) { if (e !== BREAK) throw e; } return;
      case 'Repeat': this.rule('lua-control-loop'); try { for (;;) { const inner = new Env(env); this.execBlock(s.body, inner); if (truthy(this.eval(s.cond, inner))) break; } } catch (e) { if (e !== BREAK) throw e; } return;
      case 'Do': this.execBlock(s.body, new Env(env)); return;
      case 'Break': throw BREAK;
      case 'Return': throw new ReturnSig(this.evalList(s.vals, env));
      case 'NumFor': {
        this.rule('lua-control-loop');
        const a = this.eval(s.start, env), b = this.eval(s.stop, env), st = s.step ? this.eval(s.step, env) : 1;
        const isF = [a, b, st].some((x) => x instanceof LuaFloat);
        try { for (let i = fv(a); fv(st) > 0 ? i <= fv(b) : i >= fv(b); i += fv(st)) { const inner = new Env(env); inner.vars.set(s.name, isF ? new LuaFloat(i) : i); this.execBlock(s.body, inner); } } catch (e) { if (e !== BREAK) throw e; }
        return;
      }
      case 'GenFor': {
        this.rule('lua-control-loop');
        const [f, st, init] = this.evalList(s.exprs, env); let ctl = init ?? null;
        try { for (;;) { const r = this.call(f, [st ?? null, ctl]); if (r[0] === null || r[0] === undefined) break; ctl = r[0]; const inner = new Env(env); s.names.forEach((n, i) => inner.vars.set(n, r[i] ?? null)); this.execBlock(s.body, inner); } } catch (e) { if (e !== BREAK) throw e; }
        return;
      }
    }
    throw new LuaError(`unsupported statement ${s.t}`);
  }
  assign(t, v, env) {
    if (t.t === 'Name') { const e = env.find(t.id); if (e) e.vars.set(t.id, v); else this.G.set(t.id, v); return; }
    if (t.t === 'Index') { const o = this.eval(t.obj, env); const k = this.eval(t.key, env); this.setIndex(o, k, v); return; }
    throw new LuaError('cannot assign');
  }
  setIndex(o, k, v) {
    if (!(o instanceof LuaTable)) throw new LuaError(`attempt to index a ${luaType(o)} value`);
    if (o.get(k) === undefined && o.meta) { const ni = o.meta.get('__newindex'); if (ni instanceof LuaTable) return this.setIndex(ni, k, v); if (ni) { this.call(ni, [o, k, v]); return; } }
    o.set(k, v);
  }
  index(o, k) {
    if (o instanceof LuaTable) { const v = o.get(k); if (v !== undefined) return v; if (o.meta) { const ix = o.meta.get('__index'); if (ix instanceof LuaTable) return this.index(ix, k); if (ix) return this.call(ix, [o, k])[0] ?? null; } return null; }
    if (typeof o === 'string') return this.index(this.G.get('string'), k);
    throw new LuaError(`attempt to index a ${luaType(o)} value`);
  }
  evalList(exprs, env) { const out = []; exprs.forEach((e, i) => { if (i === exprs.length - 1 && (e.t === 'Call' || e.t === 'Vararg')) out.push(...this.evalMulti(e, env)); else out.push(this.eval(e, env)); }); return out; }
  evalMulti(e, env) {
    if (e.t === 'Vararg') { const ve = env.find('...'); return ve ? ve.vars.get('...') : []; }
    if (e.t === 'Call') {
      let fn, args;
      if (e.method) { const obj = this.eval(e.fn, env); fn = this.index(obj, e.method); args = [obj, ...this.evalList(e.args, env)]; this.rule('lua-methods'); }
      else { fn = this.eval(e.fn, env); args = this.evalList(e.args, env); }
      return this.call(fn, args);
    }
    return [this.eval(e, env)];
  }
  call(fn, args) {
    if (fn instanceof Native) return fn.fn(args, this) ?? [];
    if (fn instanceof LuaFunction) {
      const env = new Env(fn.env); fn.node.params.forEach((p, i) => env.vars.set(p, args[i] ?? null));
      if (fn.node.vararg) env.vars.set('...', args.slice(fn.node.params.length));
      try { this.execBlock(fn.node.body, env); } catch (e) { if (e instanceof ReturnSig) return e.v; throw e; }
      return [];
    }
    if (fn instanceof LuaTable && fn.meta && fn.meta.get('__call')) return this.call(fn.meta.get('__call'), [fn, ...args]);
    throw new LuaError(`attempt to call a ${luaType(fn)} value`);
  }
  eval(e, env) {
    switch (e.t) {
      case 'Num': return e.float ? new LuaFloat(e.v) : e.v;
      case 'Str': return e.v;
      case 'Nil': return null; case 'True': return true; case 'False': return false;
      case 'Name': { const en = env.find(e.id); if (en) return en.vars.get(e.id); const g = this.G.get(e.id); return g === undefined ? null : g; }
      case 'Paren': return this.eval(e.e, env);
      case 'Index': return this.index(this.eval(e.obj, env), this.eval(e.key, env));
      case 'Call': case 'Vararg': return this.evalMulti(e, env)[0] ?? null;
      case 'Function': this.rule('lua-functions'); return new LuaFunction(e, env, this);
      case 'Table': {
        this.rule('lua-tables');
        const t = new LuaTable(); let n = 1;
        e.items.forEach((it, i) => { if (it.k) t.set(this.eval(it.k, env), this.eval(it.v, env)); else if (i === e.items.length - 1 && (it.v.t === 'Call' || it.v.t === 'Vararg')) for (const v of this.evalMulti(it.v, env)) t.set(n++, v); else t.set(n++, this.eval(it.v, env)); });
        return t;
      }
      case 'Un': {
        const v = this.eval(e.e, env);
        if (e.op === 'not') return !truthy(v);
        if (e.op === '-') { const m = this.meta(v, '__unm'); if (m) return this.call(m, [v, v])[0]; const n = tonum(v); return n instanceof LuaFloat ? new LuaFloat(-n.v) : -n; }
        if (e.op === '#') { if (typeof v === 'string') return v.length; const m = this.meta(v, '__len'); if (m) return this.call(m, [v])[0]; return v.length(); }
        if (e.op === '~') return ~fv(v);
        break;
      }
      case 'Bin': {
        if (e.op === 'and') { const l = this.eval(e.l, env); return truthy(l) ? this.eval(e.r, env) : l; }
        if (e.op === 'or') { const l = this.eval(e.l, env); return truthy(l) ? l : this.eval(e.r, env); }
        return this.arith(e.op, this.eval(e.l, env), this.eval(e.r, env));
      }
    }
    throw new LuaError(`unsupported expression ${e.t}`);
  }
  meta(v, name) { return v instanceof LuaTable && v.meta ? v.meta.get(name) ?? null : null; }
  arith(op, a, b) {
    const mm = { '+': '__add', '-': '__sub', '*': '__mul', '/': '__div', '%': '__mod', '^': '__pow', '//': '__idiv', '..': '__concat', '==': '__eq', '<': '__lt', '<=': '__le' }[op];
    if (mm && (a instanceof LuaTable || b instanceof LuaTable) && op !== '==') { const m = this.meta(a, mm) || this.meta(b, mm); if (m) return this.call(m, [a, b])[0]; }
    switch (op) {
      case '..': this.rule('lua-strings'); if ((typeof a !== 'string' && !isNumber(a)) || (typeof b !== 'string' && !isNumber(b))) throw new LuaError(`attempt to concatenate a ${luaType(typeof a === 'string' || isNumber(a) ? b : a)} value`); return tostr(a) + tostr(b);
      case '==': return luaEq(a, b);
      case '~=': return !luaEq(a, b);
      case '<': case '>': case '<=': case '>=': {
        if (op === '>') return this.arith('<', b, a); if (op === '>=') return this.arith('<=', b, a);
        if (typeof a === 'string' && typeof b === 'string') return op === '<' ? a < b : a <= b;
        if (isNumber(a) && isNumber(b)) return op === '<' ? fv(a) < fv(b) : fv(a) <= fv(b);
        throw new LuaError(`attempt to compare ${luaType(a)} with ${luaType(b)}`);
      }
    }
    const x = tonum(a), y = tonum(b);
    if (x === null || y === null) throw new LuaError(`attempt to perform arithmetic on a ${luaType(x === null ? a : b)} value`);
    const F = x instanceof LuaFloat || y instanceof LuaFloat; const X = fv(x), Y = fv(y);
    const w = (v) => (F ? new LuaFloat(v) : v);
    switch (op) {
      case '+': return w(X + Y); case '-': return w(X - Y); case '*': return w(X * Y);
      case '/': return new LuaFloat(X / Y); case '^': return new LuaFloat(X ** Y);
      case '//': if (!F && Y === 0) throw new LuaError("attempt to perform 'n//0'"); return w(Math.floor(X / Y));
      case '%': { if (!F && Y === 0) throw new LuaError("attempt to perform 'n%%0'"); const r = X - Math.floor(X / Y) * Y; return w(r); }
      case '&': return X & Y; case '|': return X | Y; case '~': return X ^ Y; case '<<': return X << Y; case '>>': return X >>> Y;
    }
    throw new LuaError(`unsupported operator ${op}`);
  }
}
const truthy = (v) => v !== null && v !== false && v !== undefined;
const luaEq = (a, b) => (isNumber(a) && isNumber(b) ? fv(a) === fv(b) : a === b);
function tonum(v) { if (isNumber(v)) return v; if (typeof v === 'string') { const t = v.trim(); if (/^-?(0x[0-9a-f]+|\d+)$/i.test(t)) return Number(t); const n = Number(t); return t !== '' && !Number.isNaN(n) ? new LuaFloat(n) : null; } return null; }
export function luaType(v) { if (v === null || v === undefined) return 'nil'; if (typeof v === 'boolean') return 'boolean'; if (isNumber(v)) return 'number'; if (typeof v === 'string') return 'string'; if (v instanceof LuaTable) return 'table'; return 'function'; }
function fmtFloat(v) { if (Number.isInteger(v) && Math.abs(v) < 1e16) return v.toFixed(1); if (!Number.isFinite(v)) return Number.isNaN(v) ? (Object.is(v, NaN) ? '-nan' : 'nan') : v > 0 ? 'inf' : '-inf'; let s = Number(v.toPrecision(14)).toString(); if (s.includes('e')) s = s.replace(/e([+-])(\d)$/, 'e$10$2'); return s; }
function tostr(v) { if (v === null || v === undefined) return 'nil'; if (v === true) return 'true'; if (v === false) return 'false'; if (v instanceof LuaFloat) return fmtFloat(v.v); if (typeof v === 'number') return String(v); if (typeof v === 'string') return v; if (v instanceof LuaTable) return 'table: 0x' + (v.id ??= (Math.random() * 1e8) | 0).toString(16).padStart(8, '0'); return 'function: builtin'; }
function luaFormat(fmt, args) {
  let i = 0;
  return fmt.replace(/%([-+ #0]*)(\d*)(?:\.(\d+))?([diouxXeEfgGqsc%])/g, (all, flags, width, prec, type) => {
    if (type === '%') return '%';
    const a = args[i++]; let s;
    switch (type) {
      case 'd': case 'i': s = String(Math.trunc(fv(tonum(a)))); break;
      case 'f': s = fv(tonum(a)).toFixed(prec === undefined ? 6 : Number(prec)); break;
      case 'e': case 'E': s = fv(tonum(a)).toExponential(prec === undefined ? 6 : Number(prec)).replace(/e([+-])(\d)$/, 'e$10$2'); if (type === 'E') s = s.toUpperCase(); break;
      case 'g': case 'G': s = String(Number(fv(tonum(a)).toPrecision(prec === undefined ? 6 : Math.max(1, Number(prec))))); break;
      case 'x': s = Math.trunc(fv(a)).toString(16); break; case 'X': s = Math.trunc(fv(a)).toString(16).toUpperCase(); break; case 'o': s = Math.trunc(fv(a)).toString(8); break;
      case 'c': s = String.fromCharCode(fv(a)); break;
      case 'q': s = JSON.stringify(String(a)); break;
      default: s = tostr(a); if (prec !== undefined) s = s.slice(0, Number(prec));
    }
    if (flags.includes('+') && /[dif]/.test(type) && !s.startsWith('-')) s = '+' + s;
    const w = Number(width || 0);
    if (s.length < w) s = flags.includes('-') ? s.padEnd(w) : flags.includes('0') ? (s.startsWith('-') ? '-' + s.slice(1).padStart(w - 1, '0') : s.padStart(w, '0')) : s.padStart(w);
    return s;
  });
}
function installStdlib(I) {
  const G = I.G; const N = (name, fn) => new Native(name, fn);
  const lib = (name, fns) => { const t = new LuaTable(); for (const [k, v] of Object.entries(fns)) t.set(k, v instanceof Native || typeof v !== 'function' ? v : N(k, v)); G.set(name, t); return t; };
  G.set('_G', G);
  G.set('print', N('print', (a) => { I.write(a.map(tostr).join('\t') + '\n'); return []; }));
  G.set('tostring', N('tostring', (a) => [tostr(a[0])]));
  G.set('tonumber', N('tonumber', (a) => { if (a[1] !== undefined && a[1] !== null) { const n = parseInt(String(a[0]), fv(a[1])); return [Number.isNaN(n) ? null : n]; } return [tonum(a[0])]; }));
  G.set('type', N('type', (a) => [luaType(a[0])]));
  G.set('ipairs', N('ipairs', ([t]) => [N('inext', ([tt, i]) => { const n = fv(i) + 1; const v = I.index(tt, n); return v === null ? [null] : [n, v]; }), t, 0]));
  const next = N('next', ([t, k]) => { const keys = [...t.hash.keys()]; const idx = k === null || k === undefined ? 0 : keys.indexOf(normKey(k)) + 1; if (idx >= keys.length) return [null]; const kk = keys[idx]; return [typeof kk === 'string' && kk.startsWith('f') && !Number.isNaN(Number(kk.slice(1))) && t.hash.has(kk) && false ? kk : kk, t.hash.get(kk)]; });
  G.set('next', next);
  G.set('pairs', N('pairs', ([t]) => { const pm = I.meta(t, '__pairs'); if (pm) return I.call(pm, [t]); return [next, t, null]; }));
  G.set('setmetatable', N('setmetatable', ([t, m]) => { I.rule('lua-metatables'); t.meta = m; return [t]; }));
  G.set('getmetatable', N('getmetatable', ([t]) => [t instanceof LuaTable ? t.meta : t === undefined ? null : typeof t === 'string' ? (() => { const m = new LuaTable(); m.set('__index', G.get('string')); return m; })() : null]));
  G.set('rawget', N('rawget', ([t, k]) => [t.get(k) ?? null])); G.set('rawset', N('rawset', ([t, k, v]) => { t.set(k, v); return [t]; })); G.set('rawequal', N('rawequal', ([a, b]) => [a === b])); G.set('rawlen', N('rawlen', ([t]) => [typeof t === 'string' ? t.length : t.length()]));
  G.set('select', N('select', (a) => { if (a[0] === '#') return [a.length - 1]; const n = fv(a[0]); return n < 0 ? a.slice(a.length + n) : a.slice(n); }));
  G.set('unpack', N('unpack', ([t, i, j]) => { const out = []; const e = j ?? t.length(); for (let k = fv(i ?? 1); k <= fv(e); k++) out.push(t.get(k) ?? null); return out; }));
  G.set('error', N('error', ([m]) => { const e = new LuaError(tostr(m)); e.luaValue = m; throw e; }));
  G.set('assert', N('assert', (a) => { if (!truthy(a[0])) throw new LuaError(a[1] !== undefined ? tostr(a[1]) : 'assertion failed!'); return a; }));
  G.set('pcall', N('pcall', ([f, ...args]) => { try { return [true, ...I.call(f, args)]; } catch (e) { if (e instanceof LuaError) return [false, e.luaValue ?? e.message]; throw e; } }));
  lib('string', {
    format: (a) => [luaFormat(a[0], a.slice(1))], len: ([s]) => [s.length], sub: ([s, i, j]) => { const n = s.length; let a = fv(i ?? 1), b = fv(j ?? -1); if (a < 0) a = Math.max(n + a + 1, 1); if (a === 0) a = 1; if (b < 0) b = n + b + 1; if (b > n) b = n; return [a > b ? '' : s.slice(a - 1, b)]; },
    upper: ([s]) => [s.toUpperCase()], lower: ([s]) => [s.toLowerCase()], rep: ([s, n, sep]) => [Array(Math.max(0, fv(n))).fill(s).join(sep ?? '')], reverse: ([s]) => [[...s].reverse().join('')],
    byte: ([s, i]) => [s.charCodeAt(fv(i ?? 1) - 1)], char: (a) => [String.fromCharCode(...a.map(fv))],
    find: ([s, p, init, plain]) => { const st = fv(init ?? 1) - 1; if (plain || !/[%.\[\]()*+\-?^$]/.test(p)) { const i = s.indexOf(p, st); return i < 0 ? [null] : [i + 1, i + p.length]; } const m = new RegExp(luaPat(p)).exec(s.slice(st)); return m ? [st + m.index + 1, st + m.index + m[0].length, ...m.slice(1)] : [null]; },
    match: ([s, p]) => { const m = new RegExp(luaPat(p)).exec(s); return m ? (m.length > 1 ? m.slice(1) : [m[0]]) : [null]; },
    gmatch: ([s, p]) => { const re = new RegExp(luaPat(p), 'g'); return [N('gmatch_iter', () => { const m = re.exec(s); if (!m) return [null]; if (m[0] === '') re.lastIndex++; return m.length > 1 ? m.slice(1) : [m[0]]; })]; },
    gsub: ([s, p, r]) => { let count = 0; const out = s.replace(new RegExp(luaPat(p), 'g'), (...m) => { count++; const caps = m.slice(1, -2); if (typeof r === 'string') return r.replace(/%(\d)/g, (_, d) => (d === '0' ? m[0] : caps[d - 1])); if (r instanceof LuaTable) return tostr(r.get(caps[0] ?? m[0]) ?? m[0]); const v = I.call(r, caps.length ? caps : [m[0]])[0]; return truthy(v) ? tostr(v) : m[0]; }); return [out, count]; },
  });
  lib('table', {
    insert: (a) => { const t = a[0]; if (a.length === 2) t.set(t.length() + 1, a[1]); else { const pos = fv(a[1]); for (let k = t.length(); k >= pos; k--) t.set(k + 1, t.get(k)); t.set(pos, a[2]); } return []; },
    remove: ([t, pos]) => { const n = t.length(); const p = pos === undefined ? n : fv(pos); const v = t.get(p) ?? null; for (let k = p; k < n; k++) t.set(k + 1 - 1, t.get(k + 1)); t.set(n, null); return [v]; },
    concat: ([t, sep, i, j]) => { const out = []; for (let k = fv(i ?? 1); k <= fv(j ?? t.length()); k++) out.push(tostr(t.get(k))); return [out.join(sep ?? '')]; },
    sort: ([t, cmp]) => { const n = t.length(); const arr = []; for (let k = 1; k <= n; k++) arr.push(t.get(k)); arr.sort((x, y) => (cmp ? (truthy(I.call(cmp, [x, y])[0]) ? -1 : truthy(I.call(cmp, [y, x])[0]) ? 1 : 0) : I.arith('<', x, y) ? -1 : I.arith('<', y, x) ? 1 : 0)); arr.forEach((v, k) => t.set(k + 1, v)); return []; },
    unpack: G.get('unpack'),
  });
  const F = (v) => new LuaFloat(v);
  lib('math', { pi: F(Math.PI), huge: F(Infinity), maxinteger: Number.MAX_SAFE_INTEGER, mininteger: Number.MIN_SAFE_INTEGER,
    floor: ([x]) => [Math.floor(fv(x))], ceil: ([x]) => [Math.ceil(fv(x))], abs: ([x]) => [x instanceof LuaFloat ? F(Math.abs(x.v)) : Math.abs(x)], sqrt: ([x]) => [F(Math.sqrt(fv(x)))], sin: ([x]) => [F(Math.sin(fv(x)))], cos: ([x]) => [F(Math.cos(fv(x)))], tan: ([x]) => [F(Math.tan(fv(x)))], exp: ([x]) => [F(Math.exp(fv(x)))],
    log: ([x, b]) => [F(b === undefined ? Math.log(fv(x)) : Math.log(fv(x)) / Math.log(fv(b)))], max: (a) => [a.reduce((m, x) => (fv(x) > fv(m) ? x : m))], min: (a) => [a.reduce((m, x) => (fv(x) < fv(m) ? x : m))],
    fmod: ([a, b]) => [F(fv(a) % fv(b))], tointeger: ([x]) => [Number.isInteger(fv(x)) ? fv(x) : null], type: ([x]) => [x instanceof LuaFloat ? 'float' : typeof x === 'number' ? 'integer' : null],
    random: () => { throw new LuaError('math.random is not provided (deterministic sovereign sandbox)'); } });
  lib('os', { time: () => { throw new LuaError('os.time is not available in the sovereign sandbox'); }, clock: () => [F(0)] });
  G.set('io', (() => { const t = new LuaTable(); t.set('write', N('write', (a) => { I.write(a.map(tostr).join('')); return []; })); return t; })());
}
function luaPat(p) {
  let out = ''; for (let i = 0; i < p.length; i++) { const c = p[i]; if (c === '%') { const n = p[++i]; const cls = { a: '[A-Za-z]', d: '\\d', l: '[a-z]', s: '\\s', u: '[A-Z]', w: '[A-Za-z0-9]', x: '[0-9A-Fa-f]', p: '[!-\\/:-@\\[-`{-~]', c: '[\\x00-\\x1f]', A: '[^A-Za-z]', D: '\\D', S: '\\S', W: '[^A-Za-z0-9]' }[n]; out += cls ?? '\\' + n; } else if (c === '-') out += '*?'; else if ('\\/{}|'.includes(c)) out += '\\' + c; else out += c; } return out;
}
export { tostr as luaToString };
