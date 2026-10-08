(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.YmapCore = factory();
})(this, function () {
  "use strict";

  // Engine-independent half of the branch migration map: shard decoding, the joined path, smoothing,
  // the animation timeline and date formatting. assets/ymap.js draws it; the build (lib/ymap.js) writes the shards.

  const PRECISION = 1e4;
  const R = 6371.0088;

  function haversine(a, b) {
    const p = Math.PI / 180;
    const h = Math.sin((b[0] - a[0]) * p / 2) ** 2 + Math.cos(a[0] * p) * Math.cos(b[0] * p) * Math.sin((b[1] - a[1]) * p / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Google's encoded polyline algorithm, with a configurable precision: [[lat, lng], …]
  function decodePolyline(str, precision = PRECISION) {
    const out = [];
    let i = 0, lat = 0, lng = 0;
    const next = () => {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      return result & 1 ? ~(result >> 1) : result >> 1;
    };
    while (i < str.length) { lat += next(); lng += next(); out.push([lat / precision, lng / precision]); }
    return out;
  }

  // One branch record: [startDate, startParent, [[node, geometryId, tmrca, label?], …]] → joined path.
  // Time is linear in distance along a segment: the dumps' per-point dates deviate from that by 0.04 % of the
  // segment's span at the median and 2 % at worst, so only the node dates are stored.
  function assemble(rec, geom) {
    const nodes = [], path = [];
    let t0 = rec[0], base = 0;
    for (const [name, gid, tmrca, label] of rec[2]) {
      const pts = decodePolyline(geom(gid));
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));
      const len = cum[cum.length - 1];
      // a segment starts where the previous one ended
      for (let i = path.length ? 1 : 0; i < pts.length; i++) path.push([pts[i][0], pts[i][1], t0 + (tmrca - t0) * (len ? cum[i] / len : 1), base + cum[i]]);
      base += len;
      nodes.push({ name, label: label || null, tmrca, i: path.length - 1 });
      t0 = tmrca;
    }
    const start = path[0];
    return { start: { name: rec[1], tmrca: rec[0], i: 0, lat: start[0], lng: start[1] }, nodes, path };
  }

  // Centripetal Catmull-Rom through the path vertices (interpolating: the nodes stay in place).
  // Returns a denser path and the new index of each input vertex.
  function smooth(path, stepKm = 8) {
    const lat0 = path.reduce((a, p) => a + p[0], 0) / path.length;
    const k = Math.cos(lat0 * Math.PI / 180);
    const xy = path.map((p) => [p[1] * 111.32 * k, p[0] * 110.57]);
    const n = xy.length;
    if (n < 3) return { path: path.map((p) => p.slice()), index: path.map((_, i) => i) };
    const ext = [[2 * xy[0][0] - xy[1][0], 2 * xy[0][1] - xy[1][1]], ...xy, [2 * xy[n - 1][0] - xy[n - 2][0], 2 * xy[n - 1][1] - xy[n - 2][1]]];
    const out = [], index = [];
    const dist = (a, b) => Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), 1e-9) ** 0.5;
    const lerp = (a, b, ta, tb, t) => { const w = (t - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]; };
    let d = 0;
    for (let i = 0; i < n - 1; i++) {
      const [p0, p1, p2, p3] = [ext[i], ext[i + 1], ext[i + 2], ext[i + 3]];
      const t0 = 0, t1 = t0 + dist(p0, p1), t2 = t1 + dist(p1, p2), t3 = t2 + dist(p2, p3);
      const m = Math.max(1, Math.ceil(haversine(path[i], path[i + 1]) / stepKm));
      index.push(out.length);
      for (let j = 0; j < m; j++) {
        const u = j / m, t = t1 + (t2 - t1) * u;
        const a1 = lerp(p0, p1, t0, t1, t), a2 = lerp(p1, p2, t1, t2, t), a3 = lerp(p2, p3, t2, t3, t);
        const b1 = lerp(a1, a2, t0, t2, t), b2 = lerp(a2, a3, t1, t3, t);
        const c = lerp(b1, b2, t1, t2, t);
        const pt = [c[1] / (110.57), c[0] / (111.32 * k), path[i][2] + (path[i + 1][2] - path[i][2]) * u, 0];
        if (out.length) d += haversine(out[out.length - 1], pt);
        pt[3] = d;
        out.push(pt);
      }
    }
    const last = path[n - 1];
    d += haversine(out[out.length - 1], last);
    index.push(out.length);
    out.push([last[0], last[1], last[2], d]);
    return { path: out, index };
  }

  // Leg k moves node k-1 → k with an eased run, then rests; short hops still get a readable minimum
  const DWELL_START = 0.8, DWELL = 0.6, LEG_MIN = 0.7, LEG_SPAN = 3.2, LEG_REF_KM = 1400;

  function timeline(path, nodeIdx) {
    const legs = [];
    let clock = DWELL_START;
    for (let k = 1; k < nodeIdx.length; k++) {
      const d0 = path[nodeIdx[k - 1]][3], d1 = path[nodeIdx[k]][3];
      const dur = LEG_MIN + LEG_SPAN * Math.pow((d1 - d0) / LEG_REF_KM, 0.6);
      legs.push({ k, a: clock, dur, d0, d1 });
      clock += dur + DWELL;
    }
    return { legs, total: clock };
  }

  const ease = (x) => x * x * (3 - 2 * x);

  // tau (seconds on the timeline) → distance travelled and the count of nodes reached (0 = start node only)
  function stateAt(tl, tau) {
    let d = 0, reached = 0;
    for (const L of tl.legs) {
      if (tau >= L.a + L.dur) { d = L.d1; reached = L.k; continue; }
      d = tau > L.a ? L.d0 + (L.d1 - L.d0) * ease((tau - L.a) / L.dur) : L.d0;
      break;
    }
    return { d, reached };
  }

  // distance along the path → { j: vertex before, lat, lng, t }
  function locate(path, d) {
    let lo = 0, hi = path.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path[m][3] <= d) lo = m; else hi = m; }
    const a = path[lo], b = path[hi], w = b[3] === a[3] ? 0 : Math.min(1, Math.max(0, (d - a[3]) / (b[3] - a[3])));
    return { j: lo, lat: a[0] + (b[0] - a[0]) * w, lng: a[1] + (b[1] - a[1]) * w, t: a[2] + (b[2] - a[2]) * w };
  }

  const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  // Dates are TMRCA estimates good to centuries: rounded by magnitude. s = { bce, ce, agoYears, agoK } (see i18n)
  function formatYear(y, nowYear, lang, s) {
    const a = Math.abs(y), step = a < 3000 ? 10 : a < 10000 ? 50 : 100;
    const r = Math.round(a / step) * step;
    const era = (y < 0 ? s.bce : s.ce).replace("{n}", group(r));
    const ago = nowYear - y;
    const agoText = ago < 1000
      ? s.agoYears.replace("{n}", group(Math.round(ago / 10) * 10))
      : s.agoK.replace("{n}", (ago / 1000).toFixed(1).replace(".", lang === "ru" ? "," : "."));
    return { era, ago: agoText };
  }

  // Archaeological epochs by calendar year (Near-Eastern/European convention, boundaries are conventional):
  // each entry ends at `to` (exclusive); names and colours come from i18n and CSS (--ep-<key>)
  const EPOCHS = [
    { key: "paleo", to: -10000 }, { key: "meso", to: -8000 }, { key: "neo", to: -4000 }, { key: "chalco", to: -3300 },
    { key: "bronze", to: -1200 }, { key: "iron", to: 500 }, { key: "medieval", to: 1500 }, { key: "modern", to: Infinity },
  ];
  const epochAt = (y) => EPOCHS.findIndex((e) => y < e.to);

  // path → runs of consecutive vertices within one epoch, each run sharing its boundary vertex with the next
  function splitByEpoch(path) {
    const runs = [];
    let cur = null;
    for (const p of path) {
      const e = epochAt(p[2]);
      if (!cur || cur.epoch !== e) {
        const next = { epoch: e, pts: cur ? [cur.pts[cur.pts.length - 1]] : [] };
        runs.push(next); cur = next;
      }
      cur.pts.push(p);
    }
    return runs;
  }

  // Label side per node (0 right, 1 left, 2 above, 3 below): nodes within `near` km of an earlier one take the next free side
  function labelSides(marks, near = 250) {
    const sides = [];
    marks.forEach((m, k) => {
      const used = new Set();
      for (let j = 0; j < k; j++) if (haversine([m.lat, m.lng], [marks[j].lat, marks[j].lng]) < near) used.add(sides[j]);
      sides.push([0, 1, 2, 3].find((x) => !used.has(x)) ?? k % 4);
    });
    return sides;
  }


  // ---- several branches on one map: a shared calendar clock ----

  // Calendar time on the slider: logarithmic in years before `now`. A linear scale would spend nine tenths of the run
  // on the Palaeolithic, where a branch's path has a few long legs; the log keeps every halving of the age equally long.
  const SCALE_TAU = 400;
  function timeScale(y0, y1, now, tau = SCALE_TAU) {
    const L = (y) => Math.log1p(Math.max(0, now - y) / tau);
    const a = L(y0), span = a - L(y1) || 1;
    return { toU: (y) => Math.min(1, Math.max(0, (a - L(y)) / span)), toYear: (u) => now - tau * Math.expm1(a - u * span) };
  }

  // dates along a path never go back (a re-estimated node can be older than its predecessor)
  function monotonic(path) {
    let t = -Infinity;
    return path.map((p) => { t = Math.max(t, p[2]); return [p[0], p[1], t, p[3]]; });
  }

  // calendar year → where this path's walker stands: hidden before the path starts, parked at the end after it
  function locateAt(path, year) {
    const n = path.length;
    if (year < path[0][2]) return { started: false, j: 0, lat: path[0][0], lng: path[0][1], d: 0 };
    if (year >= path[n - 1][2]) { const e = path[n - 1]; return { started: true, j: n - 2, lat: e[0], lng: e[1], d: e[3] }; }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path[m][2] <= year) lo = m; else hi = m; }
    const a = path[lo], b = path[hi], w = b[2] === a[2] ? 0 : (year - a[2]) / (b[2] - a[2]);
    return { started: true, j: lo, lat: a[0] + (b[0] - a[0]) * w, lng: a[1] + (b[1] - a[1]) * w, d: a[3] + (b[3] - a[3]) * w };
  }

  // routes: [{ segs: [{ id, a, b }] }] with a..b the smoothed-path vertex range of each node's geometry.
  // A geometry used by two or more routes is the common trunk: it is drawn once, in a neutral colour;
  // consecutive segments of one route that nobody else uses merge into a single run in the route's own colour.
  function planRuns(routes) {
    const users = new Map();
    routes.forEach((rt, r) => rt.segs.forEach((s) => { if (!users.has(s.id)) users.set(s.id, new Set()); users.get(s.id).add(r); }));
    const shared = new Map(), own = routes.map(() => []);
    routes.forEach((rt, r) => rt.segs.forEach((s) => {
      if (users.get(s.id).size > 1) {
        if (!shared.has(s.id)) shared.set(s.id, []);
        shared.get(s.id).push({ r, a: s.a, b: s.b });
      } else {
        const last = own[r][own[r].length - 1];
        if (last && last.b === s.a) last.b = s.b; else own[r].push({ a: s.a, b: s.b });
      }
    }));
    return { shared: [...shared].map(([id, owners]) => ({ id, owners })), own };
  }

  // share of the vertex range a..b walked at distance d
  function fraction(path, a, b, d) {
    const len = path[b][3] - path[a][3];
    return len > 0 ? Math.min(1, Math.max(0, (d - path[a][3]) / len)) : (d >= path[b][3] ? 1 : 0);
  }

  // [lat, lng] points of the range a..b up to `frac` of its length
  function prefix(path, a, b, frac) {
    if (frac <= 0) return [];
    if (frac >= 1) return path.slice(a, b + 1).map((p) => [p[0], p[1]]);
    const target = path[a][3] + (path[b][3] - path[a][3]) * frac, out = [];
    for (let i = a; i <= b; i++) {
      if (path[i][3] <= target) { out.push([path[i][0], path[i][1]]); continue; }
      const p = path[i - 1], q = path[i], w = (target - p[3]) / (q[3] - p[3]);
      out.push([p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w]);
      break;
    }
    return out;
  }

  // index of the child's path item where it leaves the parent's path (the deepest parent node it passes through)
  function forkAt(parentNames, childNames) {
    for (let i = parentNames.length - 1; i >= 0; i--) {
      const j = childNames.indexOf(parentNames[i]);
      if (j >= 0) return j;
    }
    return 0;
  }

  // seconds on a route's timeline when the walker stands at item k (0 = the start node)
  const reachedAt = (tl, k) => (k > 0 && tl.legs[k - 1] ? tl.legs[k - 1].a + tl.legs[k - 1].dur : 0);

  // polygons of a MultiPolygon worth fitting the camera to: at least `share` of the largest one's area and within `km`
  // of its bounding box, so the Azores or French Guiana stay highlighted without pulling the view across the ocean
  function mainPolygons(geometry, share = 0.1, km = 2000) {
    const area = (poly) => {
      const r = poly[0], k = Math.cos(r.reduce((a, c) => a + c[1], 0) / r.length * Math.PI / 180);
      let s = 0;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
      return Math.abs(s / 2) * k;
    };
    if (!geometry.coordinates.length) return [];
    const areas = geometry.coordinates.map(area), max = Math.max(...areas);
    const big = geometry.coordinates[areas.indexOf(max)][0];
    const lo = [Math.min(...big.map((c) => c[1])), Math.min(...big.map((c) => c[0]))], hi = [Math.max(...big.map((c) => c[1])), Math.max(...big.map((c) => c[0]))];
    const near = (poly) => {
      const r = poly[0], c = [r.reduce((a, p) => a + p[1], 0) / r.length, r.reduce((a, p) => a + p[0], 0) / r.length];
      return haversine(c, [Math.min(hi[0], Math.max(lo[0], c[0])), Math.min(hi[1], Math.max(lo[1], c[1]))]) <= km;
    };
    return geometry.coordinates.filter((p, i) => areas[i] === max || (areas[i] >= max * share && near(p)));
  }

  // lon/lat polygons of an outline file { p: [[ring, hole…], …] } (rings are encoded polylines) → GeoJSON MultiPolygon
  function outlineGeoJson(file, precision) {
    return { type: "MultiPolygon", coordinates: file.p.map((poly) => poly.map((ring) => decodePolyline(ring, precision).map(([lat, lng]) => [lng, lat]))) };
  }

  return { mainPolygons, forkAt, reachedAt, SCALE_TAU, timeScale, monotonic, locateAt, planRuns, fraction, prefix, outlineGeoJson, PRECISION, haversine, decodePolyline, assemble, smooth, timeline, stateAt, locate, formatYear, group, EPOCHS, epochAt, splitByEpoch, labelSides };
});
