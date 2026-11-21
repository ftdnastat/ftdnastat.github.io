(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CompareCore = factory();
})(this, function () {
  "use strict";

  const MAX_ITEMS = 8;
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
        if (!m || seen.has(tok) || out.items.length >= MAX_ITEMS) continue;
        seen.add(tok);
        out.items.push({ t: m[1], id: m[2] });
      }
    }
    return out;
  }

  function serializeHash(items) {
    const a = items.slice(0, MAX_ITEMS).map((x) => x.t + ":" + x.id).join(",");
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

  return { MAX_ITEMS, COMPACT_FROM, MIN_SHARE, TOP_ROWS, SMALL_N, parseHash, serializeHash, shares, cosine, similarityMatrix, combineMatrices, branchRows, treeRows };
});
