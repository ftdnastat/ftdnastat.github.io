(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.YSnpCore = factory();
})(this, function () {
  "use strict";

  const up = (/** @type {string} */ s) => s.toUpperCase();

  // "CTS10003+, M96+, AF4-": the sign is the result; a bare name counts as positive
  /** @param {string} text */
  function parseList(text) {
    const pos = /** @type {string[]} */ ([]), neg = /** @type {string[]} */ ([]), bad = /** @type {string[]} */ ([]), seen = new Map();
    for (const raw of String(text || "").split(/[\s,;]+/)) {
      const t = raw.trim().replace(/[()]/g, "").replace(/[−–]/g, "-");
      if (!t) continue;
      const m = t.match(/^([A-Za-z][A-Za-z0-9._]*[0-9][A-Za-z0-9._]*)([+-]?)$/);
      if (!m) { bad.push(t); continue; }
      const snp = up(m[1]), sign = m[2] === "-" ? -1 : 1;
      if (seen.has(snp)) { if (seen.get(snp) !== sign) seen.set(snp, 0); continue; }
      seen.set(snp, sign);
    }
    for (const [snp, sign] of seen) if (sign > 0) pos.push(snp); else if (sign < 0) neg.push(snp);
    return { pos, neg, bad, both: [...seen].filter(([, s]) => s === 0).map(([snp]) => snp) };
  }

  /** @param {{ roots: number, names: string, kids: number[], kits: number[], links: Record<string, number>, labels: Record<string, string>, trunk?: Record<string, string> }} d */
  function prepare(d) {
    const names = d.names.split("\n"), parent = new Int32Array(names.length).fill(-1), depth = new Int32Array(names.length), first = new Int32Array(names.length);
    let next = d.roots;
    for (let i = 0; i < names.length; i++) {
      first[i] = next;
      for (let k = 0; k < d.kids[i]; k++) { parent[next] = i; depth[next] = depth[i] + 1; next++; }
    }
    const byName = new Map(), byOwn = new Map();
    names.forEach((n, i) => {
      byName.set(up(n), i);
      // the SNP in a branch's name is left out of the search shards
      const own = up(n.slice(n.indexOf("-") + 1));
      if (n.includes("-")) (byOwn.get(own) || byOwn.set(own, []).get(own)).push(i);
    });
    // the trunk above every page is not in the search shards
    for (const [i, list] of Object.entries(d.trunk || {})) for (const s of list.split(" ")) { const k = up(s), at = byOwn.get(k) || byOwn.set(k, []).get(k); if (!at.includes(+i)) at.push(+i); }
    return { names, parent, depth, first, kids: d.kids, kits: d.kits, links: d.links, labels: d.labels, byName, byOwn };
  }

  /** @param {ReturnType<typeof prepare>} t @param {number} i */
  function pathOf(t, i) { const out = []; for (let x = i; x >= 0; x = t.parent[x]) out.push(x); return out.reverse(); }

  /** @param {ReturnType<typeof prepare>} t @param {number} i */
  function childrenOf(t, i) { const out = []; for (let k = 0; k < t.kids[i]; k++) out.push(t.first[i] + k); return out; }

  // search shard: snp-<3 chars>, or snp-<4 chars> for the prefixes in snp-split.json
  /** @param {string} snp @param {Set<string>} split */
  function shardOf(snp, split) {
    const k3 = snp.slice(0, 3).replace(/[^A-Z0-9]/g, "_");
    if (snp.length < 3) return null;
    if (split.has(k3)) return snp.length < 4 ? null : "snp-" + snp.slice(0, 4).toLowerCase().replace(/[^a-z0-9]/g, "_");
    return "snp-" + k3.toLowerCase();
  }

  // shard rows [snp, name without the page's letter prefix, kits, page index, anchor, label?, YFull node?] → snp → tree nodes;
  // a YFull-only SNP lands on the FTDNA branch above it and says nothing when negative
  /** @param {ReturnType<typeof prepare>} t @param {string[]} pages @param {any[][]} rows @param {Set<string>} want */
  function locate(t, pages, rows, want) {
    const at = /** @type {Map<string, { nodes: number[], yfull: boolean }>} */ (new Map());
    for (const r of rows) {
      const snp = up(String(r[0]));
      if (!want.has(snp)) continue;
      const page = pages[r[3]], short = String(r[1]);
      const name = short.includes("-") || !page ? short : page.slice(0, page.indexOf("-") + 1) + short;
      const i = t.byName.get(up(name));
      if (i == null) continue;
      const e = at.get(snp) || at.set(snp, { nodes: [], yfull: true }).get(snp);
      if (!e) continue;
      if (!e.nodes.includes(i)) e.nodes.push(i);
      // a negative counts unless every row of the SNP is YFull-only
      if (!r[6]) e.yfull = false;
    }
    for (const snp of want) for (const i of t.byOwn.get(snp) || []) {
      const e = at.get(snp) || at.set(snp, { nodes: [], yfull: false }).get(snp);
      if (e && !e.nodes.includes(i)) { e.nodes.push(i); e.yfull = false; }
    }
    return at;
  }

  // a branch scores its positive SNPs minus its negative ones, summed from the root; the best has the top score, the shallower on a tie
  /** @param {ReturnType<typeof prepare>} t @param {{ pos: string[], neg: string[] }} list @param {Map<string, { nodes: number[], yfull: boolean }>} at */
  function classify(t, list, at) {
    const ev = /** @type {Map<number, { pos: string[], neg: string[] }>} */ (new Map());
    const add = (/** @type {number} */ i, /** @type {"pos" | "neg"} */ k, /** @type {string} */ snp) => { const e = ev.get(i) || ev.set(i, { pos: [], neg: [] }).get(i); if (e) e[k].push(snp); };
    for (const snp of list.pos) for (const i of (at.get(snp) || { nodes: [] }).nodes) add(i, "pos", snp);
    for (const snp of list.neg) { const e = at.get(snp); if (e && !e.yfull) for (const i of e.nodes) add(i, "neg", snp); }
    const memo = new Map();
    const score = (/** @type {number} */ i) => {
      if (i < 0) return 0;
      if (memo.has(i)) return memo.get(i);
      const e = ev.get(i), s = score(t.parent[i]) + (e ? e.pos.length - e.neg.length : 0);
      memo.set(i, s);
      return s;
    };
    let best = -1;
    for (const i of ev.keys()) {
      const s = score(i);
      if (s <= 0) continue;
      if (best < 0 || s > score(best) || (s === score(best) && t.depth[i] < t.depth[best])) best = i;
    }
    if (best < 0) return { best, ev, path: [], hits: 0, against: [], off: [] };
    const path = pathOf(t, best), onPath = new Set(path);
    const against = [], got = new Set();
    for (const x of path) { const e = ev.get(x); if (e) { for (const s of e.pos) got.add(s); for (const s of e.neg) against.push([s, x]); } }
    const hits = got.size;
    // positives elsewhere: on another line or below the answer behind a negative; a recurrent SNP already on the path is not one
    const mine = new Set(path.flatMap((x) => (ev.get(x) || { pos: [] }).pos)), off = [];
    for (const [x, e] of ev) if (!onPath.has(x)) for (const s of e.pos) if (!mine.has(s)) off.push([s, x]);
    return { best, ev, path, hits, against, off };
  }

  return { parseList, prepare, pathOf, childrenOf, shardOf, locate, classify };
});
