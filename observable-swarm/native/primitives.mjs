/** CPU execution layout, not semantic addresses or acquired abilities.
 * Sources: GPU Programming Primitives (Meister et al., 2023),
 * Scan Primitives for Vector Computers (Chatterjee et al., 1990).
 */
export function exclusiveOffsets(counts) {
  const offsets = [0];
  for (const count of counts) {
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(offsets.at(-1) + count)) throw Error('Invalid segment count');
    offsets.push(offsets.at(-1) + count);
  }
  return offsets;
}

// Stable scatter groups directed edges by destination without changing their
// identities, order within each group, weights, or independent histories.
export function sparseLayout(nodes, edges) {
  const ids = [...nodes.keys()], index = new Map(ids.map((id, i) => [id, i]));
  const active = [...edges.values()].filter(e => e.enabled), counts = ids.map(() => 0);
  for (const e of active) {
    if (!index.has(e.from) || !index.has(e.to)) throw Error('Unknown relation endpoint');
    counts[index.get(e.to)]++;
  }
  const offsets = exclusiveOffsets(counts), cursors = offsets.slice(0, -1), relations = new Array(active.length);
  for (const e of active) relations[cursors[index.get(e.to)]++] = e;
  return { ids, index, offsets, relations };
}

// Seeded segmented reduction preserves the original left-to-right floating
// point order (bias first), including empty segments. Source gathering is lazy:
// DAG sources must already have executed; delayed networks read prior state.
export function propagateSegment(layout, id, seed, read, visit) {
  const segment = layout.index.get(id);
  if (segment === undefined) throw Error('Unknown execution constituent');
  let value = seed;
  for (let i = layout.offsets[segment]; i < layout.offsets[segment + 1]; i++) {
    const relation = layout.relations[i], source = read(relation.from);
    const contribution = source * relation.weight;
    value += contribution;
    visit(relation, source, contribution);
  }
  return value;
}
