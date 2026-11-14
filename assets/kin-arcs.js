// Arc maps of findings: every pair as an arc, the view fitted to the arcs of the chosen level; arrows when the data asks.
(function () {
  "use strict";
  const figs = [...document.querySelectorAll(".karc")];
  if (!figs.length) return;
  if (!window.EqEarth) { figs.forEach((f) => { f.hidden = true; }); return; }
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  (window.ftdMapWorld = window.ftdMapWorld || fetch("/assets/map-world.json").then((r) => r.json()))
    .then((geo) => figs.forEach((fig) => draw(fig, geo)))
    .catch((e) => { figs.forEach((f) => { f.hidden = true; }); console.error("arc map:", e); });

  function draw(fig, geo) {
    const D = JSON.parse(fig.querySelector('script[type="application/json"]').textContent);
    const frame = fig.querySelector(".cmap-frame"), cap = fig.querySelector(".cmap-cap"), hint = cap.textContent;
    const proj = ([lat, lon]) => EqEarth.toMap(geo.proj, lon, lat);
    const svg = el("svg", { viewBox: "0 0 " + geo.w + " " + geo.h, role: "img", "aria-label": fig.getAttribute("aria-label") });
    svg.appendChild(el("path", { d: geo.units.map((u) => u.d).join(""), class: "gm-land" }));
    svg.appendChild(el("path", { d: geo.borders, class: "brd" }));
    const marks = el("g", {});
    svg.appendChild(marks);
    frame.appendChild(svg);

    let level = fig.dataset.level, zoom = "all", on = null;
    // "all" fits the arcs of the level; the other views are the map's own boxes
    function boxOf(rows) {
      const v = zoom !== "all" && geo.views[zoom];
      let xs, ys;
      if (v) { xs = [v[0], v[0] + v[2]]; ys = [v[1], v[1] + v[3]]; } else { const pts = rows.flatMap((r) => [proj(r.a), proj(r.b)]); xs = pts.map((p) => p[0]); ys = pts.map((p) => p[1]); }
      let w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      w = Math.min(geo.w, Math.max(w * 1.3, h * 1.3 * 2, 120));
      h = w / 2;
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      return [Math.min(Math.max(cx - w / 2, 0), geo.w - w), Math.min(Math.max(cy - h / 2, 0), Math.max(0, geo.h - h)), w, h];
    }
    function paint() {
      const all = D.levels[level] || [];
      const [x0, y0, w, h] = boxOf(all);
      // a zoomed view keeps the arcs with an end inside it: the rest only fly over
      const inside = (p) => { const q = proj(p); return q[0] >= x0 && q[0] <= x0 + w && q[1] >= y0 && q[1] <= y0 + h; };
      const kept = all.map((r, i) => [r, i]).filter(([r]) => zoom === "all" || inside(r.a) || inside(r.b));
      svg.setAttribute("viewBox", [x0, y0, w, h].map((x) => x.toFixed(1)).join(" "));
      svg.classList.toggle("zoom", w < geo.w * 0.9);
      // dots keep their screen size whatever the zoom
      const px = w / (frame.clientWidth || 800), max = Math.max(1, ...all.map((r) => r.w));
      marks.replaceChildren();
      const dots = new Map();
      // the widest arcs last, so they lie on top
      kept.sort((x, y) => x[0].w - y[0].w).forEach(([r, i]) => {
        const a = proj(r.a), b = proj(r.b), dx = b[0] - a[0], dy = b[1] - a[1];
        const c = [(a[0] + b[0]) / 2 - dy * 0.2, (a[1] + b[1]) / 2 + dx * 0.2];
        const d = "M" + a.map((x) => x.toFixed(2)).join(",") + "Q" + c.map((x) => x.toFixed(2)).join(",") + " " + b.map((x) => x.toFixed(2)).join(",");
        const g = el("g", { class: "karc-pair", "data-i": String(i) });
        g.appendChild(el("path", { d, class: "karc-arc", style: "stroke-width:" + (1 + 3 * Math.sqrt(r.w / max)).toFixed(2) + "px" }));
        g.appendChild(el("path", { d, class: "karc-hit" }));
        if (D.arrow) {
          // the head sits just short of the dot, along the curve's last tangent
          const ang = Math.atan2(b[1] - c[1], b[0] - c[0]), s = px * 4, tip = [b[0] - px * 3 * Math.cos(ang), b[1] - px * 3 * Math.sin(ang)];
          const p = (k) => [tip[0] - s * 2 * Math.cos(ang + k), tip[1] - s * 2 * Math.sin(ang + k)].map((x) => x.toFixed(2)).join(",");
          g.appendChild(el("path", { d: "M" + tip.map((x) => x.toFixed(2)).join(",") + "L" + p(0.4) + "L" + p(-0.4) + "Z", class: "karc-head" }));
        }
        marks.appendChild(g);
        for (const p of [a, b]) dots.set(p.map((x) => x.toFixed(1)).join(","), p);
      });
      for (const p of dots.values()) marks.appendChild(el("circle", { cx: p[0], cy: p[1], r: (px * 2.5).toFixed(2), class: "karc-dot" }));
      on = null;
      cap.textContent = hint;
    }
    function pick(g) {
      if (on) on.classList.remove("on");
      on = g;
      if (!g) { cap.textContent = hint; return; }
      g.classList.add("on");
      g.parentNode.appendChild(g);
      cap.textContent = D.levels[level][+g.dataset.i].text;
    }
    const pairAt = (ev) => ev.target.closest && ev.target.closest(".karc-pair");
    svg.addEventListener("mouseover", (ev) => { const g = pairAt(ev); if (g && g !== on) pick(g); });
    svg.addEventListener("click", (ev) => pick(pairAt(ev)));
    const tabs = [...fig.querySelectorAll(".karc-views .tab")];
    tabs.forEach((b) => b.addEventListener("click", () => { level = b.dataset.v; tabs.forEach((x) => x.setAttribute("aria-pressed", String(x === b))); paint(); }));
    const zooms = [...fig.querySelectorAll(".karc-zoom .tab")];
    zooms.forEach((b) => { if (b.dataset.z !== "all" && !geo.views[b.dataset.z]) b.remove(); else b.addEventListener("click", () => { zoom = b.dataset.z; zooms.forEach((x) => x.setAttribute("aria-pressed", String(x === b))); paint(); }); });
    paint();
    if (window.ResizeObserver) new ResizeObserver(() => paint()).observe(frame);
  }
})();
