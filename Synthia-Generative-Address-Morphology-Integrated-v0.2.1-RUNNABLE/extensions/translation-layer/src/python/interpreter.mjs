// Pure-JS Python emulator (tree-walking). Sovereign: no network, no workers, no host I/O.
import { parse } from './parser.mjs';
import {
  PyFloat, PyTuple, PyDict, PySet, PyObject, PyClass, PyFunction, PyBuiltin, PyBoundMethod, PyStaticMethod, PyClassMethod,
  PyProperty, PyModule, PySlice, PyException, isFloat, num, isNum, f, hashKey, typeName, floatRepr,
} from './objects.mjs';

class BreakSig {} class ContinueSig {}
class ReturnSig { constructor(v) { this.v = v; } }
const BREAK = new BreakSig(), CONTINUE = new ContinueSig();

class Scope {
  constructor(parent, kind, globals) { this.vars = new Map(); this.parent = parent; this.kind = kind; this.globals = globals ?? this; this.globalNames = new Set(); this.nonlocalNames = new Set(); }
}

export class PyRange { constructor(start, stop, step) { this.start = start; this.stop = stop; this.step = step; this.pyTypeName = 'range'; }
  toArray() { const out = []; if (this.step > 0) for (let i = this.start; i < this.stop; i += this.step) out.push(i); else for (let i = this.start; i > this.stop; i += this.step) out.push(i); return out; } }

export class PythonInterpreter {
  constructor({ modules = {}, maxSteps = 5e7 } = {}) {
    this.stdout = []; this.lineBuf = '';
    this.moduleFactories = modules; this.moduleCache = new Map();
    this.steps = 0; this.maxSteps = maxSteps;
    this.rulesUsed = new Set();
    this.builtins = new Map();
    installBuiltins(this);
  }
  rule(name) { this.rulesUsed.add(name); }
  write(s) {
    this.lineBuf += s;
    let i; while ((i = this.lineBuf.indexOf('\n')) >= 0) { this.stdout.push(this.lineBuf.slice(0, i)); this.lineBuf = this.lineBuf.slice(i + 1); }
  }
  flush() { if (this.lineBuf) { this.stdout.push(this.lineBuf); this.lineBuf = ''; } }
  run(source, { name = '__main__' } = {}) {
    const tree = parse(source);
    const g = new Scope(null, 'module'); g.vars.set('__name__', name);
    this.globals = g;
    this.execBlock(tree.body, g);
    this.flush();
    return g;
  }
  // ---------------- errors
  err(type, msg) { return new PyException(type, msg); }
  // ---------------- statements
  execBlock(body, scope) { for (const s of body) this.exec(s, scope); }
  exec(node, scope) {
    if (++this.steps > this.maxSteps) throw this.err('RuntimeError', 'step budget exhausted');
    this.line = node.line ?? this.line;
    switch (node.t) {
      case 'Expr': this.rule('py-expression'); this.eval(node.value, scope); return;
      case 'Assign': { this.rule('py-assign'); const v = this.eval(node.value, scope); for (const t of node.targets) this.assign(t, v, scope); return; }
      case 'AugAssign': {
        this.rule('py-augassign');
        const cur = this.eval(node.target, scope); const v = this.binop(node.op, cur, this.eval(node.value, scope), true);
        this.assign(node.target, v, scope); return;
      }
      case 'AnnAssign': {
        this.rule('py-annotation');
        if (scope.kind === 'class' && node.target.t === 'Name') scope.annotations.push(node.target.id);
        if (node.value) this.assign(node.target, this.eval(node.value, scope), scope); return;
      }
      case 'Pass': return;
      case 'Break': throw BREAK;
      case 'Continue': throw CONTINUE;
      case 'Return': throw new ReturnSig(node.value ? this.eval(node.value, scope) : null);
      case 'If': this.rule('py-control-branch'); if (this.truthy(this.eval(node.test, scope))) this.execBlock(node.body, scope); else this.execBlock(node.orelse, scope); return;
      case 'While': {
        this.rule('py-control-loop');
        let broke = false;
        while (this.truthy(this.eval(node.test, scope))) {
          try { this.execBlock(node.body, scope); } catch (e) { if (e === BREAK) { broke = true; break; } if (e === CONTINUE) continue; throw e; }
        }
        if (!broke) this.execBlock(node.orelse, scope); return;
      }
      case 'For': {
        this.rule('py-control-loop');
        let broke = false;
        for (const item of this.iterate(this.eval(node.iter, scope))) {
          this.assign(node.target, item, scope);
          try { this.execBlock(node.body, scope); } catch (e) { if (e === BREAK) { broke = true; break; } if (e === CONTINUE) continue; throw e; }
        }
        if (!broke) this.execBlock(node.orelse, scope); return;
      }
      case 'FunctionDef': {
        this.rule('py-functions');
        let fn = this.makeFunction(node.name, node.params, node.body, scope);
        for (const d of [...node.decorators].reverse()) { this.rule('py-decorators'); fn = this.call(this.eval(d, scope), [fn]); }
        this.setName(scope, node.name, fn); return;
      }
      case 'ClassDef': {
        this.rule('py-classes');
        let cls = this.makeClass(node, scope);
        for (const d of [...node.decorators].reverse()) { this.rule('py-decorators'); cls = this.call(this.eval(d, scope), [cls]); }
        this.setName(scope, node.name, cls); return;
      }
      case 'Import': {
        this.rule('py-imports');
        for (const { name, as } of node.names) {
          const mod = this.importModule(name);
          if (as) this.setName(scope, as, mod); else { const top = name.split('.')[0]; this.setName(scope, top, this.importModule(top)); }
        }
        return;
      }
      case 'ImportFrom': {
        this.rule('py-imports');
        const mod = this.importModule(node.module);
        for (const { name, as } of node.names) {
          if (name === '*') { for (const [k, v] of mod.attrs) if (!k.startsWith('_')) this.setName(scope, k, v); continue; }
          if (!mod.attrs.has(name)) throw this.err('ImportError', `cannot import name '${name}' from '${node.module}'`);
          this.setName(scope, as ?? name, mod.attrs.get(name));
        }
        return;
      }
      case 'Global': for (const n of node.names) scope.globalNames.add(n); return;
      case 'Nonlocal': for (const n of node.names) scope.nonlocalNames.add(n); return;
      case 'Raise': {
        this.rule('py-exceptions');
        if (!node.exc) throw this.currentException ?? this.err('RuntimeError', 'No active exception to reraise');
        let exc = this.eval(node.exc, scope);
        if (exc instanceof PyClass) exc = this.call(exc, []);
        throw this.toJsException(exc);
      }
      case 'Try': {
        this.rule('py-exceptions');
        try {
          try { this.execBlock(node.body, scope); }
          catch (e) {
            if (e instanceof BreakSig || e instanceof ContinueSig || e instanceof ReturnSig) throw e;
            const pe = this.normalizeException(e);
            const h = node.handlers.find((h) => !h.type || this.exceptionMatches(pe, this.eval(h.type, scope)));
            if (!h) throw e;
            if (h.name) this.setName(scope, h.name, pe.pyValue);
            const prev = this.currentException; this.currentException = pe;
            try { this.execBlock(h.body, scope); } finally { this.currentException = prev; }
            return;
          }
          this.execBlock(node.orelse, scope);
        } finally { if (node.finalbody.length) this.execBlock(node.finalbody, scope); }
        return;
      }
      case 'With': {
        const ctxs = node.items.map((it) => { const c = this.eval(it.ctx, scope); const v = this.callMethod(c, '__enter__', []); if (it.as) this.assign(it.as, v, scope); return c; });
        try { this.execBlock(node.body, scope); } finally { for (const c of ctxs.reverse()) this.callMethod(c, '__exit__', [null, null, null]); }
        return;
      }
      case 'Assert': if (!this.truthy(this.eval(node.test, scope))) throw this.err('AssertionError', node.msg ? this.str(this.eval(node.msg, scope)) : ''); return;
      case 'Del': {
        const targets = node.targets.t === 'Tuple' ? node.targets.elts : [node.targets];
        for (const t of targets) {
          if (t.t === 'Name') this.lookupScopeFor(scope, t.id).vars.delete(t.id);
          else if (t.t === 'Subscript') { const o = this.eval(t.value, scope); const k = this.eval(t.slice, scope); if (o instanceof PyDict) o.delete(k); else if (Array.isArray(o)) o.splice(this.index(o, k), 1); }
          else if (t.t === 'Attribute') { const o = this.eval(t.value, scope); if (o instanceof PyObject) o.attrs.delete(t.attr); }
        }
        return;
      }
    }
    throw this.err('NotImplementedError', `statement ${node.t} not supported`);
  }
  toJsException(exc) {
    const cls = exc instanceof PyObject ? exc.cls : null;
    const args = exc instanceof PyObject ? exc.attrs.get('args') : null;
    const msg = args && args.items.length ? this.str(args.items[0]) : '';
    return new PyException(cls ? cls.name : 'Exception', msg, exc);
  }
  normalizeException(e) {
    if (e instanceof PyException) {
      if (!e.pyValue) { const cls = this.builtins.get(e.pyType) ?? this.builtins.get('Exception'); const o = new PyObject(cls); o.attrs.set('args', new PyTuple([e.message])); e.pyValue = o; }
      return e;
    }
    if (e instanceof RangeError) return this.normalizeException(this.err('RecursionError', 'maximum recursion depth exceeded'));
    throw e;
  }
  exceptionMatches(pe, typ) {
    const types = typ instanceof PyTuple ? typ.items : [typ];
    return types.some((t) => t instanceof PyClass && pe.pyValue.cls.isSubclassOf(t));
  }
  lookupScopeFor(scope, name) {
    if (scope.globalNames.has(name)) return scope.globals;
    if (scope.nonlocalNames.has(name)) { let s = scope.parent; while (s && !(s.kind === 'function' && s.vars.has(name))) s = s.parent; return s ?? scope.globals; }
    return scope;
  }
  setName(scope, name, v) { this.lookupScopeFor(scope, name).vars.set(name, v); }
  getName(scope, name) {
    if (scope.globalNames.has(name)) scope = scope.globals;
    if (scope.vars.has(name)) return scope.vars.get(name);
    let s = scope.parent;
    while (s) { if (s.kind !== 'class' && s.vars.has(name)) return s.vars.get(name); s = s.parent; }
    if (scope.globals.vars.has(name)) return scope.globals.vars.get(name);
    if (this.builtins.has(name)) return this.builtins.get(name);
    throw this.err('NameError', `name '${name}' is not defined`);
  }
  assign(target, v, scope) {
    switch (target.t) {
      case 'Name': this.setName(scope, target.id, v); return;
      case 'Tuple': case 'List': {
        this.rule('py-unpack');
        const items = this.iterate(v); const elts = target.elts;
        const star = elts.findIndex((e) => e.t === 'Starred');
        if (star < 0) {
          if (items.length !== elts.length) throw this.err('ValueError', items.length > elts.length ? `too many values to unpack (expected ${elts.length})` : `not enough values to unpack (expected ${elts.length}, got ${items.length})`);
          elts.forEach((e, i) => this.assign(e, items[i], scope));
        } else {
          const after = elts.length - star - 1;
          elts.slice(0, star).forEach((e, i) => this.assign(e, items[i], scope));
          this.assign(elts[star].value, items.slice(star, items.length - after), scope);
          elts.slice(star + 1).forEach((e, i) => this.assign(e, items[items.length - after + i], scope));
        }
        return;
      }
      case 'Paren': return this.assign(target.value, v, scope);
      case 'Attribute': this.setAttr(this.eval(target.value, scope), target.attr, v); return;
      case 'Subscript': this.setItem(this.eval(target.value, scope), this.eval(target.slice, scope), v); return;
      case 'Starred': return this.assign(target.value, v, scope);
    }
    throw this.err('SyntaxError', `cannot assign to ${target.t}`);
  }
  // ---------------- functions & classes
  makeFunction(name, params, body, scope, isLambda = false) {
    const defaults = params.map((p) => (p.default ? this.eval(p.default, scope) : undefined));
    const isGen = !isLambda && containsYield(body);
    return new PyFunction(name, params, body, scope, this, { defaults, isLambda, isGen, qualname: name });
  }
  callFunction(fn, args, kwargs) {
    const scope = new Scope(fn.closure, 'function', fn.closure.globals);
    const params = fn.params; let ai = 0; const extraKw = new PyDict(); let varargs = null, kwOnly = false;
    for (let i = 0; i < params.length; i++) {
      const p = params[i];
      if (p.kind === 'kwonly-marker') { kwOnly = true; continue; }
      if (p.kind === 'varargs') { varargs = p.name; scope.vars.set(p.name, new PyTuple(args.slice(ai))); ai = args.length; kwOnly = true; continue; }
      if (p.kind === 'kwargs') { scope.vars.set(p.name, extraKw); continue; }
      if (!kwOnly && ai < args.length) { if (kwargs.has(p.name)) throw this.err('TypeError', `${fn.name}() got multiple values for argument '${p.name}'`); scope.vars.set(p.name, args[ai++]); }
      else if (kwargs.has(p.name)) scope.vars.set(p.name, kwargs.get(p.name));
      else if (fn.defaults[i] !== undefined) scope.vars.set(p.name, fn.defaults[i]);
      else throw this.err('TypeError', `${fn.name}() missing required argument: '${p.name}'`);
    }
    if (ai < args.length) throw this.err('TypeError', `${fn.name}() takes ${params.filter((p) => p.kind === 'normal').length} positional arguments but ${args.length} were given`);
    const names = new Set(params.map((p) => p.name));
    for (const [k, v] of kwargs) if (!names.has(k) || params.find((p) => p.name === k)?.kind !== 'normal') {
      if (params.some((p) => p.kind === 'kwargs')) extraKw.set(k, v); else if (!names.has(k)) throw this.err('TypeError', `${fn.name}() got an unexpected keyword argument '${k}'`);
    }
    if (fn.isLambda) return this.eval(fn.body, scope);
    if (fn.isGen) { scope.yields = []; try { this.execBlock(fn.body, scope); } catch (e) { if (!(e instanceof ReturnSig)) throw e; } return scope.yields; }
    try { this.execBlock(fn.body, scope); } catch (e) { if (e instanceof ReturnSig) return e.v; throw e; }
    return null;
  }
  makeClass(node, scope) {
    const bases = node.bases.map((b) => this.eval(b, scope)).filter((b) => b instanceof PyClass);
    const cscope = new Scope(scope, 'class', scope.globals); cscope.annotations = [];
    cscope.vars.set('__qualname__', node.name);
    this.execBlock(node.body, cscope);
    const dict = new Map(cscope.vars);
    const allBases = bases.length ? bases : [this.builtins.get('object')];
    const cls = new PyClass(node.name, allBases, dict, { annotations: cscope.annotations });
    if (allBases.some((b) => b.isEnum || b.isEnumBase)) this.makeEnum(cls);
    if (allBases.some((b) => b.isException)) cls.isException = true;
    const hashFn = cls.lookup('__hash__');
    if (hashFn instanceof PyFunction) cls.hashKeyFn = (o) => 'h' + cls.id + ':' + this.call(new PyBoundMethod(o, hashFn), []);
    else { const inherited = allBases.find((b) => b.hashKeyFn); if (inherited) cls.hashKeyFn = inherited.hashKeyFn; }
    return cls;
  }
  makeEnum(cls) {
    this.rule('py-enum');
    cls.isEnum = true; cls.members = []; cls.byValue = new Map();
    let last = 0;
    for (const [k, v] of [...cls.dict]) {
      if (k.startsWith('_') || v instanceof PyFunction || v instanceof PyStaticMethod || v instanceof PyClassMethod || v instanceof PyProperty || v instanceof PyBuiltin) continue;
      let value = v;
      if (v && v.isAuto) value = last + 1;
      if (typeof value === 'number') last = value;
      const m = new PyObject(cls); m.attrs.set('name', k); m.attrs.set('value', value); m.attrs.set('_name_', k); m.attrs.set('_value_', value);
      m.enumMember = true;
      const existing = cls.byValue.get(hashKey(value));
      if (existing) { cls.dict.set(k, existing); continue; }
      cls.dict.set(k, m); cls.members.push(m); cls.byValue.set(hashKey(value), m);
    }
    cls.hashKeyFn = (o) => 'e' + cls.id + ':' + o.attrs.get('_name_');
  }
  instantiate(cls, args, kwargs) {
    if (cls.isEnum) {
      const m = cls.byValue.get(hashKey(args[0]));
      if (!m) throw this.err('ValueError', `${this.repr(args[0])} is not a valid ${cls.name}`);
      return m;
    }
    if (cls.pyNew) return cls.pyNew(args, kwargs);
    const obj = new PyObject(cls);
    const init = cls.lookup('__init__');
    if (init instanceof PyFunction) this.callFunction(init, [obj, ...args], kwargs);
    else if (init instanceof PyBuiltin) init.fn([obj, ...args], kwargs, this);
    else if (cls.isException) obj.attrs.set('args', new PyTuple(args));
    if (cls.frozen) obj.frozen = true;
    return obj;
  }
  // ---------------- calls
  call(fn, args = [], kwargs = new Map()) {
    if (fn instanceof PyFunction) return this.callFunction(fn, args, kwargs);
    if (fn instanceof PyBoundMethod) return this.call(fn.func, [fn.self, ...args], kwargs);
    if (fn instanceof PyBuiltin) return fn.fn(args, kwargs, this);
    if (fn instanceof PyClass) return this.instantiate(fn, args, kwargs);
    if (fn instanceof PyStaticMethod) return this.call(fn.func, args, kwargs);
    if (fn instanceof PyObject) { const c = fn.cls.lookup('__call__'); if (c) return this.call(c, [fn, ...args], kwargs); }
    if (fn && typeof fn.pyCall === 'function') return fn.pyCall(args, kwargs, this);
    throw this.err('TypeError', `'${typeName(fn)}' object is not callable`);
  }
  callMethod(obj, name, args, kwargs = new Map()) { return this.call(this.getAttr(obj, name), args, kwargs); }
  // ---------------- attributes
  getAttr(obj, name) {
    if (obj instanceof PyObject) {
      if (obj.attrs.has(name)) return obj.attrs.get(name);
      if (name === '__class__') return obj.cls;
      if (name === '__dict__') return new PyDict([...obj.attrs]);
      const v = obj.cls.lookup(name);
      if (v !== undefined) return this.bindDescriptor(v, obj, obj.cls);
      const ga = obj.cls.lookup('__getattr__');
      if (ga) return this.call(ga, [obj, name]);
      if (obj.cls.isException && name === 'args') return new PyTuple([]);
      throw this.err('AttributeError', `'${obj.cls.name}' object has no attribute '${name}'`);
    }
    if (obj instanceof PyClass) {
      if (name === '__name__') return obj.name;
      if (name === '__members__') return new PyDict((obj.members ?? []).map((m) => [m.attrs.get('name'), m]));
      const v = obj.lookup(name);
      if (v !== undefined) {
        if (v instanceof PyClassMethod) return new PyBoundMethod(obj, v.func);
        if (v instanceof PyStaticMethod) return v.func;
        return v;
      }
      throw this.err('AttributeError', `type object '${obj.name}' has no attribute '${name}'`);
    }
    if (obj instanceof PyModule) { if (obj.attrs.has(name)) return obj.attrs.get(name); throw this.err('AttributeError', `module '${obj.name}' has no attribute '${name}'`); }
    if (obj instanceof PyFunction && name === '__name__') return obj.name;
    if (obj && typeof obj.pyGetAttr === 'function') { const v = obj.pyGetAttr(name, this); if (v !== undefined) return v; }
    const m = builtinMethod(this, obj, name);
    if (m) return m;
    throw this.err('AttributeError', `'${typeName(obj)}' object has no attribute '${name}'`);
  }
  bindDescriptor(v, obj, cls) {
    if (v instanceof PyFunction || v instanceof PyBuiltin) return new PyBoundMethod(obj, v);
    if (v instanceof PyStaticMethod) return v.func;
    if (v instanceof PyClassMethod) return new PyBoundMethod(cls, v.func);
    if (v instanceof PyProperty) return this.call(v.fget, [obj]);
    return v;
  }
  setAttr(obj, name, v) {
    if (obj instanceof PyObject) {
      if (obj.frozen) throw this.err('FrozenInstanceError', `cannot assign to field '${name}'`);
      const sa = obj.cls.lookup('__setattr__'); if (sa instanceof PyFunction) { this.call(sa, [obj, name, v]); return; }
      obj.attrs.set(name, v); return;
    }
    if (obj instanceof PyClass) { obj.dict.set(name, v); return; }
    if (obj instanceof PyModule) { obj.attrs.set(name, v); return; }
    if (obj instanceof PyFunction) { obj[name] = v; return; }
    throw this.err('AttributeError', `'${typeName(obj)}' object attribute '${name}' is read-only`);
  }
  // ---------------- expressions
  eval(node, scope) {
    switch (node.t) {
      case 'Num': return node.isFloat ? f(node.value) : node.value;
      case 'Str': return node.value;
      case 'Const': return node.value;
      case 'Name': return this.getName(scope, node.id);
      case 'Paren': return this.eval(node.value, scope);
      case 'JoinedStr': this.rule('py-fstring'); return node.parts.map((p) => (p.t === 'Str' ? p.value : this.formatValue(p, scope))).join('');
      case 'List': this.rule('py-collections'); return this.evalElts(node.elts, scope);
      case 'Tuple': return new PyTuple(this.evalElts(node.elts, scope));
      case 'Set': return new PySet(this.evalElts(node.elts, scope));
      case 'Dict': {
        this.rule('py-collections');
        const d = new PyDict();
        node.keys.forEach((k, i) => { const v = this.eval(node.values[i], scope); if (k === null) for (const [kk, vv] of this.toDict(v).entries()) d.set(kk, vv); else d.set(this.eval(k, scope), v); });
        return d;
      }
      case 'ListComp': this.rule('py-comprehension'); return this.comprehend(node, scope, 'list');
      case 'GeneratorExp': this.rule('py-comprehension'); return this.comprehend(node, scope, 'list');
      case 'SetComp': this.rule('py-comprehension'); return new PySet(this.comprehend(node, scope, 'list'));
      case 'DictComp': this.rule('py-comprehension'); return this.comprehend(node, scope, 'dict');
      case 'Attribute': return this.getAttr(this.eval(node.value, scope), node.attr);
      case 'Subscript': return this.getItem(this.eval(node.value, scope), this.eval(node.slice, scope));
      case 'Slice': return new PySlice(node.lower ? this.eval(node.lower, scope) : null, node.upper ? this.eval(node.upper, scope) : null, node.step ? this.eval(node.step, scope) : null);
      case 'Call': {
        const fn = this.eval(node.func, scope);
        const args = []; for (const a of node.args) { if (a.t === 'Starred') args.push(...this.iterate(this.eval(a.value, scope))); else args.push(this.eval(a, scope)); }
        const kwargs = new Map(); for (const k of node.keywords) { const v = this.eval(k.value, scope); if (k.name === null) for (const [kk, vv] of this.toDict(v).entries()) kwargs.set(kk, vv); else kwargs.set(k.name, v); }
        return this.call(fn, args, kwargs);
      }
      case 'BinOp': this.rule('py-core-values'); return this.binop(node.op, this.eval(node.left, scope), this.eval(node.right, scope));
      case 'UnaryOp': {
        const v = this.eval(node.value, scope);
        if (v && typeof v.pyUnary === 'function') return v.pyUnary(node.op, this);
        if (node.op === '-') { if (isFloat(v)) return f(-v.v); if (isNum(v)) return -num(v); return this.callMethod(v, '__neg__', []); }
        if (node.op === '+') return isNum(v) ? (isFloat(v) ? v : num(v)) : this.callMethod(v, '__pos__', []);
        if (node.op === '~') return ~num(v);
        break;
      }
      case 'Not': return !this.truthy(this.eval(node.value, scope));
      case 'BoolOp': { const l = this.eval(node.left, scope); if (node.op === 'and') return this.truthy(l) ? this.eval(node.right, scope) : l; return this.truthy(l) ? l : this.eval(node.right, scope); }
      case 'Compare': {
        this.rule('py-control-branch');
        let left = this.eval(node.left, scope);
        for (let i = 0; i < node.ops.length; i++) { const right = this.eval(node.comparators[i], scope); if (!this.compare(node.ops[i], left, right)) return false; left = right; }
        return true;
      }
      case 'IfExp': return this.truthy(this.eval(node.test, scope)) ? this.eval(node.body, scope) : this.eval(node.orelse, scope);
      case 'Lambda': this.rule('py-functions'); return this.makeFunction('<lambda>', node.params, node.body, scope, true);
      case 'NamedExpr': { const v = this.eval(node.value, scope); this.setName(scope, node.name, v); return v; }
      case 'Yield': { let s = scope; while (s && !s.yields) s = s.parent; const v = node.value ? this.eval(node.value, scope) : null; if (s) s.yields.push(v); return null; }
      case 'Starred': return this.eval(node.value, scope);
    }
    throw this.err('NotImplementedError', `expression ${node.t} not supported`);
  }
  evalElts(elts, scope) { const out = []; for (const e of elts) { if (e.t === 'Starred') out.push(...this.iterate(this.eval(e.value, scope))); else out.push(this.eval(e, scope)); } return out; }
  comprehend(node, scope, kind) {
    const inner = new Scope(scope, 'function', scope.globals);
    const out = kind === 'dict' ? new PyDict() : [];
    const loop = (gi) => {
      if (gi === node.generators.length) {
        if (kind === 'dict') out.set(this.eval(node.key, inner), this.eval(node.value, inner)); else out.push(this.eval(node.elt, inner));
        return;
      }
      const g = node.generators[gi];
      const iterable = this.iterate(this.eval(g.iter, gi === 0 ? scope : inner));
      for (const item of iterable) { this.assign(g.target, item, inner); if (g.ifs.every((c) => this.truthy(this.eval(c, inner)))) loop(gi + 1); }
    };
    loop(0); return out;
  }
  formatValue(p, scope) {
    let v = this.eval(p.value, scope);
    if (p.conversion === 'r') v = this.repr(v); else if (p.conversion === 's') v = this.str(v);
    const spec = Array.isArray(p.spec) ? p.spec.map((x) => (x.t === 'Str' ? x.value : this.formatValue(x, scope))).join('') : p.spec;
    return this.format(v, spec);
  }
  format(v, spec) {
    if (v instanceof PyObject) { const fm = v.cls.lookup('__format__'); if (fm instanceof PyFunction) return this.call(fm, [v, spec]); if (!spec) return this.str(v); if (v.enumMember) v = v.attrs.get('value'); }
    if (!spec) return this.str(v);
    const m = /^(?:(.)?([<>=^]))?([+\- ])?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([bcdeEfFgGnosxX%])?$/.exec(spec);
    if (!m) throw this.err('ValueError', `Invalid format specifier '${spec}'`);
    let [, fill, align, sign, , zero, width, grouping, precision, type] = m;
    let s; const n = isNum(v) ? num(v) : null;
    if (n !== null) {
      const neg = n < 0 || Object.is(n, -0); const a = Math.abs(n);
      const p = precision !== undefined ? Number(precision) : 6;
      switch (type) {
        case 'f': case 'F': s = a.toFixed(p); break;
        case 'e': case 'E': { s = a.toExponential(p).replace(/e([+-])(\d)$/, 'e$10$2'); if (type === 'E') s = s.toUpperCase(); break; }
        case '%': s = (a * 100).toFixed(p) + '%'; break;
        case 'd': s = String(Math.trunc(a)); break;
        case 'x': s = Math.trunc(a).toString(16); break;
        case 'X': s = Math.trunc(a).toString(16).toUpperCase(); break;
        case 'b': s = Math.trunc(a).toString(2); break;
        case 'o': s = Math.trunc(a).toString(8); break;
        case 'g': case 'G': case 'n': { const pp = precision !== undefined ? Math.max(1, Number(precision)) : 6; s = String(Number(a.toPrecision(pp))); if (s.includes('e')) s = a.toExponential(pp - 1).replace(/\.?0+e/, 'e').replace(/e([+-])(\d)$/, 'e$10$2'); break; }
        default: s = precision !== undefined ? (isFloat(v) || !Number.isInteger(n) ? String(Number(a.toPrecision(Number(precision)))) : String(a)) : (isFloat(v) ? floatRepr(a) : String(a));
      }
      if (grouping) { const [ip, fp] = s.split('.'); s = ip.replace(/\B(?=(\d{3})+(?!\d))/g, grouping) + (fp !== undefined ? '.' + fp : ''); }
      const signStr = neg ? '-' : sign === '+' ? '+' : sign === ' ' ? ' ' : '';
      if (zero && !align) { fill = '0'; align = '='; }
      s = signStr + s;
      if (align === '=' && width && s.length < Number(width)) { const body = s.slice(signStr.length); return signStr + (fill ?? ' ').repeat(Number(width) - s.length) + body; }
    } else {
      s = this.str(v);
      if (precision !== undefined) s = s.slice(0, Number(precision));
    }
    const w = width ? Number(width) : 0;
    if (s.length >= w) return s;
    const pad = (fill ?? ' ').repeat(w - s.length);
    const al = align ?? (n !== null ? '>' : '<');
    if (al === '<') return s + pad;
    if (al === '>') return pad + s;
    if (al === '^') { const l = Math.floor((w - s.length) / 2); return (fill ?? ' ').repeat(l) + s + (fill ?? ' ').repeat(w - s.length - l); }
    return pad + s;
  }
  // ---------------- operators
  binop(op, a, b, inplace = false) {
    if (a && typeof a.pyBinop === 'function') { const r = a.pyBinop(op, b, false, this); if (r !== undefined) return r; }
    if (b && typeof b.pyBinop === 'function') { const r = b.pyBinop(op, a, true, this); if (r !== undefined) return r; }
    if (isNum(a) && isNum(b)) return numBinop(this, op, a, b);
    if (typeof a === 'string' && typeof b === 'string' && op === '+') return a + b;
    if (typeof a === 'string' && op === '*' && isNum(b)) return a.repeat(Math.max(0, num(b)));
    if (typeof b === 'string' && op === '*' && isNum(a)) return b.repeat(Math.max(0, num(a)));
    if (typeof a === 'string' && op === '%') return this.percentFormat(a, b);
    if (Array.isArray(a) && Array.isArray(b) && op === '+') { if (inplace) { a.push(...b); return a; } return [...a, ...b]; }
    if (Array.isArray(a) && op === '*' && isNum(b)) { const out = []; for (let i = 0; i < num(b); i++) out.push(...a); return out; }
    if (a instanceof PyTuple && b instanceof PyTuple && op === '+') return new PyTuple([...a.items, ...b.items]);
    if (a instanceof PyTuple && op === '*' && isNum(b)) { const out = []; for (let i = 0; i < num(b); i++) out.push(...a.items); return new PyTuple(out); }
    if (a instanceof PyDict && b instanceof PyDict && op === '|') { const d = new PyDict(a.entries()); for (const [k, v] of b.entries()) d.set(k, v); return d; }
    if (a instanceof PySet && b instanceof PySet) {
      if (op === '|') return new PySet([...a.values(), ...b.values()]);
      if (op === '&') return new PySet(a.values().filter((x) => b.has(x)));
      if (op === '-') return new PySet(a.values().filter((x) => !b.has(x)));
    }
    const names = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'truediv', '//': 'floordiv', '%': 'mod', '**': 'pow', '@': 'matmul', '&': 'and', '|': 'or', '^': 'xor', '<<': 'lshift', '>>': 'rshift' };
    const n = names[op];
    if (a instanceof PyObject) { const m = a.cls.lookup(`__${n}__`); if (m) { const r = this.call(m, [a, b]); if (r !== this.NotImplemented) return r; } }
    if (b instanceof PyObject) { const m = b.cls.lookup(`__r${n}__`); if (m) { const r = this.call(m, [b, a]); if (r !== this.NotImplemented) return r; } }
    throw this.err('TypeError', `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`);
  }
  percentFormat(fmt, args) {
    const vals = args instanceof PyTuple ? [...args.items] : [args]; let i = 0;
    return fmt.replace(/%(\([^)]*\))?([-+ 0#]*)(\d+|\*)?(?:\.(\d+))?([diouxXeEfFgGcrsa%])/g, (all, key, flags, width, prec, type) => {
      if (type === '%') return '%';
      let v = key ? this.getItem(args, key.slice(1, -1)) : vals[i++];
      let spec = '';
      if (flags.includes('-')) spec += '<'; else if (width) spec += '>';
      if (flags.includes('+')) spec += '+';
      if (flags.includes('0') && !flags.includes('-')) spec = '0' + spec.replace('>', '');
      if (width) spec += width; if (prec) spec += '.' + prec;
      if (type === 's') return this.format(this.str(v), spec.replace(/\.\d+/, '') );
      if (type === 'r') return this.format(this.repr(v), spec);
      if (type === 'i' || type === 'u') type = 'd';
      return this.format(v, spec + type);
    });
  }
  compare(op, a, b) {
    switch (op) {
      case '==': return this.eq(a, b);
      case '!=': return !this.eq(a, b);
      case 'is': return a === b || (a === null && b === null);
      case 'is not': return !(a === b);
      case 'in': return this.contains(b, a);
      case 'not in': return !this.contains(b, a);
    }
    if (a && typeof a.pyCompare === 'function') { const r = a.pyCompare(op, b, this); if (r !== undefined) return r; }
    if (isNum(a) && isNum(b)) { const x = num(a), y = num(b); return op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y; }
    if (typeof a === 'string' && typeof b === 'string') return op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
    if ((Array.isArray(a) && Array.isArray(b)) || (a instanceof PyTuple && b instanceof PyTuple)) {
      const x = Array.isArray(a) ? a : a.items, y = Array.isArray(b) ? b : b.items;
      for (let i = 0; i < Math.min(x.length, y.length); i++) if (!this.eq(x[i], y[i])) return this.compare(op, x[i], y[i]);
      const d = x.length - y.length; return op === '<' ? d < 0 : op === '>' ? d > 0 : op === '<=' ? d <= 0 : d >= 0;
    }
    const names = { '<': 'lt', '>': 'gt', '<=': 'le', '>=': 'ge' };
    if (a instanceof PyObject) { const m = a.cls.lookup(`__${names[op]}__`); if (m) return this.truthy(this.call(m, [a, b])); }
    throw this.err('TypeError', `'${op}' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`);
  }
  eq(a, b) {
    if (a === b) return true;
    if (isNum(a) && isNum(b)) return num(a) === num(b);
    if (a === null || b === null) return false;
    if (typeof a === 'string' || typeof b === 'string') return false;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => this.eq(x, b[i]));
    if (a instanceof PyTuple && b instanceof PyTuple) return a.items.length === b.items.length && a.items.every((x, i) => this.eq(x, b.items[i]));
    if (a instanceof PyDict && b instanceof PyDict) return a.size === b.size && a.entries().every(([k, v]) => b.has(k) && this.eq(v, b.get(k)));
    if (a instanceof PyObject) { const m = a.cls.lookup('__eq__'); if (m) { const r = this.call(m, [a, b]); if (r !== this.NotImplemented) return this.truthy(r); } }
    if (a && typeof a.pyEq === 'function') return a.pyEq(b, this);
    return false;
  }
  contains(container, x) {
    if (typeof container === 'string') return container.includes(this.str(x));
    if (Array.isArray(container)) return container.some((y) => this.eq(y, x));
    if (container instanceof PyTuple) return container.items.some((y) => this.eq(y, x));
    if (container instanceof PyDict || container instanceof PySet) return container.has(x);
    if (container instanceof PyRange) return container.toArray().includes(num(x));
    if (container instanceof PyObject) { const m = container.cls.lookup('__contains__'); if (m) return this.truthy(this.call(m, [container, x])); }
    if (container instanceof PyClass && container.isEnum) return container.members.includes(x);
    return this.iterate(container).some((y) => this.eq(y, x));
  }
  truthy(v) {
    if (v === null || v === false || v === undefined) return false;
    if (v === true) return true;
    if (typeof v === 'number') return v !== 0;
    if (v instanceof PyFloat) return v.v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof PyTuple) return v.items.length > 0;
    if (v instanceof PyDict) return v.size > 0;
    if (v instanceof PySet) return v.map.size > 0;
    if (v instanceof PyObject) { const b = v.cls.lookup('__bool__'); if (b) return this.truthy(this.call(b, [v])); const l = v.cls.lookup('__len__'); if (l) return num(this.call(l, [v])) > 0; return true; }
    if (v && typeof v.pyTruthy === 'function') return v.pyTruthy(this);
    return true;
  }
  // ---------------- items & iteration
  index(seq, i) { let n = num(i); if (!Number.isInteger(n)) throw this.err('TypeError', 'indices must be integers'); if (n < 0) n += seq.length; if (n < 0 || n >= seq.length) throw this.err('IndexError', `${typeName(seq)} index out of range`); return n; }
  sliceIdx(len, s) {
    const step = s.step === null ? 1 : num(s.step);
    const norm = (v, d) => { if (v === null) return d; let n = num(v); if (n < 0) n += len; return step > 0 ? Math.min(Math.max(n, 0), len) : Math.min(Math.max(n, -1), len - 1); };
    const start = norm(s.start, step > 0 ? 0 : len - 1), stop = norm(s.stop, step > 0 ? len : -1);
    const out = []; if (step > 0) for (let i = start; i < stop; i += step) out.push(i); else for (let i = start; i > stop; i += step) out.push(i);
    return out;
  }
  getItem(o, k) {
    if (o && typeof o.pyGetItem === 'function') return o.pyGetItem(k, this);
    if (o instanceof PyDict) { const v = o.get(k); if (v === undefined) { if (o.defaultFactory) { const d = this.call(o.defaultFactory, []); o.set(k, d); return d; } throw this.err('KeyError', this.repr(k)); } return v; }
    const seq = Array.isArray(o) ? o : o instanceof PyTuple ? o.items : typeof o === 'string' ? o : null;
    if (seq !== null) {
      if (k instanceof PySlice) { const idx = this.sliceIdx(seq.length, k); const items = idx.map((i) => seq[i]); return typeof o === 'string' ? items.join('') : Array.isArray(o) ? items : new PyTuple(items); }
      return seq[this.index(seq, k)];
    }
    if (o instanceof PyObject) { const m = o.cls.lookup('__getitem__'); if (m) return this.call(m, [o, k]); }
    if (o instanceof PyClass) { if (o.isEnum) { const m = o.members.find((x) => x.attrs.get('name') === k); if (!m) throw this.err('KeyError', this.repr(k)); return m; } return o; }
    if (o && o.pySubscriptable) return o;
    throw this.err('TypeError', `'${typeName(o)}' object is not subscriptable`);
  }
  setItem(o, k, v) {
    if (o && typeof o.pySetItem === 'function') return o.pySetItem(k, v, this);
    if (o instanceof PyDict) { o.set(k, v); return; }
    if (Array.isArray(o)) {
      if (k instanceof PySlice) { const idx = this.sliceIdx(o.length, k); const vals = this.iterate(v); if (num(k.step ?? 1) === 1) { o.splice(idx[0] ?? (k.start === null ? 0 : num(k.start)), idx.length, ...vals); } else idx.forEach((i, j) => { o[i] = vals[j]; }); return; }
      o[this.index(o, k)] = v; return;
    }
    if (o instanceof PyObject) { const m = o.cls.lookup('__setitem__'); if (m) { this.call(m, [o, k, v]); return; } }
    throw this.err('TypeError', `'${typeName(o)}' object does not support item assignment`);
  }
  iterate(o) {
    if (Array.isArray(o)) return [...o];
    if (o instanceof PyTuple) return [...o.items];
    if (typeof o === 'string') return [...o];
    if (o instanceof PyDict) return o.keys();
    if (o instanceof PySet) return o.values();
    if (o instanceof PyRange) return o.toArray();
    if (o instanceof PyClass && o.isEnum) return [...o.members];
    if (o && typeof o.pyIter === 'function') return o.pyIter(this);
    if (o instanceof PyObject) {
      const it = o.cls.lookup('__iter__');
      if (it) { const r = this.call(it, [o]); if (r !== o) return this.iterate(r); const out = []; const nx = o.cls.lookup('__next__'); for (;;) { try { out.push(this.call(nx, [o])); } catch (e) { if (e instanceof PyException && e.pyType === 'StopIteration') break; throw e; } } return out; }
      const gi = o.cls.lookup('__getitem__'); if (gi) { const out = []; for (let i = 0; ; i++) { try { out.push(this.call(gi, [o, i])); } catch (e) { if (e instanceof PyException && (e.pyType === 'IndexError' || e.pyType === 'StopIteration')) break; throw e; } } return out; }
    }
    throw this.err('TypeError', `'${typeName(o)}' object is not iterable`);
  }
  toDict(v) { if (v instanceof PyDict) return v; if (v instanceof PyObject) { const keys = this.iterate(this.callMethod(v, 'keys', [])); return new PyDict(keys.map((k) => [k, this.getItem(v, k)])); } throw this.err('TypeError', `'${typeName(v)}' object is not a mapping`); }
  // ---------------- str / repr
  str(v) {
    if (typeof v === 'string') return v;
    if (v instanceof PyObject) {
      const s = v.cls.lookup('__str__'); if (s instanceof PyFunction) return this.call(s, [v]);
      if (v.enumMember) return `${v.cls.name}.${v.attrs.get('name')}`;
      if (v.cls.isException) { const a = v.attrs.get('args'); return a && a.items.length === 1 ? this.str(a.items[0]) : a && a.items.length ? this.repr(a) : ''; }
    }
    return this.repr(v);
  }
  repr(v) {
    if (v === null) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'number') return String(v);
    if (v instanceof PyFloat) return floatRepr(v.v);
    if (typeof v === 'string') return strRepr(v);
    if (Array.isArray(v)) return '[' + v.map((x) => this.repr(x)).join(', ') + ']';
    if (v instanceof PyTuple) return v.items.length === 1 ? `(${this.repr(v.items[0])},)` : '(' + v.items.map((x) => this.repr(x)).join(', ') + ')';
    if (v instanceof PyDict) return '{' + v.entries().map(([k, x]) => `${this.repr(k)}: ${this.repr(x)}`).join(', ') + '}';
    if (v instanceof PySet) return v.map.size ? '{' + v.values().map((x) => this.repr(x)).join(', ') + '}' : 'set()';
    if (v instanceof PyRange) return `range(${v.start}, ${v.stop}${v.step !== 1 ? ', ' + v.step : ''})`;
    if (v instanceof PyObject) {
      const r = v.cls.lookup('__repr__'); if (r instanceof PyFunction) return this.call(r, [v]);
      if (v.enumMember) return `<${v.cls.name}.${v.attrs.get('name')}: ${this.repr(v.attrs.get('value'))}>`;
      if (v.cls.dataclassFields) return `${v.cls.name}(${v.cls.dataclassFields.map((fld) => `${fld}=${this.repr(v.attrs.get(fld))}`).join(', ')})`;
      if (v.cls.isException) return `${v.cls.name}(${(v.attrs.get('args')?.items ?? []).map((x) => this.repr(x)).join(', ')})`;
      return `<__main__.${v.cls.name} object>`;
    }
    if (v instanceof PyClass) return `<class '${v.builtinType ? v.name : '__main__.' + v.name}'>`;
    if (v instanceof PyFunction) return `<function ${v.name}>`;
    if (v instanceof PyBuiltin) return `<built-in function ${v.name}>`;
    if (v instanceof PyBoundMethod) return `<bound method ${v.func.name}>`;
    if (v instanceof PyModule) return `<module '${v.name}'>`;
    if (v && typeof v.pyRepr === 'function') return v.pyRepr(this);
    return String(v);
  }
  importModule(name) {
    if (this.moduleCache.has(name)) return this.moduleCache.get(name);
    const factory = this.moduleFactories[name];
    if (!factory) throw this.err('ModuleNotFoundError', `No module named '${name}'`);
    const mod = factory(this); this.moduleCache.set(name, mod); return mod;
  }
}

function containsYield(body) {
  const walk = (n) => {
    if (!n || typeof n !== 'object') return false;
    if (Array.isArray(n)) return n.some(walk);
    if (n.t === 'Yield') return true;
    if (n.t === 'FunctionDef' || n.t === 'ClassDef' || n.t === 'Lambda') return false;
    return Object.values(n).some(walk);
  };
  return walk(body);
}

export function strRepr(s) {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = q;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === '\\') out += '\\\\';
    else if (ch === q) out += '\\' + q;
    else if (ch === '\n') out += '\\n';
    else if (ch === '\t') out += '\\t';
    else if (ch === '\r') out += '\\r';
    else if (c < 32 || c === 127) out += '\\x' + c.toString(16).padStart(2, '0');
    else out += ch;
  }
  return out + q;
}

function numBinop(I, op, a, b) {
  const fl = isFloat(a) || isFloat(b);
  const x = num(a), y = num(b);
  const wrap = (v) => (fl ? f(v) : v);
  switch (op) {
    case '+': return wrap(x + y);
    case '-': return wrap(x - y);
    case '*': return wrap(x * y);
    case '/': if (y === 0) throw I.err('ZeroDivisionError', 'division by zero'); return f(x / y);
    case '//': if (y === 0) throw I.err('ZeroDivisionError', 'integer division or modulo by zero'); return wrap(Math.floor(x / y));
    case '%': { if (y === 0) throw I.err('ZeroDivisionError', 'modulo by zero'); let r = x % y; if (r !== 0 && (r < 0) !== (y < 0)) r += y; return wrap(r); }
    case '**': { if (!fl && y < 0) return f(x ** y); const r = x ** y; if (!fl && !Number.isSafeInteger(r)) return Number(BigInt(x) ** BigInt(y)); return wrap(r); }
    case '&': return x & y; case '|': return x | y; case '^': return x ^ y;
    case '<<': return x * 2 ** y; case '>>': return Math.floor(x / 2 ** y);
  }
  throw I.err('TypeError', `unsupported operand ${op}`);
}

// ---------------- builtins
function kw(kwargs, name, d) { return kwargs.has(name) ? kwargs.get(name) : d; }
function installBuiltins(I) {
  const B = (name, fn) => I.builtins.set(name, new PyBuiltin(name, fn));
  const cls = (name, bases = [], meta = {}) => { const c = new PyClass(name, bases, new Map(), { builtinType: true, ...meta }); I.builtins.set(name, c); return c; };
  const object = cls('object');
  I.NotImplemented = { pyTypeName: 'NotImplementedType', pyRepr: () => 'NotImplemented' }; I.builtins.set('NotImplemented', I.NotImplemented);
  const baseExc = cls('BaseException', [object], { isException: true });
  const exc = cls('Exception', [baseExc], { isException: true });
  const mk = (n, p = exc) => cls(n, [p], { isException: true });
  const lookup = mk('LookupError'); mk('KeyError', lookup); mk('IndexError', lookup);
  for (const n of ['TypeError', 'ValueError', 'AttributeError', 'NameError', 'RuntimeError', 'ZeroDivisionError', 'AssertionError', 'StopIteration', 'ImportError', 'OSError', 'ArithmeticError', 'OverflowError', 'FrozenInstanceError']) mk(n);
  mk('NotImplementedError', I.builtins.get('RuntimeError')); mk('RecursionError', I.builtins.get('RuntimeError')); mk('ModuleNotFoundError', I.builtins.get('ImportError'));
  for (const c of I.builtins.values()) if (c instanceof PyClass && c.isException) c.dict.set('__init__', new PyBuiltin('__init__', ([self, ...args]) => { self.attrs.set('args', new PyTuple(args)); return null; }));
  // type objects
  const typeObj = (name, conv, test) => { const c = cls(name, [object]); c.pyNew = conv; c.test = test; return c; };
  typeObj('int', (a, k) => { const v = a[0] ?? 0; if (typeof v === 'string') { const base = a[1] ?? 10; const n = parseInt(v.trim().replace(/_/g, ''), num(base)); if (Number.isNaN(n)) throw I.err('ValueError', `invalid literal for int() with base ${base}: ${strRepr(v)}`); return n; } if (v instanceof PyObject) return I.callMethod(v, '__int__', []); return Math.trunc(num(v)); }, (x) => typeof x === 'number' || typeof x === 'boolean');
  typeObj('float', (a) => { const v = a[0] ?? 0; if (typeof v === 'string') { const t = v.trim().toLowerCase(); const n = t === 'inf' || t === 'infinity' ? Infinity : t === '-inf' ? -Infinity : t === 'nan' ? NaN : Number(t); if (Number.isNaN(n) && t !== 'nan') throw I.err('ValueError', `could not convert string to float: ${strRepr(v)}`); return f(n); } if (v instanceof PyObject) return I.callMethod(v, '__float__', []); if (v && typeof v.pyFloat === 'function') return f(v.pyFloat()); return f(num(v)); }, (x) => x instanceof PyFloat);
  typeObj('str', (a) => (a.length ? I.str(a[0]) : ''), (x) => typeof x === 'string');
  typeObj('bool', (a) => (a.length ? I.truthy(a[0]) : false), (x) => typeof x === 'boolean');
  typeObj('list', (a) => (a.length ? I.iterate(a[0]) : []), (x) => Array.isArray(x));
  typeObj('tuple', (a) => new PyTuple(a.length ? I.iterate(a[0]) : []), (x) => x instanceof PyTuple);
  typeObj('dict', (a, k) => { const d = new PyDict(); if (a.length) { if (a[0] instanceof PyDict) for (const [x, y] of a[0].entries()) d.set(x, y); else for (const p of I.iterate(a[0])) { const [x, y] = I.iterate(p); d.set(x, y); } } for (const [x, y] of k) d.set(x, y); return d; }, (x) => x instanceof PyDict);
  typeObj('set', (a) => new PySet(a.length ? I.iterate(a[0]) : []), (x) => x instanceof PySet);
  typeObj('frozenset', (a) => new PySet(a.length ? I.iterate(a[0]) : []), (x) => x instanceof PySet);
  B('print', (args, k) => { const sep = kw(k, 'sep', ' '), end = kw(k, 'end', '\n'); I.write(args.map((x) => I.str(x)).join(sep ?? ' ') + (end ?? '\n')); return null; });
  B('len', ([x]) => { if (typeof x === 'string' || Array.isArray(x)) return x.length; if (x instanceof PyTuple) return x.items.length; if (x instanceof PyDict) return x.size; if (x instanceof PySet) return x.map.size; if (x instanceof PyRange) return x.toArray().length; if (x instanceof PyClass && x.isEnum) return x.members.length; if (x && typeof x.pyLen === 'function') return x.pyLen(); if (x instanceof PyObject) return num(I.callMethod(x, '__len__', [])); throw I.err('TypeError', `object of type '${typeName(x)}' has no len()`); });
  B('range', (a) => { const n = a.map(num); return n.length === 1 ? new PyRange(0, n[0], 1) : new PyRange(n[0], n[1], n[2] ?? 1); });
  B('repr', ([x]) => I.repr(x));
  B('abs', ([x]) => { if (x && typeof x.pyUnary === 'function') return x.pyUnary('abs', I); return isFloat(x) ? f(Math.abs(x.v)) : Math.abs(num(x)); });
  B('round', ([x, n]) => {
    if (x && x.pyRound) return x.pyRound(n);
    const v = num(x);
    if (n === undefined || n === null) { const r = Math.round(v); return (Math.abs(v % 1) === 0.5 && r % 2 !== 0) ? r - 1 : r; }
    const d = num(n); const s = Number(v.toFixed(Math.max(0, Math.min(100, d))));
    return isFloat(x) ? f(d >= 0 ? s : Math.round(v / 10 ** -d) * 10 ** -d) : (d >= 0 ? v : Math.round(v / 10 ** -d) * 10 ** -d);
  });
  B('sum', ([it, start], k) => { let acc = start ?? kw(k, 'start', 0); for (const x of I.iterate(it)) acc = I.binop('+', acc, x); return acc; });
  const minmax = (cmp) => (args, k) => {
    const key = kw(k, 'key', null); const items = args.length === 1 ? I.iterate(args[0]) : args;
    if (!items.length) { if (k.has('default')) return k.get('default'); throw I.err('ValueError', 'arg is an empty sequence'); }
    let best = items[0], bk = key ? I.call(key, [best]) : best;
    for (const x of items.slice(1)) { const xk = key ? I.call(key, [x]) : x; if (I.compare(cmp, xk, bk)) { best = x; bk = xk; } }
    return best;
  };
  B('min', minmax('<')); B('max', minmax('>'));
  B('sorted', ([it], k) => { const key = kw(k, 'key', null), rev = I.truthy(kw(k, 'reverse', false)); const items = I.iterate(it).map((x) => [key ? I.call(key, [x]) : x, x]); items.sort((p, q) => (I.compare('<', p[0], q[0]) ? -1 : I.compare('<', q[0], p[0]) ? 1 : 0)); if (rev) items.reverse(); return items.map((p) => p[1]); });
  B('reversed', ([it]) => I.iterate(it).reverse());
  B('enumerate', ([it, start]) => I.iterate(it).map((x, i) => new PyTuple([i + (start === undefined ? 0 : num(start)), x])));
  B('zip', (args) => { const ls = args.map((a) => I.iterate(a)); const n = Math.min(...ls.map((l) => l.length)); const out = []; for (let i = 0; i < n; i++) out.push(new PyTuple(ls.map((l) => l[i]))); return out; });
  B('map', ([fn, ...its]) => { const ls = its.map((a) => I.iterate(a)); const n = Math.min(...ls.map((l) => l.length)); const out = []; for (let i = 0; i < n; i++) out.push(I.call(fn, ls.map((l) => l[i]))); return out; });
  B('filter', ([fn, it]) => I.iterate(it).filter((x) => I.truthy(fn === null ? x : I.call(fn, [x]))));
  B('any', ([it]) => I.iterate(it).some((x) => I.truthy(x)));
  B('all', ([it]) => I.iterate(it).every((x) => I.truthy(x)));
  B('isinstance', ([x, t]) => { const ts = t instanceof PyTuple ? t.items : [t]; return ts.some((c) => (c.test ? c.test(x) || (c.name === 'int' && typeof x === 'boolean') : x instanceof PyObject && x.cls.isSubclassOf(c)) || (c.name === 'object')); });
  B('issubclass', ([a, t]) => { const ts = t instanceof PyTuple ? t.items : [t]; return ts.some((c) => a.isSubclassOf(c)); });
  B('type', ([x]) => { if (x instanceof PyObject) return x.cls; const n = typeName(x); return I.builtins.get(n) ?? I.builtins.get('object'); });
  B('hash', ([x]) => pyHash(I, x));
  B('id', ([x]) => (x && x.id) || 0);
  B('callable', ([x]) => x instanceof PyFunction || x instanceof PyBuiltin || x instanceof PyBoundMethod || x instanceof PyClass);
  B('getattr', ([o, n, d]) => { try { return I.getAttr(o, n); } catch (e) { if (d !== undefined && e instanceof PyException && e.pyType === 'AttributeError') return d; throw e; } });
  B('setattr', ([o, n, v]) => { I.setAttr(o, n, v); return null; });
  B('hasattr', ([o, n]) => { try { I.getAttr(o, n); return true; } catch (e) { if (e instanceof PyException) return false; throw e; } });
  B('format', ([v, spec]) => I.format(v, spec ?? ''));
  B('divmod', ([a, b]) => new PyTuple([I.binop('//', a, b), I.binop('%', a, b)]));
  B('pow', ([a, b, m]) => (m === undefined ? I.binop('**', a, b) : Number((BigInt(num(a)) ** BigInt(num(b))) % BigInt(num(m)))));
  B('chr', ([n]) => String.fromCodePoint(num(n)));
  B('ord', ([s]) => s.codePointAt(0));
  B('iter', ([x]) => I.iterate(x));
  B('next', ([x, d]) => { if (Array.isArray(x)) { if (x.length) return x.shift(); if (d !== undefined) return d; throw I.err('StopIteration', ''); } return I.callMethod(x, '__next__', []); });
  B('vars', ([o]) => new PyDict([...o.attrs]));
  B('input', () => { throw I.err('OSError', 'input() is not available in the sovereign sandbox'); });
  B('open', () => { throw I.err('OSError', 'open() is not available in the sovereign sandbox (no host file access)'); });
  B('staticmethod', ([fn]) => new PyStaticMethod(fn));
  B('classmethod', ([fn]) => new PyClassMethod(fn));
  B('property', ([fn]) => new PyProperty(fn));
  B('super', (args, k, ) => { throw I.err('RuntimeError', 'super() requires explicit arguments in this emulator: super(Class, self)'); });
  I.builtins.set('super', new PyBuiltin('super', ([c, self]) => ({
    pyTypeName: 'super',
    pyGetAttr: (name) => { const mro = (self instanceof PyClass ? self : self.cls).mro; const i = mro.indexOf(c); for (const k of mro.slice(i + 1)) if (k.dict.has(name)) return I.bindDescriptor(k.dict.get(name), self, self instanceof PyClass ? self : self.cls); return undefined; },
  })));
}

export function pyHash(I, x) {
  if (x === null) return 0x1f;
  if (typeof x === 'boolean') return x ? 1 : 0;
  if (typeof x === 'number') return x === -1 ? -2 : x;
  if (x instanceof PyFloat) { if (Number.isInteger(x.v)) return x.v === -1 ? -2 : x.v; return fold(fnv(String(x.v))); }
  if (typeof x === 'string') return fold(fnv(x));
  if (x instanceof PyTuple) { // CPython tuple hash (xxHash-derived), 64-bit, then folded to a safe integer
    const P1 = 11400714785074694791n, P2 = 14029467366897019727n, P5 = 2870177450012600261n, M = (1n << 64n) - 1n;
    let acc = P5;
    for (const it of x.items) { const lane = BigInt.asUintN(64, BigInt(pyHash(I, it))); acc = (acc + lane * P2) & M; acc = ((acc << 31n) | (acc >> 33n)) & M; acc = (acc * P1) & M; }
    acc = (acc + (BigInt(x.items.length) ^ (P5 ^ 3527539n))) & M;
    return fold(acc);
  }
  if (x instanceof PyObject) {
    const h = x.cls.lookup('__hash__'); if (h instanceof PyFunction) return num(I.call(h, [x]));
    if (x.enumMember) return pyHash(I, x.attrs.get('_name_'));
    return x.id;
  }
  if (x instanceof PyClass) return x.id;
  throw I.err('TypeError', `unhashable type: '${typeName(x)}'`);
}
function fnv(s) { let h = 0xcbf29ce484222325n; for (const ch of s) { h ^= BigInt(ch.codePointAt(0)); h = (h * 0x100000001b3n) & ((1n << 64n) - 1n); } return h; }
function fold(h) { const v = BigInt.asIntN(64, h); return Number(v % 9007199254740881n); }

// methods on builtin values
function builtinMethod(I, o, name) {
  const M = (fn) => new PyBuiltin(name, (args, k) => fn(args, k));
  if (typeof o === 'string') {
    const s = o;
    const t = {
      join: ([it]) => I.iterate(it).map((x) => { if (typeof x !== 'string') throw I.err('TypeError', `sequence item: expected str instance, ${typeName(x)} found`); return x; }).join(s),
      lower: () => s.toLowerCase(), upper: () => s.toUpperCase(), title: () => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()), capitalize: () => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
      strip: ([c]) => trim(s, c, 3), lstrip: ([c]) => trim(s, c, 1), rstrip: ([c]) => trim(s, c, 2),
      split: ([sep, max]) => { if (sep === undefined || sep === null) return s.trim().split(/\s+/).filter(Boolean); const parts = s.split(sep); if (max !== undefined && num(max) >= 0 && parts.length > num(max) + 1) return [...parts.slice(0, num(max)), parts.slice(num(max)).join(sep)]; return parts; },
      rsplit: ([sep]) => (sep == null ? s.trim().split(/\s+/) : s.split(sep)),
      splitlines: () => s.split(/\r?\n/).filter((x, i, a) => i < a.length - 1 || x !== ''),
      replace: ([a, b, c]) => { if (c === undefined) return s.split(a).join(b); let out = s, n = num(c), idx = 0; while (n-- > 0) { const p = out.indexOf(a, idx); if (p < 0) break; out = out.slice(0, p) + b + out.slice(p + a.length); idx = p + b.length; } return out; },
      startswith: ([p]) => (p instanceof PyTuple ? p.items.some((x) => s.startsWith(x)) : s.startsWith(p)), endswith: ([p]) => (p instanceof PyTuple ? p.items.some((x) => s.endsWith(x)) : s.endsWith(p)),
      find: ([p]) => s.indexOf(p), rfind: ([p]) => s.lastIndexOf(p), index: ([p]) => { const i = s.indexOf(p); if (i < 0) throw I.err('ValueError', 'substring not found'); return i; },
      count: ([p]) => (p === '' ? s.length + 1 : s.split(p).length - 1),
      format: (args, k) => { let i = 0; return s.replace(/\{\{|\}\}|\{([^{}:!]*)(![rs])?(?::([^{}]*))?\}/g, (all, key, conv, spec) => { if (all === '{{') return '{'; if (all === '}}') return '}'; let v; if (key === '') v = args[i++]; else if (/^\d+$/.test(key)) v = args[Number(key)]; else { const [base, ...rest] = key.split('.'); v = k.get(base); for (const r of rest) v = I.getAttr(v, r); } if (conv === '!r') v = I.repr(v); return I.format(v, spec ?? ''); }); },
      isdigit: () => /^\d+$/.test(s), isalpha: () => /^[A-Za-z]+$/.test(s), isalnum: () => /^[A-Za-z0-9]+$/.test(s), isspace: () => /^\s+$/.test(s), isupper: () => /[A-Z]/.test(s) && s === s.toUpperCase(), islower: () => /[a-z]/.test(s) && s === s.toLowerCase(),
      zfill: ([w]) => s.padStart(num(w), '0'), center: ([w, c]) => I.format(s, `${c ?? ' '}^${num(w)}`), ljust: ([w, c]) => s.padEnd(num(w), c ?? ' '), rjust: ([w, c]) => s.padStart(num(w), c ?? ' '),
      encode: () => ({ pyTypeName: 'bytes', bytes: new TextEncoder().encode(s), pyRepr() { return `b${strRepr(s)}`; } }),
    };
    if (t[name]) return M(t[name]);
  }
  if (Array.isArray(o)) {
    const t = {
      append: ([x]) => { o.push(x); return null; }, extend: ([x]) => { o.push(...I.iterate(x)); return null; }, insert: ([i, x]) => { o.splice(num(i) < 0 ? Math.max(0, o.length + num(i)) : num(i), 0, x); return null; },
      pop: ([i]) => { if (!o.length) throw I.err('IndexError', 'pop from empty list'); const idx = i === undefined ? o.length - 1 : I.index(o, i); return o.splice(idx, 1)[0]; },
      remove: ([x]) => { const i = o.findIndex((y) => I.eq(y, x)); if (i < 0) throw I.err('ValueError', 'list.remove(x): x not in list'); o.splice(i, 1); return null; },
      index: ([x]) => { const i = o.findIndex((y) => I.eq(y, x)); if (i < 0) throw I.err('ValueError', `${I.repr(x)} is not in list`); return i; },
      count: ([x]) => o.filter((y) => I.eq(y, x)).length, reverse: () => { o.reverse(); return null; }, clear: () => { o.length = 0; return null; }, copy: () => [...o],
      sort: (a, k) => { const sorted = I.call(I.builtins.get('sorted'), [o], k); o.splice(0, o.length, ...sorted); return null; },
    };
    if (t[name]) return M(t[name]);
  }
  if (o instanceof PyTuple) { const t = { index: ([x]) => o.items.findIndex((y) => I.eq(y, x)), count: ([x]) => o.items.filter((y) => I.eq(y, x)).length }; if (t[name]) return M(t[name]); }
  if (o instanceof PyDict) {
    const t = {
      get: ([k, d]) => { const v = o.get(k); return v === undefined ? (d === undefined ? null : d) : v; },
      items: () => o.entries().map(([k, v]) => new PyTuple([k, v])), keys: () => o.keys(), values: () => o.values(),
      update: ([x], k) => { if (x !== undefined) for (const [a, b] of I.toDict(x).entries()) o.set(a, b); for (const [a, b] of k) o.set(a, b); return null; },
      setdefault: ([k, d]) => { if (!o.has(k)) o.set(k, d ?? null); return o.get(k); },
      pop: ([k, d]) => { const v = o.get(k); if (v === undefined) { if (d !== undefined) return d; throw I.err('KeyError', I.repr(k)); } o.delete(k); return v; },
      copy: () => new PyDict(o.entries()), clear: () => { o.map.clear(); return null; },
    };
    if (t[name]) return M(t[name]);
  }
  if (o instanceof PySet) { const t = { add: ([x]) => { o.add(x); return null; }, update: ([x]) => { for (const y of I.iterate(x)) o.add(y); return null; }, discard: ([x]) => { o.map.delete(hashKey(x)); return null; }, remove: ([x]) => { if (!o.has(x)) throw I.err('KeyError', I.repr(x)); o.map.delete(hashKey(x)); return null; }, union: ([x]) => new PySet([...o.values(), ...I.iterate(x)]), intersection: ([x]) => { const b = new PySet(I.iterate(x)); return new PySet(o.values().filter((y) => b.has(y))); } }; if (t[name]) return M(t[name]); }
  if (o instanceof PyFloat || typeof o === 'number') { const t = { is_integer: () => Number.isInteger(num(o)), conjugate: () => o, __round__: ([n]) => I.call(I.builtins.get('round'), [o, n]) }; if (name === 'real') return o; if (name === 'imag') return 0; if (t[name]) return M(t[name]); }
  return null;
}
function trim(s, chars, mode) {
  const set = chars == null ? null : new Set(chars);
  const isT = (c) => (set ? set.has(c) : /\s/.test(c));
  let a = 0, b = s.length;
  if (mode & 1) while (a < b && isT(s[a])) a++;
  if (mode & 2) while (b > a && isT(s[b - 1])) b--;
  return s.slice(a, b);
}
export { PyException };
