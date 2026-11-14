(function () {
  "use strict";
  const fig = document.getElementById("smap");
  const blobEl = document.getElementById("smap-data");
  if (!fig || !blobEl || !window.EqEarth) return;
  const D = JSON.parse(blobEl.textContent);
  const frame = fig.querySelector(".cmap-frame"), picks = [...document.querySelectorAll(".smap-pick")];
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  (window.ftdMapWorld = window.ftdMapWorld || fetch("/assets/map-world.json").then((r) => r.json())).then((geo) => {
    const proj = ([lat, lon]) => EqEarth.toMap(geo.proj, lon, lat);
    const svg = el("svg", { viewBox: "0 0 " + geo.w + " " + geo.h, role: "img", "aria-label": fig.getAttribute("aria-label") });
    svg.appendChild(el("path", { d: geo.units.map((u) => u.d).join(""), class: "gm-land" }));
    svg.appendChild(el("path", { d: geo.borders, class: "brd" }));
    const marks = el("g", {});
    svg.appendChild(marks);
    frame.appendChild(svg);

    // a gentle arc with its head drawn in map units: markers would scale with the zoom
    function arc(a, b, cls, size) {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
      const c = [mx - dy * 0.18, my + dx * 0.18];
      marks.appendChild(el("path", { d: "M" + a.join(",") + "Q" + c.join(",") + " " + b.join(","), class: "smap-arc " + cls }));
      if (D.plain) return;
      const ang = Math.atan2(b[1] - c[1], b[0] - c[0]), h = size * 2.2;
      b = [b[0] - size * 1.4 * Math.cos(ang), b[1] - size * 1.4 * Math.sin(ang)];
      const p = (s) => [b[0] - h * Math.cos(ang + s), b[1] - h * Math.sin(ang + s)].map((x) => x.toFixed(2)).join(",");
      marks.appendChild(el("path", { d: "M" + b.join(",") + "L" + p(0.45) + "L" + p(-0.45) + "Z", class: "smap-head " + cls }));
    }
    function label(at, text, size, cls, right) {
      if (!text) return;
      const left = at[0] > right - size * 40;
      const t = el("text", { x: at[0] + (left ? -1 : 1) * size * 1.6, y: at[1] - size * 1.2, "text-anchor": left ? "end" : "start", class: "smap-label " + cls, "font-size": (size * 3).toFixed(2) });
      t.textContent = text;
      marks.appendChild(t);
    }

    let cur = 0;
    function show(i) {
      const r = D.rows[i];
      const pts = [r.core, r.out].concat(r.then || []).map(proj);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      let w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      w = Math.max(w * 1.6, h * 1.6 * 2, 160);
      h = w / 2;
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      svg.setAttribute("viewBox", [cx - w / 2, cy - h / 2, w, h].map((x) => x.toFixed(1)).join(" "));
      // marks keep their screen size whatever the zoom: 4 px units
      const size = (w / (frame.clientWidth || 800)) * 4;
      cur = i;
      marks.replaceChildren();
      const [core, out] = pts;
      if (r.then) {
        arc(pts[2], pts[3], "then", size * 0.8);
        marks.appendChild(el("circle", { cx: pts[2][0], cy: pts[2][1], r: size * 1.1, class: "smap-dot then" }));
      }
      arc(core, out, "out", size);
      marks.appendChild(el("circle", { cx: core[0], cy: core[1], r: size * 1.4, class: "smap-dot core" }));
      marks.appendChild(el("circle", { cx: out[0], cy: out[1], r: size * 1.4, class: "smap-dot " + (D.plain ? "core" : "out") }));
      label(core, r.coreL, size, "core", cx + w / 2);
      label(out, r.outL, size, "out", cx + w / 2);
      picks.forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
      svg.setAttribute("aria-label", fig.getAttribute("aria-label") + ": " + picks[i].textContent + ", " + r.coreL + " → " + r.outL);
    }
    picks.forEach((b) => b.addEventListener("click", () => {
      show(Number(b.dataset.i));
      const box = fig.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) fig.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }));
    show(0);
    if (window.ResizeObserver) new ResizeObserver(() => show(cur)).observe(frame);
  }).catch((e) => { fig.hidden = true; console.error("split map:", e); });
})();
