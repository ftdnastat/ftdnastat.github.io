// Search folding for the header search, table filters and the culture picker: "Únětice" → "unetice".
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Fold = factory();
})(this, function () {
  "use strict";
  // letters that NFD does not split into a base letter and a mark; і is the Cyrillic i that Discover puts into Latin names
  var SPECIAL = { "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i", "ħ": "h", "ŋ": "n", "ё": "е", "і": "i", "ї": "i" };
  var SPECIAL_RE = /[ßæœøłđðþıħŋёії]/g;
  function fold(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(SPECIAL_RE, function (c) { return SPECIAL[c]; })
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[’'ʼ`´‘]/g, "")
      .replace(/[\s\-‐‑–—_/]+/g, " ")
      .trim();
  }
  return { fold: fold };
});
(function () {
  "use strict";
  var lang = document.body.getAttribute("data-lang") || "en";

  // Metrika goals with visit params; the counter loads on the first user action, so early events wait in a queue
  var ymQueue = [], ymWaiting = false;
  var ymFlush = function (tries) {
    if (typeof window.ym === "function") {
      ymQueue.splice(0).forEach(function (e) { try { window.ym(window.ftdYmId, "reachGoal", e[0], e[1]); } catch (err) { /* counter blocked */ } });
      ymWaiting = false;
    } else if (tries < 60) setTimeout(function () { ymFlush(tries + 1); }, 500);
    else { ymQueue.length = 0; ymWaiting = false; }
  };
  window.ftdTrack = function (goal, params) {
    if (!window.ftdYmId) return;
    ymQueue.push([goal, params]);
    if (!ymWaiting) { ymWaiting = true; ymFlush(0); }
  };
  // a query is sent once typing pauses (or at once when a result is picked), once per field;
  // a query that found nothing and looks like a kit number or an e-mail stays here
  var searchTimers = {}, searchSent = {};
  window.ftdTrackSearch = function (where, query, found, now) {
    if (!window.ftdYmId) return;
    clearTimeout(searchTimers[where]);
    var send = function () {
      var v = String(query || "").trim().toLowerCase().slice(0, 40);
      if (v.length < 2 || searchSent[where] === v) return;
      if (!found && /@|\d{5,}/.test(v)) return;
      searchSent[where] = v;
      var p = {};
      p[where] = {};
      p[where][found ? "found" : "empty"] = v;
      window.ftdTrack("search", p);
    };
    if (now) send(); else searchTimers[where] = setTimeout(send, 1500);
  };

  // a page prerendered on hover is not a visit yet: remember its language only once it is shown
  var saveLang = function () { try { localStorage.setItem("ftdnastat_lang", lang); } catch (e) {} };
  if (document.prerendering) document.addEventListener("prerenderingchange", saveLang, { once: true });
  else saveLang();
  var sw = document.querySelector("[data-lang-switch]");
  if (sw) sw.addEventListener("click", function () { sw.href = sw.getAttribute("href").split("#")[0] + location.hash; });

  var box = document.querySelector("[data-filterable]");
  if (box) {
    var grp = "all", minn = 1, name = "", raw = "", sure = false;
    var sel = document.querySelector("[data-filter=minn]");
    var tabs = document.querySelector("[data-filter=grp]");
    var nameInput = document.querySelector("[data-filter=name]");
    var sureBox = document.querySelector("[data-filter=sure]");
    if (sel) minn = +sel.value;
    var defMinn = minn;
    // filter state lives in the hash so a copied link reopens the same view
    // ?q= comes from the header search form without JS
    var readHash = function () {
      var h = new URLSearchParams(location.hash.replace(/^#/, ""));
      var qs = new URLSearchParams(location.search);
      if (qs.get("q") && !h.get("q")) h.set("q", qs.get("q"));
      if (h.get("grp")) grp = h.get("grp");
      if (h.get("n") && !isNaN(+h.get("n"))) minn = +h.get("n");
      if (h.get("q")) { raw = h.get("q"); name = window.Fold.fold(raw); }
      sure = h.get("sure") === "1";
      if (sureBox) sureBox.checked = sure;
      if (tabs) tabs.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-v") === grp); });
      if (sel) { if (![].some.call(sel.options, function (o) { return +o.value === minn; })) { var o = document.createElement("option"); o.value = minn; o.textContent = "≥ " + minn; sel.appendChild(o); } sel.value = String(minn); }
      if (nameInput) nameInput.value = raw;
    };
    var isFilterHash = function (hash) { return /(^|&)(grp|n|q|sure)=/.test(hash.replace(/^#/, "")); };
    var writeHash = function () {
      var h = new URLSearchParams();
      if (grp !== "all") h.set("grp", grp);
      if (minn !== defMinn) h.set("n", String(minn));
      if (name) h.set("q", raw);
      if (sure) h.set("sure", "1");
      var s = h.toString();
      // a section anchor (#турция) is not ours: leave it alone unless filters are set
      if (!s && location.hash && !isFilterHash(location.hash)) return;
      // ?q= is folded into the hash state; any other query param stays as it came
      var qs = new URLSearchParams(location.search);
      qs.delete("q");
      var search = qs.toString() ? "?" + qs.toString() : "";
      var url = location.pathname + search + (s ? "#" + s : "");
      if (url !== location.pathname + location.search + location.hash) history.replaceState(null, "", url);
    };
    var count = document.querySelector("[data-count]");
    // one filter drives every list on the page (the ancient page has a Y and an mt table)
    var rows = [];
    // data-search-text: the name filter also reads the visible cells (ancient samples keep only hidden fields in data-name)
    document.querySelectorAll("[data-filterable]").forEach(function (b) { var text = b.hasAttribute("data-search-text"); Array.prototype.forEach.call(b.tagName === "TABLE" ? b.tBodies[0].rows : b.querySelectorAll("[data-grp]"), function (tr) { tr.searchText = text; rows.push(tr); }); });
    var sections = document.querySelectorAll("[data-hide-empty]");
    var apply = function () {
      var shown = 0;
      rows.forEach(function (tr) {
        if (name && tr.folded == null) tr.folded = window.Fold.fold(tr.searchText ? (tr.getAttribute("data-name") || "") + " " + tr.textContent : tr.getAttribute("data-name") || tr.textContent);
        var ok = (grp === "all" || tr.getAttribute("data-grp") === grp) && +tr.getAttribute("data-n") >= minn && (!name || tr.folded.indexOf(name) >= 0) && !(sure && tr.hasAttribute("data-unsure"));
        tr.hidden = !ok;
        if (ok) shown++;
      });
      Array.prototype.forEach.call(sections, function (s) { s.hidden = !s.querySelector("tbody tr:not([hidden])"); });
      if (count) count.textContent = shown + " / " + rows.length;
      var empty = document.querySelector("[data-empty]");
      if (empty) empty.hidden = shown > 0;
      writeHash();
    };
    var reset = document.querySelector("[data-reset]");
    if (reset) reset.addEventListener("click", function (e) { e.preventDefault(); grp = "all"; minn = 1; name = ""; raw = ""; sure = false; if (sureBox) sureBox.checked = false; if (sel) sel.value = "1"; if (nameInput) nameInput.value = ""; if (tabs) tabs.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-v") === "all"); }); apply(); });
    if (nameInput) nameInput.addEventListener("input", function () { raw = nameInput.value.trim(); name = window.Fold.fold(raw); apply(); });
    window.addEventListener("hashchange", function () { if (isFilterHash(location.hash) || !location.hash) { readHash(); apply(); } });
    readHash();
    if (tabs) tabs.addEventListener("click", function (e) {
      var b = e.target.closest(".tab");
      if (!b) return;
      grp = b.getAttribute("data-v");
      tabs.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      apply();
    });
    if (sel) sel.addEventListener("change", function () { minn = +sel.value; apply(); });
    if (sureBox) sureBox.addEventListener("change", function () { sure = sureBox.checked; apply(); });
    apply();
  }

  // a link to a row inside a folded list (#b-<branch> among the Mitotree branches) opens the fold
  var openTarget = function () {
    var id = "";
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { return; }
    var el = id && document.getElementById(id), d = el && el.closest("details");
    if (d && !d.open) { d.open = true; el.scrollIntoView(); }
  };
  openTarget();
  window.addEventListener("hashchange", openTarget);

  // sticky filter rows sit under the header, whatever height the menu wraps to
  var hdr = document.querySelector("header.top");
  if (hdr && window.ResizeObserver) new ResizeObserver(function () { document.documentElement.style.setProperty("--hdr", hdr.offsetHeight + "px"); }).observe(hdr);

  // lastFound: whether the shown list has real hits; without them it still holds the "all countries" link
  var q = document.getElementById("q"), out = document.getElementById("q-out"), lastFound = false, idx = null, labels = null, cultures = null, peoples = null, shards = {};
  var fold = window.Fold.fold;
  if (q && out) {
    var close = function () { out.hidden = true; q.setAttribute("aria-expanded", "false"); };
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    // "Z1842", "J-Z1842", "J1-Z1842", "R-L23": the SNP part after the dash names the shard /search/clade-<letter>.json
    var SNP_RE = /^(?:[A-Z]{1,5}\d*[A-Z]?-)?([A-Z]{1,4}\d[A-Z0-9._-]*)$/;
    // a starred remainder label (G-CTS574*) copied from a page still finds its branch
    var snpOf = function (v) { var m = v.toUpperCase().replace(/\*$/, "").match(SNP_RE); return m ? m[1] : null; };
    // branches without a page: /search/small-top-<2 SNP characters>.json answers two or three typed characters, /search/small-<4>.json the rest;
    // their rows point into /search/small-pages.json, and a page slug follows from its name
    var fileKey = function (s) { return s.toLowerCase().replace(/[^a-z0-9]/g, "_"); };
    var slugOf = function (name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); };
    var smallPages = null;
    var pagesOnce = function () { return smallPages || (smallPages = fetch("/search/small-pages.json").then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).catch(function (err) { smallPages = null; throw err; })); };
    // [name without the page's letter prefix, kits, page, anchor (1 itself)[, label]] → the row shape of the page shards
    var unpack = function (pages, r) { var page = pages[r[2]], name = r[0].indexOf("-") >= 0 ? r[0] : page.slice(0, page.indexOf("-") + 1) + r[0]; return [name, slugOf(page), r[1], r[4] || "", page, r[3] === 1 ? name : r[3] || ""]; };
    var smallRows = function (snp) {
      var full = snp.length >= 4 && shards["small:" + snp.slice(0, 4)];
      if (full) return full;
      var top = snp.length >= 2 && shards["smalltop:" + snp.slice(0, 2)];
      return top ? (top.t[snp.slice(0, 3)] || []).map(function (i) { return top.r[i]; }) : [];
    };
    // a row of a branch without a page names its page (e[4]) and the row to light up there (e[5])
    var cladeHref = function (dir, e) { return "/" + lang + "/" + dir + "/" + (e[1] ? esc(e[1]) + "/" : "") + (e[5] ? "#b-" + esc(encodeURIComponent(e[5])) : ""); };
    // mt names are letters and digits with ' . ! ^ + " - (H1a1, L3'4'6, H1-T16189C!, T2h2^ and A13"56 in Mitotree): the shard is the first letter
    var MT_RE = /^[A-Z][A-Z0-9'.!^+"-]*$/;
    var mtKey = function (v) { var u = v.toUpperCase(); return MT_RE.test(u) ? "mt:" + u[0] : null; };
    // a Mitotree branch counts Discover samples, not kits
    var mtCount = function (e) { return e[6] === "mito" ? (e[2] ? amount(+e[2], "data-samples") + " · Mitotree" : "Mitotree") : amount(+e[2], "data-kits"); };
    // an mt mutation by its position or in full: "16519", "T16519C", "16519C"
    var MTSNP_RE = /^[ACGT]?(\d{2,5})/;
    var mtSnpKey = function (v) { var m = v.toUpperCase().match(MTSNP_RE); return m ? "mtsnp:" + m[1].slice(0, 2) : null; };
    var mtSnpHits = function (v) {
      var key = mtSnpKey(v), shard = key && shards[key];
      if (!shard) return [];
      var up = v.toUpperCase(), pos = /^\d/.test(up) ? up.match(/^\d+/)[0] : null, posOf = function (r) { return (r[0].match(/\d+/) || [""])[0]; };
      var hits = shard.filter(function (r) { return pos ? posOf(r).indexOf(pos) === 0 : r[0].toUpperCase().indexOf(up) === 0; });
      var exact = function (r) { return r[0].toUpperCase() === up || (pos && posOf(r) === pos); };
      var order = function (a, b) { return (a[6] ? 1 : 0) - (b[6] ? 1 : 0) || b[3] - a[3]; };
      return hits.filter(exact).sort(order).concat(hits.filter(function (r) { return !exact(r); }).sort(order))
        .map(function (r) { return [r[1], r[2], r[3], "", r[4], r[5], "", r[0], r[6] || ""]; });
    };
    var mtHits = function (v) {
      var key = mtKey(v), shard = key && shards[key], names = {};
      var up = v.toUpperCase();
      var hits = shard ? shard.filter(function (e) { return e[0].toUpperCase().indexOf(up) === 0; }) : [];
      return hits.filter(function (e) { return e[0].toUpperCase() === up; }).concat(hits.filter(function (e) { return e[0].toUpperCase() !== up; }), mtSnpHits(v))
        .filter(function (e) { var k = e[0] + "|" + (e[7] || ""); if (names[k]) return false; names[k] = true; return true; }).slice(0, 6);
    };
    var cladeHits = function (v) {
      var snp = snpOf(v), none = { exact: [], rest: [] };
      if (!snp) return none;
      var shard = (shards[snp[0]] || []).concat(smallRows(snp));
      if (!shard.length) return none;
      var up = v.toUpperCase().replace(/\*$/, "");
      var exact = function (e) { var name = e[0].toUpperCase(), dash = name.indexOf("-"); return name === up || name.slice(dash + 1) === snp || (e[3] && e[3].toUpperCase() === up); };
      var hits = shard.filter(function (e) {
        var name = e[0].toUpperCase(), dash = name.indexOf("-");
        return name.indexOf(up) === 0 || (dash >= 0 && name.slice(dash + 1).indexOf(snp) === 0) || (e[3] && e[3].toUpperCase().indexOf(up) === 0);
      });
      // the shard is sorted by kits; an exact SNP match still goes first (Z1842 before Z18426)
      return { exact: hits.filter(exact), rest: hits.filter(function (e) { return !exact(e); }) };
    };
    // any SNP of a branch: /search/snp-<3 chars>.json, or <4 chars> for the prefixes in /search/snp-split.json; e[6] is the SNP
    var snpSplit = null;
    var snpFile = function (snp) {
      if (!snpSplit || snp.length < 3) return null;
      var split = snpSplit[snp.slice(0, 3).replace(/[^A-Z0-9]/g, "_")];
      return split && snp.length < 4 ? null : "snp:" + snp.slice(0, split ? 4 : 3);
    };
    var snpHits = function (v) {
      var snp = snpOf(v), key = snp && snpFile(snp), shard = key && shards[key];
      if (!shard) return { exact: [], rest: [] };
      var hits = shard.filter(function (e) { return e[6].toUpperCase().indexOf(snp) === 0; });
      // a short prefix of some other SNP of a branch is noise ("M267" → L-M20 by M2673): only from five characters
      var rest = snp.length < 5 ? [] : hits.filter(function (e) { return e[6].toUpperCase() !== snp; }).sort(function (a, b) { return b[2] - a[2]; });
      return { exact: hits.filter(function (e) { return e[6].toUpperCase() === snp; }), rest: rest };
    };
    // "J1", "R1b", "G2a": a label prefix, exact label first, one row per page
    var labelHits = function (v) {
      if (!labels) return [];
      var up = v.toUpperCase().replace(/\*$/, ""), seen = {};
      var hits = labels.filter(function (e) { return e[3].toUpperCase().indexOf(up) === 0; });
      var exact = function (e) { return e[3].toUpperCase() === up; };
      return hits.filter(exact).concat(hits.filter(function (e) { return !exact(e) && !e[4]; }), hits.filter(function (e) { return !exact(e) && e[4]; }))
        .filter(function (e) { if (seen[e[1]]) return false; seen[e[1]] = true; return true; });
    };
    var yHits = function (v) {
      var byLabel = labelHits(v), names = {};
      var c = cladeHits(v), sn = snpHits(v);
      return byLabel.concat(c.exact, sn.exact, c.rest, sn.rest).filter(function (e) { if (names[e[0]]) return false; names[e[0]] = true; return true; }).slice(0, 8);
    };
    // data-kits / data-samples hold the word forms "one|few|many" (ru) or "one|other" (en), as plural() in render.js
    var amount = function (n, attr) {
      var f = q.getAttribute(attr).split("|"), m10 = n % 10, m100 = n % 100;
      var w = f.length < 3 ? f[n === 1 ? 0 : 1] : m10 === 1 && m100 !== 11 ? f[0] : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? f[1] : f[2];
      return n.toLocaleString(lang === "ru" ? "ru-RU" : "en-US") + " " + w;
    };
    var render = function () {
      var v = q.value.trim().toLowerCase(), fv = fold(v);
      var clades = v ? yHits(v) : [], mts = v ? mtHits(v) : [];
      var cults = fv && cultures ? cultures.filter(function (e) { return (e.k || (e.k = fold(e[1] + " | " + e[2] + " | " + e[3]))).indexOf(fv) >= 0; }).slice(0, 6) : [];
      var peops = fv && peoples ? peoples.filter(function (e) { return (e.k || (e.k = fold(e[1] + " | " + e[2] + " | " + e[0]))).indexOf(fv) >= 0; }).slice(0, 6) : [];
      // the country index and the branch shards arrive independently: render whichever is ready
      if (!v || (!idx && !clades.length && !mts.length && !cults.length && !peops.length)) { close(); return; }
      var hits = (fv ? idx || [] : []).filter(function (e) { return (e.k || (e.k = fold(e.en + " | " + e.ru))).indexOf(fv) >= 0; }).slice(0, clades.length || mts.length || cults.length || peops.length ? 6 : 12);
      var rows = hits.map(function (e) { return '<a href="/' + lang + "/c/" + esc(e.s) + '/"><span>' + esc(lang === "ru" ? e.ru : e.en) + '</span><span class="mono dim">' + (+e.y) + " / " + (+e.mt) + "</span></a>"; });
      // one letter names an mt haplogroup ("H", "U"): it goes before the countries that merely contain the letter
      var mtRow = function (e) { return '<a href="' + cladeHref("mt-clade", e) + '"><span lang="en">' + esc(e[0]) + (e[7] ? ' <small>' + esc(e[7]) + (e[8] ? " · YFull " + esc(e[8]) : "") + "</small>" : "") + (e[4] ? ' <small>→ ' + esc(e[4]) + "</small>" : "") + '</span><span class="mono dim">' + esc(mtCount(e)) + "</span></a>"; };
      var mtRows = mts.length ? ['<span class="q-group dim">' + esc(q.getAttribute("data-clades-mt")) + "</span>"].concat(mts.map(mtRow)) : [];
      if (v.length === 1 && mts.length && mts[0][0].toUpperCase() === v.toUpperCase()) { rows = mtRows.concat(rows); mtRows = []; }
      if (peops.length) rows.push('<span class="q-group dim">' + esc(q.getAttribute("data-peoples")) + "</span>", peops.map(function (e) { return '<a href="/' + lang + "/ethnic/" + esc(e[0]) + '/"><span>' + esc(lang === "ru" ? e[1] : e[2]) + '</span><span class="mono dim">' + (+e[3]) + " / " + (+e[4]) + "</span></a>"; }).join(""));
      if (clades.length) rows.push('<span class="q-group dim">' + esc(q.getAttribute("data-clades")) + "</span>", clades.map(function (e) { return '<a href="' + cladeHref("clade", e) + '"><span lang="en">' + esc(e[0]) + (e[3] && e[3] !== e[0] ? ' <small>' + esc(e[3]) + "</small>" : "") + (e[6] ? ' <small>' + esc(e[6]) + (e[7] ? " · YFull " + esc(e[7]) : "") + "</small>" : "") + (e[4] ? ' <small>→ ' + esc(e[4]) + "</small>" : "") + '</span><span class="mono dim">' + esc(amount(+e[2], "data-kits")) + "</span></a>"; }).join(""));
      if (mtRows.length) rows.push.apply(rows, mtRows);
      if (cults.length) rows.push('<span class="q-group dim">' + esc(q.getAttribute("data-cultures")) + "</span>", cults.map(function (e) { return '<a href="/' + lang + "/culture/" + esc(e[0]) + '/"><span>' + esc(lang === "ru" ? e[1] : e[2]) + '</span><span class="mono dim">' + esc(amount(+e[4], "data-samples")) + "</span></a>"; }).join(""));
      lastFound = rows.length > 0;
      window.ftdTrackSearch("header", v, lastFound);
      out.innerHTML = rows.length
        ? rows.join("")
        : '<span class="q-none dim">' + esc(q.getAttribute("data-none")) + '</span><a href="/' + lang + "/countries/?q=" + encodeURIComponent(v) + '">' + esc(q.getAttribute("data-all")) + "</a>";
      out.hidden = false;
      q.setAttribute("aria-expanded", "true");
      fit();
    };
    var loading = {};
    var loadShard = function (letter) {
      if (shards[letter] !== undefined) return loading[letter] || Promise.resolve();
      shards[letter] = null;
      var small = letter.indexOf("small:") === 0, top = letter.indexOf("smalltop:") === 0, bySnp = letter.indexOf("snp:") === 0;
      var file = letter.indexOf("mtsnp:") === 0 ? "mtsnp-" + letter.slice(6) : letter.indexOf("mt:") === 0 ? "mt-clade-" + letter.slice(3).toLowerCase() : small ? "small-" + fileKey(letter.slice(6)) : top ? "small-top-" + fileKey(letter.slice(9)) : bySnp ? "snp-" + fileKey(letter.slice(4)) : "clade-" + letter.toLowerCase();
      // a missing file is an empty answer; a failed fetch is forgotten so the next keystroke retries it
      var got = fetch("/search/" + file + ".json").then(function (r) { return r.ok ? r.json() : r.status === 404 ? null : Promise.reject(r.status); });
      return (loading[letter] = (small || top || bySnp ? Promise.all([pagesOnce(), got]).then(function (x) {
        var pages = x[0], j = x[1], un = function (r) { return unpack(pages, r); };
        if (bySnp) return (j || []).map(function (r) { return un(r.slice(1)).concat([r[0], r[6] || ""]); });
        return small ? (j || []).map(un) : { r: j ? j.r.map(un) : [], t: j ? j.t : {} };
      }) : got.then(function (j) { return j || []; })).then(function (j) { shards[letter] = j; render(); }).catch(function () { delete shards[letter]; delete loading[letter]; }));
    };
    var splitLoading = null;
    var loadSnps = function (snp) {
      if (snpSplit) { var key = snpFile(snp); return key ? loadShard(key) : Promise.resolve(); }
      if (splitLoading) return splitLoading.then(function () { return loadSnps(snp); });
      return (splitLoading = fetch("/search/snp-split.json").then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (j) {
        snpSplit = {};
        j.forEach(function (k) { snpSplit[k] = true; });
        var cur = snpOf(q.value.trim()) || snp;
        var key = cur && snpFile(cur);
        if (key) return loadShard(key);
      }).catch(function () { splitLoading = null; }));
    };
    var idxLoading = null;
    // focus already starts the index, so the first keystroke rarely waits for the network
    var loadIdx = function () {
      if (idx || idxLoading) return idxLoading || Promise.resolve();
      var json = function (r) { return r.ok ? r.json() : Promise.reject(r.status); }, retry = function () { idxLoading = null; };
      return (idxLoading = Promise.all([
        fetch("/search.json").then(json).then(function (j) { idx = j; render(); }).catch(retry),
        fetch("/search/cultures.json").then(json).then(function (j) { cultures = j; render(); }).catch(retry),
        fetch("/search/peoples.json").then(json).then(function (j) { peoples = j; render(); }).catch(retry),
        fetch("/search/clade-labels.json").then(json).then(function (j) { labels = j; render(); }).catch(retry),
      ]));
    };
    // the page of one exact hit for a typed name, or null: the 404 page sends a stale or mistyped link there
    var loadFor = function (v) {
      var snp = snpOf(v), mk = mtKey(v), ms = mtSnpKey(v), jobs = [loadIdx()];
      if (snp) jobs.push(loadShard(snp[0]));
      if (snp && snp.length >= 2) jobs.push(loadShard("smalltop:" + snp.slice(0, 2)));
      if (snp && snp.length >= 4) jobs.push(loadShard("small:" + snp.slice(0, 4)));
      if (snp && snp.length >= 3) jobs.push(loadSnps(snp));
      if (mk) jobs.push(loadShard(mk));
      if (ms) jobs.push(loadShard(ms));
      return Promise.all(jobs.map(function (j) { return Promise.resolve(j).catch(function () {}); }));
    };
    var plain = function (s) { return String(s).replace(/&(amp|lt|gt|quot);/g, function (_, c) { return { amp: "&", lt: "<", gt: ">", quot: '"' }[c]; }); };
    var exactHit = function (v, kind) {
      var fv = fold(v), up = v.toUpperCase().replace(/\*$/, "");
      var country = function () { var e = (idx || []).filter(function (e) { return e.s === v.toLowerCase() || fold(e.en) === fv || fold(e.ru) === fv; })[0]; return e && "/" + lang + "/c/" + e.s + "/"; };
      var culture = function () { var e = (cultures || []).filter(function (e) { return e[0] === v.toLowerCase() || fold(e[1]) === fv || fold(e[2]) === fv; })[0]; return e && "/" + lang + "/culture/" + e[0] + "/"; };
      var people = function () { var e = (peoples || []).filter(function (e) { return e[0] === v.toLowerCase() || fold(e[1]) === fv || fold(e[2]) === fv; })[0]; return e && "/" + lang + "/ethnic/" + e[0] + "/"; };
      var clade = function () {
        var c = cladeHits(v), sn = snpHits(v), lb = labelHits(v).filter(function (e) { return e[3].toUpperCase() === up; });
        var e = lb[0] || c.exact[0] || sn.exact[0];
        return e && plain(cladeHref("clade", e));
      };
      // a mutation row names it in e[7]: 16519C, C16519T or the bare position
      var mut = function (e) { var m = String(e[7] || "").toUpperCase(); return m && (m === up || m.replace(/^[ACGT]/, "") === up || (m.match(/\d+/) || [""])[0] === up); };
      var mt = function () { var hits = mtHits(v), e = hits.filter(function (e) { return e[0].toUpperCase() === up && !e[7]; })[0] || hits.filter(mut)[0]; return e && plain(cladeHref("mt-clade", e)); };
      var order = { clade: [clade, mt], "mt-clade": [mt, clade], c: [country, people, culture], culture: [culture, country], ethnic: [people, country] }[kind] || [country, people, culture, clade, mt];
      for (var i = 0; i < order.length; i++) { var href = order[i](); if (href) return href; }
      return null;
    };
    window.ftdFind = function (v, kind) { v = String(v || "").trim(); return v ? loadFor(v).then(function () { return exactHit(v, kind); }) : Promise.resolve(null); };
    // nothing exact: the header search opens on the name, its list shows what is close
    window.ftdSuggest = function (v) { q.value = v; q.dispatchEvent(new Event("input")); q.focus(); };
    // a phone keyboard takes the lower half: the field goes to the top, the list below it fits what is left
    var narrow = window.matchMedia("(max-width:640px)"), vv = window.visualViewport;
    var lift = function () { if (narrow.matches && document.activeElement === q) q.scrollIntoView({ block: "start" }); };
    var fit = function () {
      if (!narrow.matches || out.hidden) { out.style.maxHeight = ""; return; }
      var bottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
      out.style.maxHeight = Math.min(320, Math.max(120, bottom - out.getBoundingClientRect().top - 8)) + "px";
    };
    if (vv) { vv.addEventListener("resize", function () { lift(); fit(); }); vv.addEventListener("scroll", fit); }
    q.addEventListener("focus", function () { loadIdx(); lift(); });
    q.addEventListener("input", function () {
      var snp = snpOf(q.value.trim()), mk = mtKey(q.value.trim()), ms = mtSnpKey(q.value.trim());
      if (snp) loadShard(snp[0]);
      if (snp && snp.length >= 2) loadShard("smalltop:" + snp.slice(0, 2));
      if (snp && snp.length >= 4) loadShard("small:" + snp.slice(0, 4));
      if (snp && snp.length >= 3) loadSnps(snp);
      if (mk) loadShard(mk);
      if (ms) loadShard(ms);
      render();
      loadIdx();
    });
    // arrows walk the result links; Escape closes and returns to the field
    var move = function (e, dir) {
      var links = Array.prototype.slice.call(out.querySelectorAll("a"));
      if (out.hidden || !links.length) return;
      e.preventDefault();
      var i = links.indexOf(document.activeElement);
      var next = i < 0 ? (dir > 0 ? 0 : links.length - 1) : i + dir;
      if (next < 0 || next >= links.length) { q.focus(); return; }
      links[next].focus();
    };
    q.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); var a = out.querySelector("a"); window.ftdTrackSearch("header", q.value, lastFound, true); location.href = a ? a.getAttribute("href") : "/" + lang + "/countries/?q=" + encodeURIComponent(q.value.trim()); }
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown") move(e, 1);
    });
    // a picked result is the end of the query: send it before the page goes
    out.addEventListener("click", function (e) { if (e.target.closest("a")) window.ftdTrackSearch("header", q.value, lastFound, true); });
    out.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") move(e, 1);
      if (e.key === "ArrowUp") move(e, -1);
      if (e.key === "Escape") { close(); q.focus(); }
    });
    document.addEventListener("click", function (e) { if (!out.contains(e.target) && e.target !== q) close(); });
    q.form.addEventListener("focusout", function (e) { if (!q.form.contains(e.relatedTarget)) close(); });
  }

  // CSV export: csv.js is fetched on the first click, not with the page
  var csvBtns = document.querySelectorAll("[data-csv]");
  if (csvBtns.length) {
    var csvReady = null;
    var csvLoad = function () {
      if (window.FtdnaCsv) return Promise.resolve();
      return csvReady || (csvReady = new Promise(function (ok, fail) {
        var s = document.createElement("script");
        s.src = "/assets/csv.js";
        s.onload = ok;
        s.onerror = function () { csvReady = null; fail(); };
        document.head.appendChild(s);
      }));
    };
    csvBtns.forEach(function (b) {
      b.hidden = false;
      var label = b.textContent;
      b.addEventListener("click", function () {
        if (b.disabled) return;
        b.disabled = true;
        csvLoad().then(function () { return window.FtdnaCsv.downloadCountry(b); }).catch(function (err) {
          console.error("csv export failed", err);
          b.textContent = b.getAttribute("data-error");
          setTimeout(function () { b.textContent = label; }, 3000);
        }).then(function () { b.disabled = false; });
      });
    });
  }

  // tree-ring.js is fetched on the first circle, not with the page
  var ringBars = document.querySelectorAll(".ring-bar");
  if (ringBars.length) {
    var ringReady = null;
    var ringLoad = function () {
      if (window.TreeRing) return Promise.resolve();
      return ringReady || (ringReady = new Promise(function (ok, fail) {
        var s = document.createElement("script");
        s.src = "/assets/tree-ring.js";
        s.onload = ok;
        s.onerror = function () { ringReady = null; fail(); };
        document.head.appendChild(s);
      }));
    };
    var pref = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
    var press = function (bar, sel, val, attr) { bar.querySelectorAll(sel).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute(attr) === val)); }); };
    var setView = function (bar, view, levels) {
      var box = bar.nextElementSibling;
      var shown = box.nextElementSibling && box.nextElementSibling.classList.contains("tr-view") ? box.nextElementSibling : null;
      press(bar, "[data-view]", view, "data-view");
      press(bar, "[data-lv]", String(levels), "data-lv");
      bar.querySelector(".ring-opt").hidden = true;
      if (view !== "ring") { box.hidden = false; if (shown) shown.hidden = true; return Promise.resolve(); }
      return ringLoad().then(function () {
        var v = window.TreeRing.draw(box, levels);
        v.hidden = false;
        box.hidden = true;
        bar.querySelector(".ring-opt").hidden = false;
      }).catch(function (err) { console.error("tree circle failed", err); setView(bar, "bars", levels); });
    };
    var ringLevels = pref("treeLevels") === "2" ? 2 : 3;
    var levelsOf = function () { return ringLevels; };
    ringBars.forEach(function (bar) {
      bar.hidden = false;
      bar.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        if (b.hasAttribute("data-view")) { pref("treeView", b.getAttribute("data-view")); setView(bar, b.getAttribute("data-view"), levelsOf()); }
        else if (b.hasAttribute("data-lv")) { ringLevels = Number(b.getAttribute("data-lv")); pref("treeLevels", String(ringLevels)); setView(bar, "ring", levelsOf()); }
        else if (b.hasAttribute("data-exp") && window.TreeRing) {
          var h1 = document.querySelector("h1");
          Promise.resolve().then(function () { return window.TreeRing.download(bar, levelsOf(), h1 ? h1.textContent.trim() : document.title, b.getAttribute("data-exp")); }).catch(function (err) { console.error("tree export failed", err); });
        }
      });
      if (pref("treeView") === "ring") setView(bar, "ring", levelsOf());
    });
  }
})();
