// The arithmetic of the world map's modes, for the page and for the tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WorldMapCore = factory();
})(this, function () {
  "use strict";
  const A = 20;

  // shares of one line, normalised by the counts themselves
  function shares(pairs) {
    const tot = pairs.reduce((a, [, v]) => a + v, 0), m = new Map();
    if (tot) for (const [k, v] of pairs) m.set(k, v / tot);
    return m;
  }

  function jsd(a, b) {
    let d = 0;
    for (const k of new Set([...a.keys(), ...b.keys()])) {
      const p = a.get(k) || 0, q = b.get(k) || 0, m = (p + q) / 2;
      if (p) d += 0.5 * p * Math.log2(p / m);
      if (q) d += 0.5 * q * Math.log2(q / m);
    }
    return d;
  }

  // fifths of the values; fewer than five values give no scale
  function quantEdges(vals) {
    const v = [...vals].sort((a, b) => a - b);
    return v.length < 5 ? null : [1, 2, 3, 4].map((i) => v[Math.floor((i * v.length) / 5)]);
  }

  // a small sample pulled toward the reference share as if A samples at that share were added; −1..1
  function diff(k, n, q) {
    const p = (k + A * q) / (n + A);
    return { p, v: p + q ? (p - q) / (p + q) : 0 };
  }

  // the chance two different samples fall in different groups (unbiased Gini–Simpson)
  function diversity(counts) {
    const n = counts.reduce((a, [, v]) => a + v, 0);
    if (n < 2) return null;
    let s = 0;
    for (const [, v] of counts) s += v * (v - 1);
    return 1 - s / (n * (n - 1));
  }

  // k-medoids on a distance matrix: farthest-first seeds from item 0 (the caller puts the biggest first), swaps until stable
  function kMedoids(dist, k) {
    const n = dist.length;
    k = Math.min(k, n);
    if (!k) return { medoids: [], assign: [] };
    const med = [0];
    while (med.length < k) {
      let best = -1, bd = -1;
      for (let i = 0; i < n; i++) if (!med.includes(i)) { const d = Math.min(...med.map((m) => dist[i][m])); if (d > bd) { bd = d; best = i; } }
      med.push(best);
    }
    const assignOf = () => Array.from({ length: n }, (_, i) => med.reduce((a, m, j) => (dist[i][m] < dist[i][med[a]] ? j : a), 0));
    for (let it = 0; it < 30; it++) {
      const assign = assignOf();
      let moved = false;
      for (let j = 0; j < k; j++) {
        const members = [];
        for (let i = 0; i < n; i++) if (assign[i] === j) members.push(i);
        let best = med[j], bc = Infinity;
        for (const c of members) { let cost = 0; for (const i of members) cost += dist[i][c]; if (cost < bc) { bc = cost; best = c; } }
        if (best !== med[j]) { med[j] = best; moved = true; }
      }
      if (!moved) break;
    }
    return { medoids: med, assign: assignOf() };
  }

  return { A, shares, jsd, quantEdges, diff, diversity, kMedoids };
});
