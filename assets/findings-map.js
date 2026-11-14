// The maps under findings sections: colours and captions come with the page, the shapes from map-world.json.
(function () {
  "use strict";
  const figs = [...document.querySelectorAll(".fmap")];
  if (!figs.length) return;
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  const geoP = (window.ftdMapWorld = window.ftdMapWorld || fetch("/assets/map-world.json").then((r) => r.json()));
  Promise.all([geoP, fetch("/data/map-base.json").then((r) => r.json())])
    .then(([geo, base]) => figs.forEach((fig) => draw(fig, geo, base)))
    .catch((e) => { figs.forEach((f) => { f.hidden = true; }); console.error("findings map:", e); });

  function draw(fig, geo, base) {
    const D = JSON.parse(fig.querySelector('script[type="application/json"]').textContent);
    const frame = fig.querySelector(".cmap-frame"), cap = fig.querySelector(".cmap-cap"), sub = base.sub || {};
    const name = (id) => (base.names[id] ? base.names[id][D.lang === "ru" ? 0 : 1] : id);
    // a region with no value of its own lets its country's colour through
    const cls = (id) => (has(D.v, id) ? D.v[id][0] : has(sub, id) ? "mnone" : "mna");
    const svg = el("svg", { viewBox: "0 0 " + geo.w + " " + geo.h, role: "img", "aria-label": fig.dataset.label });
    const g = el("g", {});
    for (const u of [...geo.units].sort((a, b) => has(sub, a.id) - has(sub, b.id))) g.appendChild(el("path", { d: u.d, class: "u " + cls(u.id), "data-id": u.id }));
    svg.appendChild(g);
    svg.appendChild(el("path", { d: geo.borders, class: "brd" }));
    frame.appendChild(svg);

    function say(id) {
      if (!id) { cap.textContent = ""; return; }
      cap.textContent = name(id) + ": " + (has(D.v, id) ? D.v[id][1] : D.none);
    }
    const unitAt = (ev) => { const t = ev.target.closest && ev.target.closest(".u"); return t && t.dataset.id; };
    svg.addEventListener("mouseover", (ev) => say(unitAt(ev)));
    svg.addEventListener("click", (ev) => say(unitAt(ev)));

    const buttons = [...fig.querySelectorAll(".fmap-views .tab")];
    function view(v) {
      const b = v !== "world" && geo.views[v];
      let box = [0, 0, geo.w, geo.h];
      if (b) { const [x, y, w, h] = b, W = Math.max(w, h * 2) * 1.08; box = [x + w / 2 - W / 2, y + h / 2 - W / 4, W, W / 2]; }
      svg.setAttribute("viewBox", box.map((x) => x.toFixed(1)).join(" "));
      svg.classList.toggle("zoom", Boolean(b));
      buttons.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === v)));
    }
    buttons.forEach((x) => { if (x.dataset.v !== "world" && !geo.views[x.dataset.v]) x.remove(); else x.addEventListener("click", () => view(x.dataset.v)); });
  }
})();
