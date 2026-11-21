(function () {
  "use strict";
  const root = document.getElementById("ys"), cfg = document.getElementById("ys-data");
  if (!root || !cfg || !window.YSnpCore) return;
  const C = window.YSnpCore, { lang, i18n } = JSON.parse(cfg.textContent || "{}");
  const text = /** @type {HTMLTextAreaElement} */ (document.getElementById("ys-text"));
  const out = /** @type {HTMLElement} */ (document.getElementById("ys-out"));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? o[k] : ""));
  const nf = (n) => n.toLocaleString(lang === "ru" ? "ru-RU" : "en-US");
  const plural = (n, forms) => {
    if (lang !== "ru") return forms[n === 1 ? 0 : 1];
    const a = n % 10, b = n % 100;
    return forms[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 1 : 2];
  };
  const json = (url) => fetch(url).then((r) => (r.ok ? r.json() : r.status === 404 ? [] : Promise.reject(r.status)));
  const note = (s) => { out.innerHTML = '<p class="note">' + esc(s) + "</p>"; };

  let base = null, tree = null, pages = [], split = new Set();
  const load = () => base || (base = Promise.all([json("/data/y-snp.json"), json("/search/snp-split.json")]).then(([d, s]) => { tree = C.prepare(d); pages = d.pages; split = new Set(s); }).catch((e) => { base = null; throw e; }));
  const shards = new Map();
  const shard = (f) => shards.get(f) || shards.set(f, json("/search/" + f + ".json").catch((e) => { shards.delete(f); throw e; })).get(f);

  const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  // the row of the branch on its page, or of the nearest ancestor that has one
  const linkOf = (i) => {
    for (let x = i; x >= 0; x = tree.parent[x]) {
      const l = tree.links[x];
      if (l == null) continue;
      const page = pages[l >> 1];
      return { href: esc("/" + lang + "/clade/" + slugOf(page) + "/" + (l & 1 ? "#b-" + encodeURIComponent(tree.names[x]) : "")), own: x === i, at: x };
    }
    return null;
  };
  const kits = (i) => nf(tree.kits[i]) + " " + plural(tree.kits[i], i18n.formsKits);
  const branch = (i) => {
    const l = linkOf(i), lab = tree.labels[i], name = '<b lang="en">' + esc(tree.names[i]) + "</b>" + (lab ? ' <span class="dim">' + esc(lab) + "</span>" : "");
    return l && l.own ? '<a href="' + l.href + '">' + name + "</a>" : name;
  };
  const snps = (list, sign) => '<span class="mono" lang="en">' + list.map((s) => esc(s + sign)).join(" ") + "</span>";
  const byNode = (pairs) => {
    const m = new Map();
    for (const [s, x] of pairs) (m.get(x) || m.set(x, []).get(x)).push(s);
    return [...m];
  };

  function render(list, at) {
    const r = C.classify(tree, list, at);
    if (r.best < 0) { note(i18n.ysNoBranch); return; }
    const best = r.best, l = linkOf(best);
    let h = '<section class="mf-best"><h2 data-a="branch">' + esc(i18n.ysBest) + ": " + branch(best) + "</h2>";
    h += "<p>" + esc(fill(i18n.ysScore, { hits: nf(r.hits), pos: nf(list.pos.length), neg: nf(r.against.length) })) + " · " + esc(kits(best)) + "</p>";
    if (l) h += '<p><a class="btn" href="' + l.href + '">' + esc(l.own ? i18n.ysPage : fill(i18n.ysPageUp, { name: tree.names[l.at] })) + " →</a></p>";
    h += "</section>";
    if (r.against.length) h += '<h3 data-a="against">' + esc(i18n.ysAgainst) + "</h3><p>" + esc(i18n.ysAgainstLead) + '</p><ul class="plain mf-alt">' + byNode(r.against).map(([x, s]) => "<li>" + branch(x) + " " + snps(s, "−") + "</li>").join("") + "</ul>";
    if (r.off.length) h += '<h3 data-a="off">' + esc(i18n.ysOff) + "</h3><p>" + esc(i18n.ysOffLead) + '</p><ul class="plain mf-alt">' + byNode(r.off).slice(0, 12).map(([x, s]) => "<li>" + branch(x) + " " + snps(s, "+") + "</li>").join("") + "</ul>" + (byNode(r.off).length > 12 ? '<p class="dim">' + esc(fill(i18n.ysBelowMore, { n: nf(byNode(r.off).length - 12) })) + "</p>" : "");
    const below = C.childrenOf(tree, best).sort((u, v) => tree.kits[v] - tree.kits[u]);
    if (below.length) {
      const shown = below.slice(0, 15);
      h += '<h3 data-a="below">' + esc(i18n.ysBelow) + "</h3><p>" + esc(i18n.ysBelowLead) + '</p><ul class="plain mf-alt">' + shown.map((c) => {
        const e = r.ev.get(c), no = e && e.neg.length;
        return '<li class="' + (no ? "ys-no" : "") + '">' + branch(c) + ' <span class="dim">' + esc(kits(c)) + "</span>" + (no ? " " + snps(e.neg, "−") : "") + "</li>";
      }).join("") + "</ul>" + (below.length > shown.length ? '<p class="dim">' + esc(fill(i18n.ysBelowMore, { n: nf(below.length - shown.length) })) + "</p>" : "");
    }
    const unknown = list.pos.concat(list.neg).filter((s) => !at.has(s));
    if (unknown.length) h += '<h3 data-a="unknown">' + esc(i18n.ysUnknown) + "</h3><p>" + snps(unknown, "") + "</p>";
    if (list.both.length) h += "<p>" + esc(i18n.ysBoth) + " " + snps(list.both, "") + "</p>";
    if (list.bad.length) h += "<p>" + esc(i18n.ysBad) + " " + snps(list.bad.slice(0, 20), "") + "</p>";
    const mark = (x) => { const e = r.ev.get(x); return e ? " " + snps(e.pos, "+") + (e.neg.length ? ' <span class="mf-no">' + snps(e.neg, "−") + "</span>" : "") : ""; };
    h += '<details class="mf-path"><summary>' + esc(i18n.ysPath) + " · " + nf(r.path.length) + '</summary><ul class="small-tree">' + r.path.map((x, k) => '<li style="--d:' + Math.min(k, 1) + '">' + branch(x) + mark(x) + "</li>").join("") + "</ul></details>";
    out.innerHTML = h;
  }

  let seq = 0;
  function run(raw) {
    const my = ++seq, list = C.parseList(raw);
    if (!list.pos.length && !list.neg.length) { if (raw.trim()) note(i18n.ysNone); else out.innerHTML = ""; return; }
    out.innerHTML = '<p class="dim">' + esc(i18n.ysLoading) + "</p>";
    load().then(() => {
      const want = new Set(list.pos.concat(list.neg)), files = new Set();
      for (const s of want) { const f = C.shardOf(s, split); if (f) files.add(f); }
      return Promise.all([...files].map(shard)).then((parts) => {
        if (my !== seq) return;
        render(list, C.locate(tree, pages, [].concat(...parts), want));
      });
    }).catch(() => { if (my === seq) note(i18n.ysNoData); });
  }

  let timer = 0;
  text.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => run(text.value), 300); });
  if (text.value) run(text.value);
})();
