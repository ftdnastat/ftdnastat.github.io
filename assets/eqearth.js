// Equal Earth as mapshaper drew map-world.json: +proj=eqearth on a sphere of the WGS84 semi-major axis.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EqEarth = factory();
})(this, function () {
  "use strict";

  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
  const RAD = Math.PI / 180;
  const R = 6378137;

  // lon/lat in degrees → projected metres
  function forward(lon, lat, lon0 = 0) {
    let lam = (lon - lon0) * RAD;
    if (lam > Math.PI) lam -= 2 * Math.PI;
    if (lam < -Math.PI) lam += 2 * Math.PI;
    const psi = Math.asin(M * Math.sin(lat * RAD)), p2 = psi * psi, p6 = p2 * p2 * p2;
    const x = (lam * Math.cos(psi)) / (M * (A1 + 3 * A2 * p2 + p6 * (7 * A3 + 9 * A4 * p2)));
    const y = psi * (A1 + A2 * p2 + p6 * (A3 + A4 * p2));
    return [x * R, y * R];
  }

  // lon/lat → map units of map-world.json
  function toMap(proj, lon, lat) {
    const [x, y] = forward(lon, lat, proj.lon0);
    return [(x - proj.x0) * proj.k, (proj.y1 - y) * proj.k];
  }

  // a ring of points `km` around lat/lon, for the 68 % circle
  function circle(lat, lon, km, n = 64) {
    const d = km / 6371, la = lat * RAD, lo = lon * RAD, out = [];
    for (let i = 0; i <= n; i++) {
      const b = (2 * Math.PI * i) / n;
      const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
      const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
      out.push([((lo2 / RAD + 540) % 360) - 180, la2 / RAD]);
    }
    return out;
  }

  return { forward, toMap, circle };
});
