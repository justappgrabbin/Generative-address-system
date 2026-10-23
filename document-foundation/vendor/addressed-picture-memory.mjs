/**
 * Synthia Addressed Picture Memory
 * Pure JavaScript, dependency-free.
 *
 * Stores immutable episodic pictures of configurations whose entities are
 * already located in Synthia's canonical state space. Color/Tone/Base is an
 * indicator used to resolve a Gate; this module never invents that mapping.
 */

export const ADDRESS_FIELDS = Object.freeze([
  "planetary", "dimension", "gate", "line", "color", "tone", "base",
  "degree", "minute", "second", "arcFraction", "zodiac", "house"
]);

export const CARDINALITIES = Object.freeze({
  planetary: 13, dimension: 5, gate: 64, line: 6, color: 6, tone: 6,
  base: 5, degree: 30, minute: 60, second: 60, arcAxis: 99,
  zodiac: 12, house: 12
});

const clone = value => structuredClone(value);
const freeze = value => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};

export function indicatorOf(address) {
  return `${address.color}:${address.tone}:${address.base}`;
}

export function addressKey(address) {
  assertAddress(address);
  return ADDRESS_FIELDS.map(field => String(address[field])).join("|");
}

export function assertAddress(address) {
  if (!address || typeof address !== "object") throw new TypeError("Address must be an object");
  for (const field of ADDRESS_FIELDS) {
    if (address[field] === undefined || address[field] === null || address[field] === "") {
      throw new TypeError(`Canonical address is missing ${field}`);
    }
  }
  return address;
}

export class AddressedPictureMemory {
  #space;
  #pictures = new Map();
  #sequence = 0;

  constructor(stateSpace) {
    if (!stateSpace || typeof stateSpace.get !== "function" || typeof stateSpace.resolveGate !== "function") throw new TypeError("stateSpace is required");
    this.#space = stateSpace;
  }

  capture({ id, observedAt = Date.now(), focus = null, members, relations = [], frame = {} }) {
    if (!Array.isArray(members) || members.length === 0) throw new TypeError("Picture requires members");
    const refs = members.map(member => {
      const address = member.address ?? member;
      const key = addressKey(address);
      if (!this.#space.get(key)) throw new Error(`State-space address is not registered: ${key}`);
      return freeze({ address: clone(address), key, indicator: indicatorOf(address), appearance: clone(member.appearance ?? null) });
    });
    const pictureId = id ?? `picture-${observedAt}-${++this.#sequence}`;
    if (this.#pictures.has(pictureId)) throw new Error(`Picture already exists: ${pictureId}`);
    const picture = freeze({
      id: pictureId,
      observedAt,
      focus: clone(focus),
      frame: clone(frame),
      members: refs,
      relations: clone(relations),
      kind: "addressed-state-picture",
      version: 1
    });
    this.#pictures.set(pictureId, picture);
    return picture;
  }

  recall(id, { complete = true } = {}) {
    const original = this.#pictures.get(id);
    if (!original) return null;
    const recalled = clone(original);
    recalled.members = recalled.members.map(ref => ({
      ...ref,
      state: this.#space.get(ref.key),
      completion: this.#space.get(ref.key) ? "exact-address" : "unresolved"
    }));
    if (complete) this.#complete(recalled);
    return freeze(recalled);
  }

  #complete(recalled) {
    for (const member of recalled.members) {
      if (member.state) continue;
      const [color, tone, base] = member.indicator.split(":").map(Number);
      const gate = this.#space.resolveGate({ color, tone, base });
      member.completion = gate === null ? "ambiguous-indicator" : "indicator-resolved";
      member.indicatedGate = gate;
    }
  }

  exportPicture(id) {
    const picture = this.#pictures.get(id);
    return picture ? JSON.stringify(picture) : null;
  }

  importPicture(serialized) {
    const picture = typeof serialized === "string" ? JSON.parse(serialized) : clone(serialized);
    if (picture.kind !== "addressed-state-picture" || !picture.id) throw new TypeError("Invalid picture");
    if (this.#pictures.has(picture.id)) throw new Error(`Picture already exists: ${picture.id}`);
    for (const member of picture.members ?? []) assertAddress(member.address);
    const stored = freeze(picture);
    this.#pictures.set(stored.id, stored);
    return stored;
  }

  list() {
    return Object.freeze([...this.#pictures.keys()]);
  }
}

/** Linux/Node persistence adapter. Keeps the memory model separate from storage. */
export class LinuxPictureStore {
  #directory;
  constructor(directory) {
    if (!directory) throw new TypeError("directory is required");
    this.#directory = directory;
  }

  async save(memory, id) {
    const [{ mkdir, writeFile, rename }, path] = await Promise.all([
      import("node:fs/promises"), import("node:path")
    ]);
    const serialized = memory.exportPicture(id);
    if (serialized === null) throw new Error(`Unknown picture: ${id}`);
    await mkdir(this.#directory, { recursive: true });
    const destination = path.join(this.#directory, `${encodeURIComponent(id)}.json`);
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, serialized, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, destination); // atomic on the same Linux filesystem
    return destination;
  }

  async load(memory, id) {
    const [{ readFile }, path] = await Promise.all([
      import("node:fs/promises"), import("node:path")
    ]);
    const source = path.join(this.#directory, `${encodeURIComponent(id)}.json`);
    return memory.importPicture(await readFile(source, "utf8"));
  }
}
