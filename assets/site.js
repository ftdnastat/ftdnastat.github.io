(function () {
  "use strict";
  var lang = document.body.getAttribute("data-lang") || "en";

  // a page prerendered on hover is not a visit yet: remember its language only once it is shown
  var saveLang = function () { try { localStorage.setItem("ftdnastat_lang", lang); } catch (e) {} };
  if (document.prerendering) document.addEventListener("prerenderingchange", saveLang, { once: true });
  else saveLang();
  var sw = document.querySelector("[data-lang-switch]");
  if (sw) sw.addEventListener("click", function () { sw.href = sw.getAttribute("href").split("#")[0] + location.hash; });

  var box = document.querySelector("[data-filterable]");
  if (box) {
    var grp = "all", minn = 1, name = "";
    var sel = document.querySelector("[data-filter=minn]");
    var tabs = document.querySelector("[data-filter=grp]");
    var nameInput = document.querySelector("[data-filter=name]");
    if (sel) minn = +sel.value;
    var defMinn = minn;
    // filter state lives in the hash so a copied link reopens the same view
    // ?q= comes from the header search form without JS and from the WebSite SearchAction
    var readHash = function () {
      var h = new URLSearchParams(location.hash.replace(/^#/, ""));
      var qs = new URLSearchParams(location.search);
      if (qs.get("q") && !h.get("q")) h.set("q", qs.get("q"));
      if (h.get("grp")) grp = h.get("grp");
      if (h.get("n") && !isNaN(+h.get("n"))) minn = +h.get("n");
      if (h.get("q")) name = h.get("q").toLowerCase();
      if (tabs) tabs.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-v") === grp); });
      if (sel) { if (![].some.call(sel.options, function (o) { return +o.value === minn; })) { var o = document.createElement("option"); o.value = minn; o.textContent = "≥ " + minn; sel.appendChild(o); } sel.value = String(minn); }
      if (nameInput) nameInput.value = name;
    };
    var isFilterHash = function (hash) { return /(^|&)(grp|n|q)=/.test(hash.replace(/^#/, "")); };
    var writeHash = function () {
      var h = new URLSearchParams();
      if (grp !== "all") h.set("grp", grp);
      if (minn !== defMinn) h.set("n", String(minn));
      if (name) h.set("q", name);
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
    document.querySelectorAll("[data-filterable]").forEach(function (b) { rows = rows.concat(Array.prototype.slice.call(b.tagName === "TABLE" ? b.tBodies[0].rows : b.querySelectorAll("[data-grp]"))); });
    var apply = function () {
      var shown = 0;
      rows.forEach(function (tr) {
        var ok = (grp === "all" || tr.getAttribute("data-grp") === grp) && +tr.getAttribute("data-n") >= minn && (!name || (tr.getAttribute("data-name") || tr.textContent).toLowerCase().indexOf(name) >= 0);
        tr.hidden = !ok;
        if (ok) shown++;
      });
      if (count) count.textContent = shown + " / " + rows.length;
      var empty = document.querySelector("[data-empty]");
      if (empty) empty.hidden = shown > 0;
      writeHash();
    };
    var reset = document.querySelector("[data-reset]");
    if (reset) reset.addEventListener("click", function (e) { e.preventDefault(); grp = "all"; minn = 1; name = ""; if (sel) sel.value = "1"; if (nameInput) nameInput.value = ""; if (tabs) tabs.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-v") === "all"); }); apply(); });
    if (nameInput) nameInput.addEventListener("input", function () { name = nameInput.value.trim().toLowerCase(); apply(); });
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

  var q = document.getElementById("q"), out = document.getElementById("q-out"), idx = null, labels = null, shards = {};
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
      var v = q.value.trim().toLowerCase();
      var clades = v ? yHits(v) : [], mts = v ? mtHits(v) : [];
      // the country index and the branch shards arrive independently: render whichever is ready
      if (!v || (!idx && !clades.length && !mts.length)) { close(); return; }
      var hits = (idx || []).filter(function (e) { return e.en.toLowerCase().indexOf(v) >= 0 || e.ru.toLowerCase().indexOf(v) >= 0; }).slice(0, clades.length || mts.length ? 6 : 12);
      var rows = hits.map(function (e) { return '<a href="/' + lang + "/c/" + esc(e.s) + '/"><span>' + esc(lang === "ru" ? e.ru : e.en) + '</span><span class="mono dim">' + (+e.y) + " / " + (+e.mt) + "</span></a>"; });
      if (clades.length) rows.push('<span class="q-group dim">' + esc(q.getAttribute("data-clades")) + "</span>", clades.map(function (e) { return '<a href="/' + lang + "/clade/" + esc(e[1]) + '/"><span lang="en">' + esc(e[0]) + (e[3] && e[3] !== e[0] ? ' <small>' + esc(e[3]) + "</small>" : "") + (e[4] ? ' <small>→ ' + esc(e[4]) + "</small>" : "") + '</span><span class="mono dim">' + (+e[2]).toLocaleString(lang === "ru" ? "ru-RU" : "en-US") + " " + esc(q.getAttribute("data-kits")) + "</span></a>"; }).join(""));
      if (mts.length) rows.push('<span class="q-group dim">' + esc(q.getAttribute("data-clades-mt")) + "</span>", mts.map(function (e) { return '<a href="/' + lang + "/mt-clade/" + esc(e[1]) + '/"><span lang="en">' + esc(e[0]) + (e[4] ? ' <small>→ ' + esc(e[4]) + "</small>" : "") + '</span><span class="mono dim">' + (+e[2]).toLocaleString(lang === "ru" ? "ru-RU" : "en-US") + " " + esc(q.getAttribute("data-kits")) + "</span></a>"; }).join(""));
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
      if (e.key === "Enter") { e.preventDefault(); var a = out.querySelector("a"); location.href = a ? a.getAttribute("href") : "/" + lang + "/countries/?q=" + encodeURIComponent(q.value.trim()); }
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown") move(e, 1);
    });
    out.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") move(e, 1);
      if (e.key === "ArrowUp") move(e, -1);
      if (e.key === "Escape") { close(); q.focus(); }
    });
    document.addEventListener("click", function (e) { if (!out.contains(e.target) && e.target !== q) close(); });
    q.form.addEventListener("focusout", function (e) { if (!q.form.contains(e.relatedTarget)) close(); });
  }
})();
