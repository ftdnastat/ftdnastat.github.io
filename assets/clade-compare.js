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
  let token = 0;
  const load = (url) => window.ftdJson(url, url.startsWith("/search/")).catch(() => null);
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

  // Y shares shards with header search; mt uses the page-only index.
  const shardOf = (q) => {
    const v = q.trim().toUpperCase();
    if (!v) return null;
    if (!isY) return "mt-compare-" + v.charAt(0).toLowerCase();
    const i = v.indexOf("-");
    const snp = i >= 0 ? v.slice(i + 1) : v;
    return snp ? "clade-" + snp.charAt(0).toLowerCase() : null;
  };
  const shard = async (name) => await load("/search/" + name + ".json") || [];
  let matches = [], active = -1, searchToken = 0, pendingSearch = null;
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
    const ranked = rows.map((r) => ({ r, k: rank(r) })).filter((x) => x.k >= 0).sort((a, b) => a.k - b.k || b.r[2] - a.r[2]);
    for (const x of ranked) if (!seen.has(x.r[1])) { seen.add(x.r[1]); outRows.push(x.r); }
    return outRows.slice(0, 12);
  }

  function closeList() {
    searchToken++;
    pendingSearch = null;
    matches = [];
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
    closeList();
    if (input.disabled) return;
    const my = searchToken;
    const q = input.value;
    if (!q.trim()) return;
    pendingSearch = search(q);
    const found = await pendingSearch;
    if (my !== searchToken) return;
    pendingSearch = null;
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
  input.addEventListener("keydown", async (ev) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (!matches.length || list.hidden) return;
      const step = ev.key === "ArrowDown" ? 1 : -1;
      setActive(active < 0 && step < 0 ? matches.length - 1 : (active + step + matches.length) % matches.length);
    } else if (ev.key === "Enter") {
      if (pendingSearch) {
        ev.preventDefault();
        const my = searchToken;
        await pendingSearch;
        if (my !== searchToken) return;
      }
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

  let closeAgeDetail;
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAgeDetail?.();
  });

  function agesSection(data) {
    const s = section(S.ccAgesTitle, S.ccAgesLead);
    const rows = data.map((branch, i) => ({ branch, i })).filter((r) => r.branch);
    const sortAge = ({ branch }) => branch.ages.dF?.[0] ?? branch.ages.d?.[0] ?? -Infinity;
    rows.sort((a, b) => sortAge(b) - sortAge(a));
    const events = rows.flatMap(({ branch }) => [branch.ages.dF, branch.ages.d]).filter(Boolean);
    if (!events.length) { s.appendChild(el("p", "note", S.ccNoAges)); return s; }

    const legend = el("div", "cc-age-legend");
    for (const [mark, label] of [["split", S.ccFormed], ["ancestor", S.ccTmrca], ["bounds", S.ccAgeBounds]]) {
      const item = el("span", null, label);
      item.prepend(el("i", "cc-age-key " + mark));
      legend.appendChild(item);
    }
    const values = events.flat().filter(Number.isFinite);
    const lo = Math.min(...values), hi = Math.max(...values);
    const pad = Math.max(1, (hi - lo || hi) * 0.07);
    const from = hi + pad, to = lo >= 0 ? Math.max(0, lo - pad) : lo - pad;
    const pos = (v) => 100 * (from - v) / (from - to);
    const calendar = (v) => {
      const y = D.present - v;
      return fmt(y < 0 ? S.yearBC : S.yearAD, { n: nf(Math.abs(y) || 1) });
    };
    const chart = el("div", "cc-ages");
    const axis = el("div", "cc-age-axis");
    axis.appendChild(el("span", "cc-age-unit", S.tlAgo));
    const ticks = axis.appendChild(el("div", "cc-age-ticks"));
    const relative = new Intl.RelativeTimeFormat(lang);
    const ideal = Math.max(1, (from - to) / 4);
    const power = 10 ** Math.floor(Math.log10(ideal));
    const step = [1, 2, 5, 10].map((n) => n * power).reduce((a, b) => Math.abs(a - ideal) <= Math.abs(b - ideal) ? a : b);
    const grid = [];
    for (let v = Math.floor(from / step) * step; v >= to; v -= step) {
      const tick = el("span", "cc-age-tick", nf(v));
      const x = pos(v);
      tick.style.left = x + "%";
      if (x < 8) tick.classList.add("first");
      if (x > 92) tick.classList.add("last");
      grid.push(x);
      if (Number.isFinite(D.present)) tick.appendChild(el("small", null, calendar(v)));
      ticks.appendChild(tick);
    }
    chart.appendChild(axis);

    for (const { branch, i } of rows) {
      const { dF: split, d: ancestor } = branch.ages;
      const row = el("div", "cc-age-row c" + (i + 1));
      chart.appendChild(row);
      const name = el("b", "cc-age-name", branch.name);
      if (!split && !ancestor) {
        const missing = el("div", "cc-age-summary");
        missing.append(name, el("span", "dim", S.ccAgeMissing));
        row.appendChild(missing);
        continue;
      }
      const button = el("button", "cc-age-summary");
      button.type = "button";
      const track = el("span", "cc-age-track");
      track.setAttribute("aria-hidden", "true");
      button.append(name, track);
      const panel = el("div", "cc-age-detail");
      panel.id = "cc-age-detail-" + i;
      panel.hidden = true;
      button.setAttribute("aria-controls", panel.id);
      button.setAttribute("aria-expanded", "false");
      row.append(button, panel);

      const bar = (cls, older, younger) => {
        const line = el("i", cls);
        line.style.left = pos(older) + "%";
        line.style.width = (pos(younger) - pos(older)) + "%";
        track.appendChild(line);
      };
      for (const x of grid) {
        const guide = el("i", "cc-age-guide");
        guide.style.left = x + "%";
        track.appendChild(guide);
      }
      const ranges = [split, ancestor].filter((v) => v && v[1] !== v[2]);
      const reversed = split && ancestor && split[0] < ancestor[0];
      if (reversed) {
        for (const [, lo, hi] of ranges) bar("cc-age-band", Math.max(lo, hi), Math.min(lo, hi));
      } else if (ranges.length) {
        const ends = ranges.flatMap((v) => v.slice(1));
        bar("cc-age-band", Math.max(...ends), Math.min(...ends));
      }
      if (split && ancestor && !reversed) bar("cc-age-link", split[0], ancestor[0]);
      const description = [branch.name];
      for (const [v, mark, label] of [[split, "split", S.ccFormed], [ancestor, "ancestor", S.ccTmrca]]) {
        const detail = el("div");
        detail.append(el("i", "cc-age-key " + mark), el("b", null, label));
        if (v) {
          const x = pos(v[0]) + "%";
          const dot = el("i", "cc-age-dot " + mark);
          dot.style.left = x;
          const number = el("span", "cc-age-number " + mark, nf(v[0]));
          number.style.setProperty("--x", x);
          track.append(dot, number);
          const years = relative.format(-v[0], "year");
          const hasRange = v[1] !== v[2];
          const range = hasRange ? " (" + nf(Math.min(v[1], v[2])) + "–" + nf(Math.max(v[1], v[2])) + ")" : "";
          detail.appendChild(el("span", null, years + range + (Number.isFinite(D.present) ? " · " + calendar(v[0]) : "")));
          description.push(label + " " + years);
        } else detail.appendChild(el("span", null, S.ccAgeMissing));
        panel.appendChild(detail);
      }
      if (reversed) panel.appendChild(el("p", "note", S.ccAgeReversed));
      button.setAttribute("aria-label", description.join(", "));
      let pinned = false;
      const close = () => {
        pinned = false;
        panel.hidden = true;
        button.setAttribute("aria-expanded", "false");
        if (closeAgeDetail === close) closeAgeDetail = undefined;
      };
      const open = () => {
        if (closeAgeDetail !== close) closeAgeDetail?.();
        closeAgeDetail = close;
        panel.hidden = false;
        button.setAttribute("aria-expanded", "true");
      };
      row.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") open(); });
      row.addEventListener("pointerleave", () => { if (!pinned) close(); });
      button.addEventListener("click", () => {
        if (pinned) close();
        else { pinned = true; open(); }
      });
      button.addEventListener("blur", close);
    }
    s.append(legend, chart);
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

  // ymap.js reads the blob when it loads and takes later sets of branches by the ymap:branches event
  const mapSec = document.getElementById("cc-map"), mapBlob = document.getElementById("ymap-data");
  let mapKey = "";
  function syncMap(data) {
    if (!mapSec || !mapBlob) return;
    const on = items.map((slug, i) => ({ slug, i, d: data[i] })).filter((x) => x.d && x.d.m);
    const off = data.filter((d) => d && !d.m).map((d) => d.name);
    mapSec.hidden = on.length < 2;
    const missing = document.getElementById("cc-map-missing");
    missing.hidden = mapSec.hidden || !off.length;
    missing.textContent = missing.hidden ? "" : fmt(S.ccMapMissing, { list: off.join(", ") });
    const key = on.map((x) => x.slug + ":" + x.i).join(",");
    if (mapSec.hidden || key === mapKey) return;
    mapKey = key;
    const pages = {};
    for (const x of on) for (const [name, , slug] of x.d.chain) if (slug) pages[name] = pageHref(slug);
    const detail = { branches: on.map((x) => ({ name: x.d.name, slug: x.slug })), pages, colors: on.map((x) => COLORS[x.i]) };
    mapBlob.textContent = JSON.stringify(Object.assign(JSON.parse(mapBlob.textContent), detail));
    const chips = document.getElementById("cc-map-chips");
    chips.textContent = "";
    for (const x of on) {
      const li = el("li");
      li.style.setProperty("--br", COLORS[x.i]);
      li.append(el("i"), link(x.slug, x.d.name));
      chips.appendChild(li);
    }
    const trunk = el("li", "ymap-trunk-chip");
    trunk.append(el("i"), S.ymapTrunk);
    chips.appendChild(trunk);
    document.dispatchEvent(new CustomEvent("ymap:branches", { detail }));
  }

  async function render() {
    const my = ++token;
    empty.hidden = items.length > 0;
    const data = await Promise.all(items.map(loadBranch));
    if (my !== token) return;
    renderChips(data);
    syncMap(data);
    closeAgeDetail?.();
    out.textContent = "";
    if (data.some((d) => !d)) {
      const bad = items.filter((s, i) => !data[i]);
      out.appendChild(el("p", "note", S.ccError + " " + bad.join(", ")));
    }
    const ok = data.filter(Boolean);
    if (ok.length < 2) {
      if (ok.length === 1) out.appendChild(agesSection(data));
      return;
    }
    const parts = [meetSection(ok), agesSection(data), await countriesSection(ok), growthSection(ok)];
    if (my !== token) return;
    for (const p of parts) if (p) out.appendChild(p);
  }
  syncInput();
  render();
})();
