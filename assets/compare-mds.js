// Label positions can move to avoid collisions. Point positions always use the same scale on both axes.
const NS = "http://www.w3.org/2000/svg";
function svgNode(tag, attrs, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  return node;
}

function wrapped(text, maxWidth, measure) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? line + " " + word : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function overlap(a, b) {
  return (
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  );
}

function placeLabels(points, names, width, height, measure, boxes) {
  return points.map(([px, py], i) => {
    const lines = wrapped(names[i], Math.max(90, Math.min(width * 0.42, 210)), measure);
    const w = Math.max(...lines.map(measure)) + 8,
      h = lines.length * 17 + 4;
    let best,
      min = Infinity;
    // The nearest clear rectangle wins; grid candidates cover dense clusters and coincident points.
    const consider = (x, y) => {
      x = Math.max(2, Math.min(width - w - 2, x));
      y = Math.max(2, Math.min(height - h - 2, y));
      const rect = { x, y, w, h };
      const penalty = boxes.reduce((sum, box) => sum + overlap(rect, box), 0);
      const dist = Math.hypot(px - Math.max(x, Math.min(px, x + w)), py - Math.max(y, Math.min(py, y + h)));
      const score = penalty * 1000 + dist;
      if (score < min) {
        min = score;
        best = rect;
      }
    };
    consider(px + 8, py - h / 2);
    consider(px - w - 8, py - h / 2);
    consider(px - w / 2, py - h - 8);
    consider(px - w / 2, py + 8);
    if (min >= 1000 && points.length <= 32) {
      for (let y = 2; y < height; y += 12) for (let x = 2; x < width; x += 18) consider(x, y);
    } else if (points.length > 32) {
      for (const dx of [-w - 8, 8]) for (const dy of [-h - 8, 8]) consider(px + dx, py + dy);
    }
    boxes.push(best);
    return { ...best, lines };
  });
}

// Shared by the on-screen diagram and the standalone PNG.
const palette = ["#176d99", "#b94e33", "#367844", "#7556a7", "#ae650b", "#177b79", "#ab4779", "#525e82"];
let geometryPromise;
function geography() {
  if (!geometryPromise)
    geometryPromise = window
      .ftdJson("/assets/map-world.json")
      .then((world) => {
        const probe = svgNode("svg", { width: 0, height: 0, "aria-hidden": "true" });
        probe.style.position = "absolute";
        document.body.appendChild(probe);
        try {
          const shape = probe.appendChild(svgNode("path", {}));
          return world.units.map(({ id, d }) => {
            shape.setAttribute("d", d);
            const { x, y, width: w, height: h } = shape.getBBox();
            return { key: "c:" + id, d, x, y, w, h };
          });
        } finally {
          probe.remove();
        }
      })
      .catch((error) => {
        geometryPromise = null;
        throw error;
      });
  return geometryPromise;
}

function locator(shapes, selected, x, y, width, height, label) {
  const items = new Map(selected.map((p) => [p.key, p]));
  const regions = shapes.filter((s) => items.has(s.key));
  if (!regions.length) return null;
  const left = Math.min(...regions.map((s) => s.x)),
    right = Math.max(...regions.map((s) => s.x + s.w));
  const top = Math.min(...regions.map((s) => s.y)),
    bottom = Math.max(...regions.map((s) => s.y + s.h));
  const scale = Math.max((right - left) / width, (bottom - top) / height, 0.025) * 1.35;
  const w = scale * width,
    h = scale * height,
    vx = (left + right - w) / 2,
    vy = (top + bottom - h) / 2;
  const inset = svgNode("svg", {
    class: "mds-locator",
    x,
    y,
    width,
    height,
    viewBox: [vx, vy, w, h].join(" "),
    overflow: "hidden",
    role: "img",
    "aria-label": label,
  });
  inset.appendChild(svgNode("title", {}, label));
  inset.appendChild(svgNode("rect", { x: vx, y: vy, width: w, height: h, fill: "#e5f0f3" }));
  for (const shape of shapes) {
    if (shape.x + shape.w < vx || shape.x > vx + w || shape.y + shape.h < vy || shape.y > vy + h) continue;
    const point = items.get(shape.key);
    const unit = svgNode("path", {
      d: shape.d,
      fill: point ? point.color : "#d1dbd4",
      stroke: "#fff",
      "stroke-width": point ? 0.9 : 0.5,
      "vector-effect": "non-scaling-stroke",
      "fill-rule": "evenodd",
    });
    if (point) {
      unit.dataset.key = point.key;
      unit.appendChild(svgNode("title", {}, point.name));
    }
    inset.appendChild(unit);
  }
  return inset;
}

function draw(data, totalWidth, brand = null) {
  const exporting = Boolean(brand);
  const { points: labelled, S, title, caption, source, missing } = data;
  const mapWidth = Math.min(226, Math.round(totalWidth * 0.44));
  const side = totalWidth >= 640;
  const mapHeight = Math.round(mapWidth * 0.69);
  const head = exporting ? 118 : 0;
  const inset =
    data.shapes &&
    locator(data.shapes, labelled, side ? totalWidth - mapWidth - 12 : 12, 0, mapWidth, mapHeight, data.locatorTitle);
  const width = inset && side ? totalWidth - mapWidth - 28 : totalWidth;
  const names = labelled.map((p) => p.name);
  const height = Math.max(245, Math.min(width * 0.57, 410), Math.min(labelled.length * 18, 1000));
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = "14px system-ui";
  const measure = (s) => ctx.measureText(s).width;
  const notes = exporting
    ? [S.cmpMdsLead, caption, missing, source].filter(Boolean).flatMap((s) => wrapped(s, totalWidth - 36, measure))
    : [];
  const legendX = side ? totalWidth - mapWidth - 12 : 24 + mapWidth;
  const geoLegend = inset
    ? labelled
        .filter((p) => data.shapes.some((s) => s.key === p.key))
        .sort((a, b) => a.number - b.number)
        .map((p) => ({
          point: p,
          lines: wrapped(p.name, (side ? mapWidth : totalWidth - legendX - 6) - 18, measure),
        }))
    : [];
  const legendHeight = geoLegend.reduce((n, item) => n + item.lines.length * 15 + 2, 0);
  const bodyHeight = !inset
    ? height
    : side
      ? Math.max(height, mapHeight + legendHeight + 52)
      : height + 34 + Math.max(mapHeight, legendHeight);
  const figureHeight = bodyHeight + head + (exporting ? 60 + notes.length * 19 : 0);
  const svg = svgNode("svg", {
    viewBox: "0 0 " + totalWidth + " " + figureHeight,
    width: totalWidth,
    height: figureHeight,
    role: "img",
    "aria-label": title,
    "font-family": "system-ui, sans-serif",
  });
  svg.append(
    svgNode("title", {}, title),
    svgNode("desc", {}, data.links.map((e) => names[e.a] + " — " + names[e.b] + ": " + e.percent).join("; ") + ". " + caption),
  );
  const ink = exporting ? "#14202b" : "var(--ink)",
    line = exporting ? "#d9dee4" : "var(--line)",
    bg = exporting ? "#ffffff" : "var(--surface)";
  if (exporting) {
    svg.append(
      svgNode("rect", { width: totalWidth, height: figureHeight, fill: "#f2f4f6" }),
      brand,
      svgNode(
        "text",
        { x: totalWidth - 18, y: 32, fill: "#4f5b67", "text-anchor": "end", "font-size": 11, "font-family": "monospace" },
        "MDS",
      ),
      svgNode("text", { x: 18, y: 77, fill: ink, "font-size": 24, "font-weight": 650 }, title),
      svgNode("text", { x: 18, y: 103, fill: ink, "font-size": 15 }, data.modeLabel),
    );
  }
  const plot = svgNode("svg", { x: 0, y: head, width, height, viewBox: "0 0 " + width + " " + height, overflow: "hidden" });
  svg.appendChild(plot);
  const domain = labelled;
  const extent = (points, k) => [Math.min(...points.map((p) => p[k])), Math.max(...points.map((p) => p[k]))];
  const x = extent(domain, "x"),
    y = extent(domain, "y");
  const scale = Math.min((width - 48) / (x[1] - x[0]), (height - 50) / (y[1] - y[0]));
  const ratio = Number.isFinite(scale) ? scale : 1;
  const project = (p) => [width / 2 + (p.x - (x[0] + x[1]) / 2) * ratio, height / 2 - (p.y - (y[0] + y[1]) / 2) * ratio];
  const pts = labelled.map(project);
  const boxes = pts.map(([x, y]) => ({ x: x - 9, y: y - 9, w: 18, h: 18 }));
  const edgeLabels = [];
  for (const { a, b, percent } of data.links) {
    const [x1, y1] = pts[a],
      [x2, y2] = pts[b];
    const cx = (x1 + x2) / 2,
      cy = (y1 + y2) / 2;
    const color = exporting ? "#596979" : "var(--ink-3)";
    plot.appendChild(svgNode("line", { class: "mds-neighbor", x1, y1, x2, y2, stroke: color, "stroke-width": 1.4 }));
    const w = measure(percent) + 8,
      h = 18;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const nx = length ? (y1 - y2) / length : 0,
      ny = length ? (x2 - x1) / length : 1;
    // Keep labels at the midpoint unless another label or a coincident point occupies it.
    let best,
      least = Infinity;
    for (const offset of [0, 12, -12, 22, -22, 34, -34, 48, -48]) {
      const x = Math.max(1, Math.min(width - w - 1, cx + offset * nx - w / 2));
      const y = Math.max(1, Math.min(height - h - 1, cy + offset * ny - h / 2));
      const box = { x, y, w, h };
      const cost = boxes.reduce((sum, occupied) => sum + overlap(box, occupied), 0) * 1000 + Math.abs(offset);
      if (cost < least) {
        best = box;
        least = cost;
      }
      if (!cost) break;
    }
    boxes.push(best);
    edgeLabels.push({ percent, box: best, cx, cy });
  }
  const labels = placeLabels(pts, names, width, height, measure, boxes);
  for (let i = 0; i < pts.length; i++) {
    const [cx, cy] = pts[i],
      box = labels[i];
    plot.appendChild(
      svgNode("line", {
        x1: cx,
        y1: cy,
        x2: Math.max(box.x, Math.min(cx, box.x + box.w)),
        y2: Math.max(box.y, Math.min(cy, box.y + box.h)),
        stroke: line,
        "stroke-width": 1.5,
      }),
    );
  }
  for (const { percent, box, cx, cy } of edgeLabels) {
    const x = box.x + box.w / 2,
      y = box.y + box.h / 2;
    if (Math.hypot(x - cx, y - cy) > 9) plot.appendChild(svgNode("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: line }));
    plot.appendChild(
      svgNode(
        "text",
        {
          class: "mds-percent",
          x,
          y,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "font-size": 12,
          "font-weight": 600,
          fill: ink,
          stroke: bg,
          "stroke-width": 5,
          "stroke-linejoin": "round",
          "paint-order": "stroke",
        },
        percent,
      ),
    );
  }
  pts.forEach(([cx, cy], i) => {
    const dot = svgNode("circle", { cx, cy, r: 8, fill: labelled[i].color, stroke: bg, "stroke-width": 1.8 });
    dot.dataset.key = labelled[i].key;
    dot.appendChild(svgNode("title", {}, names[i]));
    plot.appendChild(dot);
    plot.appendChild(
      svgNode(
        "text",
        {
          x: cx,
          y: cy,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          fill: "#fff",
          "font-size": 10,
          "font-weight": 700,
          "pointer-events": "none",
        },
        String(labelled[i].number),
      ),
    );
  });
  labels.forEach((box, i) =>
    box.lines.forEach((s, j) =>
      plot.appendChild(
        svgNode(
          "text",
          {
            "data-key": labelled[i].key,
            x: box.x + 4,
            y: box.y + 15 + j * 17,
            fill: ink,
            stroke: bg,
            "stroke-width": 3,
            "paint-order": "stroke",
            "font-size": 14,
          },
          s,
        ),
      ),
    ),
  );
  if (inset) {
    const ix = side ? totalWidth - mapWidth - 12 : 12,
      iy = side ? head + 24 : head + height + 22;
    inset.setAttribute("y", iy);
    svg.append(svgNode("text", { x: ix, y: iy - 7, fill: ink, "font-size": 12, "font-weight": 600 }, data.locatorTitle), inset);
    const lx = legendX;
    let ly = side ? iy + mapHeight + 19 : iy + 10;
    for (const { point: p, lines } of geoLegend) {
      svg.appendChild(svgNode("circle", { cx: lx + 5, cy: ly - 4, r: 7, fill: p.color }));
      svg.appendChild(
        svgNode(
          "text",
          {
            x: lx + 5,
            y: ly - 4,
            "text-anchor": "middle",
            "dominant-baseline": "central",
            fill: "#fff",
            "font-size": 9,
            "font-weight": 700,
          },
          String(p.number),
        ),
      );
      for (const str of lines) {
        svg.appendChild(svgNode("text", { x: lx + 16, y: ly, fill: ink, "font-size": 12 }, str));
        ly += 15;
      }
      ly += 2;
    }
  }
  notes.forEach((s, i) =>
    svg.appendChild(svgNode("text", { x: 18, y: head + bodyHeight + 23 + i * 19, fill: ink, "font-size": 14 }, s)),
  );
  if (exporting) {
    const url = new URL(
      document.querySelector('link[rel="canonical"]')?.href || location.pathname,
      "https://ftdnastat.github.io",
    );
    svg.append(
      svgNode("line", { x1: 18, x2: totalWidth - 18, y1: figureHeight - 39, y2: figureHeight - 39, stroke: "#d9dee4" }),
      svgNode(
        "text",
        {
          x: totalWidth - 18,
          y: figureHeight - 15,
          "text-anchor": "end",
          fill: "#1f66bd",
          "font-size": 14,
          "font-family": "monospace",
        },
        url.host + url.pathname,
      ),
    );
  }
  return svg;
}

export function mount(host, { S, lang, dates, changed }) {
  const html = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  const title = html("h2", null, S.cmpMdsTitle),
    lead = html("p", null, S.cmpMdsLead);
  title.id = "mds";
  const toolbar = html("div", "mds-toolbar");
  function controls(label, choices, choose, showLabel = false) {
    const tabs = html("div", "tabs");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", label);
    if (showLabel) tabs.appendChild(html("span", "mds-control-label", label));
    const btns = {};
    for (const [key, text] of choices) {
      const b = html("button", "tab", text);
      b.type = "button";
      b.onclick = () => choose(key);
      btns[key] = b;
      tabs.appendChild(b);
    }
    toolbar.appendChild(tabs);
    return btns;
  }
  let mode, selection;
  const modeLabels = { all: S.cmpSimAll, y: S.cmpSimY, mt: S.cmpSimMt };
  const modes = controls(S.cmpMdsTitle, Object.entries(modeLabels), changed);
  let preferredCount = 2;
  const neighborLabels = [S.cmpMdsOne, S.cmpMdsTwo, S.cmpMdsThree];
  const neighbors = controls(S.cmpMdsNeighbors, [["1", "1"], ["2", "2"], ["3", "3"]], key => {
    preferredCount = Number(key);
    refreshLinks();
  }, true);
  const plot = html("div", "mds-plot"),
    caption = html("p", "mds-caption"),
    missing = html("p", "dim"),
    actions = html("div", "summary-actions");
  const status = html("p", "dim");
  status.setAttribute("role", "status");
  host.replaceChildren(title, lead, toolbar, plot, caption, missing, actions, status);
  let shapes;
  let model = null,
    generation = 0,
    lastWidth = 0;
  async function file(snapshot) {
    const geometry = snapshot.shapes || (snapshot.points.some(p => p.key.startsWith("c:")) && await geography().catch(() => null));
    const { imageBrand, svgPng } = await import("./image-export.js");
    const svg = draw({ ...snapshot, shapes: geometry }, Math.max(240, plot.clientWidth), imageBrand(18, 16, 24));
    const scale = Math.max(2, 1400 / svg.width.baseVal.value);
    return svgPng(
      new XMLSerializer().serializeToString(svg),
      Math.round(svg.width.baseVal.value * scale),
      Math.round(svg.height.baseVal.value * scale),
    );
  }
  for (const [action, label] of [
    ["share", S.cmpMdsShare],
    ["download", S.cmpMdsDownload],
  ]) {
    const b = html("button", "tab", label);
    b.type = "button";
    actions.appendChild(b);
    b.onclick = async () => {
      const snapshot = model,
        filename = "ftdnastat-mds-" + mode + "-" + selection.ids.map(id => id.slice(2)).join("-").slice(0, 150) + ".png";
      b.disabled = true;
      try {
        const blob = await file(snapshot);
        if (model !== snapshot) return;
        if (action === "share") {
          const { showImageActions } = await import("./image-export.js");
          if (model !== snapshot) return;
          await showImageActions(b, blob, { title: S.cmpMdsTitle, filename, lang, url: new URL(location.href) });
        } else {
          const a = html("a");
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        }
      } catch {
        if (model === snapshot) status.textContent = S.cmpMdsExportError;
      } finally {
        b.disabled = false;
      }
    };
  }
  const redraw = () => {
    if (model) {
      lastWidth = Math.max(240, Math.round(plot.clientWidth));
      plot.replaceChildren(draw(model, lastWidth));
    }
  };
  const percent = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 2 });
  function refreshLinks() {
    const limit = model.points.length - 1;
    const count = Math.min(preferredCount, limit);
    for (const [key, button] of Object.entries(neighbors)) {
      button.disabled = Number(key) > limit;
      button.setAttribute("aria-pressed", String(Number(key) === count));
    }
    const links = window.CompareCore.nearestLinks(model.matrix, count).map(edge => ({
      ...edge, percent: percent.format(edge.similarity),
    }));
    model = { ...model, links, modeLabel: modeLabels[mode] + " · " + neighborLabels[count - 1] };
    redraw();
  }
  function update() {
    generation++;
    model = null;
    status.textContent = "";
    const { ids, names, matrices } = selection;
    const matrix = matrices[mode];
    const available = ids.map((_, i) => i).filter((i) => matrix[i][i] != null);
    available.sort((a, b) => ids[a].localeCompare(ids[b], "en"));
    const absent = names.filter((_, i) => matrix[i][i] == null);
    const plotted = available.map((i) => available.map((j) => matrix[i][j]));
    const fit = window.CompareCore.fitMds(plotted);
    Object.entries(modes).forEach(([k, b]) => b.setAttribute("aria-pressed", String(k === mode)));
    missing.textContent = absent.length ? S.cmpMdsOmitted + " " + absent.join(", ") : "";
    missing.hidden = !absent.length;
    actions.hidden = !fit;
    neighbors[1].parentElement.hidden = !fit;
    if (!fit) {
      plot.replaceChildren();
      caption.textContent = S.cmpMdsInsufficient;
      return;
    }
    const points = available.map((i, k) => ({
      color: palette[i % palette.length],
      number: i + 1,
      key: ids[i],
      name: names[i],
      x: fit.points[k][0],
      y: fit.points[k][1],
    }));
    if (fit.stress === null) {
      caption.textContent = S.cmpMdsCoincident;
    } else {
      const stress = fit.stress.toLocaleString(lang, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
      let note = S.cmpMdsExact;
      if (fit.stress > 1e-10) {
        note = S.cmpMdsStress + " " + S.cmpMdsOrdered;
        if (fit.sampled) {
          note = S.cmpMdsStress + " " + S.cmpMdsSampled.replace("{n}", fit.conflicts.length).replace("{total}", fit.comparisons);
        } else if (fit.conflicts?.length) {
          note = S.cmpMdsStress + " " + S.cmpMdsConflicts.replace("{n}", fit.conflicts.length).replace("{total}", fit.comparisons);
        }
      }
      caption.textContent = "Stress-1 = " + stress + ". " + note;
    }
    const sources = [];
    if (points.some(p => p.key.startsWith("c:"))) {
      sources.push("FTDNA");
      if (mode !== "mt") sources.push(S.kindY + " " + dates.y);
      if (mode !== "y") sources.push(S.kindMt + " " + dates.mt);
    }
    if (points.some((p) => p.key.startsWith("p:"))) sources.push("YFull", dates.yfull);
    model = {
      matrix: plotted,
      points,
      shapes,
      locatorTitle: S.cmpMdsGeo,
      title: S.cmpMdsTitle,
      caption: caption.textContent,
      source: sources.filter(Boolean).join(" · "),
      missing: missing.textContent,
      S,
    };
    refreshLinks();
    if (!shapes && points.some((p) => p.key.startsWith("c:"))) {
      const current = generation;
      geography()
        .then((result) => {
          shapes = result;
          if (model && generation === current) {
            model.shapes = result;
            redraw();
          }
        })
        .catch(() => {
          /* The similarity diagram remains usable without the locator. */
        });
    }
  }
  const onResize = () => {
    if (Math.round(plot.clientWidth) !== lastWidth) redraw();
  };
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(plot);
  else window.addEventListener("resize", onResize);
  return {
    update(data, kind) {
      selection = data;
      mode = kind;
      update();
    },
    clear() {
      generation++;
      model = null;
      plot.replaceChildren();
    },
  };
}
