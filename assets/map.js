(function () {
  "use strict";
  const fig = document.getElementById("cmap");
  const blobEl = document.getElementById("map-data");
  if (!fig || !blobEl) return;
  const D = JSON.parse(blobEl.textContent);
  const lang = D.lang;
  const frame = fig.querySelector(".cmap-frame");
  const cap = fig.querySelector(".cmap-cap");
  const tabs = fig.querySelector(".cmap-tabs");
  const NS = "http://www.w3.org/2000/svg";
  const SPECIAL = { "x-ru-ua": "mapRuUa", "x-ose": "mapOse" };

  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  const pf = (x) => { const s = (100 * x).toFixed(x < 0.1 ? 1 : 0); return (lang === "ru" ? s.replace(".", ",") : s) + "%"; };
  const svgEl = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  const shares = new Map(Object.entries(D.shares).map(([k, v]) => [k, v / 1e4]));
  const binOf = (v) => { const i = D.edges.findIndex((e) => v <= e + 1e-9); return i < 0 ? D.edges.length : i + 1; };
  const top = [...shares.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];

  Promise.all([fetch("/assets/map-world.json").then((r) => r.json()), fetch("/data/map-base.json").then((r) => r.json())]).then(([geo, base]) => {
    const S = base.i18n[lang];
    const counted = new Set(base[D.kind]);
    const nameOf = (id) => (base.names[id] ? base.names[id][lang === "ru" ? 0 : 1] : null);
    const classOf = (id) => {
      if (shares.has(id)) return "m" + binOf(shares.get(id));
      if (counted.has(id)) return "m0";
      return base.names[id] ? "msm" : "mna";
    };

    const svg = svgEl("svg", { viewBox: "0 0 " + geo.w + " " + geo.h, role: "img", "aria-label": fig.getAttribute("aria-label") });
    const defs = svgEl("defs", {});
    // 5 px stripes at any zoom: fitHatch() rescales the pattern from screen pixels to map units
    const pat = svgEl("pattern", { id: "cmap-hatch", width: "5", height: "5", patternUnits: "userSpaceOnUse" });
    pat.appendChild(svgEl("rect", { width: "5", height: "5", class: "cmap-hatch-bg" }));
    pat.appendChild(svgEl("line", { x1: "0", y1: "0", x2: "0", y2: "5", class: "cmap-hatch-ln" }));
    defs.appendChild(pat);
    svg.appendChild(defs);
    const g = svgEl("g", {});
    const paths = new Map();
    for (const u of geo.units) {
      const p = svgEl("path", { d: u.d, class: "u " + classOf(u.id), "data-id": u.id });
      paths.set(u.id, p);
      g.appendChild(p);
    }
    svg.appendChild(g);
    svg.appendChild(svgEl("path", { d: geo.borders, class: "brd" }));
    const ring = svgEl("path", { class: "ring" });
    svg.appendChild(ring);
    frame.appendChild(svg);

    let pinned = null;
    function describe(id) {
      cap.textContent = "";
      if (!id) { cap.textContent = S.mapHint; return; }
      if (SPECIAL[id]) { cap.textContent = S[SPECIAL[id]]; return; }
      const name = nameOf(id);
      if (!name) { cap.textContent = S.mapNoData; return; }
      const a = document.createElement("a");
      a.textContent = name;
      a.href = "/" + lang + "/c/" + id + "/";
      cap.appendChild(a);
      const msg = shares.has(id) ? fmt(S.mapShare, { pct: pf(shares.get(id)) }) : counted.has(id) ? S.mapZero : fmt(S.mapSmall, { n: D.minN });
      cap.appendChild(document.createTextNode(": " + msg));
    }
    function mark(id) {
      if (id && paths.has(id)) ring.setAttribute("d", paths.get(id).getAttribute("d"));
      else ring.removeAttribute("d");
    }
    const idOf = (ev) => (ev.target.getAttribute && ev.target.getAttribute("data-id")) || null;
    svg.addEventListener("pointerover", (ev) => {
      if (pinned || ev.pointerType === "touch") return;
      const id = idOf(ev);
      mark(id); describe(id);
    });
    svg.addEventListener("pointerleave", (ev) => { if (!pinned && ev.pointerType !== "touch") { mark(null); describe(null); } });
    svg.addEventListener("click", (ev) => {
      const id = idOf(ev);
      pinned = id && id !== pinned ? id : null;
      mark(pinned); describe(pinned);
    });

    const views = Object.assign({ world: [0, 0, geo.w, geo.h] }, geo.views);
    const box = paths.has(top) ? paths.get(top).getBBox() : null;
    const inside = (v) => box && box.x >= v[0] && box.y >= v[1] && box.x + box.width <= v[0] + v[2] && box.y + box.height <= v[1] + v[3];
    let view = ["caucasus", "europe"].find((k) => views[k] && inside(views[k])) || "world";
    function fitHatch() {
      const w = svg.clientWidth || geo.w, v = views[view];
      const k = Math.max(v[2] / w, v[3] / (w / 2));
      pat.setAttribute("patternTransform", "rotate(45) scale(" + k.toFixed(4) + ")");
    }
    function show() {
      svg.setAttribute("viewBox", views[view].join(" "));
      svg.classList.toggle("zoom", view !== "world");
      tabs.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === view)));
      fitHatch();
    }
    tabs.querySelectorAll(".tab").forEach((b) => {
      if (!views[b.dataset.v]) { b.remove(); return; }
      b.addEventListener("click", () => { view = b.dataset.v; show(); });
    });
    window.addEventListener("resize", fitHatch);
    show();
  }).catch(() => fig.remove());
})();
