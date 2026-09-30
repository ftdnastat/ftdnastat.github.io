(function () {
  "use strict";
  var lang = document.body.getAttribute("data-lang") || "en";

  try { localStorage.setItem("ftdnastat_lang", lang); } catch (e) {}
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
    var rows = Array.prototype.slice.call(box.tagName === "TABLE" ? box.tBodies[0].rows : box.querySelectorAll("[data-grp]"));
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

  var q = document.getElementById("q"), out = document.getElementById("q-out"), idx = null;
  if (q && out) {
    var close = function () { out.hidden = true; q.setAttribute("aria-expanded", "false"); };
    var render = function () {
      var v = q.value.trim().toLowerCase();
      if (!v || !idx) { close(); return; }
      var hits = idx.filter(function (e) { return e.en.toLowerCase().indexOf(v) >= 0 || e.ru.toLowerCase().indexOf(v) >= 0; }).slice(0, 12);
      var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
      out.innerHTML = hits.length
        ? hits.map(function (e) { return '<a href="/' + lang + "/c/" + esc(e.s) + '/"><span>' + esc(lang === "ru" ? e.ru : e.en) + '</span><span class="mono dim">' + (+e.y) + " / " + (+e.mt) + "</span></a>"; }).join("")
        : '<span class="q-none dim">' + esc(q.getAttribute("data-none")) + '</span><a href="/' + lang + "/countries/?q=" + encodeURIComponent(v) + '">' + esc(q.getAttribute("data-all")) + "</a>";
      out.hidden = false;
      q.setAttribute("aria-expanded", "true");
    };
    q.addEventListener("input", function () {
      if (idx) return render();
      fetch("/search.json").then(function (r) { return r.json(); }).then(function (j) { idx = j; render(); }).catch(function () {});
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
