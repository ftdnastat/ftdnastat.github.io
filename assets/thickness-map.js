// The thickness scatter: modern carriers per subbranch across, ancient samples per subbranch up, both against the parent, log2.
(function () {
  "use strict";
  const fig = document.getElementById("thmap"), blobEl = document.getElementById("thmap-data");
  if (!fig || !blobEl) return;
  const S = JSON.parse(blobEl.textContent);
  const frame = fig.querySelector(".thmap-frame"), cap = fig.querySelector(".thmap-cap"), pick = fig.querySelector(".thmap-letter"), treePick = fig.querySelector(".thmap-tree");
  const NS = "http://www.w3.org/2000/svg", LIM = 4;
  // the modern axis spreads about half as wide as the ancient one: its log2 is stretched to the same square
  const LIMX = 2, SX = LIM / LIMX;
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));
  const fmt = (v) => { const x = Math.pow(2, v); const s = x < 1 ? x.toFixed(2) : x.toFixed(1); return "×" + (S.lang === "ru" ? s.replace(".", ",") : s); };

  fetch("/data/thickness.json").then((r) => r.json()).then((ALL) => {
    const svg = el("svg", { viewBox: [-LIM, -LIM, 2 * LIM, 2 * LIM].join(" "), role: "img", "aria-label": fig.getAttribute("aria-label") });
    for (let v = -LIM; v <= LIM; v++) svg.appendChild(el("line", { x1: -LIM, y1: v, x2: LIM, y2: v, class: v ? "grid" : "axis" }));
    for (let v = -LIMX; v <= LIMX; v++) svg.appendChild(el("line", { x1: v * SX, y1: -LIM, x2: v * SX, y2: LIM, class: v ? "grid" : "axis" }));
    const corner = (x, y, anchor, text) => { const tx = el("text", { x, y, "text-anchor": anchor, class: "quad" }); tx.textContent = text; svg.appendChild(tx); };
    corner(-LIM + 0.15, -LIM + 0.45, "start", S.quad.past);
    corner(LIM - 0.15, -LIM + 0.45, "end", S.quad.both);
    corner(-LIM + 0.15, LIM - 0.2, "start", S.quad.rare);
    corner(LIM - 0.15, LIM - 0.2, "end", S.quad.later);
    const ax = (x, y, anchor, text, rot) => { const tx = el("text", Object.assign({ x, y, "text-anchor": anchor, class: "ax" }, rot ? { transform: "rotate(-90 " + x + " " + y + ")" } : {})); tx.textContent = text; svg.appendChild(tx); };
    ax(LIM - 0.1, -0.12, "end", S.x);
    ax(0.12, -LIM + 0.75, "start", S.y);
    const dots = el("g", {}), labels = el("g", {});
    svg.appendChild(dots);
    svg.appendChild(labels);
    frame.appendChild(svg);

    const ptsOf = (D) => D.rows.map(([name, li, m, a, kits, slug]) => ({ name, letter: D.letters[li] || "", cls: "c" + (li >= 0 && li < 20 ? li + 1 : 0), x: clamp(m, LIMX) * SX, y: clamp(-a, LIM), edge: Math.abs(m) >= LIMX || Math.abs(a) >= LIM, m, a, kits, slug }));
    let tree = "y", pts = [];
    function load() {
      tree = treePick && ALL[treePick.value] ? treePick.value : "y";
      pts = ptsOf(ALL[tree]);
      pick.replaceChildren(new Option(S.all, ""));
      for (const l of [...new Set(pts.map((p) => p.letter).filter(Boolean))].sort()) pick.appendChild(new Option(l, l));
    }
    const pageOf = (p) => "/" + S.lang + (tree === "mt" ? "/mt-clade/" : "/clade/") + p.slug + "/";

    let shown = [];
    function draw() {
      const want = pick.value;
      shown = pts.filter((p) => !want || p.letter === want);
      dots.replaceChildren();
      labels.replaceChildren();
      for (const p of shown) dots.appendChild(el("circle", { cx: p.x.toFixed(3), cy: p.y.toFixed(3), r: (0.02 + 0.014 * Math.log10(p.kits + 1)).toFixed(3), class: "pt " + p.cls }));
      // the farthest from the centre get their names, kept apart; a point pinned to the edge has no true place to label
      const named = [];
      for (const p of [...shown].filter((q) => !q.edge).sort((a, b) => b.x * b.x + b.y * b.y - (a.x * a.x + a.y * a.y))) {
        if (named.length >= 8) break;
        if (named.some((q) => Math.abs(q.x - p.x) < 1.2 && Math.abs(q.y - p.y) < 0.35)) continue;
        named.push(p);
      }
      for (const p of named) {
        const tx = el("text", { x: (p.x + (p.x > 0 ? -0.1 : 0.1)).toFixed(2), y: (p.y - 0.1).toFixed(2), "text-anchor": p.x > 0 ? "end" : "start", class: "lab" });
        tx.textContent = p.name;
        labels.appendChild(tx);
      }
    }
    const nearest = (ev) => {
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX; pt.y = ev.clientY;
      const at = pt.matrixTransform(svg.getScreenCTM().inverse());
      let best = null, bd = 0.09;
      for (const p of shown) { const dd = (p.x - at.x) ** 2 + (p.y - at.y) ** 2; if (dd < bd) { bd = dd; best = p; } }
      return best;
    };
    function say(p) {
      cap.replaceChildren();
      if (!p) return;
      const text = p.name + ": " + S.cap.replace("{a}", fmt(p.a)).replace("{m}", fmt(p.m));
      if (p.slug) { const a = document.createElement("a"); a.href = pageOf(p); a.textContent = text; cap.append(a); } else cap.textContent = text;
    }
    // the caption keeps the last point: clearing it on the way to its link would make the link unreachable
    svg.addEventListener("mousemove", (ev) => { const p = nearest(ev); if (p) say(p); });
    svg.addEventListener("click", (ev) => { const p = nearest(ev); if (p && p.slug && ev.detail > 1) location.href = pageOf(p); else say(p); });
    pick.addEventListener("change", () => { draw(); say(null); });
    if (treePick) treePick.addEventListener("change", () => { load(); draw(); say(null); });
    load();
    draw();
  }).catch((e) => { fig.hidden = true; console.error("thickness map:", e); });
})();
