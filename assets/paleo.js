// /culture/compare/ in the browser: pick 2–4 cultures, get the Y chart and the mt chart one under the other,
// both cut at one year or each at its own depth.
// All maths and the SVG live in paleo-core.js; this file only wires the controls, the URL and the PNG.
(function () {
  "use strict";
  var root = document.getElementById("paleo");
  if (!root || !window.PaleoCore) return;
  var C = window.PaleoCore;
  document.documentElement.classList.add("pc-run");
  var cfg = JSON.parse(document.getElementById("paleo-data").textContent);
  var T = cfg.i18n, lang = cfg.lang;
  var $ = function (id) { return document.getElementById(id); };
  var input = $("pc-input"), opts = $("pc-opts"), chips = $("pc-chips"), empty = $("pc-empty"), status = $("pc-status"), pngBtn = $("pc-png");
  var ageBox = $("pc-age-box"), ageIn = $("pc-age"), ageOut = $("pc-age-out"), yearBtn = $("pc-year"), autoBtn = $("pc-auto");
  var modeBtns = root.querySelectorAll(".pc-mode [data-mode]");
  // one block per tree: its data, its depth slider and the cached stops of the current culture set
  var trees = cfg.kinds.map(function (kind) {
    var el = $("pc-tree-" + kind);
    return { kind: kind, el: el, data: null, bySlug: {}, depthBox: el.querySelector(".pc-depth"), depthIn: el.querySelector(".pc-depth input"), depthOut: el.querySelector(".pc-depth output"), miss: el.querySelector(".pc-miss"), out: el.querySelector(".pc-out"), table: el.querySelector("table"), key: null, stops: [], auto: null, ageStops: [], ageAuto: null, present: [] };
  });
  var field = function (tr) { return tr.kind === "y" ? "depth" : "depthMt"; };
  var modeOf = function (h) { return h.age == null && (h.depth != null || h.depthMt != null) ? "depth" : "age"; };
  // a chain page is its cultures in its order: the hash there keeps only the cut (#a=-3000, #d=11&dm=1);
  // another set or order moves to the main page with the cultures in the hash
  var chain = cfg.main ? C.parseHash(cfg.initial) : null;
  var stateOf = function (hash) {
    var h = C.parseHash(hash);
    if (chain) { h.cultures = chain.cultures.slice(); if (h.age == null && h.depth == null && h.depthMt == null) h.depth = chain.depth; }
    h.mode = modeOf(h);
    return h;
  };
  // an old link with another set of cultures on a chain URL belongs to the main page
  if (chain && C.parseHash(location.hash).cultures.length && C.parseHash(location.hash).cultures.join() !== chain.cultures.join()) location.replace(cfg.main + location.hash);
  var state = stateOf(location.hash || (chain ? "" : cfg.initial)), merged = [], bySlug = {}, ageStops = [], shown = [], active = -1;
  // until a control is touched a chain page keeps its clean URL
  var touched = false;
  var byAge = function () { return state.mode === "age"; };
  var ready = function () { return trees.every(function (tr) { return tr.data; }); };

  // the site palette from CSS variables, so the chart follows the theme; the core hands it to the largest groups
  function palette() {
    var cs = getComputedStyle(document.documentElement), p = [];
    for (var i = 1; i <= 8; i++) p.push(cs.getPropertyValue("--s" + i).trim() || "#888");
    return { palette: p, grey: cs.getPropertyValue("--s0").trim() || "#9aa3ad", ink: cs.getPropertyValue("--ink").trim() || "#14202b", muted: cs.getPropertyValue("--ink-3").trim() || "#5f6a75", bg: cs.getPropertyValue("--surface").trim() || "#fff" };
  }
  var i18n = { ciRange: T.ciRange, samples: T.paleoSamples, source: T.paleoSource, branch: T.paleoBranch, group: T.paleoGroup, total: T.paleoTotal, depthLine: T.paleoDepthLine, ageLine: T.paleoAgeLine, pairLine: T.paleoPairLine, totalLine: T.paleoTotalLine, bce: T.paleoBce, ce: T.paleoCe };

  var cutOf = function () { return byAge() ? { cultures: state.cultures, age: state.age } : { cultures: state.cultures, depth: state.depth, depthMt: state.depthMt }; };
  function setHash() {
    var h = state.cultures.length ? C.formatHash(cutOf()) : "";
    if (chain) {
      if (!touched && !location.hash) return;
      h = h.replace(/^#c=[^&]*&?/, "#").replace(/^#$/, "");
    }
    if (location.hash !== h) history.replaceState(null, "", h || location.pathname);
  }

  function renderChips() {
    chips.innerHTML = "";
    state.cultures.forEach(function (s, i) {
      var c = bySlug[s], li = document.createElement("li");
      li.className = "cp-chip";
      li.innerHTML = "<span></span>";
      li.firstChild.textContent = c ? c[lang] : s;
      [["←", T.paleoLeft, -1], ["→", T.paleoRight, 1], ["×", T.paleoRemove, 0]].forEach(function (b) {
        if ((b[2] === -1 && i === 0) || (b[2] === 1 && i === state.cultures.length - 1)) return;
        var btn = document.createElement("button");
        btn.type = "button"; btn.textContent = b[0]; btn.setAttribute("aria-label", b[1] + ": " + (c ? c[lang] : s));
        btn.onclick = function () {
          if (b[2] === 0) { state.cultures.splice(i, 1); state.depth = state.depthMt = state.age = null; }
          else { var j = i + b[2], t = state.cultures[j]; state.cultures[j] = s; state.cultures[i] = t; }
          update();
          // the chips are rebuilt: keep focus on the moved chip, or go back to the input after a removal
          var li2 = b[2] === 0 ? null : chips.children[i + b[2]];
          var again = li2 && [].filter.call(li2.querySelectorAll("button"), function (x) { return x.textContent === b[0]; })[0];
          (again || li2 && li2.querySelector("button") || input).focus();
        };
        li.appendChild(btn);
      });
      chips.appendChild(li);
    });
  }

  // stops and auto values walk the whole tree: computed once per set of cultures, not per slider step
  function prepare(tr) {
    tr.present = state.cultures.filter(function (s) { return tr.bySlug[s]; });
    var key = tr.present.join();
    if (key === tr.key) return;
    tr.key = key;
    var ok = tr.present.length >= C.MIN_ITEMS;
    tr.stops = ok ? C.depthStops(tr.data, tr.present) : [];
    tr.auto = ok ? C.autoDepth(tr.data, tr.present) : null;
    tr.ageStops = ok ? C.ageStops(tr.data, tr.present) : [];
    tr.ageAuto = ok ? C.autoAge(tr.data, tr.present) : null;
  }
  // index of the last stop at or below v (the first stop when v is below them all)
  function snap(stops, v) {
    var at = 0;
    stops.forEach(function (d, i) { if (d <= v) at = i; });
    return at;
  }

  function update() {
    if (!ready()) return;
    state.cultures = state.cultures.filter(function (s) { return bySlug[s]; });
    if (chain && state.cultures.join() !== chain.cultures.join()) {
      location.assign(cfg.main + (state.cultures.length ? C.formatHash(cutOf()) : ""));
      return;
    }
    renderChips();
    for (var m = 0; m < modeBtns.length; m++) modeBtns[m].setAttribute("aria-pressed", String(modeBtns[m].getAttribute("data-mode") === state.mode));
    input.disabled = state.cultures.length >= C.MAX_ITEMS;
    input.placeholder = input.disabled ? T.paleoMax : T.paleoPickHint;
    if (input.disabled) closeOpts();
    empty.hidden = state.cultures.length > 0;
    trees.forEach(prepare);
    var live = trees.filter(function (tr) { return tr.present.length >= C.MIN_ITEMS; });
    var ok = live.length > 0;
    pngBtn.disabled = !ok;
    yearBtn.disabled = state.cultures.length < C.MIN_ITEMS || C.byYear({ cultures: merged }, state.cultures).join() === state.cultures.join();
    ageBox.hidden = !ok || !byAge();
    autoBtn.disabled = true;
    if (!ok) {
      trees.forEach(function (tr) { tr.el.hidden = true; });
      status.textContent = !state.cultures.length ? "" : state.cultures.length < C.MIN_ITEMS ? T.paleoMin : T.paleoTooFew;
      setHash();
      return;
    }
    // one year for both trees: the slider walks the stops of either; auto follows the Y tree when it can,
    // since the mt chart would push it back by tens of thousands of years to stay under the row limit
    if (byAge()) {
      var all = {};
      live.forEach(function (tr) { tr.ageStops.forEach(function (y) { all[y] = 1; }); });
      ageStops = Object.keys(all).map(Number).sort(function (a, b) { return a - b; });
      if (state.age == null) state.age = live[0].ageAuto;
      state.age = ageStops[snap(ageStops, state.age)];
      ageIn.min = "0"; ageIn.max = String(ageStops.length - 1); ageIn.value = String(snap(ageStops, state.age));
      ageOut.textContent = C.yearText(state.age, lang, i18n);
      ageIn.setAttribute("aria-valuetext", ageOut.textContent);
    } else {
      live.forEach(function (tr) {
        var f = field(tr);
        if (state[f] == null) state[f] = tr.auto;
        state[f] = tr.stops[snap(tr.stops, state[f])];
      });
    }
    // a button that would change nothing is shown as disabled, not left to look broken
    autoBtn.disabled = byAge() ? state.age === live[0].ageAuto : live.every(function (tr) { return state[field(tr)] === tr.auto; });
    setHash();
    var pal = palette(), two = trees.length > 1, outside = 0;
    trees.forEach(function (tr) {
      tr.el.hidden = false;
      var missing = state.cultures.filter(function (s) { return !tr.bySlug[s]; }).map(function (s) { return bySlug[s][lang]; });
      var good = tr.present.length >= C.MIN_ITEMS;
      tr.miss.textContent = !good ? T.paleoTooFew : missing.length ? T.paleoMissing.replace("{list}", missing.join(", ")) : "";
      tr.miss.hidden = !tr.miss.textContent;
      tr.depthBox.hidden = !good || byAge();
      tr.out.hidden = !good;
      tr.table.closest("details").hidden = !good;
      if (!good) { tr.out.innerHTML = ""; return; }
      if (!byAge()) {
        var v = state[field(tr)];
        tr.depthIn.min = "0"; tr.depthIn.max = String(tr.stops.length - 1); tr.depthIn.value = String(snap(tr.stops, v));
        tr.depthOut.textContent = String(v);
        tr.depthIn.setAttribute("aria-valuetext", String(v));
      }
      var L = C.layout(tr.data, tr.present, byAge() ? { age: state.age } : state[field(tr)], { lang: lang, barH: two ? 460 : 760, gap: document.documentElement.clientWidth < 640 ? 90 : 150 });
      tr.out.innerHTML = C.svg(tr.data, L, Object.assign({ lang: lang, i18n: i18n, href: cultureHref }, pal));
      var cap = tr.table.querySelector("caption");
      tr.table.innerHTML = C.table(tr.data, L, { lang: lang, i18n: i18n });
      if (cap) tr.table.insertBefore(cap, tr.table.firstChild);
      outside += tr.present.reduce(function (s, x) { return s + (tr.bySlug[x].u || 0); }, 0);
    });
    status.textContent = outside ? T.paleoOutside.replace("{n}", outside) : "";
    [].forEach.call(root.querySelectorAll(".pc-static"), function (f) { f.hidden = true; });
  }

  function add(s) {
    if (!bySlug[s] || state.cultures.indexOf(s) >= 0 || state.cultures.length >= C.MAX_ITEMS) return false;
    state.cultures.push(s);
    state.depth = state.depthMt = state.age = null; // a new set of cultures gets its own readable cut
    if (window.ftdTrack) {
      if (input.value.trim()) window.ftdTrackSearch("culture", input.value, true, true);
      window.ftdTrack("compare_pick", { culture: s });
      if (state.cultures.length >= C.MIN_ITEMS) window.ftdTrack("compare_set", { culture: state.cultures.slice().sort().join(" + ") });
    }
    input.value = "";
    closeOpts();
    update();
    return true;
  }

  function closeOpts() {
    opts.hidden = true;
    shown = [];
    active = -1;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
  function setActive(i) {
    var items = opts.querySelectorAll("[role=option]");
    if (!items.length) return;
    active = (i + items.length) % items.length;
    for (var k = 0; k < items.length; k++) items[k].setAttribute("aria-selected", k === active ? "true" : "false");
    input.setAttribute("aria-activedescendant", items[active].id);
    items[active].scrollIntoView({ block: "nearest" });
  }
  function renderOpts() {
    if (!ready() || input.disabled) { closeOpts(); return; }
    shown = C.searchCultures(merged, input.value, window.Fold.fold, state.cultures).slice(0, 60);
    if (input.value.trim() && window.ftdTrackSearch) window.ftdTrackSearch("culture", input.value, shown.length > 0);
    opts.innerHTML = "";
    if (!shown.length) {
      var none = document.createElement("li");
      none.className = "pc-none dim";
      none.setAttribute("role", "option");
      none.setAttribute("aria-disabled", "true");
      none.textContent = T.paleoNoMatch;
      opts.appendChild(none);
    }
    shown.forEach(function (c, i) {
      var li = document.createElement("li");
      li.id = "pc-opt-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.textContent = C.pickLabel(c, lang);
      var n = document.createElement("span");
      n.className = "dim mono";
      n.textContent = trees.map(function (tr) { var x = tr.bySlug[c.s]; return x ? (tr.kind === "y" ? T.yDna : T.mtDna) + " " + x.n : ""; }).filter(Boolean).join(" · ");
      li.appendChild(n);
      li.addEventListener("click", function () { add(c.s); });
      opts.appendChild(li);
    });
    active = -1;
    input.removeAttribute("aria-activedescendant");
    opts.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  // keeps focus in the input, so a click on an option or on the scrollbar does not close the list
  opts.addEventListener("mousedown", function (e) { e.preventDefault(); });
  input.addEventListener("input", renderOpts);
  input.addEventListener("focus", renderOpts);
  input.addEventListener("blur", closeOpts);
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (opts.hidden) renderOpts();
      setActive(active < 0 && e.key === "ArrowUp" ? -1 : active + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      var pick = active >= 0 ? shown[active] : shown.length === 1 ? shown[0] : null;
      if (pick) add(pick.s);
    } else if (e.key === "Escape") closeOpts();
  });
  // the sliders redraw on every step: a chart is a few hundred SVG nodes at most
  ageIn.addEventListener("input", function () { touched = true; state.age = ageStops[Number(ageIn.value)]; update(); });
  trees.forEach(function (tr) {
    tr.depthIn.addEventListener("input", function () { touched = true; state[field(tr)] = tr.stops[Number(tr.depthIn.value)]; update(); });
  });
  yearBtn.addEventListener("click", function () { state.cultures = C.byYear({ cultures: merged }, state.cultures); update(); });
  autoBtn.addEventListener("click", function () { touched = true; state.depth = state.depthMt = state.age = null; update(); });
  [].forEach.call(modeBtns, function (b) {
    b.addEventListener("click", function () {
      if (b.getAttribute("data-mode") === state.mode) return;
      touched = true; state.mode = b.getAttribute("data-mode"); state.depth = state.depthMt = state.age = null; update();
    });
  });
  window.addEventListener("hashchange", function () {
    if (!ready()) return;
    var h = stateOf(location.hash || (chain ? "" : cfg.initial));
    if (h.cultures.join() !== state.cultures.join() || h.depth !== state.depth || h.depthMt !== state.depthMt || h.age !== state.age) { state = h; update(); }
  });

  // PNG: the charts one under another on a 2× canvas, each under its tree title;
  // fonts fall back to the system sans if IBM Plex is not ready
  pngBtn.addEventListener("click", function () {
    var parts = trees.filter(function (tr) { return !tr.el.hidden && !tr.out.hidden && tr.out.querySelector("svg"); });
    if (!parts.length) return;
    var pal = palette(), TITLE = parts.length > 1 ? 44 : 0;
    Promise.all(parts.map(function (tr) {
      return new Promise(function (resolve, reject) {
        var svgEl = tr.out.querySelector("svg"), img = new Image();
        var url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svgEl)], { type: "image/svg+xml" }));
        img.onload = function () { URL.revokeObjectURL(url); resolve({ img: img, w: +svgEl.getAttribute("width"), h: +svgEl.getAttribute("height"), title: tr.el.querySelector("h2").textContent }); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("svg")); };
        img.src = url;
      });
    })).then(function (imgs) {
      var w = Math.max.apply(null, imgs.map(function (x) { return x.w; })), h = imgs.reduce(function (s, x) { return s + x.h + TITLE; }, 0);
      // 2× where the browser allows it: mobile canvases stop at about 16 MP and 4096 px a side
      var sc = Math.min(2, Math.sqrt(16e6 / (w * h)), 4096 / Math.max(w, h));
      var cv = document.createElement("canvas"); cv.width = Math.floor(w * sc); cv.height = Math.floor(h * sc);
      var g = cv.getContext("2d"); g.scale(sc, sc);
      g.fillStyle = pal.bg; g.fillRect(0, 0, w, h);
      var y = 0;
      imgs.forEach(function (x) {
        if (TITLE) { g.fillStyle = pal.ink; g.font = "700 24px 'IBM Plex Sans', system-ui, sans-serif"; g.fillText(x.title, 20, y + 32); y += TITLE; }
        g.drawImage(x.img, 0, y); y += x.h;
      });
      var cut = byAge() ? "-" + Math.abs(state.age) + (state.age < 0 ? "bce" : "ce") : (state.depth != null ? "-y" + state.depth : "") + (state.depthMt != null ? "-mt" + state.depthMt : "");
      cv.toBlob(function (b) { if (!b) { status.textContent = T.paleoError; return; } var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "ftdnastat-" + state.cultures.join("-") + cut + ".png"; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); });
    }).catch(function () { status.textContent = T.paleoError; });
  });

  // a culture has its own page with enough Y samples, or else with enough mt ones
  var mtPages = {};
  (cfg.mtPages || []).forEach(function (s) { mtPages[s] = true; });
  var cultureHref = function (slug) {
    if (slug.indexOf("tag:") === 0) return "/" + lang + "/culture/tag/" + slug.slice(4) + "/";
    var y = trees.filter(function (tr) { return tr.kind === "y"; })[0];
    return (y && y.bySlug[slug]) || mtPages[slug] ? "/" + lang + "/culture/" + slug + "/" : null;
  };
  var loading = $("pc-loading");
  var loaded = function () { loading.remove(); document.documentElement.classList.remove("pc-has"); };
  Promise.all(trees.map(function (tr) {
    return fetch("/data/paleo-" + tr.kind + ".json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
      tr.data = d;
      d.cultures.forEach(function (c) { tr.bySlug[c.s] = c; });
    });
  })).then(function () {
    // the picker lists every culture of either tree once
    trees.forEach(function (tr) {
      tr.data.cultures.forEach(function (c) {
        if (!bySlug[c.s]) { bySlug[c.s] = { s: c.s, en: c.en, ru: c.ru, rp: c.rp, d: c.d, tag: c.tag, n: 0, year: c.year }; merged.push(bySlug[c.s]); }
        bySlug[c.s].n += c.n;
      });
    });
    merged.sort(function (a, b) { return b.n - a.n; });
    loaded();
    if (document.activeElement === input) renderOpts();
    update();
  }).catch(function () { loaded(); status.textContent = T.paleoError; });
})();
