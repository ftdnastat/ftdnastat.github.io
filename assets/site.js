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
    var readHash = function () {
      var h = new URLSearchParams(location.hash.replace(/^#/, ""));
      if (h.get("grp")) grp = h.get("grp");
      if (h.get("n") && !isNaN(+h.get("n"))) minn = +h.get("n");
      if (h.get("q")) name = h.get("q").toLowerCase();
      if (tabs) tabs.querySelectorAll(".tab").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-v") === grp); });
      if (sel) { if (![].some.call(sel.options, function (o) { return +o.value === minn; })) { var o = document.createElement("option"); o.value = minn; o.textContent = "≥ " + minn; sel.appendChild(o); } sel.value = String(minn); }
      if (nameInput) nameInput.value = name;
    };
    var writeHash = function () {
      var h = new URLSearchParams();
      if (grp !== "all") h.set("grp", grp);
      if (minn !== defMinn) h.set("n", String(minn));
      if (name) h.set("q", name);
      var s = h.toString();
      var url = location.pathname + location.search + (s ? "#" + s : "");
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
    window.addEventListener("hashchange", function () { readHash(); apply(); });
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
    var render = function () {
      var v = q.value.trim().toLowerCase();
      if (!v || !idx) { out.hidden = true; return; }
      var hits = idx.filter(function (e) { return e.en.toLowerCase().indexOf(v) >= 0 || e.ru.toLowerCase().indexOf(v) >= 0; }).slice(0, 12);
      var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
      out.innerHTML = hits.length
        ? hits.map(function (e) { return '<a role="option" href="/' + lang + "/c/" + esc(e.s) + '/"><span>' + esc(lang === "ru" ? e.ru : e.en) + '</span><span class="mono dim">' + (+e.y) + " / " + (+e.mt) + "</span></a>"; }).join("")
        : '<span class="q-none dim">' + esc(q.getAttribute("data-none")) + '</span><a role="option" href="/' + lang + "/countries/#q=" + encodeURIComponent(v) + '">' + esc(q.getAttribute("data-all")) + "</a>";
      out.hidden = false;
      q.setAttribute("aria-expanded", "true");
    };
    q.addEventListener("input", function () {
      if (idx) return render();
      fetch("/search.json").then(function (r) { return r.json(); }).then(function (j) { idx = j; render(); }).catch(function () {});
    });
    q.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); var a = out.querySelector("a"); location.href = a ? a.getAttribute("href") : "/" + lang + "/countries/#q=" + encodeURIComponent(q.value.trim()); }
      if (e.key === "Escape") { out.hidden = true; q.setAttribute("aria-expanded", "false"); }
    });
    document.addEventListener("click", function (e) { if (!out.contains(e.target) && e.target !== q) { out.hidden = true; q.setAttribute("aria-expanded", "false"); } });
  }
})();
