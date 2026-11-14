(function () {
  "use strict";
  const figs = [...document.querySelectorAll(".simmap")];
  if (!figs.length) return;
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  const geoP = (window.ftdMapWorld = window.ftdMapWorld || fetch("/assets/map-world.json").then((r) => r.json()));
  Promise.all([geoP, fetch("/data/map-base.json").then((r) => r.json())])
    .then(([geo, base]) => figs.forEach((fig) => draw(fig, geo, base)))
    .catch((e) => { figs.forEach((f) => { f.hidden = true; }); console.error("similar map:", e); });

  function draw(fig, geo, base) {
    const D = JSON.parse(fig.querySelector('script[type="application/json"]').textContent);
    const frame = fig.querySelector(".cmap-frame"), cap = fig.querySelector(".cmap-cap"), sub = base.sub || {};
    const name = (id) => (base.names[id] ? base.names[id][D.lang === "ru" ? 0 : 1] : id);
    const bin = (v) => { const i = D.edges.findIndex((x) => v <= x); return i < 0 ? D.edges.length + 1 : i + 1; };
    const own = (id) => id === D.self || sub[id] === D.self;
    // a region with no value of its own lets its country's colour through; a region page's own country stays plain under it
    const cls = (id) => (own(id) ? "msf" : has(D.sim, id) ? "m" + bin(D.sim[id]) : id === D.parent ? "mna" : has(sub, id) ? "mnone" : base.names[id] ? "msm" : "mna");
    const svg = el("svg", { viewBox: "0 0 " + geo.w + " " + geo.h, role: "img", "aria-label": fig.dataset.label });
    // one pattern per map: Chrome draws no pattern that sits in a hidden panel
    const hatch = fig.id + "-hatch", defs = el("defs", {}), pat = el("pattern", { id: hatch, width: "5", height: "5", patternUnits: "userSpaceOnUse" });
    pat.appendChild(el("rect", { width: "5", height: "5", class: "cmap-hatch-bg" }));
    pat.appendChild(el("line", { x1: "0", y1: "0", x2: "0", y2: "5", class: "cmap-hatch-ln" }));
    defs.appendChild(pat);
    svg.appendChild(defs);
    const g = el("g", {}), paths = new Map();
    for (const u of [...geo.units].sort((a, b) => has(sub, a.id) - has(sub, b.id))) {
      const c = cls(u.id), p = el("path", { d: u.d, class: "u " + c, "data-id": u.id });
      if (c === "msm") p.style.setProperty("--f", "url(#" + hatch + ")");
      paths.set(u.id, p);
      g.appendChild(p);
    }
    svg.appendChild(g);
    svg.appendChild(el("path", { d: geo.borders, class: "brd" }));
    frame.appendChild(svg);

    function say(id) {
      cap.replaceChildren();
      if (!id || own(id)) return;
      if (!has(D.sim, id)) { if (base.names[id] && id !== D.parent) cap.textContent = fmt(D.s.few, { name: name(id) }); return; }
      cap.append(fmt(D.s.cap, { name: name(id), pct: D.sim[id] + "%" }) + " ");
      const a = document.createElement("a");
      a.href = "/" + D.lang + "/compare/#a=c:" + D.self + ",c:" + id;
      a.textContent = D.s.compare;
      cap.append(a);
    }
    const unitAt = (ev) => { const t = ev.target.closest && ev.target.closest(".u"); return t && t.dataset.id; };
    svg.addEventListener("mouseover", (ev) => say(unitAt(ev)));
    svg.addEventListener("click", (ev) => say(unitAt(ev)));

    const box = (ids) => {
      const bs = ids.map((id) => paths.get(id)).filter(Boolean).map((p) => p.getBBox());
      if (!bs.length) return null;
      const x0 = Math.min(...bs.map((b) => b.x)), x1 = Math.max(...bs.map((b) => b.x + b.width));
      const y0 = Math.min(...bs.map((b) => b.y)), y1 = Math.max(...bs.map((b) => b.y + b.height));
      const w = Math.max((x1 - x0) * 1.3, (y1 - y0) * 1.3 * 2, 120), h = w / 2;
      if (w > geo.w * 0.9) return null;
      const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
      return [clamp((x0 + x1) / 2 - w / 2, 0, geo.w - w), clamp((y0 + y1) / 2 - h / 2, 0, Math.max(0, geo.h - h)), w, h];
    };
    const buttons = [...fig.querySelectorAll(".simmap-views .tab")];
    // a map in a hidden panel has no boxes yet: the near view is found once it shows
    let near, cur = "near", ro = null;
    function view(v) {
      cur = v;
      if (near === undefined && frame.clientWidth) {
        near = box([D.self, ...D.top]);
        fig.querySelector(".simmap-views").hidden = !near;
        if (ro) ro.disconnect();
      }
      const b = v === "near" && near ? near : [0, 0, geo.w, geo.h];
      svg.setAttribute("viewBox", b.map((x) => x.toFixed(1)).join(" "));
      svg.classList.toggle("zoom", b === near);
      if (near !== undefined) buttons.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === (b === near ? "near" : "world"))));
    }
    buttons.forEach((x) => x.addEventListener("click", () => view(x.dataset.v)));
    view("near");
    if (near === undefined && window.ResizeObserver) (ro = new ResizeObserver(() => { if (near === undefined) view(cur); })).observe(frame);
  }
})();
