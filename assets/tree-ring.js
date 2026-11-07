// Circle view of the bar trees: rings of branches around a radial dendrogram, with PNG/SVG export.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TreeRing = factory();
})(this, function () {
  "use strict";

  const SIZE = 1000, C = SIZE / 2;
  const R_OUT = 470, R_LETTER = 400, R_HOLE = 200;
  const FS = 26;
  const NS = "http://www.w3.org/2000/svg";
  // sibling shades: mixed towards black (<0) or white (>0), so neighbours of one letter stay apart
  const SHADES = [0, -22, 14, -36, 6, -12, 24];

  function layout(rows, levels, otherLabel) {
    const top = { depth: -1, kids: [], v: 1 };
    const stack = [top];
    for (const r of rows) {
      if (r.depth >= levels || r.v <= 0) continue;
      while (stack.length > 1 && stack[stack.length - 1].depth >= r.depth) stack.pop();
      const parent = stack[stack.length - 1];
      if (r.depth !== parent.depth + 1) continue;
      const node = Object.assign({}, r, { kids: [] });
      parent.kids.push(node);
      stack.push(node);
    }
    const covered = top.kids.reduce((s, n) => s + n.v, 0);
    if (1 - covered > 1e-6) top.kids.push({ depth: 0, k: "", label: otherLabel, cls: "c0", v: 1 - covered, kids: [], other: true });
    const segs = [], leaves = [];
    const place = (node, a0, shade) => {
      node.a0 = a0;
      node.a1 = a0 + node.v * 2 * Math.PI;
      node.shade = shade;
      let a = a0, sum = 0;
      node.kids.forEach((kid, i) => {
        // a compare tree's other series can give a child more than its parent: it must not spill into the neighbour
        kid.v = Math.min(kid.v, Math.max(0, node.v - sum));
        kid.parentCommon = commonOf(node.label) || node.parentCommon; place(kid, a, node.depth < 0 ? 0 : SHADES[i % SHADES.length]); a = kid.a1; sum += kid.v; });
      const rest = node.v - sum;
      if (node.kids.length && node.depth + 1 < levels && rest > 1e-6 && !node.other) {
        const star = { depth: node.depth + 1, k: node.k, label: node.label + "*", parentCommon: node.parentCommon, href: node.href, cls: node.cls, v: rest, kids: [], star: true, a0: a, a1: node.a1, shade: 30 };
        node.kids.push(star);
      }
      if (node.depth >= 0) segs.push(node);
      if (node.depth >= 0 && !node.kids.length) leaves.push(node);
    };
    place(top, -Math.PI / 2, 0);
    for (const s of top.kids) for (const x of walk(s)) if (x.star) segs.push(x), leaves.push(x);
    for (const s of segs) {
      s.r1 = s.depth === 0 ? R_OUT : ringOuter(s.depth, levels);
      s.r0 = s.kids.length ? (s.depth === 0 ? R_LETTER : ringOuter(s.depth + 1, levels)) : R_HOLE;
      if (s.depth === 0 && !s.kids.length) s.r1 = R_OUT;
    }
    return { top, segs, leaves };
  }

  function* walk(n) { yield n; for (const k of n.kids) yield* walk(k); }

  function ringOuter(depth, levels) {
    if (depth === 0) return R_OUT;
    const step = (R_LETTER - R_HOLE) / Math.max(1, levels - 1);
    return R_LETTER - (depth - 1) * step;
  }

  const rho = (depth, levels) => (depth < 0 ? 14 : 14 + ((R_HOLE - 30) * (depth + 1)) / (levels + 0.5));

  const pt = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)];
  const f1 = (v) => Math.round(v * 10) / 10;

  function arcPath(r0, r1, a0, a1) {
    if (a1 - a0 >= 2 * Math.PI - 1e-6) a1 = a0 + 2 * Math.PI - 1e-4;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
    return "M" + f1(x0) + " " + f1(y0) + "A" + r1 + " " + r1 + " 0 " + big + " 1 " + f1(x1) + " " + f1(y1) + "L" + f1(x2) + " " + f1(y2) + (r0 > 0 ? "A" + r0 + " " + r0 + " 0 " + big + " 0 " + f1(x3) + " " + f1(y3) : "") + "Z";
  }

  function dendrogram(top, levels) {
    const lines = [], dots = [];
    const real = (n) => n.kids.filter((k) => !k.other);
    const mid = (n) => { const ks = real(n); return ks.length ? (angleOf(ks[0]) + angleOf(ks[ks.length - 1])) / 2 : (n.a0 + n.a1) / 2; };
    const angleOf = (n) => (n.am != null ? n.am : (n.am = mid(n)));
    const radius = (n) => (n.kids.length ? rho(n.depth, levels) : R_HOLE - 6);
    const go = (n) => {
      const ks = real(n);
      if (!ks.length) return;
      const r = rho(n.depth, levels), a0 = angleOf(ks[0]), a1 = angleOf(ks[ks.length - 1]);
      if (a1 - a0 > 1e-4) {
        const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1);
        lines.push({ cls: n.cls || ks[0].cls, d: "M" + f1(x0) + " " + f1(y0) + "A" + r + " " + r + " 0 " + (a1 - a0 > Math.PI ? 1 : 0) + " 1 " + f1(x1) + " " + f1(y1) });
      }
      for (const k of ks) {
        const a = angleOf(k), [x0, y0] = pt(r, a), [x1, y1] = pt(radius(k), a);
        lines.push({ cls: k.cls, d: "M" + f1(x0) + " " + f1(y0) + "L" + f1(x1) + " " + f1(y1) });
        if (k.kids.length) dots.push({ cls: k.cls, x: f1(x1), y: f1(y1) });
        go(k);
      }
    };
    go(top);
    return { lines, dots };
  }

  const commonOf = (label) => { const m = /^[A-Z]+\d[\w']*(?=-)/.exec(label || ""); return m ? m[0] : null; };

  // a margin over the average glyph: the exported file falls back to a system font
  const textW = (s) => s.length * FS * 0.68;
  function labelFor(seg) {
    const span = seg.a1 - seg.a0, rm = (seg.r0 + seg.r1) / 2, thick = seg.r1 - seg.r0;
    const star = seg.star ? "*" : "";
    // the common name first (R1b of R1b-L51), as people know it; a bare letter prefix (N-CTS2929) says too little
    const common = commonOf(seg.label);
    const label = seg.label || "";
    // mt names merge sister branches (U2'3'4'7'8'9): the first one stands for the group; the letters' ring can fall back to the letter
    const merged = label.includes("'") ? label.slice(0, label.indexOf("'")) + "'…" + star : null;
    const letter = seg.depth === 0 ? (/^[A-Z]+/.exec(label) || [null])[0] : null;
    const forms = [common && common !== seg.parentCommon ? common + star : null, seg.label, seg.k && seg.k.includes("-") ? seg.k.slice(seg.k.indexOf("-") + 1) + star : null, merged, letter].filter(Boolean);
    const along = (s) => span * rm >= textW(s) + 12 && thick >= FS + 6;
    const across = (s) => thick >= textW(s) + 14 && span * rm >= FS + 4;
    // the letters' ring reads along the arc, inner rings across it; each takes the other way when its own does not fit
    for (const s of forms) {
      if (seg.depth === 0 ? along(s) : across(s)) return { text: s, tangential: seg.depth === 0 };
      if (seg.depth === 0 ? across(s) : along(s)) return { text: s, tangential: seg.depth !== 0 };
    }
    return null;
  }

  function labelTransform(seg, tangential) {
    const a = (seg.a0 + seg.a1) / 2, rm = (seg.r0 + seg.r1) / 2;
    const [x, y] = pt(rm, a);
    let deg = (a * 180) / Math.PI;
    if (tangential) { deg += 90; if (Math.sin(a) > 0) deg += 180; } else if (Math.cos(a) < 0) deg += 180;
    return "translate(" + f1(x) + " " + f1(y) + ") rotate(" + f1(deg) + ")";
  }

  const shadeFill = (s) => (s ? "color-mix(in oklab, var(--c) " + (100 - Math.abs(s)) + "%, " + (s < 0 ? "#000" : "#fff") + ")" : "var(--c)");
  const escXml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function svgOf(rows, levels, opts) {
    const { segs, top } = layout(rows, levels, opts.other);
    const pct = opts.pct || ((v) => (v * 100).toFixed(1) + "%");
    let out = "";
    for (const s of segs) {
      const fill = s.depth === 0 ? "var(--c)" : shadeFill(s.shade);
      const shape = '<path d="' + arcPath(s.r0, s.r1, s.a0, s.a1) + '" style="fill:' + fill + '"><title>' + escXml((s.star ? s.label : s.label || s.k) + " · " + pct(s.v)) + "</title></path>";
      const lab = labelFor(s);
      const text = lab ? '<text transform="' + labelTransform(s, lab.tangential) + '" class="tr-t">' + escXml(lab.text) + "</text>" : "";
      const inner = '<g class="tr-seg ' + (s.cls || "c0") + '">' + shape + text + "</g>";
      out += s.href ? '<a href="' + escXml(s.href) + '">' + inner + "</a>" : inner;
    }
    const den = dendrogram(top, levels);
    out += '<g class="tr-den">' + den.lines.map((l) => '<path class="' + (l.cls || "c0") + '" d="' + l.d + '"/>').join("") + den.dots.map((d) => '<circle class="' + (d.cls || "c0") + '" cx="' + d.x + '" cy="' + d.y + '" r="5"/>').join("") + "</g>";
    return '<svg class="tr-svg" viewBox="0 0 ' + SIZE + " " + SIZE + '" role="group" aria-label="' + escXml(opts.title || "") + '">' + out + "</svg>";
  }

  function rowsOf(box, series) {
    const total = Number(box.previousElementSibling.getAttribute("data-total")) || 1;
    return [...box.querySelectorAll(series ? ".cmp-row[data-k]" : "[data-k][data-n]")].map((el) => {
      const a = el.querySelector(".tl a"), b = el.querySelector(".tl b"), i = el.querySelector(".bar-track i");
      const v = series ? Number(el.getAttribute("data-" + series)) : Number(el.getAttribute("data-n")) / total;
      const level = el.classList.contains("cmp-row") ? Number((el.className.match(/\bd(\d+)/) || [0, 0])[1]) : Number(el.getAttribute("aria-level")) - 1;
      return { depth: level, k: el.getAttribute("data-k"), label: b ? b.textContent : el.getAttribute("data-k"), href: a ? a.getAttribute("href") : null, cls: i ? (i.className.match(/\bc\d+\b/) || ["c0"])[0] : "c0", v };
    });
  }

  function discs(box, levels) {
    const bar = box.previousElementSibling;
    const other = bar.getAttribute("data-other");
    const series = box.classList.contains("cmp") ? ["f", "y"] : [null];
    const fmt = new Intl.NumberFormat(document.documentElement.lang || undefined, { style: "percent", maximumFractionDigits: 1 });
    return series.map((s) => { const cap = bar.getAttribute("data-cap" + (s ? "-" + s : "")); return { cap, svg: svgOf(rowsOf(box, s), levels, { other, title: cap, pct: fmt.format }) }; });
  }

  function draw(box, levels) {
    let view = box.nextElementSibling;
    if (!view || !view.classList.contains("tr-view")) {
      view = document.createElement("div");
      view.className = "tr-view";
      box.after(view);
    }
    view.innerHTML = discs(box, levels).map((d) => '<figure class="tr-fig">' + d.svg + (d.cap ? "<figcaption>" + escXml(d.cap) + "</figcaption>" : "") + "</figure>").join("");
    return view;
  }

  // computed colours go inline: the file is read without the site's stylesheet
  function inlineStyles(src, dst) {
    const a = src.querySelectorAll("*"), b = dst.querySelectorAll("*");
    for (let i = 0; i < a.length; i++) {
      const cs = getComputedStyle(a[i]);
      const st = [];
      for (const p of ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "font-family", "font-size", "font-weight", "paint-order", "text-anchor", "dominant-baseline"]) st.push(p + ":" + cs.getPropertyValue(p));
      b[i].setAttribute("style", st.join(";"));
      b[i].removeAttribute("class");
    }
  }

  // every tree of the group is drawn off screen, so the file holds Y and mt even when one of them shows bars
  function exportSvg(bars, levels, title, site) {
    const tmp = document.createElement("div");
    tmp.style.cssText = "position:absolute;left:-99999px;top:0;width:1000px";
    document.body.appendChild(tmp);
    const rows = bars.map((bar) => {
      const figs = discs(bar.nextElementSibling, levels).map((d) => {
        const holder = document.createElement("div");
        holder.innerHTML = d.svg;
        tmp.appendChild(holder);
        const src = holder.firstChild, copy = src.cloneNode(true);
        inlineStyles(src, copy);
        copy.querySelectorAll("a").forEach((a) => a.replaceWith(...a.childNodes));
        return { body: copy.innerHTML, cap: d.cap };
      });
      return { label: bar.getAttribute("data-label"), figs };
    });
    tmp.remove();
    const cols = Math.max(...rows.map((r) => r.figs.length));
    const pad = 60, capH = 70, headH = cols > 1 ? 60 : 0, foot = 130;
    const rowH = headH + SIZE + capH;
    const w = SIZE * cols + pad * (cols + 1), h = pad / 2 + rows.length * rowH + foot;
    const cs = getComputedStyle(document.body);
    // --ink-3 holds light-dark(): only an element resolves it; without the variable the probe inherits the ink
    const probe = document.body.appendChild(document.createElement("i"));
    probe.style.color = "var(--ink-3)";
    const bg = cs.backgroundColor, ink = cs.color, dim = getComputedStyle(probe).color;
    probe.remove();
    const font = "system-ui, sans-serif";
    const text = (x, y, size, weight, fill, s, anchor) => '<text x="' + x + '" y="' + y + '"' + (anchor ? ' text-anchor="' + anchor + '"' : "") + ' style="font:' + weight + " " + size + "px " + font + ";fill:" + fill + '">' + escXml(s) + "</text>";
    let inner = '<rect width="100%" height="100%" fill="' + bg + '"/>';
    rows.forEach((r, ri) => {
      const y0 = pad / 2 + ri * rowH;
      if (headH) inner += text(pad, y0 + 42, 36, 700, ink, r.label);
      r.figs.forEach((f, i) => {
        const x = pad + i * (SIZE + pad);
        inner += '<g transform="translate(' + x + " " + (y0 + headH) + ')">' + f.body + "</g>";
        if (f.cap) inner += text(x + C, y0 + headH + SIZE + 44, 30, 600, ink, f.cap, "middle");
      });
    });
    inner += text(pad, h - 50, 40, 700, ink, title);
    inner += text(w - pad, h - 50, 28, 600, dim, site, "end");
    const doc = document.createElementNS(NS, "svg");
    doc.setAttribute("xmlns", NS);
    doc.setAttribute("viewBox", "0 0 " + w + " " + h);
    doc.setAttribute("width", w);
    doc.setAttribute("height", h);
    doc.innerHTML = inner;
    return { text: new XMLSerializer().serializeToString(doc), w, h };
  }

  function save(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function download(bar, levels, title, format) {
    const bars = [...document.querySelectorAll('.ring-bar[data-group="' + bar.getAttribute("data-group") + '"]')];
    const { text, w, h } = exportSvg(bars, levels, title, bar.getAttribute("data-site"));
    const name = (location.pathname.split("/").filter(Boolean).join("-") || "tree") + "-" + bar.getAttribute("data-group").replace("Short", "").toLowerCase() + "." + format;
    const svgBlob = new Blob([text], { type: "image/svg+xml" });
    if (format === "svg") return Promise.resolve(save(svgBlob, name));
    return new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = w * 2;
        cv.height = h * 2;
        const g = cv.getContext("2d");
        g.scale(2, 2);
        g.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(img.src);
        cv.toBlob((b) => (b ? ok(save(b, name)) : fail(new Error("png"))), "image/png");
      };
      img.onerror = () => fail(new Error("svg image"));
      img.src = URL.createObjectURL(svgBlob);
    });
  }

  return { layout, svgOf, arcPath, labelFor, ringOuter, draw, download };
});
