// Pure core of /culture/compare/: which branch each ancient sample shows at a given tree depth,
// the columns and ribbons of the chart, the pair statistics and the SVG itself. No DOM here, so the
// same file runs in the browser and in jest (UMD, like compare-core.js).
//
// Data: /data/paleo-y.json, built by site/lib/paleo-compare.js
//   nodes[i] = [parent, name, label, depth, group, age]   in DFS pre-order, so i is also the row order
//     parent  index of the parent node, -1 for the root of a letter (R-M207, I-M170 …)
//     depth   levels below that letter root (R-M207 = 0, R-M173 = 1, R-M343 = 2 …)
//     group   index of the nearest node at or above with a short label (R1b, R1a, I2a1, G2a …)
//     age     TMRCA of the branch from Discover, a year (−2900 = 2900 BCE), or null; the age mode
//             cuts by it
//   cultures[] = { s, ru, en, n, year, x: [node index per sample], u: samples outside the tree }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PaleoCore = factory();
})(this, function () {
  "use strict";

  const MIN_ITEMS = 2;
  const MAX_ITEMS = 4;
  const MAX_SEGMENTS = 32; // auto depth: the deepest level at which every column still reads
  const SLUG = /^(tag:)?[a-z0-9][a-z0-9-]*$/;

  const AGE_STEP = 500;
  // as site/lib/significance.js: below this many samples a share shows its 95% Wilson interval in a tooltip
  const UNCERTAIN_N = 30;
  function wilson(k, n, z = 1.96) {
    if (!n) return null;
    const p = k / n, z2 = z * z, d = 1 + z2 / n;
    const c = (p + z2 / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / d;
    return [Math.max(0, c - h), Math.min(1, c + h)];
  }
  // " · 95% interval 65–99%" for a small sample, "" otherwise
  const ciNote = (k, n, i18n) => { if (n >= UNCERTAIN_N || !i18n.ciRange) return ""; const w = wilson(k, n); return "; " + fmt(i18n.ciRange, { lo: Math.round(100 * w[0]), hi: Math.round(100 * w[1]) }); };

  // ---- state in the URL: #c=yamnaya,corded-ware,bell-beaker&a=-2500 cuts both trees at one year;
  // &d=9&dm=2 cuts the Y tree and the mt tree at their own depths
  function parseHash(hash) {
    const out = { cultures: [], depth: null, depthMt: null, age: null };
    for (const part of String(hash || "").replace(/^#/, "").split("&")) {
      const [k, v = ""] = part.split("=");
      let val = v;
      try { val = decodeURIComponent(v); } catch (e) { continue; }
      if (k === "c") for (const s of val.split(",")) if (SLUG.test(s) && !out.cultures.includes(s) && out.cultures.length < MAX_ITEMS) out.cultures.push(s);
      if (k === "d" && /^\d{1,2}$/.test(v)) out.depth = Number(v);
      if (k === "a" && /^-?\d{1,6}$/.test(v)) out.age = Number(v);
      if (k === "dm" && /^\d{1,2}$/.test(v)) out.depthMt = Number(v);
    }
    return out;
  }
  const formatHash = ({ cultures, depth, depthMt, age }) => "#c=" + cultures.join(",") + (age != null ? "&a=" + age : (depth != null ? "&d=" + depth : "") + (depthMt != null ? "&dm=" + depthMt : ""));

  // ---- tree helpers ----------------------------------------------------------------------------
  const P = 0, NAME = 1, LABEL = 2, DEPTH = 3, GROUP = 4, AGE = 5;

  // ancestor of node i at depth d; a node shallower than d stays itself (its test went no deeper)
  function atDepth(nodes, i, d) {
    while (nodes[i][DEPTH] > d) i = nodes[i][P];
    return i;
  }
  // year by which the line of node i had split off: its parent's TMRCA, a child's TMRCA clamped to be
  // no older than its parent's (Discover estimates are not always monotone); a letter root is always there
  const BORN = new WeakMap();
  function born(data) {
    if (BORN.has(data)) return BORN.get(data);
    const nodes = data.nodes, tmrca = new Array(nodes.length), out = new Array(nodes.length);
    nodes.forEach((n, i) => {
      const up = n[P] >= 0 ? tmrca[n[P]] : -Infinity;
      tmrca[i] = n[AGE] == null ? up : Math.max(n[AGE], up);
      out[i] = n[P] >= 0 ? up : -Infinity;
    });
    BORN.set(data, out);
    return out;
  }
  // ancestor of node i whose line already existed in the given year
  function atAge(data, i, year) {
    const b = born(data);
    while (b[i] > year) i = data.nodes[i][P];
    return i;
  }
  // a cut is a depth (number) or { age: year }
  const placer = (data, cut) => (typeof cut === "number" ? (i) => atDepth(data.nodes, i, cut) : (i) => atAge(data, i, cut.age));

  function isAncestor(nodes, a, b) {
    for (let x = nodes[b][P]; x >= 0; x = nodes[x][P]) if (x === a) return true;
    return false;
  }
  const snp = (name) => { const k = name.indexOf("-"); return k >= 0 ? name.slice(k + 1) : name; };

  // ---- columns ---------------------------------------------------------------------------------
  // one column per culture: counts per displayed node and per group, both in tree order
  function column(data, culture, cut) {
    const clades = new Map(), groups = new Map(), cladesOf = new Map(), at = placer(data, cut);
    for (const i of culture.x) {
      const d = at(i);
      clades.set(d, (clades.get(d) || 0) + 1);
      const g = data.nodes[i][GROUP];
      groups.set(g, (groups.get(g) || 0) + 1);
      if (!cladesOf.has(g)) cladesOf.set(g, new Set());
      cladesOf.get(g).add(d);
    }
    const byOrder = (m) => [...m].sort((a, b) => a[0] - b[0]).map(([node, n]) => ({ node, n }));
    return { slug: culture.s, culture, n: culture.x.length, clades: byOrder(clades), groups: byOrder(groups).map((r) => ({ ...r, clades: cladesOf.get(r.node) })) };
  }

  // "X*": in this culture X holds samples whose test stops at X, next to samples shown deeper inside X
  function markStars(nodes, cols) {
    for (const c of cols) {
      const above = new Set();
      for (const r of c.clades) for (let x = nodes[r.node][P]; x >= 0 && !above.has(x); x = nodes[x][P]) above.add(x);
      for (const r of c.clades) r.star = above.has(r.node);
    }
    return cols;
  }

  const rootOf = (nodes, i) => { while (nodes[i][P] >= 0) i = nodes[i][P]; return i; };

  // rows go letter by letter, the letters largest first across the chosen cultures (R above G and Q,
  // as one expects); inside a letter the tree order stays, so a branch sits under its parent
  function rowOrder(nodes, cols) {
    const size = new Map();
    for (const c of cols) for (const r of c.clades) { const k = rootOf(nodes, r.node); size.set(k, (size.get(k) || 0) + r.n / c.n); }
    const key = (i) => [-(size.get(rootOf(nodes, i)) || 0), rootOf(nodes, i), i];
    return (a, b) => { const x = key(a.node), y = key(b.node); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
  }
  function orderRows(nodes, cols) {
    const cmp = rowOrder(nodes, cols);
    for (const c of cols) {
      c.clades.sort(cmp);
      // a group sits level with its first branch: G-M201 above G-P15 in the tree, but its Z8022 comes after the P15 rows
      const rank = new Map(c.clades.map((r, k) => [r.node, k]));
      const first = (g) => Math.min(...[...g.clades].map((d) => rank.get(d)));
      c.groups.sort((a, b) => first(a) - first(b) || cmp(a, b));
    }
    return cols;
  }

  function columns(data, slugs, cut) {
    const bySlug = new Map(data.cultures.map((c) => [c.s, c]));
    const cols = slugs.map((s) => bySlug.get(s)).filter(Boolean).map((c) => column(data, c, cut));
    return orderRows(data.nodes, markStars(data.nodes, cols));
  }

  // the deepest level at which no column has more than MAX_SEGMENTS rows
  function autoDepth(data, slugs, max = MAX_SEGMENTS) {
    let best = 1;
    for (let d = 1; d <= maxDepth(data, slugs); d++) {
      if (columns(data, slugs, d).every((c) => c.clades.length <= max)) best = d; else break;
    }
    return best;
  }
  // depths at which the picture changes: in the real FTDNA tree long chains of nodes change nothing,
  // so the slider walks these stops instead of every level
  function depthStops(data, slugs) {
    const out = [];
    let prev = null;
    for (let d = 1; d <= maxDepth(data, slugs); d++) {
      const sig = columns(data, slugs, d).map((c) => c.clades.map((r) => r.node).join(",")).join("|");
      if (sig !== prev) out.push(d);
      prev = sig;
    }
    return out;
  }
  // age mode: the picture changes only when some line on a sample's path appears, so the stops are the
  // years those lines split off, rounded up to AGE_STEP
  function ageStops(data, slugs) {
    const b = born(data), seen = new Set(), out = new Set();
    for (const c of data.cultures) if (slugs.includes(c.s)) for (const i of c.x) {
      for (let x = i; x >= 0 && !seen.has(x); x = data.nodes[x][P]) { seen.add(x); if (b[x] > -Infinity) out.add(Math.ceil(b[x] / AGE_STEP) * AGE_STEP + 0); }
    }
    return out.size ? [...out].sort((a, z) => a - z) : [0];
  }
  // the lines as they were when the oldest chosen culture lived: a later branch cannot link it to the
  // others; earlier still if some column would get more than max rows
  function autoAge(data, slugs, max = MAX_SEGMENTS) {
    const stops = ageStops(data, slugs);
    const years = data.cultures.filter((c) => slugs.includes(c.s) && c.year != null).map((c) => c.year);
    const until = years.length ? Math.min(...years) : Infinity;
    for (let k = stops.length - 1; k >= 0; k--) {
      if (stops[k] > until && k > 0) continue;
      if (k === 0 || columns(data, slugs, { age: stops[k] }).every((c) => c.clades.length <= max)) return stops[k];
    }
    return stops[0];
  }
  function maxDepth(data, slugs) {
    let m = 1;
    for (const c of data.cultures) if (slugs.includes(c.s)) for (const i of c.x) m = Math.max(m, data.nodes[i][DEPTH]);
    return m;
  }

  // ---- statistics for a pair of neighbouring columns ---------------------------------------------
  //   a→b      share of a's samples whose displayed branch also occurs in b
  //   matched  (matched a + matched b) / (n a + n b)
  //   overlap  Σ min(share in a, share in b) over displayed branches
  function pairStats(a, b) {
    const ma = new Map(a.clades.map((r) => [r.node, r.n])), mb = new Map(b.clades.map((r) => [r.node, r.n]));
    let ab = 0, ba = 0, overlap = 0;
    for (const [k, v] of ma) if (mb.has(k)) { ab += v; overlap += Math.min(v / a.n, mb.get(k) / b.n); }
    for (const [k, v] of mb) if (ma.has(k)) ba += v;
    return { ab, ba, na: a.n, nb: b.n, shareAB: a.n ? ab / a.n : 0, shareBA: b.n ? ba / b.n : 0, matched: a.n + b.n ? (ab + ba) / (a.n + b.n) : 0, overlap };
  }

  // ---- layout ----------------------------------------------------------------------------------
  // Each culture has a group bar (R1b, I2a1 …) and a clade bar on every side that faces a neighbour:
  // first [group|clade], middle [clade|group|clade], last [clade|group]. Every column is the same
  // height whatever its n, as shares; ribbons join the same branch in neighbouring clade bars.
  // without opt.width the chart takes its natural width: neighbours stand at most o.gap apart, up to 1200
  function layout(data, slugs, cut, opt = {}) {
    const o = Object.assign({ barH: 760, top: 90, barW: 105, groupW: 56, gap: 150, minWidth: 480, maxWidth: 1200, minSeg: 1.5, labelMin: 12, lang: "ru" }, opt);
    const cols = columns(data, slugs, cut);
    const k = cols.length;
    const blockW = (i) => o.groupW + o.barW * ((i > 0) + (i < k - 1));
    const used = cols.reduce((s, c, i) => s + blockW(i), 0);
    if (!o.width) o.width = Math.max(o.minWidth, Math.min(o.maxWidth, 40 + used + Math.max(k - 1, 0) * o.gap));
    // long culture names wrap within an equal share of the width; the bars move down by the extra lines
    const lines = cols.map((c) => wrap(c.culture[o.lang] || c.culture.en || c.culture.s, Math.max(10, Math.floor(((o.width - 40) / Math.max(k, 1) - 16) / HEAD_CHAR))));
    const extra = Math.max(0, ...lines.map((l) => l.length - 1)) * HEAD_LINE;
    o.top += extra;
    const gap = k > 1 ? (o.width - 40 - used) / (k - 1) : 0;
    const bars = [], ribbons = [], heads = [];
    const sideOf = []; // per column: { left, right } → Map node → [y0, y1] and the bar x
    let x = 20;
    cols.forEach((c, i) => {
      const parts = [];
      if (i > 0) parts.push("cladeL");
      parts.push("group");
      if (i < k - 1) parts.push("cladeR");
      const side = {};
      // the first heading starts at the left edge, the last ends at the right one, so long names stay inside
      heads.push({ x: i === 0 && k > 1 ? x : i === k - 1 && k > 1 ? x + blockW(i) : x + blockW(i) / 2, anchor: i === 0 && k > 1 ? "start" : i === k - 1 && k > 1 ? "end" : "middle", title: c.culture, lines: lines[i], n: c.n });
      for (const p of parts) {
        const rows = p === "group" ? c.groups : c.clades;
        const pos = stack(rows, c.n, o);
        const w = p === "group" ? o.groupW : o.barW;
        for (const r of pos) bars.push({ kind: p === "group" ? "group" : "clade", x, w, y: r.y, h: r.h, node: r.node, n: r.n, total: c.n, star: !!r.star, slug: c.slug });
        if (p !== "group") side[p === "cladeL" ? "left" : "right"] = { x, map: new Map(pos.map((r) => [r.node, [r.y, r.y + r.h]])) };
        x += w;
      }
      sideOf.push(side);
      x += gap;
    });
    for (let i = 0; i + 1 < k; i++) {
      const a = sideOf[i].right, b = sideOf[i + 1].left;
      for (const [node, ya] of a.map) if (b.map.has(node)) ribbons.push({ node, x0: a.x + o.barW, y0: ya, x1: b.x, y1: b.map.get(node) });
    }
    const stats = [];
    for (let i = 0; i + 1 < k; i++) stats.push({ a: cols[i].culture, b: cols[i + 1].culture, ...pairStats(cols[i], cols[i + 1]) });
    return { o, cols, bars, ribbons, heads, stats, depth: typeof cut === "number" ? cut : null, age: typeof cut === "number" ? null : cut.age, headY: HEAD_Y + extra };
  }

  const HEAD_Y = 38, HEAD_LINE = 23, HEAD_CHAR = 11.5; // 19px bold Cyrillic: about 11.5px a character
  const TEXT_CHAR = 0.58; // regular Cyrillic with some capitals and digits: about 0.58 of the font size
  function wrap(text, max) {
    const out = [];
    for (const w of String(text).split(" ")) {
      const last = out[out.length - 1];
      if (last != null && (last + " " + w).length <= max) out[out.length - 1] = last + " " + w;
      else out.push(w);
    }
    return out;
  }

  // shares → y positions; tiny segments get a minimum height and the rest shrinks to fit
  function stack(rows, n, o) {
    const raw = rows.map((r) => Math.max(o.minSeg, (o.barH * r.n) / n));
    const scale = o.barH / raw.reduce((s, h) => s + h, 0);
    let y = o.top;
    return rows.map((r, i) => { const h = raw[i] * scale; const out = { ...r, y, h }; y += h; return out; });
  }

  // ---- SVG -------------------------------------------------------------------------------------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (x, lang) => { const s = (100 * x).toFixed(1); return (lang === "ru" ? s.replace(".", ",") : s) + "%"; };
  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));

  // colours by group, not by letter: R1a and R1b must differ, that is the point of a Yamnaya / Corded
  // Ware chart. The site palette goes to the largest groups of the selection in order, the rest is grey;
  // branches of one group alternate in lightness so neighbours stay apart.
  function groupColors(L, palette) {
    const total = new Map();
    for (const c of L.cols) for (const g of c.groups) total.set(g.node, (total.get(g.node) || 0) + g.n / c.n);
    return new Map([...total].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, palette.length).map(([g], i) => [g, palette[i]]));
  }

  // href(slug): the culture page, or null; with it the headings are links
  function svg(data, L, { lang = "ru", i18n, palette, grey = "#9aa3ad", ink = "#14202b", muted = "#5f6a75", bg = "#ffffff", href = null }) {
    const o = L.o, nodes = data.nodes;
    const gc = groupColors(L, palette);
    const colorOf = (node) => gc.get(nodes[node][GROUP]) || grey;
    const name = (c) => c[lang] || c.en || c.s;
    const tip = (b) => { const nd = nodes[b.node]; return nd[NAME] + (nd[LABEL] && nd[LABEL] !== nd[NAME] ? " (" + nd[LABEL] + ")" : "") + " · " + b.n + " / " + b.total + " · " + pct(b.n / b.total, lang) + ciNote(b.n, b.total, i18n); };
    const short = (b) => (b.kind === "group" ? nodes[b.node][LABEL] || nodes[b.node][NAME] : snp(nodes[b.node][NAME]) + (b.star ? "*" : ""));
    const shade = (b, idx) => (b.kind === "group" ? 1 : [1, 0.78, 0.6, 0.86, 0.68][idx % 5]);
    let s = "";
    for (const r of L.ribbons) {
      const mx = (r.x0 + r.x1) / 2;
      const d = "M" + r.x0 + "," + r.y0[0] + " C" + mx + "," + r.y0[0] + " " + mx + "," + r.y1[0] + " " + r.x1 + "," + r.y1[0] + " L" + r.x1 + "," + r.y1[1] + " C" + mx + "," + r.y1[1] + " " + mx + "," + r.y0[1] + " " + r.x0 + "," + r.y0[1] + " Z";
      s += '<path d="' + d + '" fill="' + colorOf(r.node) + '" fill-opacity="0.38"><title>' + esc(nodes[r.node][NAME]) + "</title></path>";
    }
    let idx = 0, prevX = null;
    for (const b of L.bars) {
      if (b.x !== prevX) { idx = 0; prevX = b.x; }
      s += '<rect x="' + b.x + '" y="' + b.y.toFixed(2) + '" width="' + b.w + '" height="' + b.h.toFixed(2) + '" fill="' + colorOf(b.node) + '" fill-opacity="' + shade(b, idx++) + '" stroke="' + bg + '" stroke-width="0.6"><title>' + esc(tip(b)) + "</title></rect>";
      if (b.h >= o.labelMin) s += '<text x="' + (b.x + b.w / 2) + '" y="' + (b.y + b.h / 2 + 4) + '" text-anchor="middle" font-size="' + (b.kind === "group" ? 14 : 12) + '" font-weight="600" fill="#fff" stroke="rgba(0,0,0,.45)" stroke-width="2.4" paint-order="stroke">' + esc(short(b)) + "</text>";
    }
    let links = 0;
    for (const h of L.heads) {
      const url = href ? href(h.title.s) : null;
      const head = '<text x="' + h.x + '" y="' + HEAD_Y + '" text-anchor="' + h.anchor + '" font-size="19" font-weight="700" fill="' + ink + '"' + (url ? ' class="pc-link"' : "") + ">" + h.lines.map((l, i) => '<tspan x="' + h.x + '" dy="' + (i ? HEAD_LINE : 0) + '">' + esc(l) + "</tspan>").join("") + "<title>" + esc(name(h.title)) + "</title></text>";
      s += url ? '<a href="' + esc(url) + '">' + head + "</a>" : head;
      if (url) links++;
      s += '<text x="' + h.x + '" y="' + (L.headY + 26) + '" text-anchor="' + h.anchor + '" font-size="14" fill="' + muted + '">' + esc(fmt(i18n.samples || "n={n}", { n: h.n })) + (h.title.year != null ? " · " + esc(yearText(h.title.year, lang, i18n)) : "") + "</text>";
    }
    let y = o.top + o.barH + 44;
    // lines under the chart wrap to its width; y ends on the baseline of the last line
    const para = (text, size, fill, title) => {
      const ls = wrap(text, Math.max(20, Math.floor((o.width - 40) / (size * TEXT_CHAR))));
      s += '<text x="20" y="' + y + '" font-size="' + size + '" fill="' + fill + '">' + ls.map((l, i) => '<tspan x="20" dy="' + (i ? Math.round(size * 1.3) : 0) + '">' + esc(l) + "</tspan>").join("") + (title ? "<title>" + esc(title) + "</title>" : "") + "</text>";
      y += (ls.length - 1) * Math.round(size * 1.3);
    };
    para(L.age != null ? fmt(i18n.ageLine, { y: yearText(L.age, lang, i18n) }) : fmt(i18n.depthLine, { d: L.depth }), 15, muted);
    for (const st of L.stats) {
      y += 34;
      para(fmt(i18n.pairLine, { a: name(st.a), b: name(st.b), p: pct(st.shareAB, lang), m: st.ab, n: st.na }), 16, ink, ciNote(st.ab, st.na, i18n).slice(2));
      y += 24;
      para(fmt(i18n.pairLine, { a: name(st.b), b: name(st.a), p: pct(st.shareBA, lang), m: st.ba, n: st.nb }), 16, ink, ciNote(st.ba, st.nb, i18n).slice(2));
      y += 22;
      para(fmt(i18n.totalLine, { m: pct(st.matched, lang), o: pct(st.overlap, lang) }), 14, muted);
    }
    y += 30;
    s += '<text x="' + (o.width - 20) + '" y="' + y + '" text-anchor="end" font-size="13" fill="' + muted + '">' + esc(i18n.source || "ftdnastat.github.io · FTDNA Discover") + "</text>";
    const H = y + 16;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + o.width + " " + H + '" width="' + o.width + '" height="' + H + '" style="--w:' + o.width + 'px" role="' + (links ? "group" : "img") + '" aria-label="' + esc(L.heads.map((h) => name(h.title)).join(" — ")) + '" font-family="IBM Plex Sans, system-ui, sans-serif"><rect width="100%" height="100%" fill="' + bg + '"/>' + s + "</svg>";
  }

  // the chart as a table for screen readers and copying: one row per displayed branch, a share per culture
  function table(data, L, { lang = "ru", i18n }) {
    const nodes = data.nodes, name = (c) => c[lang] || c.en || c.s;
    const seen = new Set();
    for (const c of L.cols) for (const r of c.clades) seen.add(r.node);
    const rows = [...seen].map((node) => ({ node })).sort(rowOrder(nodes, L.cols));
    const cell = (c, node) => {
      const r = c.clades.find((x) => x.node === node);
      if (!r) return "—";
      const text = esc(pct(r.n / c.n, lang) + " (" + r.n + ")"), note = ciNote(r.n, c.n, i18n);
      return note ? '<span class="unc" title="' + esc(note.slice(2)) + '">' + text + '<span class="sr-only"> (' + esc(note.slice(2)) + ")</span></span>" : text;
    };
    const head = '<thead><tr><th scope="col">' + esc(i18n.branch) + '</th><th scope="col">' + esc(i18n.group) + "</th>" + L.cols.map((c) => '<th scope="col" class="num">' + esc(name(c.culture)) + "</th>").join("") + "</tr></thead>";
    const body = rows.map((r) => { const nd = nodes[r.node], g = nodes[nd[GROUP]]; return '<tr><th scope="row" class="mono">' + esc(nd[NAME]) + "</th><td>" + esc(g[LABEL] || g[NAME]) + "</td>" + L.cols.map((c) => '<td class="num">' + cell(c, r.node) + "</td>").join("") + "</tr>"; }).join("");
    const foot = '<tfoot><tr><th scope="row">' + esc(i18n.total) + "</th><td></td>" + L.cols.map((c) => '<td class="num">' + c.n + "</td>").join("") + "</tr></tfoot>";
    return head + "<tbody>" + body + "</tbody>" + foot;
  }

  // oldest culture first by the median sample year; cultures without a year keep their order at the end
  function byYear(data, slugs) {
    const year = new Map(data.cultures.map((c) => [c.s, c.year]));
    return slugs.map((s, i) => [s, i]).sort((a, b) => {
      const x = year.get(a[0]), y = year.get(b[0]);
      return (x == null) - (y == null) || (x != null && y != null ? x - y : 0) || a[1] - b[1];
    }).map((x) => x[0]);
  }

  // ---- culture picker --------------------------------------------------------------------------
  function pickLabel(c, lang) {
    if (c.tag) return lang === "ru" ? c.ru : c.en;
    const ru = c.rp || c.ru;
    return lang === "ru" && ru && ru !== c.en ? c.en + " (" + ru + ")" : c.en;
  }
  // names that start with the query first, then the larger cultures
  function searchCultures(cultures, query, fold, exclude = []) {
    const q = fold(query);
    const keys = (c) => c._k || (c._k = [c.en, c.ru, c.rp, c.d, c.s].filter(Boolean).map(fold));
    const out = [];
    for (const c of cultures) {
      if (exclude.includes(c.s)) continue;
      const k = keys(c);
      if (!q) { out.push([c, 1]); continue; }
      if (k.some((x) => x.startsWith(q))) out.push([c, 0]);
      else if (k.some((x) => x.includes(q))) out.push([c, 1]);
    }
    return out.sort((a, b) => a[1] - b[1] || b[0].n - a[0].n).map((x) => x[0]);
  }

  // median sample year: −2900 → "~2900 до н. э." / "~2900 BCE"
  function yearText(year, lang, i18n) {
    const a = Math.abs(Math.round(year / 50) * 50);
    return "~" + a + " " + (year < 0 ? i18n.bce : i18n.ce);
  }

  return { MIN_ITEMS, MAX_ITEMS, MAX_SEGMENTS, AGE_STEP, UNCERTAIN_N, wilson, pickLabel, searchCultures, parseHash, formatHash, atDepth, atAge, born, isAncestor, column, columns, autoDepth, depthStops, ageStops, autoAge, maxDepth, pairStats, layout, groupColors, svg, table, byYear, yearText };
});
