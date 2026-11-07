(function () {
  "use strict";
  const root = document.getElementById("cc");
  const blobEl = document.getElementById("cc-data");
  if (!root || !blobEl) return;
  const D = JSON.parse(blobEl.textContent);
  const S = D.i18n, lang = D.lang, isY = D.kind === "y";
  const input = document.getElementById("cc-input");
  const list = document.getElementById("cc-list");
  const chipsEl = document.getElementById("cc-chips");
  const out = document.getElementById("cc-out");
  const empty = document.getElementById("cc-empty");
  const placeholder = input.placeholder;
  const COLORS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];
  const SVGNS = "http://www.w3.org/2000/svg";

  const nf = (n) => Math.round(n).toLocaleString(lang === "ru" ? "ru-RU" : "en-US");
  const pf = (x) => { const s = (100 * x).toFixed(x < 0.1 ? 1 : 0); return (lang === "ru" ? s.replace(".", ",") : s) + "%"; };
  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  // the same rounding as the branch page: hundreds of years, whole thousands from 10k
  const age = (y) => (y >= 10000 ? fmt(S.ageK, { n: nf(Math.ceil(y / 1000)) }) : fmt(S.yearsAgo, { n: nf(Math.round(y / 100) * 100) }));
  const pageHref = (slug) => "/" + lang + "/" + D.dir + "/" + slug + "/";

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function link(slug, text) {
    const a = el("a", null, text);
    a.href = pageHref(slug);
    return a;
  }
  function section(title, lead) {
    const s = el("section");
    const head = el("div", "sec-head");
    head.appendChild(el("h2", null, title));
    if (lead) head.appendChild(el("p", null, lead));
    s.appendChild(head);
    return s;
  }
  function swatch(i) {
    const dot = el("i", "cc-sw");
    dot.style.background = COLORS[i];
    return dot;
  }

  const parseHash = () => {
    const m = location.hash.match(/(?:^#|&)b=([^&]*)/);
    let raw = "";
    try { raw = m ? decodeURIComponent(m[1]) : ""; } catch (e) { /* a malformed hash opens an empty page */ }
    return raw.split(",").map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z0-9-]+$/.test(s)).filter((s, i, a) => a.indexOf(s) === i).slice(0, D.max);
  };
  let items = parseHash();
  const cache = new Map();
  let token = 0;

  function load(url) {
    if (!cache.has(url)) cache.set(url, fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => { cache.delete(url); return null; }));
    return cache.get(url);
  }
  const loadBranch = (slug) => load("/data/" + D.dir + "/" + slug + ".json");
  let countries = null;
  const loadCountries = () => countries || (countries = load("/data/compare-index.json").then((rows) => { if (!rows) countries = null; return new Map((rows || []).filter((r) => r.t === "c").map((r) => [r.id, r[lang] || r.en])); }));

  function syncInput() {
    input.disabled = items.length >= D.max;
    input.placeholder = input.disabled ? S.ccMax : placeholder;
  }
  function setItems(next) {
    items = next.slice(0, D.max);
    syncInput();
    try { history.replaceState(null, "", location.pathname + location.search + (items.length ? "#b=" + items.join(",") : "")); } catch (e) { /* file: or sandboxed */ }
    render();
  }

  // header search shards: Y by the first letter of the SNP, plus the labels (R1a, J2b); mt by the first letter of the name
  const shardOf = (q) => {
    const v = q.trim().toUpperCase();
    if (!v) return null;
    if (!isY) return "mt-clade-" + v.charAt(0).toLowerCase();
    const i = v.indexOf("-");
    const snp = i >= 0 ? v.slice(i + 1) : v;
    return snp ? "clade-" + snp.charAt(0).toLowerCase() : null;
  };
  const shards = new Map();
  function shard(name) {
    if (!shards.has(name)) shards.set(name, load("/search/" + name + ".json").then((rows) => rows || []));
    return shards.get(name);
  }
  // rows of branches without a page of their own (six fields) land on another page: not comparable
  const own = (rows) => rows.filter((r) => r.length < 6);
  let matches = [], active = -1, searchToken = 0;
  async function search(q) {
    const v = q.trim().toUpperCase().replace(/\*$/, "");
    if (!v) return [];
    const names = [shardOf(v)];
    if (isY) names.push("clade-labels");
    const rows = (await Promise.all(names.filter(Boolean).map(shard))).flat();
    const seen = new Set(items), outRows = [];
    const rank = (r) => {
      const name = r[0].toUpperCase(), snp = isY ? name.slice(name.indexOf("-") + 1) : name, label = String(r[3] || "").toUpperCase();
      if (name === v || snp === v || label === v) return 0;
      if (name.startsWith(v) || snp.startsWith(v) || label.startsWith(v)) return 1;
      return -1;
    };
    const ranked = own(rows).map((r) => ({ r, k: rank(r) })).filter((x) => x.k >= 0).sort((a, b) => a.k - b.k || b.r[2] - a.r[2]);
    for (const x of ranked) if (!seen.has(x.r[1])) { seen.add(x.r[1]); outRows.push(x.r); }
    return outRows.slice(0, 12);
  }

  function closeList() {
    searchToken++;
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }
  function setActive(i) {
    active = i;
    list.querySelectorAll("[role=option]").forEach((o, j) => {
      o.setAttribute("aria-selected", j === i ? "true" : "false");
      if (j === i) { input.setAttribute("aria-activedescendant", o.id); o.scrollIntoView({ block: "nearest" }); }
    });
  }
  async function openList() {
    if (input.disabled) return;
    const my = ++searchToken;
    const q = input.value;
    if (!q.trim()) { closeList(); return; }
    const found = await search(q);
    if (my !== searchToken) return;
    matches = found;
    list.textContent = "";
    input.removeAttribute("aria-activedescendant");
    if (!matches.length) {
      const li = el("li", "cp-none", S.ccNoMatch);
      li.setAttribute("role", "presentation");
      list.appendChild(li);
    }
    matches.forEach((r, i) => {
      const li = el("li", "cp-opt");
      li.id = "cc-opt-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.appendChild(el("span", "cp-opt-name", r[0] + (r[3] ? " · " + r[3] : "")));
      li.appendChild(el("small", "cp-opt-meta", (r[4] ? r[4] + " · " : "") + fmt(S.ccKits, { n: nf(r[2]) })));
      li.addEventListener("mousedown", (ev) => { ev.preventDefault(); add(r[1]); });
      list.appendChild(li);
    });
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    active = -1;
  }
  function add(slug) {
    if (items.length >= D.max || items.includes(slug)) return;
    input.value = "";
    closeList();
    setItems(items.concat([slug]));
    if (window.ftdTrack && items.length >= 2) window.ftdTrack("clade_compare", { entity: items.slice().sort().join(" + ") });
    if (!input.disabled) input.focus();
  }
  input.addEventListener("input", openList);
  input.addEventListener("blur", closeList);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (!matches.length || list.hidden) return;
      const step = ev.key === "ArrowDown" ? 1 : -1;
      setActive(active < 0 && step < 0 ? matches.length - 1 : (active + step + matches.length) % matches.length);
    } else if (ev.key === "Enter") {
      if (!list.hidden && matches.length) { ev.preventDefault(); add(matches[active >= 0 ? active : 0][1]); }
    } else if (ev.key === "Escape") closeList();
  });
  window.addEventListener("hashchange", () => { items = parseHash(); syncInput(); render(); });

  function renderChips(data) {
    chipsEl.textContent = "";
    items.forEach((slug, i) => {
      const d = data[i];
      const name = d ? d.name + (d.label && d.label !== d.name ? " · " + d.label : "") : slug;
      const chip = el("li", "cp-chip");
      chip.appendChild(swatch(i));
      chip.appendChild(d ? link(slug, name) : el("span", null, name));
      const b = el("button", "cp-x", "×");
      b.type = "button";
      b.setAttribute("aria-label", fmt(S.ccRemove, { name }));
      b.addEventListener("click", () => { setItems(items.filter((x) => x !== slug)); input.focus(); });
      chip.appendChild(b);
      chipsEl.appendChild(chip);
    });
  }

  const joinNames = (names) => (names.length < 3 ? names.join(S.ccAnd) : names.slice(0, -1).join(", ") + S.ccAnd + names[names.length - 1]);

  // the deepest node on every chain; a branch on another's chain sits inside it
  function meetSection(data) {
    const chains = data.map((d) => d.chain);
    let i = 0;
    while (chains.every((c) => i < c.length && c[i][0] === chains[0][i][0])) i++;
    const mrca = i ? chains[0][i - 1] : null;
    if (!mrca) return null;
    const s = section(S.ccMeetTitle);
    const p = el("p");
    const mrcaNode = mrca[2] ? link(mrca[2], mrca[0]) : el("b", null, mrca[0]);
    const inside = data.some((d) => d.chain[d.chain.length - 1][0] === mrca[0]);
    if (inside) {
      const rest = data.filter((d) => d.chain[d.chain.length - 1][0] !== mrca[0]).map((d) => d.name);
      fill(p, fmt(rest.length > 1 ? S.ccInsideMany : S.ccInside, { a: "\u0000a", b: "\u0000b" }), { a: el("b", null, joinNames(rest)), b: mrcaNode });
    } else {
      const names = joinNames(data.map((d) => d.name));
      const text = mrca[1] != null ? fmt(S.ccMeet, { list: names, age: age(mrca[1]), mrca: "\u0000m" }) : fmt(S.ccMeetNoAge, { list: names, mrca: "\u0000m" });
      fill(p, text, { m: mrcaNode });
    }
    s.appendChild(p);
    return s;
  }
  // placeholders \0a, \0b, \0m in a translated sentence become elements
  function fill(p, text, parts) {
    text.split(/(\u0000[a-z])/).forEach((x) => p.appendChild(x.charAt(0) === "\u0000" ? parts[x.charAt(1)] : document.createTextNode(x)));
  }

  function agesSection(data) {
    const rows = [];
    data.forEach((d, i) => {
      const a = d.ages;
      if (a.d) rows.push({ i, what: S.ccTmrca, v: a.d });
      if (a.dF) rows.push({ i, what: S.ccFormed, v: a.dF, formed: true });
    });
    const s = section(S.ccAgesTitle, S.ccAgesLead);
    if (!rows.length) { s.appendChild(el("p", "note", S.ccNoAges)); return s; }
    const lo = Math.min(...rows.map((r) => r.v[1])), hi = Math.max(...rows.map((r) => r.v[2]));
    const pad = (hi - lo) * 0.06 || hi * 0.06 || 1, from = hi + pad, to = Math.max(0, lo - pad);
    const pct = (v) => ((100 * (from - v)) / (from - to)).toFixed(1);
    const box = el("div", "agef");
    box.setAttribute("role", "list");
    for (const r of rows) {
      const row = el("div", "agef-row" + (r.formed ? " formed" : ""));
      row.setAttribute("role", "listitem");
      const lab = el("div", "agef-lab");
      lab.appendChild(swatch(r.i));
      lab.appendChild(el("b", null, data[r.i].name));
      lab.appendChild(document.createTextNode(" " + r.what));
      lab.appendChild(el("span", "agef-v", age(r.v[0]) + (r.v[2] > r.v[1] ? " (" + nf(Math.round(r.v[1] / 100) * 100) + "–" + nf(Math.round(r.v[2] / 100) * 100) + ")" : "")));
      const track = el("div", "agef-track");
      track.setAttribute("aria-hidden", "true");
      if (r.v[2] > r.v[1]) { const ci = el("i", "agef-ci"); ci.style.left = pct(r.v[2]) + "%"; ci.style.right = (100 - pct(r.v[1])) + "%"; if (!r.formed) ci.style.background = COLORS[r.i]; track.appendChild(ci); }
      const pt = el("i", "agef-pt");
      pt.style.left = pct(r.v[0]) + "%";
      // a hollow dot: the split from the parent, not the branch's own ancestor
      if (r.formed) { pt.style.background = "var(--surface)"; pt.style.border = "2px solid " + COLORS[r.i]; } else pt.style.background = COLORS[r.i];
      track.appendChild(pt);
      row.appendChild(lab);
      row.appendChild(track);
      box.appendChild(row);
    }
    // round steps as on the branch page (site/lib/age-forest.js)
    const step = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000].find((v) => (from - to) / v <= 5) || 100000;
    const axis = el("div", "agef-axis");
    axis.setAttribute("aria-hidden", "true");
    axis.appendChild(el("span"));
    const ticks = axis.appendChild(el("div", "agef-ticks"));
    for (let v = Math.ceil(to / step) * step; v <= from; v += step) {
      const tk = el("span", null, v >= 1000 ? (v / 1000).toString().replace(".", lang === "ru" ? "," : ".") + (lang === "ru" ? "к" : "k") : String(v));
      tk.style.left = pct(v) + "%";
      ticks.appendChild(tk);
    }
    box.appendChild(axis);
    s.appendChild(box);
    return s;
  }

  const TOP = 10;
  async function countriesSection(data) {
    const names = await loadCountries();
    const keep = new Set();
    for (const d of data) d.cc.slice(0, TOP).forEach((c) => keep.add(c[0]));
    const share = (d, slug) => { const c = d.cc.find((x) => x[0] === slug); return c ? c[1] / d.n : 0; };
    const s = section(S.ccCountriesTitle, S.ccCountriesLead);
    if (!keep.size) { s.appendChild(el("p", "note", S.ccNoCountries)); return s; }
    const rows = [...keep].map((slug) => ({ slug, v: data.map((d) => share(d, slug)) })).sort((a, b) => Math.max(...b.v) - Math.max(...a.v));
    const max = Math.max(...rows.flatMap((r) => r.v));
    const wrap = el("div", "tablewrap");
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", S.ccCountriesTitle);
    const tbl = el("table", "list cc-tbl");
    const head = el("tr");
    const th0 = el("th", null, S.ccColCountry);
    th0.scope = "col";
    head.appendChild(th0);
    data.forEach((d, i) => { const th = el("th", "num"); th.scope = "col"; th.appendChild(swatch(i)); th.appendChild(document.createTextNode(d.name)); head.appendChild(th); });
    tbl.appendChild(el("thead")).appendChild(head);
    const body = tbl.appendChild(el("tbody"));
    for (const r of rows) {
      const tr = el("tr");
      const td = el("td", "name");
      const a = el("a", null, names.get(r.slug) || r.slug);
      a.href = "/" + lang + "/c/" + r.slug + "/";
      td.appendChild(a);
      tr.appendChild(td);
      r.v.forEach((v, i) => {
        const c = el("td", "num");
        // a branch's list stops at its top countries: past it the share is below the last one listed
        const d = data[i], cut = d.cut && d.cc.length ? d.cc[d.cc.length - 1][1] / d.n : 0;
        c.appendChild(el("span", "cp-v", v ? pf(v) : cut ? "<" + pf(cut) : "·"));
        const bar = el("span", "cp-bar");
        const fillBar = el("i");
        fillBar.style.width = (max ? (100 * v / max).toFixed(1) : 0) + "%";
        fillBar.style.background = COLORS[i];
        bar.appendChild(fillBar);
        c.appendChild(bar);
        tr.appendChild(c);
      });
      body.appendChild(tr);
    }
    wrap.appendChild(tbl);
    s.appendChild(wrap);
    return s;
  }

  const HGT = 260, ML = 64, MR = 12, MT = 12, MB = 40;
  const STEPS = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000];
  function growthSection(data) {
    const s = section(S.ccGrowthTitle, S.ccGrowthLead);
    const drawn = data.map((d, i) => ({ d, i })).filter((x) => x.d.g);
    const missing = data.filter((d) => !d.g).map((d) => d.name);
    if (drawn.length) {
      // drawn at the box width so the labels keep their size on a phone
      const W = Math.max(320, Math.min(760, out.clientWidth || 720));
      const xMax = Math.max(...drawn.map((x) => x.d.g.root)), yMax = Math.max(10, ...drawn.map((x) => x.d.g.total));
      const x = (ago) => ML + ((xMax - ago) / xMax) * (W - ML - MR);
      const y = (n) => MT + (1 - Math.log10(Math.max(1, n)) / Math.log10(yMax)) * (HGT - MT - MB);
      const g = svg("svg", { viewBox: "0 0 " + W + " " + HGT, class: "growth cc-growth", role: "img", "aria-label": S.ccGrowthTitle });
      const step = STEPS.find((v) => xMax / v <= (W < 500 ? 4 : 6)) || 100000;
      for (let v = 0; v <= xMax; v += step) {
        g.appendChild(svg("line", { x1: x(v), x2: x(v), y1: MT, y2: HGT - MB, class: "gr-grid" }));
        const tx = svg("text", { x: x(v), y: HGT - MB + 24, "text-anchor": "middle" });
        tx.textContent = v >= 1000 ? (v / 1000).toString().replace(".", lang === "ru" ? "," : ".") + (lang === "ru" ? "к" : "k") : String(v);
        g.appendChild(tx);
      }
      for (let p = 1; p <= yMax; p *= 10) {
        g.appendChild(svg("line", { x1: ML, x2: W - MR, y1: y(p), y2: y(p), class: "gr-grid" }));
        const ty = svg("text", { x: ML - 6, y: y(p) + 4, "text-anchor": "end" });
        ty.textContent = nf(p);
        g.appendChild(ty);
      }
      for (const { d, i } of drawn) {
        let path = "M" + x(d.g.root).toFixed(1) + "," + y(1).toFixed(1);
        for (const [ago, c] of d.g.pts) path += "H" + x(ago).toFixed(1) + "V" + y(c).toFixed(1);
        path += "H" + x(0).toFixed(1);
        g.appendChild(svg("path", { d: path, class: "cc-line", style: "stroke:" + COLORS[i] }));
      }
      const fig = el("figure", "growth-fig");
      fig.appendChild(g);
      fig.appendChild(el("figcaption", "dim small", S.ccGrowthAxes));
      s.appendChild(fig);
    }
    if (missing.length) s.appendChild(el("p", "note small", fmt(S.ccNoGrowth, { list: missing.join(", ") })));
    return s;
  }

  async function render() {
    const my = ++token;
    empty.hidden = items.length > 0;
    const data = await Promise.all(items.map(loadBranch));
    if (my !== token) return;
    renderChips(data);
    out.textContent = "";
    if (data.some((d) => !d)) {
      const bad = items.filter((s, i) => !data[i]);
      out.appendChild(el("p", "note", S.ccError + " " + bad.join(", ")));
    }
    const ok = data.filter(Boolean);
    if (ok.length < 2) {
      if (ok.length === 1) out.appendChild(agesSection(ok));
      return;
    }
    const parts = [meetSection(ok), agesSection(ok), await countriesSection(ok), growthSection(ok)];
    if (my !== token) return;
    for (const p of parts) if (p) out.appendChild(p);
  }
  syncInput();
  render();
})();
