// Time slider logic of the palaeo map, shared by the page script and the tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PaleoMapCore = factory();
})(this, function () {
  "use strict";

  const STEPS = 1000;
  const AGO_MIN = 150;
  const AGO_MAX = 14000;
  const MIN_HALF = 150;
  // the further back, the fewer samples: the window widens with age
  const HALF_SHARE = 0.12;
  const SLOTS = 8;

  // slider 0 = oldest, STEPS = most recent; log scale, so the last millennia get most of the track
  const agoOf = (v) => Math.round(Math.exp(Math.log(AGO_MAX) + (Math.log(AGO_MIN) - Math.log(AGO_MAX)) * (v / STEPS)));
  const sliderOf = (ago) => Math.round(((Math.log(AGO_MAX) - Math.log(Math.min(AGO_MAX, Math.max(AGO_MIN, ago)))) / (Math.log(AGO_MAX) - Math.log(AGO_MIN))) * STEPS);
  const halfWidth = (ago) => Math.max(MIN_HALF, Math.round((ago * HALF_SHARE) / 50) * 50);

  // a Y point carries [lat, lon, year, oldest, youngest, ..]: its dating range touching the window counts; mt has one date
  const covers = (kind, p, year, half) => (kind === "y" ? p[3] <= year + half && p[4] >= year - half : p[2] >= year - half && p[2] <= year + half);

  function groups(points, keyOf) {
    const m = new Map();
    for (const p of points) { const k = keyOf(p); if (k == null || k < 0) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
    return [...m].map(([key, pts]) => ({ key, pts })).sort((a, b) => b.pts.length - a.pts.length || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  // colour slots 1..SLOTS for the largest groups; a group keeps its slot while it stays among them, so colours do not jump
  function assignSlots(prev, keys, n = SLOTS) {
    const top = keys.slice(0, n), out = new Map(), used = new Set();
    for (const k of top) if (prev.has(k)) { out.set(k, prev.get(k)); used.add(prev.get(k)); }
    let free = 1;
    for (const k of top) if (!out.has(k)) { while (used.has(free)) free++; out.set(k, free); used.add(free); }
    return out;
  }

  // Discover's area holds from its year until the next frame
  function frameAt(frames, year) {
    let best = null;
    for (const f of frames || []) { if (f[0] > year) break; best = f; }
    return best;
  }

  return { frameAt, STEPS, AGO_MIN, AGO_MAX, SLOTS, agoOf, sliderOf, halfWidth, covers, groups, assignSlots };
});
