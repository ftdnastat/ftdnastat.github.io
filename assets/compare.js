(function () {
  "use strict";
  const C = window.CompareCore;
  const root = document.getElementById("cmp");
  const blobEl = document.getElementById("compare-data");
  if (!C || !root || !blobEl) return;
  const D = JSON.parse(blobEl.textContent);
  const S = D.i18n, lang = D.lang;
  const input = document.getElementById("cmp-input");
  const list = document.getElementById("cmp-list");
  const chipsEl = document.getElementById("cmp-chips");
  const out = document.getElementById("cmp-out");
  const empty = document.getElementById("cmp-empty");

  let state = C.parseHash(location.hash);
  let index = null, byKey = new Map(), matches = [], active = -1, token = 0, simKind = "all";
  const cache = new Map();

  const nf = (n) => Math.round(n).toLocaleString(lang === "ru" ? "ru-RU" : "en-US");
  const pf = (x, d) => { const s = (100 * x).toFixed(d == null ? 1 : d); return (lang === "ru" ? s.replace(".", ",") : s) + "%"; };
  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  const KINDS = ["y", "mt"];
  const kindName = (kind) => S[kind === "y" ? "kindY" : "kindMt"];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const keyOf = (x) => x.t + ":" + x.id;
  const nameOf = (e) => e[lang] || e.en;
  const nOf = (e, kind) => (e ? e[kind] : 0);
  const hrefOf = (e) => "/" + lang + (e.t === "c" ? "/c/" : "/ethnic/") + e.id + "/";
  // numbered columns and one switchable matrix from COMPACT_FROM items
  const compact = () => state.items.length >= C.COMPACT_FROM;

  function syncHash() {
    const h = C.serializeHash(state.items);
    try { history.replaceState(null, "", location.pathname + location.search + h); } catch (e) { /* file: or sandboxed */ }
  }

  function setItems(items) {
    state.items = items.slice(0, C.MAX_ITEMS);
    syncHash();
    renderAll();
  }

  function add(entry) {
    if (state.items.length >= C.MAX_ITEMS || state.items.some((x) => keyOf(x) === keyOf(entry))) return;
    input.value = "";
    closeList();
    setItems(state.items.concat([{ t: entry.t, id: entry.id }]));
    if (input.disabled) chipsEl.querySelector("button").focus();
    else input.focus();
  }

  // focusing the input after a removal must not pop the dropdown over the results
  let quietFocus = false;
  function remove(i) {
    setItems(state.items.filter((x, j) => j !== i));
    quietFocus = true;
    input.focus();
    quietFocus = false;
  }

  function renderChips() {
    chipsEl.textContent = "";
    state.items.forEach((x, i) => {
      const e = byKey.get(keyOf(x));
      const name = e ? nameOf(e) : x.id;
      const chip = el("li", "cp-chip");
      if (compact()) chip.appendChild(el("span", "cp-num", String(i + 1)));
      chip.appendChild(el("span", null, name));
      const b = el("button", "cp-x", "×");
      b.type = "button";
      b.setAttribute("aria-label", fmt(S.cmpRemove, { name }));
      b.addEventListener("click", () => remove(i));
      chip.appendChild(b);
      chipsEl.appendChild(chip);
    });
    const full = state.items.length >= C.MAX_ITEMS;
    input.disabled = full;
    input.placeholder = full ? S.cmpMax : S.cmpPlaceholder;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    const taken = new Set(state.items.map(keyOf));
    const scored = [];
    for (const e of index) {
      if (taken.has(keyOf(e))) continue;
      let rank = 0;
      if (q) {
        const names = [e.ru, e.en].map((s) => String(s || "").toLowerCase());
        if (names.some((s) => s.startsWith(q) || s.split(/[\s·(),-]+/).some((w) => w.startsWith(q)))) rank = 1;
        else if (names.some((s) => s.includes(q))) rank = 2;
        else continue;
      } else rank = 1;
      scored.push({ e, rank });
    }
    scored.sort((a, b) => a.rank - b.rank || b.e.y + b.e.mt - a.e.y - a.e.mt);
    return scored.slice(0, 12).map((x) => x.e);
  }

  function closeList() {
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

  function openList() {
    if (!index || input.disabled) return;
    matches = search(input.value);
    list.textContent = "";
    if (!matches.length) {
      const li = el("li", "cp-none", S.cmpNoMatch);
      li.setAttribute("role", "presentation");
      list.appendChild(li);
    }
    matches.forEach((e, i) => {
      const li = el("li", "cp-opt");
      li.id = "cmp-opt-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.appendChild(el("span", "cp-opt-name", nameOf(e)));
      li.appendChild(el("small", "cp-opt-meta", S[e.t === "c" ? "cmpTypeC" : "cmpTypeP"] + " · " + KINDS.map((k) => kindName(k) + " " + (nOf(e, k) ? nf(nOf(e, k)) : "—")).join(" · ")));
      li.addEventListener("mousedown", (ev) => { ev.preventDefault(); add(e); });
      list.appendChild(li);
    });
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    active = -1;
  }

  input.addEventListener("input", openList);
  input.addEventListener("focus", () => { if (!quietFocus) openList(); });
  input.addEventListener("click", () => { if (list.hidden) openList(); });
  input.addEventListener("blur", closeList);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (list.hidden) openList();
      if (!matches.length) return;
      const step = ev.key === "ArrowDown" ? 1 : -1;
      setActive(active < 0 && step < 0 ? matches.length - 1 : (active + step + matches.length) % matches.length);
    } else if (ev.key === "Enter") {
      if (!list.hidden && matches.length) { ev.preventDefault(); add(matches[active >= 0 ? active : 0]); }
    } else if (ev.key === "Escape") {
      closeList();
    }
  });

  function load(e, kind) {
    if (!e || !nOf(e, kind)) return Promise.resolve(null);
    const url = "/data/" + (e.t === "c" ? "" : "people/") + e.id + "." + kind + ".json";
    if (!cache.has(url)) cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); }).catch(() => { cache.delete(url); return null; }));
    return cache.get(url);
  }

  function stackBar(l1, n, kind) {
    const bar = el("div", "stack");
    bar.setAttribute("role", "img");
    const parts = [];
    let rest = 1;
    for (const r of l1) {
      const v = r.v / n;
      const letter = (String(r.k).match(/^[A-Z]+/) || [""])[0];
      const i = el("i", D.cls[kind][letter] || "c0");
      i.style.flex = (100 * v).toFixed(2);
      bar.appendChild(i);
      rest -= v;
      if (v >= 0.05) parts.push(r.k + " " + pf(v, 0));
    }
    if (rest > 0.002) { const i = el("i", "c0"); i.style.flex = (100 * rest).toFixed(2); bar.appendChild(i); }
    bar.setAttribute("aria-label", parts.join(", "));
    return bar;
  }

  // datas: { y, mt } loaded files of one item, each null when that line has no data
  function itemPanel(x, i, e, datas) {
    const p = el("div", "panel");
    const head = el("div", "panel-head");
    const h = el("h3", "p-title");
    if (compact()) h.appendChild(el("span", "cp-num", String(i + 1)));
    if (e) { const a = el("a", null, nameOf(e)); a.href = hrefOf(e); h.appendChild(a); } else h.appendChild(document.createTextNode(x.id));
    head.appendChild(h);
    p.appendChild(head);
    if (e) p.appendChild(el("span", "cp-badge", S[e.t === "c" ? "cmpSrcC" : "cmpSrcP"]));
    for (const kind of KINDS) {
      const d = datas[kind];
      const row = el("div", "cp-line");
      const lab = el("div", "cp-line-lab");
      lab.appendChild(el("b", null, kindName(kind)));
      if (d) lab.appendChild(el("span", "dim mono", " n=" + nf(d.n)));
      row.appendChild(lab);
      row.appendChild(d ? stackBar(d.l1, d.n, kind) : el("p", "dim", fmt(S.cmpNoData, { kind: kindName(kind) })));
      p.appendChild(row);
    }
    return p;
  }

  function legend(kind) {
    const lg = el("div", "legend");
    lg.appendChild(el("b", null, kindName(kind)));
    D.macro[kind].forEach((k, i) => {
      const s = el("span");
      s.appendChild(el("i", "c" + (i + 1)));
      s.appendChild(document.createTextNode(k));
      lg.appendChild(s);
    });
    const o = el("span");
    o.appendChild(el("i", "c0"));
    o.appendChild(document.createTextNode(S.other));
    lg.appendChild(o);
    return lg;
  }

  function tableWrap(label, table) {
    const w = el("div", "tablewrap");
    w.tabIndex = 0;
    w.setAttribute("role", "region");
    w.setAttribute("aria-label", label);
    w.appendChild(table);
    return w;
  }

  function section(title, lead) {
    const s = el("section");
    const h = el("div", "sec-head");
    h.appendChild(el("h2", null, title));
    if (lead) h.appendChild(el("p", null, lead));
    s.appendChild(h);
    return s;
  }

  // 0–49% plain, then a darker step every 10 points
  // bucket on the shown (rounded) percent, so "50%" never sits in the plain bucket
  const simClass = (v) => (v == null ? "" : " sim" + Math.max(0, Math.min(5, Math.floor(Math.round(100 * v) / 10) - 4)));

  const simCell = (tag, v) => el(tag, "num" + simClass(v), v == null ? "—" : pf(v, 0));

  function simMatrix(title, names, m, wide) {
    const box = el("div", "cp-sim-box");
    if (!wide) box.appendChild(el("h3", null, title));
    const t = el("table", "list cp-tbl cp-sim" + (wide ? " cp-sim-wide" : ""));
    t.appendChild(el("caption", "sr-only", title));
    const hr = el("tr");
    hr.appendChild(el("th")).appendChild(el("span", "sr-only", title));
    names.forEach((n, i) => { const th = el("th", "num", String(i + 1)); th.scope = "col"; th.title = n; th.setAttribute("aria-label", n); hr.appendChild(th); });
    t.appendChild(el("thead")).appendChild(hr);
    const tb = el("tbody");
    names.forEach((n, i) => {
      const tr = el("tr");
      const th = el("th", null, i + 1 + " · " + n);
      th.scope = "row";
      tr.appendChild(th);
      names.forEach((x, j) => tr.appendChild(i === j ? el("td", "num dim", "—") : simCell("td", m[i][j])));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    box.appendChild(tableWrap(title, t));
    return box;
  }

  function simSection(names, datas) {
    const my = C.similarityMatrix(datas.map((d) => d.y)), mmt = C.similarityMatrix(datas.map((d) => d.mt));
    const all = C.combineMatrices(my, mmt);
    const s = section(S.cmpSimTitle, S.cmpSimLead);
    if (names.length === 2) {
      const p = el("p", "cp-sim-pair");
      p.appendChild(document.createTextNode(fmt(S.cmpSimSentence, { a: names[0], b: names[1] }) + " "));
      [[S.cmpSimY, my], [S.cmpSimMt, mmt], [S.cmpSimAll, all]].forEach(([label, m], i) => {
        if (i) p.appendChild(document.createTextNode(" · "));
        p.appendChild(document.createTextNode(label[0].toLowerCase() + label.slice(1) + " "));
        p.appendChild(simCell("span", m[0][1]));
      });
      s.appendChild(p);
      return s;
    }
    if (compact()) {
      const ms = { y: [S.cmpSimY, my], mt: [S.cmpSimMt, mmt], all: [S.cmpSimAll, all] };
      const tabs = el("div", "tabs cp-sim-tabs");
      tabs.setAttribute("role", "group");
      tabs.setAttribute("aria-label", S.cmpSimTitle);
      const slot = el("div");
      slot.setAttribute("aria-live", "polite");
      const show = () => {
        tabs.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === simKind)));
        slot.textContent = "";
        slot.appendChild(simMatrix(ms[simKind][0], names, ms[simKind][1], true));
      };
      Object.keys(ms).forEach((k) => {
        const b = el("button", "tab", ms[k][0]);
        b.type = "button";
        b.dataset.v = k;
        b.addEventListener("click", () => { simKind = k; show(); });
        tabs.appendChild(b);
      });
      show();
      s.appendChild(tabs);
      s.appendChild(slot);
      return s;
    }
    const grid = el("div", "cp-sim-grid");
    grid.appendChild(simMatrix(S.cmpSimY, names, my));
    grid.appendChild(simMatrix(S.cmpSimMt, names, mmt));
    grid.appendChild(simMatrix(S.cmpSimAll, names, all));
    s.appendChild(grid);
    return s;
  }

  function branchSection(names, datas, kind, withLead) {
    const rows = C.branchRows(datas);
    const s = section(S.cmpBranchesTitle + " · " + kindName(kind), withLead ? fmt(S.cmpBranchesLead, { p: Math.round(100 * C.MIN_SHARE), n: C.TOP_ROWS }) : null);
    if (!rows.length) return s;
    const peak = Math.max(...rows.map((r) => r.max));
    const t = el("table", "list cp-tbl cp-branches" + (compact() ? " cp-compact" : ""));
    t.appendChild(el("caption", "sr-only", S.cmpBranchesTitle + " · " + kindName(kind)));
    const hr = el("tr");
    const h0 = el("th", null, S.cmpColBranch);
    h0.scope = "col";
    hr.appendChild(h0);
    names.forEach((n, i) => {
      const th = el("th", "num");
      th.scope = "col";
      if (compact()) {
        th.appendChild(el("span", "cp-h-name", n));
        th.appendChild(el("span", "cp-h-num", String(i + 1))).setAttribute("aria-hidden", "true");
        th.title = n;
      } else th.textContent = n;
      hr.appendChild(th);
    });
    t.appendChild(el("thead")).appendChild(hr);
    const tb = el("tbody");
    for (const r of rows) {
      const tr = el("tr");
      const slug = D.clades && D.clades[kind][r.k];
      const cell = el("td", "name");
      if (slug) { const link = el("a", null, r.k); link.href = "/" + lang + (kind === "y" ? "/clade/" : "/mt-clade/") + slug + "/"; cell.appendChild(link); } else cell.textContent = r.k;
      tr.appendChild(cell);
      r.shares.forEach((v) => {
        const td = el("td", "num" + (v != null && v === r.max ? " top" : ""));
        if (v == null) td.textContent = "—";
        else {
          const txt = pf(v);
          const val = td.appendChild(el("span", "cp-v", compact() ? txt.slice(0, -1) : txt));
          if (compact()) val.appendChild(el("span", "cp-pct", "%"));
          const bar = el("span", "cp-bar");
          const i = el("i");
          i.style.width = (100 * v / peak).toFixed(1) + "%";
          bar.appendChild(i);
          td.appendChild(bar);
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    s.appendChild(tableWrap(S.cmpBranchesTitle + " · " + kindName(kind), t));
    return s;
  }

  async function renderAll() {
    const my = ++token;
    renderChips();
    empty.hidden = state.items.length > 0;
    if (!state.items.length) { out.textContent = ""; return; }
    const entries = state.items.map((x) => byKey.get(keyOf(x)));
    const loaded = await Promise.all(entries.map((e) => Promise.all(KINDS.map((k) => load(e, k)))));
    if (my !== token) return;
    const datas = loaded.map(([y, mt]) => ({ y, mt }));
    out.textContent = "";
    const cols = el("div", "cp-cols");
    state.items.forEach((x, i) => cols.appendChild(itemPanel(x, i, entries[i], datas[i])));
    const letters = section(S.cmpLettersTitle);
    letters.appendChild(cols);
    KINDS.forEach((k) => letters.appendChild(legend(k)));
    out.appendChild(letters);
    const names = entries.map((e, i) => (e ? nameOf(e) : state.items[i].id));
    const usable = (k) => datas.filter((d) => d[k]).length;
    if (state.items.length >= 2 && (usable("y") >= 2 || usable("mt") >= 2)) out.appendChild(simSection(names, datas));
    let lead = true;
    for (const k of KINDS) if (usable(k)) { out.appendChild(branchSection(names, datas.map((d) => d[k]), k, lead)); lead = false; }
    const small = [];
    datas.forEach((d, i) => KINDS.forEach((k) => { if (d[k] && d[k].n < C.SMALL_N) small.push(names[i] + " (" + kindName(k) + ")"); }));
    if (small.length) out.appendChild(el("p", "warn", fmt(S.cmpSmall, { n: C.SMALL_N, names: small.join(", ") })));
    const types = new Set(entries.filter((e, i) => e && (datas[i].y || datas[i].mt)).map((e) => e.t));
    if (types.size > 1) out.appendChild(el("p", "note", S.cmpMixed));
  }

  function sanitize() {
    if (!index) return;
    const known = state.items.filter((x) => byKey.has(keyOf(x)));
    if (known.length !== state.items.length) { state.items = known; syncHash(); }
  }

  window.addEventListener("hashchange", () => {
    const next = C.parseHash(location.hash);
    if (C.serializeHash(next.items) === C.serializeHash(state.items)) return;
    state = next;
    sanitize();
    renderAll();
  });

  fetch("/data/compare-index.json").then((r) => r.json()).then((rows) => {
    index = rows;
    byKey = new Map(rows.map((e) => [keyOf(e), e]));
    sanitize();
    syncHash();
    renderAll();
  }).catch(() => { out.textContent = ""; out.appendChild(el("p", "warn", S.cmpError)); });
})();
