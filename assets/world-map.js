// The world map with modes (/map/): every country and region coloured by the mode the form picks; state in the hash.
(function () {
  "use strict";
  const fig = document.getElementById("wmap"), blobEl = document.getElementById("wmap-data"), form = document.querySelector(".wm-form");
  const C = window.WorldMapCore;
  if (!fig || !blobEl || !form || !C) return;
  const S = JSON.parse(blobEl.textContent);
  const frame = fig.querySelector(".cmap-frame"), cap = fig.querySelector(".cmap-cap"), legendEl = fig.querySelector(".wm-legend"), qEl = document.querySelector(".wm-q");
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  const nf = (x) => x.toLocaleString(S.lang === "ru" ? "ru-RU" : "en-US");
  const pf = (x, d = 0) => { const s = (100 * x).toFixed(d); return (S.lang === "ru" ? s.replace(".", ",") : s) + "%"; };
  const df = (x, d = 2) => { const s = x.toFixed(d); return S.lang === "ru" ? s.replace(".", ",") : s; };
  const SEQ = [15, 32, 50, 70, 100].map((p) => "color-mix(in srgb,var(--acc) " + p + "%,var(--surface))");
  const div = (sign, step) => "color-mix(in srgb," + (sign > 0 ? "var(--s2)" : "var(--s7)") + " " + [28, 45, 62, 80, 100][step] + "%,var(--surface))";
  const CAT = (i) => (i >= 0 && i < 20 ? "var(--s" + (i + 1) + ")" : "var(--s0)");
  const binOf = (v, edges) => { const i = edges.findIndex((e) => v <= e); return i < 0 ? edges.length : i; };

  Promise.all([window.ftdMapWorld || fetch("/assets/map-world.json").then((r) => r.json()), fetch("/data/world-map.json").then((r) => r.json())]).then(([geo, D]) => {
    const units = new Map(D.units.map((u) => [u.s, u]));
    const isSub = (id) => { const u = units.get(id); return Boolean(u && u.p); };
    // "places of ancestors": the same units with geographic project counts instead of FTDNA's; testing and kin stay FTDNA's
    const geoUnits = D.units.map((u) => ({ ...u, n: u.g ? u.g.n : [0, 0], l: u.g ? u.g.l : {} })), geoBy = new Map(geoUnits.map((u) => [u.s, u]));
    const FTDNA_ONLY = new Set(["ratio", "tested", "kin"]);
    const useGeo = () => form.elements.src.value === "geo" && !FTDNA_ONLY.has(form.elements.m.value);
    const LIST = () => (useGeo() ? geoUnits : D.units), BY = () => (useGeo() ? geoBy : units);
    const svg = el("svg", { viewBox: "0 0 " + geo.w + " " + geo.h, role: "img", "aria-label": fig.getAttribute("aria-label") });
    const defs = el("defs", {}), pat = el("pattern", { id: "wm-hatch", width: "5", height: "5", patternUnits: "userSpaceOnUse" });
    pat.appendChild(el("rect", { width: "5", height: "5", class: "cmap-hatch-bg" }));
    pat.appendChild(el("line", { x1: "0", y1: "0", x2: "0", y2: "5", class: "cmap-hatch-ln" }));
    defs.appendChild(pat);
    svg.appendChild(defs);
    const g = el("g", {}), paths = new Map();
    for (const u of [...geo.units].sort((a, b) => isSub(a.id) - isSub(b.id))) { const p = el("path", { d: u.d, class: "u", "data-id": u.id }); paths.set(u.id, p); g.appendChild(p); }
    svg.appendChild(g);
    svg.appendChild(el("path", { d: geo.borders, class: "brd" }));
    frame.appendChild(svg);

    const F = form.elements;
    const letterOf = (d, i) => D.letters[d][i];
    const countOf = (u, d, L) => (u.l[d] || []).reduce((a, [i, v]) => a + (i === L ? v : 0), 0);
    const index = {}, files = new Map();
    // branch: the loaded one for this line; state: "" | "wait" | "none" | "err"; seq drops stale answers
    let branch = null, state = "", seq = 0;
    const getJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });
    const cached = (map, key, url) => { if (!map.has(key)) map.set(key, getJson(url).catch((e) => { map.delete(key); throw e; })); return map.get(key); };
    const indexes = new Map();
    function loadIndex(d) {
      return cached(indexes, d, "/data/wm/" + d + "-index.json").then((rows) => {
        if (!index[d]) {
          const byName = new Map();
          // "R-M269", "M269" and the label all find the branch
          for (const [name, slug, label] of rows) for (const key of [name, name.replace(/^[A-Z][A-Za-z0-9]*-/, ""), label]) if (key && !byName.has(key.toLowerCase())) byName.set(key.toLowerCase(), { name, slug });
          index[d] = { rows, byName };
        }
        const dl = document.getElementById("wm-branches");
        if (dl.dataset.d !== d && d === F.d.value) { dl.replaceChildren(...rows.map(([name, , label]) => new Option(label && label !== name ? label : "", name))); dl.dataset.d = d; }
        return index[d];
      });
    }
    const wantsBranch = () => F.lv.value === "branch" && (F.m.value === "share" || F.m.value === "diff");
    function refreshBranch() {
      const my = ++seq, d = F.d.value, want = F.b.value.trim().toLowerCase();
      branch = null;
      state = wantsBranch() && want ? "wait" : "";
      paint();
      if (!wantsBranch()) return;
      const settle = (next, k) => { if (my !== seq) return; branch = k ? { name: next, k } : null; state = k ? "" : next; paint(); };
      loadIndex(d).then((ix) => {
        if (my !== seq || !want) return null;
        const hit = ix.byName.get(want);
        if (!hit) return ["none", null];
        return cached(files, d + "/" + hit.slug, "/data/wm/" + d + "/" + hit.slug + ".json").then((k) => [hit.name, k]);
      }, () => ["err", null]).then((r) => { if (r) settle(r[0], r[1]); }, () => settle("err", null));
    }
    function fillSelects() {
      const d = F.d.value, n = +F.n.value;
      const keepL = F.l.value ? F.l.selectedOptions[0].textContent : null, keepC = F.c.value;
      const tot = new Map();
      for (const u of LIST()) if (!u.p) for (const [i, v] of u.l[d] || []) tot.set(i, (tot.get(i) || 0) + v);
      F.l.replaceChildren(...[...tot].sort((a, b) => b[1] - a[1]).map(([i]) => new Option(letterOf(d, i), String(i))));
      // the letter is kept by name: the indexes of the two lines differ
      const same = [...F.l.options].find((o) => o.textContent === keepL);
      if (same) F.l.value = same.value;
      const big = LIST().filter((u) => u.n[d === "y" ? 0 : 1] >= n).sort((a, b) => (S.names[a.s] || a.s).localeCompare(S.names[b.s] || b.s));
      F.c.replaceChildren(...big.map((u) => new Option(S.names[u.s] || u.s, u.s)));
      if ([...F.c.options].some((o) => o.value === keepC)) F.c.value = keepC;
      else if ([...F.c.options].some((o) => o.value === "russian-federation")) F.c.value = "russian-federation";
    }

    function compute() {
      const m = F.m.value, d = F.d.value, n = +F.n.value, di = d === "y" ? 0 : 1, out = new Map();
      const L = F.l.value === "" ? -1 : +F.l.value, byBranch = F.lv.value === "branch";
      const kOf = (u) => (byBranch ? (branch && (branch.k[useGeo() ? "g" : "f"] || {})[u.s]) || 0 : countOf(u, d, L));
      if (byBranch && !branch && (m === "share" || m === "diff")) return { out, legend: { kind: "seq", items: [] }, missing: state || "pick" };
      const ok = (u) => u.n[di] >= n;
      // regions repeat their country's kits: pooled measures take countries only
      const top = (u) => !u.p;
      const legend = { kind: "seq", items: [] };
      const seqLegend = (edges, show) => (edges ? SEQ.map((c, i) => [c, (i ? show(edges[i - 1]) : "") + (i < 4 ? "–" + show(edges[i]) : "+")]) : []);
      if (m === "top") {
        const seen = new Map();
        for (const u of LIST()) {
          const c = u.l[d] || [];
          if (!ok(u) || !c.length) continue;
          const [i, v] = c.reduce((a, b) => (b[1] > a[1] ? b : a));
          out.set(u.s, { fill: CAT(i), text: letterOf(d, i) + " — " + pf(v / u.n[di]) });
          if (top(u)) seen.set(i, (seen.get(i) || 0) + 1);
        }
        legend.kind = "cat";
        legend.items = [...seen].sort((a, b) => b[1] - a[1]).map(([i, c]) => [CAT(i), letterOf(d, i) + " · " + nf(c)]);
      } else if (m === "share") {
        const vals = [];
        for (const u of LIST()) if (ok(u)) vals.push([u, Math.min(1, kOf(u) / u.n[di])]);
        const max = Math.max(1e-9, ...vals.map((x) => x[1])), edges = [1, 2, 3, 4].map((i) => max * (i / 5) ** 2);
        for (const [u, v] of vals) out.set(u.s, { fill: SEQ[binOf(v, edges)], text: pf(v, 1) });
        legend.items = SEQ.map((c, i) => [c, (i ? pf(edges[i - 1], 1) : "0") + "–" + (i < 4 ? pf(edges[i], 1) : pf(max, 1))]);
      } else if (m === "diff") {
        const ref = new Map(), byMacro = F.ref.value === "macro";
        for (const u of LIST()) {
          if (!top(u) || !ok(u)) continue;
          const key = byMacro ? u.r : "w", r = ref.get(key) || ref.set(key, { k: 0, n: 0 }).get(key);
          r.k += kOf(u);
          r.n += u.n[di];
        }
        for (const u of LIST()) {
          const r = ok(u) && ref.get(byMacro ? u.r : "w");
          if (!r || !r.n) continue;
          const x = C.diff(kOf(u), u.n[di], r.k / r.n);
          out.set(u.s, { fill: div(x.v, binOf(Math.abs(x.v), [0.05, 0.15, 0.3, 0.5])), text: pf(x.p, 1) + " / " + pf(r.k / r.n, 1) });
        }
        legend.kind = "div";
        legend.ends = [S.s.wmBelow, S.s.wmAbove];
      } else if (m === "ratio") {
        let ty = 0, tm = 0;
        for (const u of LIST()) if (top(u)) { ty += u.n[0]; tm += u.n[1]; }
        for (const u of LIST()) {
          if (u.n[0] < n || u.n[1] < n) continue;
          const v = Math.log2((u.n[1] / u.n[0]) / (tm / ty));
          out.set(u.s, { fill: div(v, binOf(Math.abs(v), [0.25, 0.5, 1, 1.5])), text: "mt/Y " + df(u.n[1] / u.n[0]) });
        }
        legend.kind = "div";
        legend.ends = [S.s.wmLessMt, S.s.wmMoreMt];
      } else if (m === "similar") {
        const base = BY().get(F.c.value);
        if (base && ok(base)) {
          const b = C.shares(base.l[d] || []);
          for (const u of LIST()) if (ok(u)) { const v = u.s === base.s ? 1 : 1 - C.jsd(C.shares(u.l[d] || []), b); out.set(u.s, { fill: u.s === base.s ? "var(--ink)" : SEQ[binOf(v, [0.2, 0.4, 0.6, 0.8])], text: pf(v) }); }
          legend.items = SEQ.map((c, i) => [c, pf(i / 5) + "–" + pf((i + 1) / 5)]).concat([["var(--ink)", S.names[base.s] || base.s]]);
        }
      } else if (m === "diversity") {
        const vals = [];
        for (const u of LIST()) { if (!ok(u)) continue; const v = C.diversity(u.l[d] || []); if (v != null) vals.push([u, v]); }
        const edges = C.quantEdges(vals.filter(([u]) => top(u)).map((x) => x[1]));
        if (edges) for (const [u, v] of vals) out.set(u.s, { fill: SEQ[binOf(v, edges)], text: df(v) });
        legend.items = seqLegend(edges, (x) => df(x));
      } else if (m === "clusters") {
        const list = LIST().filter((u) => top(u) && ok(u) && (u.l[d] || []).length).sort((a, b) => b.n[di] - a.n[di]);
        const vec = list.map((u) => C.shares(u.l[d]));
        const dist = vec.map((a, i) => vec.map((b, j) => (i === j ? 0 : C.jsd(a, b))));
        const { medoids, assign } = C.kMedoids(dist, +F.k.value);
        const tops = medoids.map((mi) => [...vec[mi]].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([i]) => letterOf(d, i)).join(", "));
        list.forEach((u, i) => out.set(u.s, { fill: CAT(assign[i]), text: fmt(S.s.wmCluster, { i: assign[i] + 1, top: tops[assign[i]] }) }));
        legend.kind = "cat";
        legend.items = tops.map((tp, j) => [CAT(j), (j + 1) + ": " + tp]);
      } else if (m === "tested" || m === "kin") {
        const vals = [];
        for (const u of LIST()) { const v = m === "tested" ? u.t && u.t[di] : u.k; if (v != null) vals.push([u, v]); }
        const edges = C.quantEdges(vals.map((x) => x[1])), show = (x) => (m === "tested" ? df(x, 1) : pf(x, 1));
        if (edges) for (const [u, v] of vals) out.set(u.s, { fill: SEQ[binOf(v, edges)], text: show(v) });
        legend.items = seqLegend(edges, show);
      }
      return { out, legend };
    }

    const sw = (c, text, cls) => { const s = document.createElement("span"), i = document.createElement("i"); i.className = "cmap-sw" + (cls ? " " + cls : ""); if (c) i.style.background = c; s.append(i, text); return s; };
    let cur = new Map();
    function paint() {
      const m = F.m.value, d = F.d.value, di = d === "y" ? 0 : 1, n = +F.n.value;
      const pickable = m === "share" || m === "diff";
      for (const [k, on] of [["lv", pickable], ["l", pickable && F.lv.value === "letter"], ["b", pickable && F.lv.value === "branch"], ["ref", m === "diff"], ["c", m === "similar"], ["k", m === "clusters"], ["d", m !== "ratio" && m !== "kin"], ["src", !FTDNA_ONLY.has(m)], ["n", m !== "tested" && m !== "kin"]]) form.querySelector(".wm-" + k).hidden = !on;
      const { out, legend, missing } = compute();
      cur = out;
      const nOf = (u) => (m === "ratio" ? Math.min(u.n[0], u.n[1]) : u.n[di]);
      for (const [id, p] of paths) {
        const u = BY().get(id), v = out.get(id);
        // a region without its own value lets its country's colour through; hatching means too few samples, nothing else
        let fill = "var(--grid)";
        if (v) fill = v.fill;
        else if (u && u.p) fill = "transparent";
        else if (u && m !== "tested" && m !== "kin" && nOf(u) > 0 && nOf(u) < n) fill = "url(#wm-hatch)";
        p.style.fill = fill;
        p.classList.toggle("wm-clear", fill === "transparent");
      }
      legendEl.replaceChildren();
      if (legend.kind === "div") {
        const wrap = document.createElement("span"), b1 = document.createElement("b"), b2 = document.createElement("b");
        wrap.className = "wm-div";
        b1.textContent = legend.ends[0];
        b2.textContent = legend.ends[1];
        const steps = [4, 3, 2, 1, 0].map((s) => div(-1, s)).concat([0, 1, 2, 3, 4].map((s) => div(1, s)));
        wrap.append(b1, ...steps.map((c) => { const i = document.createElement("i"); i.className = "cmap-sw"; i.style.background = c; return i; }), b2);
        legendEl.append(wrap);
      } else for (const [c, t] of legend.items) legendEl.append(sw(c, t));
      if (m !== "tested" && m !== "kin") legendEl.append(sw("var(--grid)", S.s.wmLegendNone), sw(null, fmt(useGeo() ? S.s.wmLegendSmallGeo : S.s.wmLegendSmall, { n: nf(n) }), "msm"));
      qEl.textContent = S.modes[m] + " " + (missing ? { wait: "", none: S.s.wmBranchNone, err: S.s.wmBranchErr, pick: S.s.wmBranchPick }[missing] : fmt(S.s.wmShown, { n: nf(out.size) }));
      cap.textContent = "";
      const st = new URLSearchParams();
      for (const k of ["m", "d", "src", "lv", "l", "b", "ref", "c", "k", "n"]) {
        if (form.querySelector(".wm-" + k).hidden || F[k].value === "") continue;
        st.set(k, k === "l" ? F.l.selectedOptions[0].textContent : k === "b" ? (branch ? branch.name : F.b.value.trim()) : F[k].value);
      }
      history.replaceState(null, "", "#" + st.toString());
    }

    function say(id) {
      const u = BY().get(id), v = cur.get(id);
      if (!u) { cap.textContent = ""; return; }
      const m = F.m.value, di = F.d.value === "y" ? 0 : 1;
      cap.textContent = (S.names[id] || id) + ": " + (v ? fmt(S.s["wmCap_" + m], { v: v.text, nn: fmt(useGeo() ? S.s.wmNPeople : S.s.wmNKits, { n: nf(u.n[di]) }), y: nf(u.n[0]), mt: nf(u.n[1]) }) : S.s.wmNoData);
    }
    const unitAt = (ev) => { const t = ev.target.closest && ev.target.closest(".u"); return t && t.dataset.id; };
    svg.addEventListener("mouseover", (ev) => { const id = unitAt(ev); if (id) say(id); });
    svg.addEventListener("click", (ev) => say(unitAt(ev)));

    const viewBtns = [...fig.querySelectorAll(".wm-views .tab")];
    function view(v) {
      const b = v !== "world" && geo.views[v];
      let box = [0, 0, geo.w, geo.h];
      if (b) { const [x, y, w, h] = b, W = Math.max(w, h * 2) * 1.08, Hh = W / 2; box = [x + w / 2 - W / 2, y + h / 2 - Hh / 2, W, Hh]; }
      svg.setAttribute("viewBox", box.map((x) => x.toFixed(1)).join(" "));
      svg.classList.toggle("zoom", Boolean(b));
      viewBtns.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === v)));
    }
    viewBtns.forEach((b) => { if (b.dataset.v !== "world" && !geo.views[b.dataset.v]) b.remove(); else b.addEventListener("click", () => view(b.dataset.v)); });

    // the hash first, so a shared link opens on its own map
    function fromHash() {
      const h = new URLSearchParams(location.hash.slice(1));
      for (const k of ["m", "d", "src", "lv", "ref", "k", "n"]) if (h.get(k) && [...F[k].options].some((o) => o.value === h.get(k))) F[k].value = h.get(k);
      F.b.value = h.get("b") || F.b.value;
      fillSelects();
      const l = [...F.l.options].find((o) => o.textContent === h.get("l"));
      if (l) F.l.value = l.value;
      if (h.get("c") && [...F.c.options].some((o) => o.value === h.get("c"))) F.c.value = h.get("c");
      refreshBranch();
    }
    form.addEventListener("change", (ev) => {
      if (ev.target === F.d || ev.target === F.n || ev.target === F.src || ev.target === F.m) fillSelects();
      if (ev.target === F.d || ev.target === F.b || ev.target === F.lv || ev.target === F.m) refreshBranch(); else paint();
    });
    F.b.addEventListener("focus", () => { loadIndex(F.d.value).catch(() => {}); });
    window.addEventListener("hashchange", fromHash);
    fromHash();
    view("world");
  }).catch((e) => { fig.hidden = true; form.hidden = true; if (qEl) qEl.hidden = true; console.error("world map:", e); });
})();
