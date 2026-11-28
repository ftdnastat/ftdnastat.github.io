(function () {
  "use strict";
  const root = document.getElementById("mf"), cfg = document.getElementById("mf-data");
  if (!root || !cfg || !window.MtFastaCore) return;
  const C = window.MtFastaCore, { lang, i18n } = JSON.parse(cfg.textContent || "{}");
  const text = /** @type {HTMLTextAreaElement} */ (document.getElementById("mf-text"));
  const file = /** @type {HTMLInputElement} */ (document.getElementById("mf-file"));
  const out = /** @type {HTMLElement} */ (document.getElementById("mf-out"));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? o[k] : ""));
  const nf = (n) => n.toLocaleString(lang === "ru" ? "ru-RU" : "en-US");
  const plural = (n, forms) => {
    if (lang !== "ru") return forms[n === 1 ? 0 : 1];
    const a = n % 10, b = n % 100;
    return forms[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 1 : 2];
  };
  const shown = (name) => name.replace(/\^$/, "");

  let data = null, nodes = null, rsrs = "";
  const load = () => data || (data = fetch("/data/mt-fasta.json").then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((d) => { nodes = C.prepare(d); rsrs = C.rsrsOf(nodes, d.rcrs, d.ref); return d; }).catch((e) => { data = null; throw e; }));

  // the row of the branch on its page, or of the nearest ancestor that has one
  const linkOf = (i) => {
    for (let x = i; x >= 0; x = nodes[x].parent) {
      const l = nodes[x].link;
      if (!l) continue;
      const [slug, anchor] = l.split("#");
      return { href: esc("/" + lang + "/mt-clade/" + (slug ? slug + "/" : "") + (anchor ? "#b-" + encodeURIComponent(anchor) : "")), own: x === i, at: x };
    }
    return null;
  };
  const branch = (i) => {
    const l = linkOf(i), name = '<b lang="en">' + esc(shown(nodes[i].name)) + "</b>";
    return l && l.own ? '<a href="' + l.href + '">' + name + "</a>" : name;
  };
  const mutList = (list) => '<span class="mono" lang="en">' + list.map(esc).join(" ") + "</span>";

  const score = (r, i) => esc(fill(i18n.mfScore, { hits: nf(r.hits[i]), miss: nf(r.miss[i]) }));

  // list: a parsed mutation list, not full when only HVR1 and HVR2 are known
  function render(d, a, seqName, list) {
    const hvr = list && !list.full, r = C.classify(nodes, a);
    const sure = hvr ? C.confident(nodes, r) : -1, best = sure >= 0 ? sure : r.order[0], path = C.explain(nodes, best, a);
    const missing = path.flatMap((x) => x.muts.filter((m) => m.st === -1 && m.w > 0).map((m) => m.token));
    const extra = C.extras(nodes, best, d.rcrs, d.ref, a);
    const l = linkOf(best);
    let h = '<section class="mf-best"><h2 data-a="branch">' + esc(hvr ? fill(i18n.mfHvrBest, { regions: list.regions.join(" " + i18n.mfAnd + " ") }) : i18n.mfBest) + (hvr ? " " : ": ") + branch(best) + "</h2>";
    h += "<p>" + score(r, best) + (list ? " · " + esc(fill(i18n.mfList, { n: nf(list.count) })) : "") + (nodes[best].n ? " · " + esc(nf(nodes[best].n) + " " + plural(nodes[best].n, i18n.formsSamples)) + " Mitotree" : "") + (seqName ? ' · <span class="dim">' + esc(fill(i18n.mfRead, { name: seqName, mm: nf(a.mismatches + a.gaps) })) + "</span>" : "") + "</p>";
    if (l) h += '<p><a class="btn" href="' + l.href + '">' + esc(l.own ? i18n.mfPage : fill(i18n.mfPageUp, { name: shown(nodes[l.at].name) })) + " →</a></p>";
    if (hvr) h += "<p>" + esc(i18n.mfHvrLead) + "</p>";
    h += "</section>";
    if (hvr) h += fits(r, best, a);
    if (missing.length) h += '<h3 data-a="missing">' + esc(i18n.mfMissing) + "</h3><p>" + mutList(missing) + "</p>";
    if (extra.length) h += '<h3 data-a="extras">' + esc(i18n.mfExtras) + "</h3><p>" + esc(i18n.mfExtrasLead) + "</p><p>" + mutList(extra) + "</p>";
    const onPath = new Set(path.map((x) => x.i)), alt = [];
    for (const i of r.order) { if (hvr || alt.length >= 5) break; if (!onPath.has(i) && !C.pathOf(nodes, i).includes(best)) alt.push(i); }
    if (alt.length) h += '<h3 data-a="alt">' + esc(i18n.mfAlt) + '</h3><ul class="plain mf-alt">' + alt.map((i) => "<li>" + branch(i) + ' <span class="dim">' + score(r, i) + "</span></li>").join("") + "</ul>";
    const mark = (m) => '<span class="mf-m ' + (m.st === 2 || m.w < 1 ? "mf-skip" : m.st > 0 ? "mf-ok" : m.st < 0 ? "mf-no" : "mf-unk") + '">' + (m.st === 2 || !m.w ? "" : m.st > 0 ? "✓" : m.st < 0 ? "✗" : "?") + esc(m.token) + "</span>";
    h += '<details class="mf-path"><summary>' + esc(i18n.mfPath) + " · " + nf(path.length) + "</summary><p class=\"dim\">" + esc(i18n.mfPathLead) + '</p><ul class="small-tree">' + path.map((x, k) => '<li style="--d:' + Math.min(k, 1) + '">' + branch(x.i) + (x.muts.length ? ' <span class="mono muts" lang="en">' + x.muts.map(mark).join(" ") + "</span>" : "") + "</li>").join("") + "</ul></details>";
    out.innerHTML = h;
  }

  // per branch: its mutations below the answer that the list cannot show
  function fits(r, top, a) {
    const best = r.score[r.order[0]], shown = [];
    for (const i of r.order) {
      if (shown.length >= 6 || r.score[i] < best - 1) break;
      const p = C.pathOf(nodes, i);
      if (i === top || !p.includes(top) || shown.some((s) => p.includes(s))) continue;
      shown.push(i);
    }
    if (!shown.length) return "";
    const below = (i) => { const p = C.pathOf(nodes, i); return p.slice(p.indexOf(top) + 1).flatMap((x) => nodes[x].muts.filter((m) => m.w > 0 && C.state(m, a) === 0).map((m) => m.token)); };
    return '<h3 data-a="fits">' + esc(i18n.mfHvrAlt) + '</h3><ul class="plain mf-alt">' + shown.map((i) => { const m = below(i); return "<li>" + branch(i) + ' <span class="dim">' + score(r, i) + "</span>" + (m.length ? ' <span class="mono muts" lang="en">' + m.slice(0, 8).map(esc).join(" ") + (m.length > 8 ? " …" : "") + "</span>" : "") + "</li>"; }).join("") + "</ul>";
  }

  // FTDNA prints mutation lists; FASTA has no digits except in GenBank-style line numbers, which parseList refuses
  const looksList = (raw) => !/^\s*>/.test(raw) && /\d/.test(raw);

  let seq = 0;
  function run(raw) {
    const my = ++seq;
    if (looksList(raw)) {
      out.innerHTML = '<p class="dim">' + esc(i18n.mfLoading) + "</p>";
      load().then((d) => {
        if (my !== seq) return;
        const list = C.parseList(raw, d.ref, rsrs);
        if (list) render(d, list.a, "", list);
        else fasta(raw, my);
      }, () => { if (my === seq) out.innerHTML = '<p class="note">' + esc(i18n.mfNoData) + "</p>"; });
      return;
    }
    fasta(raw, my);
  }

  function fasta(raw, my) {
    const f = C.parseFasta(raw);
    if (!f.seq) { out.innerHTML = raw.trim() ? '<p class="note">' + esc(i18n.mfNotFasta) + "</p>" : ""; return; }
    if (Math.abs(f.seq.length - 16569) > C.MAX_LEN_DIFF) { out.innerHTML = '<p class="note">' + esc(fill(i18n.mfPartial, { n: nf(f.seq.length) + " " + plural(f.seq.length, i18n.formsBases) })) + "</p>"; return; }
    out.innerHTML = '<p class="dim">' + esc(i18n.mfLoading) + "</p>";
    load().then((d) => {
      if (my !== seq) return;
      const a = C.align(d.ref, f.seq);
      if (!a) { out.innerHTML = '<p class="note">' + esc(i18n.mfNoAlign) + "</p>"; return; }
      render(d, a, f.name);
    }, () => { if (my === seq) out.innerHTML = '<p class="note">' + esc(i18n.mfNoData) + "</p>"; });
  }

  let timer = 0;
  text.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => run(text.value), 250); });
  file.addEventListener("change", () => {
    const f = file.files && file.files[0];
    if (!f) return;
    // a full mtDNA FASTA is about 17 KB; a picked BAM or VCF would hang the tab
    if (f.size > 2e6) { out.innerHTML = '<p class="note">' + esc(i18n.mfNotFasta) + "</p>"; return; }
    f.text().then((s) => { text.value = s; run(s); }, () => { out.innerHTML = '<p class="note">' + esc(i18n.mfNotFasta) + "</p>"; });
  });
  if (text.value) run(text.value);
})();
