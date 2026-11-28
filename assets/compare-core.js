(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CompareCore = factory();
})(this, function () {
  "use strict";

  const COMPACT_FROM = 5;
  const MIN_SHARE = 0.02;
  const TOP_ROWS = 25;
  const SMALL_N = 30;
  const TOKEN = /^([cp]):([A-Za-z0-9_-]+)$/;

  // "#a=c:russia-dagestan,p:che" → { items: [{ t, id }] }; invalid tokens and duplicates are dropped, a legacy &k= is ignored
  function parseHash(hash) {
    const out = { items: [] };
    const seen = new Set();
    for (const part of String(hash || "").replace(/^#/, "").split("&")) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      const key = part.slice(0, eq), val = part.slice(eq + 1);
      if (key !== "a") continue;
      for (const tok of val.split(",")) {
        const m = TOKEN.exec(tok);
        if (!m || seen.has(tok)) continue;
        seen.add(tok);
        out.items.push({ t: m[1], id: m[2] });
      }
    }
    return out;
  }

  function serializeHash(items) {
    const a = items.map((x) => x.t + ":" + x.id).join(",");
    return a ? "#a=" + a : "";
  }

  function shares(rows, n) {
    const m = new Map();
    if (!n) return m;
    for (const r of rows || []) m.set(r.k, (m.get(r.k) || 0) + r.v / n);
    return m;
  }

  // cosine similarity of two share vectors over the union of keys (same formula as render-yfull agreement)
  function cosine(rowsA, nA, rowsB, nB) {
    const a = shares(rowsA, nA), b = shares(rowsB, nB);
    let dot = 0, na = 0, nb = 0;
    for (const k of new Set([...a.keys(), ...b.keys()])) {
      const x = a.get(k) || 0, y = b.get(k) || 0;
      dot += x * y; na += x * x; nb += y * y;
    }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  // datas: one { n, l2 } or null per item → matrix[i][j] (null where either side has no data)
  function similarityMatrix(datas) {
    return datas.map((a, i) => datas.map((b, j) => {
      if (!a || !b || !a.n || !b.n) return null;
      return i === j ? 1 : cosine(a.l2, a.n, b.l2, b.n);
    }));
  }

  // overall similarity: the mean of the Y and mt values where both exist, else the one that exists
  function combineMatrices(my, mmt) {
    return my.map((row, i) => row.map((y, j) => {
      const mt = mmt[i][j];
      return y == null ? mt : mt == null ? y : (y + mt) / 2;
    }));
  }

  function nearestLinks(matrix, count = 1) {
    const links = [], seen = new Set();
    for (let i = 0; i < matrix.length; i++) {
      const neighbors = matrix[i].map((similarity, j) => ({ j, similarity }))
        .filter(({ j, similarity }) => j !== i && Number.isFinite(similarity))
        .sort((a, b) => b.similarity - a.similarity || a.j - b.j);
      for (const { j, similarity } of neighbors.slice(0, count)) {
        const a = Math.min(i, j), b = Math.max(i, j), key = a + ":" + b;
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({ a, b, similarity });
      }
    }
    return links;
  }

  // Use the very matrix shown in the comparison. A missing pair has no target distance.
  function fitMds(matrix) {
    const n = matrix.length;
    if (n < 2 || matrix.some(row => row.length !== n || !row.every(Number.isFinite))) return null;
    const distance = matrix.map((row, i) => row.map((s, j) => i === j || 1 - s < 1e-14 ? 0 : Math.sqrt(2 * (1 - s))));
    const pairs = [];
    let longest = [0, 1, 0];
    for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) {
      const pair = [j, i, distance[i][j]];
      pairs.push(pair);
      if (pair[2] > longest[2]) longest = pair;
    }
    const [a, b, edge] = longest;
    const points = matrix.map(() => [0, 0]);
    if (!edge) return { points, stress: null };
    points[b][0] = edge;
    function score(coords) {
      let residual = 0, fitted = 0;
      for (const [i, j, d] of pairs) {
        const actual = Math.hypot(coords[i][0] - coords[j][0], coords[i][1] - coords[j][1]);
        residual += (actual - d) ** 2;
        fitted += actual * actual;
      }
      return { points: coords, stress: Math.sqrt(residual / fitted) };
    }
    if (n === 2) return score(points);
    if (n === 3) {
      const c = 3 - a - b, ac = distance[a][c], bc = distance[b][c];
      if (ac + bc >= edge - 1e-12) {
        const x = (ac * ac - bc * bc + edge * edge) / (2 * edge);
        points[c] = [x, Math.sqrt(Math.max(0, ac * ac - x * x))];
        return score(points);
      }
    }
    const orders = [];
    // Sample the triangular array of edge comparisons without allocating it.
    const totalOrders = pairs.length * (pairs.length - 1) / 2;
    const budget = Math.min(totalOrders, 378);
    const sampled = budget < totalOrders;
    for (let k = 0; k < budget; k++) {
      const index = Math.floor((k + 0.5) * totalOrders / budget);
      const i = Math.floor((1 + Math.sqrt(1 + 8 * index)) / 2);
      const j = index - i * (i - 1) / 2;
      const near = pairs[i][2] < pairs[j][2] ? i : j;
      const far = near === i ? j : i;
      const gap = pairs[far][2] - pairs[near][2];
      if (gap > 1e-10) orders.push({ near, far, gap });
    }
    const lengths = new Float64Array(pairs.length), slopes = new Float64Array(pairs.length);
    let best, ordered, bestCost = Infinity, orderedCost = Infinity;
    function evaluate(coords, weight) {
      let residual = 0, penalty = 0, inversions = 0;
      for (let k = 0; k < pairs.length; k++) {
        const [i, j, target] = pairs[k];
        const length = Math.hypot(coords[i][0]-coords[j][0], coords[i][1]-coords[j][1]);
        lengths[k] = length;
        // Penalize proportional compression as well as absolute error.
        const floor = edge * 0.01;
        const logRatio = Math.log((length + floor) / (target + floor));
        residual += (length - target) ** 2 + target ** 2 * (2 * logRatio) ** 8;
        slopes[k] = length - target + 8 * target ** 2 * (2 * logRatio) ** 7 / (length + floor);
      }
      for (const {near, far, gap} of orders) {
        if (lengths[far] - lengths[near] <= 1e-10) inversions++;
        const shortfall = Math.max(0, gap - (lengths[far] - lengths[near]));
        penalty += shortfall ** 2;
        slopes[near] += weight * shortfall;
        slopes[far] -= weight * shortfall;
      }
      const cost = residual + weight * penalty;
      const quality = residual + penalty / pairs.length;
      if (!inversions && quality < orderedCost) {
        ordered = coords;
        orderedCost = quality;
      }
      if (quality < bestCost) {
        bestCost = quality;
        best = coords;
      }
      return cost;
    }
    let seed = 17;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296 - 0.5;
    }
    for (let start = 0; start < (sampled ? 3 : 16); start++) {
      let coords = matrix.map(() => [random(), random()]);
      for (const weight of [1 / pairs.length, 3, 30]) {
        let cost = evaluate(coords, weight), rate = 1/n;
        for (let step = 0; step < (sampled ? 64 : 160); step++) {
          const gradient = matrix.map(() => [0, 0]);
          for (let k = 0; k < pairs.length; k++) {
            if (!lengths[k]) continue;
            const [i, j] = pairs[k], factor = slopes[k] / lengths[k];
            const dx = factor * (coords[i][0]-coords[j][0]), dy = factor * (coords[i][1]-coords[j][1]);
            gradient[i][0] += dx; gradient[j][0] -= dx;
            gradient[i][1] += dy; gradient[j][1] -= dy;
          }
          const next = coords.map(([x, y], i) => [x-rate*gradient[i][0], y-rate*gradient[i][1]]);
          const trial = evaluate(next, weight);
          if (trial > cost) {
            rate /= 2;
            if (rate < 1e-9) break;
            evaluate(coords, weight);
          } else {
            coords = next;
            if (cost-trial < 1e-13) break;
            cost = trial;
            rate = Math.min(rate*1.2, 1/n);
          }
        }
      }
    }
    if (ordered && orderedCost <= 2 * bestCost) best = ordered;
    const chosen = best;
    evaluate(chosen, 0);
    const conflicts = orders.filter(({near, far}) => lengths[far] - lengths[near] <= 1e-10)
      .map(({near, far}) => [...pairs[near].slice(0, 2), ...pairs[far].slice(0, 2)]);
    return { ...score(chosen), conflicts, sampled, comparisons: orders.length };

  }

  // rows: branches with a share ≥ minShare in at least one item, biggest peak first; shares[i] is null for an item without data
  function branchRows(datas, minShare = MIN_SHARE, limit = TOP_ROWS) {
    const maps = datas.map((d) => (d && d.n ? shares(d.l2, d.n) : null));
    const keys = new Set();
    for (const m of maps) if (m) for (const [k, v] of m) if (v >= minShare) keys.add(k);
    const rows = [...keys].map((k) => {
      const vals = maps.map((m) => (m ? m.get(k) || 0 : null));
      return { k, shares: vals, max: Math.max(...vals.map((v) => (v == null ? -1 : v))) };
    });
    rows.sort((x, y) => y.max - x.max || (x.k < y.k ? -1 : x.k > y.k ? 1 : 0));
    return rows.slice(0, limit);
  }

  // the union tree of /data/compare-tree.<kind>.json with each item's cumulative shares (data.cum = [[index, n]]):
  // a node stays when some item has at least minShare in it; its depth counts the kept ancestors, siblings go
  // by their peak share. Above `limit` rows only the `limit` largest peaks stay (an ancestor's cumulative share
  // is never below its child's, so the cut keeps the tree whole). A node with no kits anywhere never shows.
  // null when an item lacks cum or its cum was built against another union (cumN ≠ the union's size).
  function treeRows(datas, union, minShare = MIN_SHARE, limit = TOP_ROWS * 2) {
    if (!union || !union.nodes || datas.some((d) => d && d.n && (!d.cum || d.cumN !== union.nodes.length))) return null;
    const nodes = union.nodes;
    const shareOf = datas.map((d) => { if (!d || !d.n) return null; const m = new Map(); for (const [i, n] of d.cum) m.set(i, n / d.n); return m; });
    const vals = (i) => shareOf.map((m) => (m ? m.get(i) || 0 : null));
    const peaks = nodes.map((n, i) => Math.max(...vals(i).map((v) => (v == null ? -1 : v))));
    const peak = (i) => peaks[i];
    let kept = new Set();
    nodes.forEach((n, i) => { if (peak(i) > 0 && peak(i) >= minShare) kept.add(i); });
    if (kept.size > limit) kept = new Set([...kept].sort((x, y) => peak(y) - peak(x) || x - y).slice(0, limit));
    const keptParent = (i) => { let p = nodes[i][0]; while (p >= 0 && !kept.has(p)) p = nodes[p][0]; return p; };
    const children = new Map(), roots = [];
    for (const i of kept) { const p = keptParent(i); if (p < 0) roots.push(i); else (children.get(p) || children.set(p, []).get(p)).push(i); }
    const byPeak = (a, b) => peak(b) - peak(a) || a - b;
    const out = [];
    const walk = (i, depth) => { const shares = vals(i); out.push({ k: nodes[i][1], shown: nodes[i][2], depth, shares, max: peak(i) }); for (const c of (children.get(i) || []).sort(byPeak)) walk(c, depth + 1); };
    for (const r of roots.sort(byPeak)) walk(r, 0);
    return out;
  }

  return { COMPACT_FROM, MIN_SHARE, TOP_ROWS, SMALL_N, parseHash, serializeHash, shares, cosine, nearestLinks, fitMds, similarityMatrix, combineMatrices, branchRows, treeRows };
});
