(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GeoSmooth = factory();
})(this, function () {
  "use strict";

  const MIN_AROUND = 3;
  const key = (lat, lon) => lat + "," + lon;
  const wrapLon = (o) => ((((o + 180) % 360) + 360) % 360) - 180;
  const km = (a1, o1, a2, o2) => {
    const r = Math.PI / 180, h = Math.sin(((a2 - a1) * r) / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(((o2 - o1) * r) / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  // a branch's share within R: carriers over all members around each cell, both under a quartic kernel
  function smooth(branch, totals, step, R, minAround = MIN_AROUND) {
    const tot = new Map(totals.map((c) => [key(c[0], c[1]), c[2]]));
    const carriers = new Map(branch.map((p) => [key(p.lat, p.lon), p.share * (tot.get(key(p.lat, p.lon)) || 0)]));
    const dLat = Math.ceil(R / 111 / step) * step, out = [];
    for (const [lat, lon] of totals) {
      const cLat = lat + step / 2, cLon = lon + step / 2;
      const dLon = Math.min(179, Math.ceil(R / (111 * Math.max(0.1, Math.cos((cLat * Math.PI) / 180))) / step) * step);
      let num = 0, den = 0;
      for (let a = lat - dLat; a <= lat + dLat; a += step) for (let o = lon - dLon; o <= lon + dLon; o += step) {
        const k = key(a, wrapLon(o)), t = tot.get(k);
        if (!t) continue;
        const d = km(cLat, cLon, a + step / 2, o + step / 2);
        if (d >= R) continue;
        const w = (1 - (d / R) ** 2) ** 2;
        den += w * t;
        num += w * (carriers.get(k) || 0);
      }
      if (num > 0 && den >= minAround) out.push({ lat, lon, share: num / den });
    }
    return out;
  }

  return { smooth, km, MIN_AROUND };
});
