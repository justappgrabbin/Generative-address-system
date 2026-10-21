// Python object model in plain JS (no host APIs).
export class PyFloat { constructor(v) { this.v = v; } valueOf() { return this.v; } }
export class PyTuple { constructor(items) { this.items = items; Object.freeze(this.items); } }
export class PyException extends Error {
  constructor(type, message, pyValue = null) { super(message); this.pyType = type; this.pyValue = pyValue; }
}
export class PyDict {
  constructor(entries = []) { this.map = new Map(); for (const [k, v] of entries) this.set(k, v); }
  set(k, v) { const key = hashKey(k); const e = this.map.get(key); if (e) e[1] = v; else this.map.set(key, [k, v]); }
  get(k) { const e = this.map.get(hashKey(k)); return e ? e[1] : undefined; }
  has(k) { return this.map.has(hashKey(k)); }
  delete(k) { return this.map.delete(hashKey(k)); }
  keys() { return [...this.map.values()].map((e) => e[0]); }
  values() { return [...this.map.values()].map((e) => e[1]); }
  entries() { return [...this.map.values()]; }
  get size() { return this.map.size; }
}
export class PySet {
  constructor(items = []) { this.map = new Map(); for (const x of items) this.add(x); }
  add(x) { this.map.set(hashKey(x), x); }
  has(x) { return this.map.has(hashKey(x)); }
  values() { return [...this.map.values()]; }
}
let objectIds = 0;
export class PyObject { constructor(cls) { this.cls = cls; this.attrs = new Map(); this.id = ++objectIds; } }
export class PyClass {
  constructor(name, bases, dict, meta = {}) {
    this.name = name; this.bases = bases; this.dict = dict; this.id = ++objectIds; Object.assign(this, meta);
    this.mro = computeMro(this);
  }
  lookup(name) { for (const c of this.mro) if (c.dict.has(name)) return c.dict.get(name); return undefined; }
  isSubclassOf(other) { return this.mro.includes(other); }
}
function computeMro(cls) {
  const out = [cls];
  for (const b of cls.bases) for (const c of b.mro) if (!out.includes(c)) out.push(c);
  return out;
}
export class PyFunction {
  constructor(name, params, body, closure, interp, opts = {}) { this.name = name; this.params = params; this.body = body; this.closure = closure; this.interp = interp; Object.assign(this, opts); }
}
export class PyBuiltin { constructor(name, fn) { this.name = name; this.fn = fn; } }
export class PyBoundMethod { constructor(self, func) { this.self = self; this.func = func; } }
export class PyStaticMethod { constructor(func) { this.func = func; } }
export class PyClassMethod { constructor(func) { this.func = func; } }
export class PyProperty { constructor(fget) { this.fget = fget; } }
export class PyModule { constructor(name, attrs = {}) { this.name = name; this.attrs = new Map(Object.entries(attrs)); } }
export class PySlice { constructor(start, stop, step) { this.start = start; this.stop = stop; this.step = step; } }

export const isFloat = (x) => x instanceof PyFloat;
export const num = (x) => (x instanceof PyFloat ? x.v : typeof x === 'boolean' ? (x ? 1 : 0) : x);
export const isNum = (x) => typeof x === 'number' || x instanceof PyFloat || typeof x === 'boolean';
export const f = (v) => new PyFloat(v);

export function hashKey(k) {
  if (k === null) return 'N';
  if (typeof k === 'boolean') return 'n' + (k ? 1 : 0);
  if (typeof k === 'number') return 'n' + k;
  if (k instanceof PyFloat) return 'n' + k.v;
  if (typeof k === 'string') return 's' + k;
  if (k instanceof PyTuple) return 't(' + k.items.map(hashKey).join(',') + ')';
  if (k instanceof PyObject || k instanceof PyClass) {
    const h = k instanceof PyObject && k.cls.hashKeyFn ? k.cls.hashKeyFn(k) : null;
    return h ?? ('o' + k.id);
  }
  if (k instanceof PyFunction || k instanceof PyBuiltin) return 'f' + (k.id ??= ++objectIds);
  throw new PyException('TypeError', `unhashable type: '${typeName(k)}'`);
}
export function typeName(x) {
  if (x === null) return 'NoneType';
  if (typeof x === 'boolean') return 'bool';
  if (typeof x === 'number') return 'int';
  if (x instanceof PyFloat) return 'float';
  if (typeof x === 'string') return 'str';
  if (Array.isArray(x)) return 'list';
  if (x instanceof PyTuple) return 'tuple';
  if (x instanceof PyDict) return 'dict';
  if (x instanceof PySet) return 'set';
  if (x instanceof PyObject) return x.cls.name;
  if (x instanceof PyClass) return 'type';
  if (x instanceof PyFunction || x instanceof PyBuiltin || x instanceof PyBoundMethod) return 'function';
  if (x instanceof PyModule) return 'module';
  if (x && x.pyTypeName) return x.pyTypeName;
  return 'object';
}

// Python float repr (shortest round-trip, Python exponent rules)
export function floatRepr(v) {
  if (Number.isNaN(v)) return 'nan';
  if (v === Infinity) return 'inf';
  if (v === -Infinity) return '-inf';
  if (v === 0) return Object.is(v, -0) ? '-0.0' : '0.0';
  const exp = Math.floor(Math.log10(Math.abs(v)));
  let s = String(v);
  const needsExp = Math.abs(v) >= 1e16 || Math.abs(v) < 1e-4;
  if (needsExp) {
    let e = v.toExponential(); // shortest digits
    let [mant, ex] = e.split('e');
    const sign = ex[0] === '-' ? '-' : '+';
    ex = ex.replace(/^[+-]/, '');
    if (ex.length < 2) ex = '0' + ex;
    return `${mant}e${sign}${ex}`;
  }
  if (s.includes('e')) s = v.toFixed(Math.max(0, -exp + 16)).replace(/0+$/, '');
  if (!s.includes('.')) s += '.0';
  return s;
}
