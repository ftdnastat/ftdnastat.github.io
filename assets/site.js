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
    var grp = "all", minn = 1, name = "", raw = "";
    var sel = document.querySelector("[data-filter=minn]");
    var tabs = document.querySelector("[data-filter=grp]");
    var nameInput = document.querySelector("[data-filter=name]");
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
      if (tabs) tabs.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-v") === grp); });
      if (sel) { if (![].some.call(sel.options, function (o) { return +o.value === minn; })) { var o = document.createElement("option"); o.value = minn; o.textContent = "≥ " + minn; sel.appendChild(o); } sel.value = String(minn); }
      if (nameInput) nameInput.value = raw;
    };
    var isFilterHash = function (hash) { return /(^|&)(grp|n|q)=/.test(hash.replace(/^#/, "")); };
    var writeHash = function () {
      var h = new URLSearchParams();
      if (grp !== "all") h.set("grp", grp);
      if (minn !== defMinn) h.set("n", String(minn));
      if (name) h.set("q", raw);
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
        var ok = (grp === "all" || tr.getAttribute("data-grp") === grp) && +tr.getAttribute("data-n") >= minn && (!name || tr.folded.indexOf(name) >= 0);
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
    if (reset) reset.addEventListener("click", function (e) { e.preventDefault(); grp = "all"; minn = 1; name = ""; raw = ""; if (sel) sel.value = "1"; if (nameInput) nameInput.value = ""; if (tabs) tabs.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-v") === "all"); }); apply(); });
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
    apply();
  }

  // lastFound: whether the shown list has real hits; without them it still holds the "all countries" link
  var q = document.getElementById("q"), out = document.getElementById("q-out"), lastFound = false, idx = null, labels = null, cultures = null, shards = {};
  var fold = window.Fold.fold;
  if (q && out) {
    var close = function () { out.hidden = true; q.setAttribute("aria-expanded", "false"); };
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    // "Z1842", "J-Z1842", "J1-Z1842", "R-L23": the SNP part after the dash names the shard /search/clade-<letter>.json
    var SNP_RE = /^(?:[A-Z]{1,5}\d*[A-Z]?-)?([A-Z]{1,4}\d[A-Z0-9._-]*)$/;
    // a starred remainder label (G-CTS574*) copied from a page still finds its branch
    var snpOf = function (v) { var m = v.toUpperCase().replace(/\*$/, "").match(SNP_RE); return m ? m[1] : null; };
    // mt names are letters and digits with ' . ! - (H1a1, L3'4'6, H1-T16189C!): the shard is the first letter
    var MT_RE = /^[A-Z][A-Z0-9'.!-]*$/;
    var mtKey = function (v) { var u = v.toUpperCase(); return MT_RE.test(u) ? "mt:" + u[0] : null; };
    var mtHits = function (v) {
      var key = mtKey(v), shard = key && shards[key];
      if (!shard) return [];
      var up = v.toUpperCase();
      return shard.filter(function (e) { return e[0].toUpperCase().indexOf(up) === 0; }).slice(0, 6);
    };
    var cladeHits = function (v) {
      var snp = snpOf(v);
      if (!snp) return [];
      var shard = shards[snp[0]];
      if (!shard) return [];
      var up = v.toUpperCase().replace(/\*$/, "");
      var exact = function (e) { var name = e[0].toUpperCase(), dash = name.indexOf("-"); return name === up || name.slice(dash + 1) === snp || (e[3] && e[3].toUpperCase() === up); };
      var hits = shard.filter(function (e) {
        var name = e[0].toUpperCase(), dash = name.indexOf("-");
        return name.indexOf(up) === 0 || (dash >= 0 && name.slice(dash + 1).indexOf(snp) === 0) || (e[3] && e[3].toUpperCase().indexOf(up) === 0);
      });
      // the shard is sorted by kits; an exact SNP match still goes first (Z1842 before Z18426)
      return hits.filter(exact).concat(hits.filter(function (e) { return !exact(e); })).slice(0, 8);
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
      byLabel.forEach(function (e) { names[e[0]] = true; });
      return byLabel.concat(cladeHits(v).filter(function (e) { return !names[e[0]]; })).slice(0, 8);
    };
    var render = function () {
      var v = q.value.trim().toLowerCase(), fv = fold(v);
      var clades = v ? yHits(v) : [], mts = v ? mtHits(v) : [];
      var cults = fv && cultures ? cultures.filter(function (e) { return (e.k || (e.k = fold(e[1] + " | " + e[2] + " | " + e[3]))).indexOf(fv) >= 0; }).slice(0, 6) : [];
      // the country index and the branch shards arrive independently: render whichever is ready
      if (!v || (!idx && !clades.length && !mts.length && !cults.length)) { close(); return; }
      var hits = (fv ? idx || [] : []).filter(function (e) { return (e.k || (e.k = fold(e.en + " | " + e.ru))).indexOf(fv) >= 0; }).slice(0, clades.length || mts.length || cults.length ? 6 : 12);
      var rows = hits.map(function (e) { return '<a href="/' + lang + "/c/" + esc(e.s) + '/"><span>' + esc(lang === "ru" ? e.ru : e.en) + '</span><span class="mono dim">' + (+e.y) + " / " + (+e.mt) + "</span></a>"; });
      if (clades.length) rows.push('<span class="q-group dim">' + esc(q.getAttribute("data-clades")) + "</span>", clades.map(function (e) { return '<a href="/' + lang + "/clade/" + esc(e[1]) + '/"><span lang="en">' + esc(e[0]) + (e[3] && e[3] !== e[0] ? ' <small>' + esc(e[3]) + "</small>" : "") + (e[4] ? ' <small>→ ' + esc(e[4]) + "</small>" : "") + '</span><span class="mono dim">' + (+e[2]).toLocaleString(lang === "ru" ? "ru-RU" : "en-US") + " " + esc(q.getAttribute("data-kits")) + "</span></a>"; }).join(""));
      if (mts.length) rows.push('<span class="q-group dim">' + esc(q.getAttribute("data-clades-mt")) + "</span>", mts.map(function (e) { return '<a href="/' + lang + "/mt-clade/" + esc(e[1]) + '/"><span lang="en">' + esc(e[0]) + (e[4] ? ' <small>→ ' + esc(e[4]) + "</small>" : "") + '</span><span class="mono dim">' + (+e[2]).toLocaleString(lang === "ru" ? "ru-RU" : "en-US") + " " + esc(q.getAttribute("data-kits")) + "</span></a>"; }).join(""));
      if (cults.length) rows.push('<span class="q-group dim">' + esc(q.getAttribute("data-cultures")) + "</span>", cults.map(function (e) { return '<a href="/' + lang + "/culture/" + esc(e[0]) + '/"><span>' + esc(lang === "ru" ? e[1] : e[2]) + '</span><span class="mono dim">' + (+e[4]).toLocaleString(lang === "ru" ? "ru-RU" : "en-US") + " " + esc(q.getAttribute("data-samples")) + "</span></a>"; }).join(""));
      lastFound = rows.length > 0;
      window.ftdTrackSearch("header", v, lastFound);
      out.innerHTML = rows.length
        ? rows.join("")
        : '<span class="q-none dim">' + esc(q.getAttribute("data-none")) + '</span><a href="/' + lang + "/countries/?q=" + encodeURIComponent(v) + '">' + esc(q.getAttribute("data-all")) + "</a>";
      out.hidden = false;
      q.setAttribute("aria-expanded", "true");
    };
    var loadShard = function (letter) {
      if (shards[letter] !== undefined) return;
      shards[letter] = null;
      var file = letter.indexOf("mt:") === 0 ? "mt-clade-" + letter.slice(3).toLowerCase() : "clade-" + letter.toLowerCase();
      // a failed fetch is forgotten so the next keystroke retries it
      fetch("/search/" + file + ".json").then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (j) { shards[letter] = j; render(); }).catch(function () { delete shards[letter]; });
    };
    var idxLoading = false;
    // focus already starts the index, so the first keystroke rarely waits for the network
    var loadIdx = function () {
      if (idx || idxLoading) return;
      idxLoading = true;
      fetch("/search.json").then(function (r) { return r.json(); }).then(function (j) { idx = j; render(); }).catch(function () { idxLoading = false; });
      fetch("/search/cultures.json").then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (j) { cultures = j; render(); }).catch(function () { idxLoading = false; });
      fetch("/search/clade-labels.json").then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (j) { labels = j; render(); }).catch(function () { idxLoading = false; });
    };
    q.addEventListener("focus", loadIdx);
    q.addEventListener("input", function () {
      var snp = snpOf(q.value.trim()), mk = mtKey(q.value.trim());
      if (snp) loadShard(snp[0]);
      if (mk) loadShard(mk);
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
})();
