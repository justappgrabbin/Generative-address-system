// Pure-JS shims for the stdlib/numpy subset donor sources use. No host I/O, no network.
import { PyFloat, PyTuple, PyDict, PyObject, PyClass, PyBuiltin, PyModule, PySlice, PyException, isNum, num, f, isFloat, floatRepr } from './objects.mjs';
import { PyRange } from './interpreter.mjs';

const B = (name, fn) => new PyBuiltin(name, fn);
const fl = (x) => (x instanceof PyFloat ? x : f(num(x)));

// numpy-compatible pairwise summation (matches numpy's pairwise_sum for float64)
export function pairwiseSum(a, lo = 0, n = a.length) {
  if (n < 8) { let r = 0; for (let i = 0; i < n; i++) r += a[lo + i]; return r === 0 && n === 0 ? 0 : r; }
  if (n <= 128) {
    const r = [a[lo], a[lo + 1], a[lo + 2], a[lo + 3], a[lo + 4], a[lo + 5], a[lo + 6], a[lo + 7]];
    let i; for (i = 8; i < n - (n % 8); i += 8) for (let j = 0; j < 8; j++) r[j] += a[lo + i + j];
    let res = ((r[0] + r[1]) + (r[2] + r[3])) + ((r[4] + r[5]) + (r[6] + r[7]));
    for (; i < n; i++) res += a[lo + i];
    return res;
  }
  let n2 = Math.floor(n / 2); n2 -= n2 % 8;
  return pairwiseSum(a, lo, n2) + pairwiseSum(a, lo + n2, n - n2);
}
const dot = (x, y) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * y[i]; return s; };

export class NDArray {
  constructor(data, dtype = 'float64') { this.data = data; this.dtype = dtype; this.pyTypeName = 'ndarray'; }
  box(v) { return this.dtype === 'int64' ? v : this.dtype === 'bool' ? !!v : f(v); }
  pyLen() { return this.data.length; }
  pyIter() { return this.data.map((v) => this.box(v)); }
  pyGetItem(k, I) {
    if (k instanceof PySlice) return new NDArray(I.sliceIdx(this.data.length, k).map((i) => this.data[i]), this.dtype);
    if (k instanceof NDArray) return new NDArray(k.dtype === 'bool' ? this.data.filter((_, i) => k.data[i]) : k.data.map((i) => this.data[i]), this.dtype);
    return this.box(this.data[I.index(this.data, k)]);
  }
  pySetItem(k, v, I) {
    if (k instanceof PySlice) { const idx = I.sliceIdx(this.data.length, k); const vals = v instanceof NDArray ? v.data : idx.map(() => num(v)); idx.forEach((i, j) => { this.data[i] = vals[j]; }); return; }
    this.data[I.index(this.data, k)] = num(v);
  }
  pyBinop(op, other, reflected, I) {
    const ops = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '**': (a, b) => a ** b, '//': (a, b) => Math.floor(a / b), '%': (a, b) => { const r = a % b; return r !== 0 && (r < 0) !== (b < 0) ? r + b : r; } };
    if (op === '@') return f(dot(this.data, other.data));
    const fn = ops[op]; if (!fn) return undefined;
    const o = other instanceof NDArray ? other.data : Array.isArray(other) ? other.map(num) : null;
    if (o === null && !isNum(other)) return undefined;
    const outType = op === '/' || this.dtype === 'float64' || (other instanceof NDArray && other.dtype === 'float64') || isFloat(other) ? 'float64' : 'int64';
    const s = o === null ? num(other) : null;
    return new NDArray(this.data.map((v, i) => { const b = o ? o[i] : s; return reflected ? fn(b, v) : fn(v, b); }), outType);
  }
  pyCompare(op, other) {
    const o = other instanceof NDArray ? other.data : null, s = o ? null : num(other);
    const fn = { '<': (a, b) => a < b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '>=': (a, b) => a >= b }[op];
    return new NDArray(this.data.map((v, i) => (fn(v, o ? o[i] : s) ? 1 : 0)), 'bool');
  }
  pyUnary(op) { if (op === '-') return new NDArray(this.data.map((v) => -v), this.dtype); if (op === 'abs') return new NDArray(this.data.map(Math.abs), this.dtype); return this; }
  pyTruthy(I) { if (this.data.length === 1) return !!this.data[0]; throw new PyException('ValueError', 'The truth value of an array with more than one element is ambiguous. Use a.any() or a.all()'); }
  pyGetAttr(name) {
    const self = this;
    switch (name) {
      case 'shape': return new PyTuple([this.data.length]);
      case 'size': return this.data.length;
      case 'ndim': return 1;
      case 'T': return this;
      case 'dtype': return this.dtype;
      case 'sum': return B('sum', () => self.box(pairwiseSum(self.data)));
      case 'mean': return B('mean', () => f(pairwiseSum(self.data) / self.data.length));
      case 'max': return B('max', () => self.box(Math.max(...self.data)));
      case 'min': return B('min', () => self.box(Math.min(...self.data)));
      case 'argmax': return B('argmax', () => self.data.indexOf(Math.max(...self.data)));
      case 'argmin': return B('argmin', () => self.data.indexOf(Math.min(...self.data)));
      case 'copy': return B('copy', () => new NDArray([...self.data], self.dtype));
      case 'tolist': return B('tolist', () => self.data.map((v) => self.box(v)));
      case 'dot': return B('dot', ([o]) => f(dot(self.data, o.data)));
      case 'astype': return B('astype', ([t]) => new NDArray(self.data.map((v) => (t === 'int' || t?.name === 'int' ? Math.trunc(v) : v)), t === 'int' || t?.name === 'int' ? 'int64' : 'float64'));
      case 'any': return B('any', () => self.data.some(Boolean));
      case 'all': return B('all', () => self.data.every(Boolean));
      case 'std': return B('std', () => { const m = pairwiseSum(self.data) / self.data.length; return f(Math.sqrt(pairwiseSum(self.data.map((v) => (v - m) ** 2)) / self.data.length)); });
      case 'round': return B('round', ([d]) => new NDArray(self.data.map((v) => Number(v.toFixed(num(d ?? 0)))), self.dtype));
    }
    return undefined;
  }
  pyRepr() { return `array([${this.data.map((v) => (this.dtype === 'float64' ? npFloat(v) : String(v))).join(', ')}])`; }
  pyRound(n) { return new NDArray(this.data.map((v) => Number(v.toFixed(num(n ?? 0)))), this.dtype); }
}
function npFloat(v) { const s = floatRepr(v); return s.endsWith('.0') ? s.slice(0, -1) : s; }
const toArr = (I, x) => (x instanceof NDArray ? x.data : I.iterate(x).map(num));
const elementwise = (fn) => (I) => B('ufunc', ([x]) => (x instanceof NDArray ? new NDArray(x.data.map(fn)) : Array.isArray(x) ? new NDArray(x.map((v) => fn(num(v)))) : f(fn(num(x)))));

function numpyModule(I) {
  const m = {
    pi: f(Math.PI), e: f(Math.E), inf: f(Infinity), nan: f(NaN), newaxis: null,
    ndarray: new PyClass('ndarray', [], new Map(), { builtinType: true, test: (x) => x instanceof NDArray }),
    float64: B('float64', ([x]) => f(num(x))), int64: B('int64', ([x]) => Math.trunc(num(x))), float32: B('float32', ([x]) => f(Math.fround(num(x)))),
    zeros: B('zeros', ([n]) => new NDArray(new Array(n instanceof PyTuple ? num(n.items[0]) : num(n)).fill(0))),
    ones: B('ones', ([n]) => new NDArray(new Array(n instanceof PyTuple ? num(n.items[0]) : num(n)).fill(1))),
    full: B('full', ([n, v]) => new NDArray(new Array(num(n)).fill(num(v)))),
    zeros_like: B('zeros_like', ([a]) => new NDArray(new Array(a.data.length).fill(0))),
    array: B('array', ([x], k) => { if (x instanceof NDArray) return new NDArray([...x.data], x.dtype); const items = I.iterate(x); const isInt = items.every((v) => typeof v === 'number' || typeof v === 'boolean'); const dt = k.get('dtype'); return new NDArray(items.map(num), dt ? (dt.name === 'int' ? 'int64' : 'float64') : isInt ? 'int64' : 'float64'); }),
    asarray: null,
    arange: B('arange', (a) => { const n = a.map(num); const [s, e, st] = n.length === 1 ? [0, n[0], 1] : [n[0], n[1], n[2] ?? 1]; const out = []; for (let v = s; st > 0 ? v < e : v > e; v += st) out.push(v); return new NDArray(out, a.some(isFloat) ? 'float64' : 'int64'); }),
    linspace: B('linspace', ([a, b, n], k) => { const N = n === undefined ? 50 : num(n); const ep = k.has('endpoint') ? I.truthy(k.get('endpoint')) : true; const div = ep ? N - 1 : N; const step = (num(b) - num(a)) / div; const out = []; for (let i = 0; i < N; i++) out.push(num(a) + i * step); if (ep && N > 1) out[N - 1] = num(b); return new NDArray(out); }),
    sum: B('sum', ([x]) => (x instanceof NDArray ? x.box(pairwiseSum(x.data)) : f(pairwiseSum(toArr(I, x))))),
    mean: B('mean', ([x]) => { const d = toArr(I, x); return f(pairwiseSum(d) / d.length); }),
    max: B('max', ([x]) => f(Math.max(...toArr(I, x)))), min: B('min', ([x]) => f(Math.min(...toArr(I, x)))),
    argmax: B('argmax', ([x]) => { const d = toArr(I, x); return d.indexOf(Math.max(...d)); }), argmin: B('argmin', ([x]) => { const d = toArr(I, x); return d.indexOf(Math.min(...d)); }),
    dot: B('dot', ([a, b]) => f(dot(toArr(I, a), toArr(I, b)))),
    outer: null,
    correlate: B('correlate', ([a, v, mode], k) => {
      const A = toArr(I, a), V = toArr(I, v); const md = mode ?? k.get('mode') ?? 'valid';
      const n = A.length, mlen = V.length; const full = [];
      for (let lag = -(mlen - 1); lag <= n - 1; lag++) { let s = 0; for (let j = 0; j < mlen; j++) { const i = lag + j; if (i >= 0 && i < n) s += A[i] * V[j]; } full.push(s); }
      if (md === 'full') return new NDArray(full);
      if (md === 'same') { const L = Math.max(n, mlen); const off = Math.floor((full.length - L) / 2); return new NDArray(full.slice(off, off + L)); }
      return new NDArray(full.slice(mlen - 1, n)); }),
    convolve: B('convolve', ([a, v, mode]) => { const A = toArr(I, a), V = toArr(I, v).slice().reverse(); return I.call(m.correlate, [new NDArray(A), new NDArray(V), mode ?? 'full']); }),
    clip: B('clip', ([x, lo, hi]) => (x instanceof NDArray ? new NDArray(x.data.map((v) => Math.min(Math.max(v, num(lo)), num(hi)))) : f(Math.min(Math.max(num(x), num(lo)), num(hi))))),
    where: B('where', ([c, a, b]) => new NDArray(c.data.map((v, i) => (v ? (a instanceof NDArray ? a.data[i] : num(a)) : (b instanceof NDArray ? b.data[i] : num(b)))))),
    abs: elementwise(Math.abs)(I), sqrt: elementwise(Math.sqrt)(I), sin: elementwise(Math.sin)(I), cos: elementwise(Math.cos)(I), tan: elementwise(Math.tan)(I),
    exp: elementwise(Math.exp)(I), log: elementwise(Math.log)(I), log2: elementwise(Math.log2)(I), log10: elementwise(Math.log10)(I), floor: elementwise(Math.floor)(I), ceil: elementwise(Math.ceil)(I), tanh: elementwise(Math.tanh)(I),
    round: B('round', ([x, d]) => (x instanceof NDArray ? x.pyRound(d) : f(Number(num(x).toFixed(num(d ?? 0)))))),
    isclose: B('isclose', ([a, b]) => Math.abs(num(a) - num(b)) <= 1e-8 + 1e-5 * Math.abs(num(b))),
    concatenate: B('concatenate', ([seq]) => new NDArray(I.iterate(seq).flatMap((x) => toArr(I, x)))),
    roll: B('roll', ([x, s]) => { const d = toArr(I, x), n = d.length, k = ((num(s) % n) + n) % n; return new NDArray([...d.slice(n - k), ...d.slice(0, n - k)]); }),
    cumsum: B('cumsum', ([x]) => { let s = 0; return new NDArray(toArr(I, x).map((v) => (s += v))); }),
    std: B('std', ([x]) => { const d = toArr(I, x); const mm = pairwiseSum(d) / d.length; return f(Math.sqrt(pairwiseSum(d.map((v) => (v - mm) ** 2)) / d.length)); }),
  };
  m.asarray = m.array;
  m.linalg = new PyModule('numpy.linalg', { norm: B('norm', ([x]) => f(Math.sqrt(dot(toArr(I, x), toArr(I, x))))) });
  m.random = new PyModule('numpy.random', { seed: B('seed', ([s]) => { rng = mulberry(num(s)); return null; }), rand: B('rand', ([n]) => (n === undefined ? f(rng()) : new NDArray(Array.from({ length: num(n) }, () => rng())))), random: B('random', () => f(rng())), RandomState: B('RandomState', ([seed]) => new RandomState(seed === undefined || seed === null ? 0 : num(seed))) });
  return new PyModule('numpy', m);
}
let rng = mulberry(0);
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function jsonDumps(I, v, k) {
  const indent = k.get('indent') ?? null; const sortKeys = I.truthy(k.get('sort_keys') ?? false); const ensureAscii = k.has('ensure_ascii') ? I.truthy(k.get('ensure_ascii')) : true;
  const seps = k.get('separators'); const [itemSep, keySep] = seps ? seps.items : [indent === null ? ', ' : ',', ': '];
  const enc = (s) => { let out = '"'; for (const ch of s) { const c = ch.codePointAt(0); if (ch === '"') out += '\\"'; else if (ch === '\\') out += '\\\\'; else if (ch === '\n') out += '\\n'; else if (ch === '\r') out += '\\r'; else if (ch === '\t') out += '\\t'; else if (ch === '\b') out += '\\b'; else if (ch === '\f') out += '\\f'; else if (c < 0x20 || (ensureAscii && c > 0x7e)) { if (c > 0xffff) { const h = Math.floor((c - 0x10000) / 0x400) + 0xd800, l = ((c - 0x10000) % 0x400) + 0xdc00; out += `\\u${h.toString(16).padStart(4, '0')}\\u${l.toString(16).padStart(4, '0')}`; } else out += `\\u${c.toString(16).padStart(4, '0')}`; } else out += ch; } return out + '"'; };
  const def = k.get('default');
  const go = (x, depth) => {
    const nl = indent === null ? '' : '\n' + ' '.repeat(num(indent) * (depth + 1)), end = indent === null ? '' : '\n' + ' '.repeat(num(indent) * depth);
    if (x === null) return 'null'; if (x === true) return 'true'; if (x === false) return 'false';
    if (typeof x === 'number') return String(x);
    if (x instanceof PyFloat) return Number.isFinite(x.v) ? floatRepr(x.v) : x.v > 0 ? 'Infinity' : x.v < 0 ? '-Infinity' : 'NaN';
    if (typeof x === 'string') return enc(x);
    if (Array.isArray(x) || x instanceof PyTuple) { const items = Array.isArray(x) ? x : x.items; if (!items.length) return '[]'; return '[' + nl + items.map((y) => go(y, depth + 1)).join(itemSep + nl) + end + ']'; }
    if (x instanceof PyDict) {
      let ents = x.entries().map(([kk, vv]) => [typeof kk === 'string' ? kk : kk === null ? 'null' : kk === true ? 'true' : kk === false ? 'false' : I.str(kk), vv]);
      if (sortKeys) ents.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      if (!ents.length) return '{}';
      return '{' + nl + ents.map(([kk, vv]) => enc(kk) + keySep + go(vv, depth + 1)).join(itemSep + nl) + end + '}';
    }
    if (def) return go(I.call(def, [x]), depth);
    throw new PyException('TypeError', `Object of type ${x instanceof PyObject ? x.cls.name : typeof x} is not JSON serializable`);
  };
  return go(v, 0);
}
function jsonLoads(I, s) {
  const conv = (x) => { if (x === null || typeof x === 'boolean' || typeof x === 'string') return x; if (typeof x === 'number') return Number.isInteger(x) && !/[.eE]/.test(String(x)) ? x : f(x); if (Array.isArray(x)) return x.map(conv); return new PyDict(Object.entries(x).map(([k, v]) => [k, conv(v)])); };
  // keep float-vs-int distinction by pre-marking numbers with a decimal point/exponent
  const marked = JSON.parse(s, function (key, value) { return value; });
  const rawNums = [...s.matchAll(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)].map((m) => m[0]);
  let idx = 0;
  const conv2 = (x) => { if (typeof x === 'number') { const raw = rawNums[idx++] ?? ''; return /[.eE]/.test(raw) ? f(x) : x; } if (Array.isArray(x)) return x.map(conv2); if (x && typeof x === 'object') return new PyDict(Object.entries(x).map(([k, v]) => [k, conv2(v)])); return x; };
  return idx === 0 && rawNums.length === 0 ? conv(marked) : conv2(marked);
}

export function stdlibModules() {
  return {
    numpy: numpyModule,
    math: () => new PyModule('math', {
      pi: f(Math.PI), e: f(Math.E), tau: f(2 * Math.PI), inf: f(Infinity), nan: f(NaN),
      ...Object.fromEntries(['sqrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'log2', 'log10', 'fabs', 'sinh', 'cosh', 'tanh'].map((n) => [n, B(n, ([x]) => f(Math[n === 'fabs' ? 'abs' : n](num(x))))])),
      log: B('log', ([x, b]) => f(b === undefined ? Math.log(num(x)) : Math.log(num(x)) / Math.log(num(b)))),
      floor: B('floor', ([x]) => Math.floor(num(x))), ceil: B('ceil', ([x]) => Math.ceil(num(x))), trunc: B('trunc', ([x]) => Math.trunc(num(x))),
      pow: B('pow', ([a, b]) => f(num(a) ** num(b))), atan2: B('atan2', ([a, b]) => f(Math.atan2(num(a), num(b)))), hypot: B('hypot', (a) => f(Math.hypot(...a.map(num)))),
      isclose: B('isclose', ([a, b], k) => { const rt = num(k.get('rel_tol') ?? 1e-9), at = num(k.get('abs_tol') ?? 0); return Math.abs(num(a) - num(b)) <= Math.max(rt * Math.max(Math.abs(num(a)), Math.abs(num(b))), at); }),
      isnan: B('isnan', ([x]) => Number.isNaN(num(x))), isinf: B('isinf', ([x]) => !Number.isFinite(num(x)) && !Number.isNaN(num(x))),
      factorial: B('factorial', ([n]) => { let r = 1; for (let i = 2; i <= num(n); i++) r *= i; return r; }), gcd: B('gcd', ([a, b]) => { a = Math.abs(num(a)); b = Math.abs(num(b)); while (b) [a, b] = [b, a % b]; return a; }),
      degrees: B('degrees', ([x]) => f((num(x) * 180) / Math.PI)), radians: B('radians', ([x]) => f((num(x) * Math.PI) / 180)),
    }),
    json: (I) => new PyModule('json', { dumps: B('dumps', ([v], k) => jsonDumps(I, v, k)), loads: B('loads', ([s]) => jsonLoads(I, s)) }),
    enum: (I) => {
      const Enum = new PyClass('Enum', [I.builtins.get('object')], new Map(), { isEnumBase: true });
      const IntEnum = new PyClass('IntEnum', [Enum], new Map(), { isEnumBase: true });
      return new PyModule('enum', { Enum, IntEnum, Flag: Enum, auto: B('auto', () => ({ isAuto: true, pyTypeName: 'auto' })) });
    },
    dataclasses: (I) => {
      const field = B('field', (a, k) => ({ pyTypeName: 'Field', isField: true, default: k.get('default'), factory: k.get('default_factory') }));
      const apply = (cls, opts) => {
        I.rule('py-dataclass');
        const fields = [];
        for (const c of [...cls.mro].reverse()) for (const n of c.annotations ?? []) if (!fields.includes(n)) fields.push(n);
        const defaults = new Map();
        for (const n of fields) { const c = cls.mro.find((x) => x.dict.has(n)); if (c) defaults.set(n, c.dict.get(n)); }
        cls.dataclassFields = fields; if (opts.frozen) cls.frozen = true;
        if (!cls.dict.has('__init__')) cls.dict.set('__init__', new PyBuiltin('__init__', ([self, ...args], kw) => {
          fields.forEach((n, i) => {
            let v;
            if (i < args.length) v = args[i]; else if (kw.has(n)) v = kw.get(n);
            else if (defaults.has(n)) { const d = defaults.get(n); v = d && d.isField ? (d.factory ? I.call(d.factory, []) : d.default) : d; }
            else throw new PyException('TypeError', `__init__() missing required argument: '${n}'`);
            self.attrs.set(n, v);
          });
          const post = cls.lookup('__post_init__'); if (post) I.call(post, [self]);
          return null;
        }));
        if (!cls.dict.has('__eq__')) cls.dict.set('__eq__', new PyBuiltin('__eq__', ([a, b]) => b instanceof PyObject && b.cls === a.cls && fields.every((n) => I.eq(a.attrs.get(n), b.attrs.get(n)))));
        if (opts.frozen && !cls.dict.has('__hash__')) cls.hashKeyFn = (o) => 'd' + cls.id + ':' + fields.map((n) => { try { return JSON.stringify(I.repr(o.attrs.get(n))); } catch { return '?'; } }).join(',');
        return cls;
      };
      const dataclass = B('dataclass', (args, k) => {
        if (args.length === 1 && args[0] instanceof PyClass) return apply(args[0], {});
        const opts = { frozen: I.truthy(k.get('frozen') ?? false) };
        return B('dataclass_decorator', ([cls]) => apply(cls, opts));
      });
      const asdict = B('asdict', ([o]) => new PyDict(o.cls.dataclassFields.map((n) => [n, o.attrs.get(n)])));
      return new PyModule('dataclasses', { dataclass, field, asdict, FrozenInstanceError: I.builtins.get('FrozenInstanceError') });
    },
    typing: () => { const any = { pyTypeName: 'typing', pySubscriptable: true }; return new PyModule('typing', Object.fromEntries(['Dict', 'List', 'Tuple', 'Any', 'Optional', 'Union', 'Callable', 'Set', 'Iterable', 'Iterator', 'Sequence', 'Mapping', 'Type', 'FrozenSet', 'Generator', 'ClassVar', 'Literal', 'NamedTuple', 'TypeVar'].map((n) => [n, n === 'TypeVar' ? B('TypeVar', () => any) : any]))); },
    abc: (I) => new PyModule('abc', { ABC: new PyClass('ABC', [I.builtins.get('object')], new Map()), abstractmethod: B('abstractmethod', ([fn]) => fn), ABCMeta: I.builtins.get('object') }),
    functools: (I) => new PyModule('functools', { reduce: B('reduce', ([fn, it, init]) => { const items = I.iterate(it); let acc = init === undefined ? items.shift() : init; for (const x of items) acc = I.call(fn, [acc, x]); return acc; }), lru_cache: B('lru_cache', (a) => (a.length && a[0] && !(a[0] instanceof PyFloat) && typeof a[0] === 'object' && a[0].params ? a[0] : B('lru', ([fn]) => fn))), wraps: B('wraps', () => B('wrap', ([fn]) => fn)), cache: B('cache', ([fn]) => fn) }),
    collections: (I) => new PyModule('collections', {
      OrderedDict: I.builtins.get('dict'),
      defaultdict: B('defaultdict', ([factory]) => { const d = new PyDict(); d.defaultFactory = factory; return d; }),
      Counter: B('Counter', ([it]) => { const d = new PyDict(); d.defaultFactory = B('int', () => 0); if (it !== undefined) for (const x of I.iterate(it)) d.set(x, (d.get(x) ?? 0) + 1); return d; }),
      deque: B('deque', ([it]) => (it === undefined ? [] : I.iterate(it))),
    }),
    itertools: (I) => new PyModule('itertools', {
      product: B('product', (args, k) => { const pools = args.map((a) => I.iterate(a)); const rep = num(k.get('repeat') ?? 1); let all = []; for (let r = 0; r < rep; r++) all.push(...pools); let out = [[]]; for (const p of all) out = out.flatMap((x) => p.map((y) => [...x, y])); return out.map((x) => new PyTuple(x)); }),
      combinations: B('combinations', ([it, r]) => { const pool = I.iterate(it), out = []; const rec = (s, acc) => { if (acc.length === num(r)) { out.push(new PyTuple(acc)); return; } for (let i = s; i < pool.length; i++) rec(i + 1, [...acc, pool[i]]); }; rec(0, []); return out; }),
      chain: B('chain', (args) => args.flatMap((a) => I.iterate(a))),
      count: B('count', () => { throw new PyException('NotImplementedError', 'itertools.count is unbounded'); }),
    }),
    random: () => new PyModule('random', { seed: B('seed', ([s]) => { rng = mulberry(num(s ?? 0)); return null; }), random: B('random', () => f(rng())), randint: B('randint', ([a, b]) => num(a) + Math.floor(rng() * (num(b) - num(a) + 1))), choice: B('choice', ([s]) => s[Math.floor(rng() * s.length)]), uniform: B('uniform', ([a, b]) => f(num(a) + rng() * (num(b) - num(a)))) }),
    sys: () => new PyModule('sys', { argv: ['script.py'], version: '3.11 (synthia translation layer)', maxsize: Number.MAX_SAFE_INTEGER, platform: 'synthia' }),
    hashlib: () => { throw new PyException('ModuleNotFoundError', "No module named 'hashlib' (not provided by translation layer)"); },
  };
}

// numpy legacy RandomState: MT19937 seeded via init_genrand, random_sample = 53-bit double (bit-compatible with numpy).
export class RandomState {
  constructor(seed) { this.pyTypeName = 'RandomState'; this.mt = new Uint32Array(624); this.i = 624; this.mt[0] = seed >>> 0; for (let i = 1; i < 624; i++) { const p = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30); this.mt[i] = (Math.imul(1812433253, p) + i) >>> 0; } }
  u32() {
    const mt = this.mt;
    if (this.i >= 624) { for (let k = 0; k < 624; k++) { const y = (mt[k] & 0x80000000) | (mt[(k + 1) % 624] & 0x7fffffff); mt[k] = mt[(k + 397) % 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0); } this.i = 0; }
    let y = mt[this.i++]; y ^= y >>> 11; y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & 0xefc60000; y ^= y >>> 18; return y >>> 0;
  }
  double() { const a = this.u32() >>> 5, b = this.u32() >>> 6; return (a * 67108864 + b) / 9007199254740992; }
  pyGetAttr(name) {
    const self = this;
    const many = (fn) => B(name, ([n]) => (n === undefined || n === null ? f(fn()) : new NDArray(Array.from({ length: n instanceof PyTuple ? num(n.items[0]) : num(n) }, fn))));
    if (name === 'rand' || name === 'random_sample' || name === 'random') return many(() => self.double());
    if (name === 'uniform') return B(name, ([lo, hi, n]) => { const a = num(lo ?? 0), b = num(hi ?? 1); const g = () => a + (b - a) * self.double(); return n === undefined ? f(g()) : new NDArray(Array.from({ length: num(n) }, g)); });
    return undefined;
  }
}
