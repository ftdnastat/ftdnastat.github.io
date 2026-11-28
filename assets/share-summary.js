import { imageBrand, svgPng, showImageActions } from "./image-export.js";

const ink = "#14202b",
  muted = "#4f5b67",
  paper = "#f2f4f6",
  blue = "#2a78d6",
  grey = "#c3c9cf";
const SUMMARY_TREE_LEVELS = 2;
const originColors = [blue, "#eb6834", "#1baf7a", grey];
const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const rect = (x, y, w, h, color) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
const text = (x, y, value, size, color = ink, weight = 400, anchor = "start", family = "system-ui,sans-serif") =>
  `<text x="${x}" y="${y}" fill="${color}" font-family="${family}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(value)}</text>`;
const rule = (y) => rect(64, y, 952, 2, "#d9dee4");
const circle = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const json = url => window.ftdJson(url);

const library = (name, file) => window.ftdScript(name, file);

async function migration(slug, lang, world, countries) {
  const [root, shard, core, projection] = await Promise.all([
    json("/data/ymap-root.json"),
    json("/data/ymap/" + slug + ".json"),
    library("YmapCore", "ymap-core.js"),
    library("EqEarth", "eqearth.js"),
  ]);
  const route = core.assemble(shard.b, (id) => shard.g[id] || root.g[id]);
  const pts = route.path.map(([lat, lon]) => projection.toMap(world.proj, lon, lat));
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const w = Math.max(80, Math.max(...xs) - Math.min(...xs) + 35),
    h = Math.max(70, Math.max(...ys) - Math.min(...ys) + 28);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const xy = (p) => p.map((v) => v.toFixed(2)).join(",");
  const base = world.units
    .map((u) => `<path d="${esc(u.d)}" fill="#cfd7df" stroke="#ffffff" stroke-width=".5" vector-effect="non-scaling-stroke"/>`)
    .join("");
  const stops = [route.start, route.nodes[Math.floor(route.nodes.length / 2)], route.nodes.at(-1)];
  const countryColors = new Map(countries.map((row, i) => [row[2], originColors[i]]));
  const highlights = world.units
    .filter((u) => countryColors.has(u.id))
    .map((u) => {
      const color = countryColors.get(u.id);
      return `<path d="${esc(u.d)}" fill="${color}" fill-opacity=".55" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    })
    .join("");
  const marks = stops.map((s) => circle(...pts[s.i], 1.9, ink)).join("");
  const points = pts.map(xy).join(" ");
  const dates = stops
    .map((s, i) => {
      const absolute = Math.abs(s.tmrca);
      const step = absolute < 100 ? 1 : absolute < 3000 ? 10 : absolute < 10000 ? 50 : 100;
      const year = Math.max(1, Math.round(absolute / step) * step);
      const era = s.tmrca < 0 ? (lang === "ru" ? " до н. э." : " BCE") : (lang === "ru" ? " н. э." : " CE");
      const x = 72 + 318 * i;
      return text(x, 705, s.name + " · " + year.toLocaleString(lang) + era, 20, muted);
    })
    .join("");
  return `<svg x="64" y="278" width="952" height="394" viewBox="${cx - w / 2} ${cy - h / 2} ${w} ${h}" preserveAspectRatio="xMidYMid meet">
    <rect x="-2000" y="-2000" width="5000" height="5000" fill="#e7eef5"/>${base}${highlights}
    <g fill="none" stroke-linejoin="round" stroke-linecap="round">
      <polyline points="${points}" stroke="white" stroke-width="3.1"/>
      <polyline points="${points}" stroke="${ink}" stroke-width="1.4"/>
    </g>
    ${marks}</svg>${dates}`;
}

function viewport(x, y, w, h, box, body) {
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${box}">${body}</svg>`;
}

function atlas(world, fill) {
  return world.units
    .map(
      (u) =>
        `<path d="${esc(u.d)}" fill="${fill(u.id) || "#d5dbe1"}" stroke="${paper}" stroke-width=".5" vector-effect="non-scaling-stroke"/>`,
    )
    .join("");
}

function branchMap(world, rows) {
  const units = world.units.filter((u) => rows.some((row) => row[2] === u.id));
  if (!units.length) return "";
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", units.map((unit) => unit.d).join(" "));
  const svg = document.createElementNS(path.namespaceURI, "svg");
  svg.style.cssText = "position:absolute;left:-10000px";
  svg.append(path);
  document.body.append(svg);
  let box;
  try {
    box = path.getBBox();
  } finally {
    svg.remove();
  }
  const w = Math.max(32, box.width * 1.15, (box.height * 1.15) / 0.44),
    h = w * 0.44;
  const frame = [box.x + box.width / 2 - w / 2, box.y + box.height / 2 - h / 2, w, h].join(" ");
  const colors = new Map(rows.map((row, i) => [row[2], originColors[i]]));
  return viewport(
    64,
    275,
    952,
    416,
    frame,
    atlas(world, (id) => colors.get(id)),
  );
}

async function similarityArt(lang, base) {
  const fig = document.getElementById("sim-y");
  if (!fig) return null;
  await window.ftdSimilarityReady;
  const svg = fig.querySelector("svg");
  if (!svg) return null;
  const data = JSON.parse(fig.querySelector('script[type="application/json"]').textContent);
  const hues = ["#cdddef", "#a5c2e3", "#7da8d8", "#508bc9", "#1f66bd"];
  const fills = { msf: ink, mnone: "none", mna: "#e6eaee", msm: "url(#few)" };
  hues.forEach((color, i) => {
    fills["m" + (i + 1)] = color;
  });
  const hatch =
    '<pattern id="few" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#e6eaee"/><path d="M0 0v4" stroke="#b6c1cd" stroke-width="1"/></pattern>';
  const paths = [...svg.querySelectorAll("path.u")]
    .map((path) => {
      const key = [...path.classList].find((cls) => cls in fills);
      return `<path d="${esc(path.getAttribute("d"))}" fill="${fills[key]}" stroke="#fff" stroke-width=".38" vector-effect="non-scaling-stroke"/>`;
    })
    .join("");
  return {
    map: viewport(510, 99, 515, 226, svg.dataset.summaryView || svg.getAttribute("viewBox"), "<defs>" + hatch + "</defs>" + paths),
    closest: data.top.slice(0, 3).map((id) => [base.names[id]?.[lang === "ru" ? 0 : 1] || id, data.sim[id]]),
  };
}

async function countryArt(d, lang) {
  const [ring, base, ...datasets] = await Promise.all([
    library("TreeRing", "tree-ring.js"),
    json("/data/map-base.json"),
    ...d.groups.map((g) => json("/data/" + d.slug + "." + g.kind + ".json")),
  ]);
  // Older cached map-base files predate the palette.
  const palette = base.letters || (await json("/data/world-map.json")).letters;
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-10000px;color-scheme:light;width:1000px";
  document.body.appendChild(host);
  try {
    const groups = datasets.map((data, i) => {
      const kind = d.groups[i].kind,
        letters = palette[kind];
      const slot = (k) => {
        const n = letters.indexOf(k);
        return n >= 0 && n < 20 ? n + 1 : 0;
      };
      let family = "";
      const tree = data.tree?.length ? data.tree : data.l1.map(({ k, v }) => ({ name: k, n: v, depth: 0 }));
      const rows = tree
        .filter((r) => r.depth < SUMMARY_TREE_LEVELS)
        .map((r) => {
          if (!r.depth) family = (r.name.match(/^[A-Z]+/) || [""])[0];
          return { depth: r.depth, k: r.name, label: r.label || r.shown || r.name, cls: "c" + slot(family), v: r.n / data.n };
        });
      const other = lang === "ru" ? "прочие" : "other";
      const art = ring.svgOf(rows, SUMMARY_TREE_LEVELS, { other, title: d.title, pctRound: (v) => Math.round(100 * v) + "%" });
      return { art: ring.standalone(art, host), leaders: d.groups[i].leaders, n: data.n, kind };
    });
    return { groups, similarity: await similarityArt(lang, base) };
  } finally {
    host.remove();
  }
}

function donut(cx, cy, r, rows, total) {
  let offset = 0;
  return rows
    .map(([, value, color]) => {
      const part = (value / total) * 100,
        start = offset;
      offset += part;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${r * 0.45}" pathLength="100" stroke-dasharray="${part} ${100 - part}" transform="rotate(${-90 + 3.6 * start} ${cx} ${cy})"/>`;
    })
    .join("");
}

function makeCard(d, lang, url, art, limits) {
  const tr = (ru, en) => (lang === "ru" ? ru : en);
  const num = (n) => n.toLocaleString(lang);
  const pct = (k, n) => (k / n).toLocaleString(lang, { style: "percent", maximumFractionDigits: n < limits.SMALL_N ? 0 : 1 });
  const mono = "monospace",
    swatch = (x, y, c) => `<rect x="${x}" y="${y}" width="18" height="18" rx="3" fill="${c}"/>`;
  let body = rect(0, 0, 1080, 1350, paper);
  body +=
    imageBrand(56, 41, 48).outerHTML +
    text(1020, 72, d.groups ? tr("ГЕОГРАФИЯ", "GEOGRAPHY") : d.kind === "mt" ? tr("мтДНК", "mtDNA") : tr("Y-ДНК", "Y-DNA"), 21, muted, 500, "end", mono);
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = "700 86px system-ui,sans-serif";
  const titleSize = Math.min(86, Math.floor((86 * (d.groups ? 435 : 355)) / measure.measureText(d.title).width));
  body += text(54, 193, d.title, titleSize, ink, 700);
  if (d.groups) {
    if (art.similarity) {
      body += text(57, 240, tr("Сходство по Y-гаплогруппам", "Similarity by Y haplogroups"), 26, muted);
      art.similarity.closest.forEach(([name, value], i) => {
        const y = 279 + i * 33;
        body += text(57, y, name, 25, ink, 550) + text(422, y, value + "%", 24, blue, 650, "end");
      });
      body +=
        art.similarity.map +
        text(1020, 346, tr("Темнее синий — ближе состав Y-линий", "Darker blue · more similar Y lineages"), 21, muted, 400, "end");
      body += text(
        1020,
        373,
        tr("Чёрный — выбранное место · штриховка — мало данных", "Black · selected place    Hatched · small sample"),
        17,
        muted,
        400,
        "end",
      );
    }
    art.groups.forEach((g, i) => {
      const x = 54 + i * 496;
      body += rect(x - 12, 393, 479, 730, "#fff");
      body += text(
        x,
        438,
        g.kind === "y" ? tr("Отцовские линии", "Paternal lines") : tr("Материнские линии", "Maternal lines"),
        36,
        ink,
        700,
      );
      body += text(
        x,
        474,
        (g.kind === "y" ? tr("Y-ДНК", "Y-DNA") : tr("мтДНК", "mtDNA")) + " · n = " + num(g.n),
        25,
        muted,
        500,
        "start",
        mono,
      );
      body += viewport(x + 18, 475, 424, 424, "0 0 1000 1000", g.art);
      if (g.leaders?.length) {
        body += text(x, 925, tr("Чаще всего в выборке", "Most frequent in the sample"), 23, muted);
        g.leaders.forEach(({ name, share }, j) => {
          const y = 972 + j * 46;
          body += text(x, y, name, 28, ink, 600) + text(x + 446, y, share, 28, ink, 550, "end");
        });
      }
      if (g.kind === "y" && d.yRate) {
        body += text(x, 1107, tr("Образцов на 100 тыс. мужчин", "Kits per 100,000 men") + " · " + d.yRate, 23, muted);
      }
    });
    if (d.finding) {
      const f = d.finding;
      body += rule(1130) + text(55, 1181, f.name, 37, ink, 700);
      body += text(
        55,
        1225,
        tr("Доля в местной Y-выборке", "Share in the local Y sample") +
          " · " +
          pct(f.n, d.groups.find((g) => g.kind === "y").n) +
          "   ·   " +
          tr("Отношение к мировой доле FTDNA", "Relative to the worldwide FTDNA share") +
          " · ×" +
          f.ratio.toLocaleString(lang, { maximumFractionDigits: 1 }),
        24,
        muted,
      );
    }
  } else {
    if (d.lineage?.length > 1) {
      body += text(423, 112, d.kind === "mt" ? tr("Путь по мт-дереву FTDNA", "Path in the FTDNA mt tree") : tr("Путь по Y-дереву FTDNA", "Path in the FTDNA Y tree"), 23, muted, 550);
      const lines = [];
      let line = "";
      measure.font = "500 20px monospace";
      for (const name of d.lineage) {
        const next = line ? line + " → " + name : name;
        if (line && measure.measureText(next).width > 590) {
          lines.push(line);
          line = "→ " + name;
        } else {
          line = next;
        }
      }
      lines.push(line);
      if (lines.length > 3) lines.splice(1, lines.length - 2, "…");
      lines.forEach((value, i) => {
        body += text(423, 144 + i * 27, value, 20, blue, 500, "start", mono);
      });
    }
    body += text(
      58,
      248,
      art.route
        ? tr("Путь предков по модели FTDNA Discover", "Ancestral route in the FTDNA Discover model")
        : tr("География образцов ветки", "Reported origins of branch samples"),
      33,
      muted,
    );
    body += art.map || text(56, 477, tr("Нет географических данных для карты", "No mapped origins available"), 31, muted);
    if (!art.route && art.map)
      body += text(
        1016,
        716,
        tr("Цвета стран и регионов — в диаграмме ниже", "Country and region colours match the chart below"),
        22,
        muted,
        400,
        "end",
      );
    body += text(56, 788, tr("Происхождение образцов", "Reported sample origins"), 41, ink, 700);
    const rows = d.rows.map(([label, k], i) => [label, k, originColors[i]]);
    const rest = d.n - rows.reduce((sum, r) => sum + r[1], 0);
    if (rest > 0) rows.push([tr("Остальные", "Other"), rest, grey]);
    if (!d.n) body += text(56, 900, tr("Происхождение образцов неизвестно", "No reported sample origins"), 30, muted);
    if (d.n) body +=
      donut(228, 970, 124, rows, d.n) +
      text(228, 973, num(d.n), 37, ink, 650, "middle") +
      text(228, 1004, tr("с известной", "reported"), 20, muted, 400, "middle") +
      text(228, 1029, tr("географией", "origins"), 20, muted, 400, "middle");
    rows.forEach(([label, k, color], i) => {
      const y = 855 + i * 64;
      body +=
        swatch(429, y - 19, color) +
        text(461, y, label, 29, ink, 600) +
        text(1019, y, k < limits.SMALL_K ? num(k) + tr(" из ", " of ") + num(d.n) : num(k) + "  ·  " + pct(k, d.n), 27, muted, 400, "end");
    });
    if (d.age) {
      const [mean, lo, hi] = d.age.map((v) => (v == null ? null : Math.round(v / 100) * 100));
      body +=
        rule(1130) +
        text(56, 1181, tr("Общий предок", "Common ancestor") + " · " + num(mean) + tr(" лет назад", " years ago"), 37, ink, 700);
      body += text(
        56,
        1224,
        (lo != null && hi != null ? tr("Диапазон оценки", "Estimated range") + " · " + num(lo) + "–" + num(hi) + "     " : "") +
          "FTDNA Discover",
        24,
        muted,
      );
    }
  }
  body += text(56, 1280, "FamilyTreeDNA · " + (d.source ? d.source + " " : d.kind === "mt" ? "mt " : "Y ") + d.date + (d.groups ? "  /  mt " + d.mtDate : ""), 22, muted);
  body += text(56, 1320, url.host + url.pathname + url.hash, 25, blue, 500, "start", mono);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">${body}</svg>`;
}

export async function openSummary(button, d = JSON.parse(button.dataset.summary)) {
  const lang = document.documentElement.lang;
  const canonical = document.querySelector('link[rel="canonical"]');
  const url = new URL(canonical?.href || location.href);
  url.hash = d.anchor || "";
  if (!window.ftdJson) await import("/assets/page-data.js");
  const limits = window.ftdShareLimits;
  let art;
  if (d.groups) {
    art = await countryArt(d, lang);
  } else {
    const world = await json("/assets/map-world.json");
    let route = "";
    if (d.route) {
      try {
        route = await migration(d.route, lang, world, d.rows);
      } catch (error) {
        console.warn("share-summary: route unavailable", error);
      }
    }
    art = { route, map: route || branchMap(world, d.rows) };
  }
  const blob = await svgPng(makeCard(d, lang, url, art, limits), 1080, 1350);
  await showImageActions(button, blob, { title: d.title, filename: d.slug + ".png", lang, url });
}
