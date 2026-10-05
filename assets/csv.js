(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./compare-core"));
  else root.FtdnaCsv = factory(root.CompareCore);
})(this, function (Core) {
  "use strict";

  // the renderer slices its bars with these same numbers, so `shown` cannot drift from the page
  const SHOWN_L1 = 16, SHOWN_L2 = 20;
  const SMALL_K = 5, SMALL_N = 100;
  const BOM = "\uFEFF";
  const GOAL = "csv_download";
  const FORMULA = /^(\s*[=+\-@]|[\t\r])/;

  // a share is always a string with four decimals, so 1.234 and 1.2340 never look different to a parser
  const frac = (x) => (Number.isFinite(x) ? x.toFixed(6) : null);
  const pct = (v, n) => frac(v / n);

  function cell(v) {
    if (v == null) return "";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
    let s = String(v);
    if (FORMULA.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function build({ header, rows }) {
    return BOM + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  }

  const fileName = (parts) => "ftdnastat-" + parts.join("-").replace(/[^A-Za-z0-9_.+-]+/g, "_") + ".csv";

  function countryTable({ data, branches = {}, kind, present, S }) {
    const n = data.n;
    const header = [S.csvColLevel, S.csvColBranch, S.csvColLabel, S.csvColKits, S.csvColShare, S.csvColAge, S.csvColDepth, S.csvColShown];
    const loc = S.labels || {};
    const info = (k) => { const key = String(k).replace(/\*$/, ""), b = branches[key] || [null, null]; return [loc[key] || b[0], b[1]]; };
    const ago = (mean) => (mean == null ? null : Math.round(present - mean));
    const rows = [];
    data.l1.forEach((r, i) => rows.push(["l1", r.k, null, r.v, pct(r.v, n), null, null, i < SHOWN_L1 ? 1 : 0]));
    data.l2.forEach((r, i) => { const [label, mean] = info(r.k); rows.push(["l2", r.k, label, r.v, pct(r.v, n), ago(mean), null, i < SHOWN_L2 ? 1 : 0]); });
    // the page draws the whole stored tree
    if (kind === "y") for (const r of data.tree || []) rows.push(["tree", r.name, loc[r.name] || r.label, r.n, pct(r.n, n), r.age ? ago(r.age.mean) : null, r.depth, 1]);
    for (const [name, c] of data.terminal || []) rows.push(["terminal", name, null, c, pct(c, n), null, null, 0]);
    return { header, rows };
  }

  // the page table is the subset branchRows() picks with its default threshold
  function branchTable({ names, datas, S }) {
    const shown = new Set(Core.branchRows(datas).map((r) => r.k));
    const header = [S.csvColBranch, S.csvColShown];
    names.forEach((nm) => header.push(nm + " · " + S.csvColKits, nm + " · " + S.csvColShare));
    const rows = Core.branchRows(datas, 0, Infinity).map((r) => {
      const row = [r.k, shown.has(r.k) ? 1 : 0];
      r.shares.forEach((v, i) => row.push(v == null ? null : Math.round(v * datas[i].n), v == null ? null : frac(v)));
      return row;
    });
    return { header, rows };
  }

  function simTable({ names, matrix, title }) {
    const header = [title, ...names];
    const rows = names.map((nm, i) => [nm, ...names.map((_, j) => (matrix[i][j] == null ? null : frac(matrix[i][j])))]);
    return { header, rows };
  }

  // Metrika loads on the first user action; the stub exists right after that, but a click can still beat it
  function track(ymId, params, tries) {
    if (!ymId) return;
    const w = typeof window === "undefined" ? null : window;
    if (w && typeof w.ym === "function") { try { w.ym(Number(ymId), "reachGoal", GOAL, params); } catch (e) { /* counter blocked */ } return; }
    if (w && (tries || 0) < 12) setTimeout(() => track(ymId, params, (tries || 0) + 1), 500);
  }

  function save(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const getJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); });

  async function downloadCountry(btn) {
    const d = btn.dataset, lang = d.lang, kind = d.kind;
    const [data, branches, strings] = await Promise.all([getJson("/data/" + d.slug + "." + kind + ".json"), getJson("/data/branches.json"), getJson("/data/csv-strings.json")]);
    const S = strings[lang];
    const date = kind === "y" ? d.ypub : d.mtf;
    const { header, rows } = countryTable({ data, branches: branches[kind], kind, present: Number(d.present), S });
    save(fileName([d.slug, kind, date]), build({ header, rows }));
    track(d.ym, { type: "country", kind, table: "levels" });
  }

  function downloadTable(spec) {
    save(spec.name, build(spec));
    track(spec.ym, { type: "compare", kind: spec.kind, table: spec.table });
  }

  return { SHOWN_L1, SHOWN_L2, SMALL_K, SMALL_N, GOAL, cell, build, fileName, countryTable, branchTable, simTable, track, downloadCountry, downloadTable };
});
