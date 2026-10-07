(function () {
  "use strict";
  const fig = document.querySelector("figure.ymap");
  const blobEl = document.getElementById("ymap-data");
  if (!fig || !blobEl || !window.YmapCore) return;
  const D = JSON.parse(blobEl.textContent);
  const C = window.YmapCore;
  const S = D.s;
  const frame = fig.querySelector(".ymap-frame");
  const fold = fig.closest("details");
  const STORY = "https://discover.familytreedna.com/y-dna/";
  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  const year = (y) => C.formatYear(y, D.now, D.lang, { bce: S.ymapBce, ce: S.ymapCe, agoYears: S.ymapAgoYears, agoK: S.ymapAgoK });
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue("--acc").trim() || "#1f66bd";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // Google clips a polyline at the antimeridian even with noWrap longitudes; geodesic segments between the
  // closely spaced smoothed points take the short way across it instead
  const LL = (lat, lng) => ({ lat, lng });
  const getJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });

  // The map engine is the only part that knows about Google; everything else works on the joined path.
  function loadGoogle(key) {
    if (window.google && google.maps && google.maps.importLibrary) return Promise.resolve();
    return new Promise((resolve, reject) => {
      window.__ymapGmapsReady = resolve;
      const s = document.createElement("script");
      s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&v=weekly&loading=async&callback=__ymapGmapsReady";
      s.onerror = () => reject(new Error("Google Maps failed to load"));
      document.head.appendChild(s);
    });
  }

  // both maps open on the last FOCUS_YEARS (where the branch itself lives); "Whole path" zooms out to the origin
  const FOCUS_YEARS = 12000, RUN_SECONDS = 26, START_DWELL = 0.7, ORIGIN_YEARS = 40000, WALKER_STEP = 9, FORK_ZOOM = 7;

  // Camera while the clock runs: pans when a walker leaves the inner part of the frame; a drag by the reader
  // hands the camera back until the next Start
  function makeFollower(map) {
    let on = false, panning = false;
    map.addListener("dragstart", () => { on = false; });
    map.addListener("idle", () => { panning = false; });
    // the frame shrunk by 15 % per side; longitudes go through modulo so a view across the antimeridian keeps its width
    const inner = (b) => {
      const ne = b.getNorthEast(), sw = b.getSouthWest();
      const span = ((ne.lng() - sw.lng()) % 360 + 360) % 360 || 360, dLat = (ne.lat() - sw.lat()) * 0.15, dLng = span * 0.15;
      const wrap = (x) => ((x + 180) % 360 + 360) % 360 - 180;
      return new google.maps.LatLngBounds({ lat: sw.lat() + dLat, lng: wrap(sw.lng() + dLng) }, { lat: ne.lat() - dLat, lng: wrap(ne.lng() - dLng) });
    };
    return {
      set(v) { on = v; },
      keep(points) {
        const b = on && !panning && points.length ? map.getBounds() : null;
        if (!b || points.every((p) => inner(b).contains(p))) return;
        panning = true;
        if (points.length === 1) return map.panTo(points[0]);
        const nb = new google.maps.LatLngBounds();
        points.forEach((p) => nb.extend(p));
        map.panToBounds(nb, 60);
      },
    };
  }

  const EP_KEY = { paleo: "ymapEpPaleo", meso: "ymapEpMeso", neo: "ymapEpNeo", chalco: "ymapEpChalco", bronze: "ymapEpBronze", iron: "ymapEpIron", medieval: "ymapEpMedieval", modern: "ymapEpModern" };
  const epColor = (e) => cssVar("--ep-" + C.EPOCHS[e].key);

  const mapOptions = (center) => ({
    center, zoom: 4, mapId: D.mapId, mapTypeId: "terrain",
    zoomControl: true, cameraControl: false, mapTypeControl: false,
    streetViewControl: false, rotateControl: false, fullscreenControl: true, scaleControl: true, gestureHandling: "cooperative",
  });

  function makeBar() {
    const bar = el("div", "ymap-bar");
    const play = el("button", "tab", "▶ " + S.ymapPlay), stop = el("button", "tab", "■ " + S.ymapStop);
    play.type = stop.type = "button";
    const date = el("span", "ymap-date mono"), km = el("span", "ymap-km mono");
    date.setAttribute("aria-live", "off");
    const range = el("input", "ymap-range");
    range.type = "range"; range.min = 0; range.max = 1000; range.value = 0; range.setAttribute("aria-label", S.ymapProgress);
    bar.append(play, stop, date, km, range);
    frame.after(bar);
    return { play, stop, date, km, range };
  }

  // info card over the map for the picked node: age, epoch and the links; returns show(mark, key)
  function makeCard() {
    const card = el("div", "ymap-card");
    card.hidden = true;
    frame.appendChild(card);
    const show = (m, key) => {
      if (card.dataset.k === String(key) && !card.hidden) { card.hidden = true; return; }
      card.dataset.k = key;
      card.replaceChildren();
      const close = el("button", "ymap-card-x", "×");
      close.type = "button"; close.setAttribute("aria-label", S.ymapClose);
      close.addEventListener("click", () => { card.hidden = true; });
      const title = el("b", null, m.text);
      const age = el("div", "mono", m.era + " · " + m.ago);
      const ep = el("div", "dim", S[EP_KEY[C.EPOCHS[m.epoch].key]]);
      ep.style.setProperty("--ep", epColor(m.epoch)); ep.prepend(el("i", "ymap-card-ep"));
      card.append(close, title, age, ep);
      if (D.pages[m.name]) { const a = el("a", null, S.ymapInfoPage); a.href = D.pages[m.name]; card.appendChild(a); }
      if (!m.virtual) { const a = el("a", null, S.ymapInfoDiscover); a.href = STORY + encodeURIComponent(m.name) + "/story"; a.target = "_blank"; a.rel = "noopener"; card.appendChild(a); }
      card.hidden = false;
    };
    show.hide = () => { card.hidden = true; };
    return show;
  }

  // Play/stop/slider over a timeline of `total` seconds; the run ends with everything drawn and Start begins again
  function makeClock({ play, stop, range }, total, onFrame, onState) {
    let tau = 0, playing = false, last = 0, raf = 0;
    const state = (v) => { playing = v; if (onState) onState(v); };
    const render = () => {
      onFrame(tau);
      range.value = Math.round(tau / total * 1000);
      play.disabled = playing; stop.disabled = !playing;
    };
    function tick(now) {
      if (!playing) return;
      tau = Math.min(total, tau + (now - last) / 1000);
      last = now;
      if (tau >= total) state(false);
      render();
      if (playing) raf = requestAnimationFrame(tick);
    }
    function start() {
      if (playing) return;
      if (tau >= total) tau = 0;
      state(true); last = performance.now();
      render();
      raf = requestAnimationFrame(tick);
    }
    play.addEventListener("click", start);
    stop.addEventListener("click", () => { state(false); cancelAnimationFrame(raf); render(); });
    range.addEventListener("input", () => { tau = range.value / 1000 * total; render(); });
    const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    // reduced motion: open on the finished picture, the Start button still animates on request
    function settle() {
      if (!reduced()) return start();
      tau = total; render();
    }
    // another timeline: play it from `at`, or show it at `at` (reduced motion: at the end)
    function retime(newTotal, at, run) {
      state(false); cancelAnimationFrame(raf);
      total = newTotal; tau = Math.min(at, total);
      if (run && !reduced()) return start();
      if (run) tau = total;
      render();
    }
    return { start, settle, retime };
  }

  // ---- one branch: epoch-coloured path, the walker follows the legs; at its end the fork of child branches ----

  async function googleRenderer(host, at) {
    const { Map, Polyline } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    const map = new Map(host, mapOptions(LL(at[0], at[1])));
    let route = null, layer = [], fork = [], runs = [], nodes = [];
    const drop = (xs) => { for (const x of xs) { if (x.setMap) x.setMap(null); else x.map = null; } return []; };
    let unclamp = null;
    const fit = (focus) => {
      if (unclamp) unclamp();
      const bounds = new google.maps.LatLngBounds();
      route.path.forEach((p) => { if (!focus || p[2] >= D.now - FOCUS_YEARS) bounds.extend(LL(p[0], p[1])); });
      if (bounds.isEmpty()) route.path.forEach((p) => bounds.extend(LL(p[0], p[1])));
      map.fitBounds(bounds, { top: 40, left: 40, bottom: 40, right: 150 });
    };
    // no closer than FORK_ZOOM (a child's own leg is often a few dozen km); no idle comes when the camera stays, hence the timer
    const fitFrom = (i) => {
      const bounds = new google.maps.LatLngBounds();
      route.path.slice(i).forEach((p) => bounds.extend(LL(p[0], p[1])));
      if (unclamp) unclamp();
      map.setOptions({ maxZoom: FORK_ZOOM });
      const h = google.maps.event.addListenerOnce(map, "idle", () => unclamp());
      const timer = setTimeout(() => unclamp(), 1000);
      unclamp = () => { h.remove(); clearTimeout(timer); map.setOptions({ maxZoom: null }); unclamp = null; };
      map.fitBounds(bounds, { top: 60, left: 60, bottom: 60, right: 150 });
    };
    const walkerEl = el("div", "ymap-walker");
    const walker = new AdvancedMarkerElement({ map, position: LL(at[0], at[1]), content: walkerEl, zIndex: 100 });
    const follow = makeFollower(map);
    function setRoute(rt) {
      route = rt;
      layer = drop(layer); fork = drop(fork);
      // one pair of polylines per epoch run: the faint full run and the walked part on top
      runs = rt.runs.map((r) => {
        const color = epColor(r.epoch), ll = r.pts.map((p) => (LL(p[0], p[1])));
        layer.push(new Polyline({ map, geodesic: true, path: ll, strokeColor: color, strokeOpacity: 0.35, strokeWeight: 3, clickable: false }));
        const walked = new Polyline({ map, geodesic: true, path: [], strokeColor: color, strokeOpacity: 1, strokeWeight: 5, zIndex: 10, clickable: false });
        layer.push(walked);
        return { pts: r.pts, ll, walked };
      });
      const sides = C.labelSides(rt.marks);
      nodes = rt.marks.map((m, k) => {
        const node = el("div", "ymap-node ymap-node--" + "rltb"[sides[k]]);
        node.style.setProperty("--ep", epColor(m.epoch));
        node.appendChild(el("span", "ymap-dot"));
        const a = el("button", "ymap-tag", m.text);
        a.type = "button"; a.title = m.title;
        a.addEventListener("click", () => rt.onPick(k));
        node.appendChild(a);
        layer.push(new AdvancedMarkerElement({ map, position: LL(m.lat, m.lng), content: node, zIndex: 5 + k }));
        return node;
      });
    }
    // dashed lines from the branch's end to each child's end; shown once the walker is there
    function setFork(kids, onPick, visible) {
      fork = drop(fork);
      const sides = C.labelSides([...route.marks, ...kids.map((kid) => kid.end)]).slice(route.marks.length);
      kids.forEach((kid, i) => {
        const color = brColor(i);
        fork.push(new Polyline({ map: visible ? map : null, geodesic: true, path: kid.pts.map((p) => LL(p[0], p[1])), strokeOpacity: 0, zIndex: 6, clickable: false,
          icons: [{ icon: { path: "M 0,-1 0,1", strokeColor: color, strokeOpacity: 0.95, strokeWeight: 3, scale: 2 }, offset: "0", repeat: "10px" }] }));
        const node = el("div", "ymap-node ymap-node--" + "rltb"[sides[i]] + " ymap-end ymap-kid");
        node.style.setProperty("--br", color);
        node.appendChild(el("span", "ymap-dot"));
        const tag = el("button", "ymap-tag", kid.name + " · " + C.group(kid.n));
        tag.type = "button"; tag.title = fmt(S.ymapKidGo, { name: kid.name });
        tag.addEventListener("click", () => onPick(kid));
        node.appendChild(tag);
        fork.push(new AdvancedMarkerElement({ map: visible ? map : null, position: LL(kid.end.lat, kid.end.lng), content: node, zIndex: 30 + i }));
      });
    }
    const showFork = (v) => { for (const x of fork) { if (x.setMap) x.setMap(v ? map : null); else x.map = v ? map : null; } };
    return {
      fit, fitFrom, follow, setRoute, setFork, showFork,
      draw(pos, d, reached, epoch) {
        walker.position = LL(pos.lat, pos.lng);
        follow.keep([LL(pos.lat, pos.lng)]);
        walkerEl.style.setProperty("--ep", epColor(epoch));
        for (const r of runs) {
          const n = r.pts.findIndex((p) => p[3] > d);
          r.walked.setPath(n < 0 ? r.ll : n === 0 ? [] : r.ll.slice(0, n).concat([LL(pos.lat, pos.lng)]));
        }
        nodes.forEach((n, k) => {
          n.classList.toggle("is-passed", k <= reached);
          n.classList.toggle("is-current", k === reached);
        });
      },
    };
  }

  function route(rec, geom) {
    const a = C.assemble(rec, geom);
    const sm = C.smooth(a.path, 8);
    const items = [a.start, ...a.nodes];
    const marks = items.map((n, k) => {
      const i = sm.index[n.i], p = sm.path[i];
      const text = k === 0 ? n.name : n.name + (n.label ? " (" + n.label + ")" : "");
      const y = year(n.tmrca);
      return { name: n.name, virtual: k === 0, lat: p[0], lng: p[1], i, text, era: y.era, ago: y.ago, epoch: C.epochAt(n.tmrca), title: text + ", " + y.era + ", " + y.ago };
    });
    const rt = { path: sm.path, marks, names: items.map((n) => n.name), runs: C.splitByEpoch(sm.path), total: sm.path[sm.path.length - 1][3] };
    rt.tl = C.timeline(rt.path, marks.map((m) => m.i));
    return rt;
  }

  const pageOf = (slug) => "/" + D.lang + "/clade/" + slug + "/";

  // first: { name, slug, file } of the page's branch; files: slug → Promise of /data/ymap/<slug>.json
  function mountSingle(first, renderer, geomOf, files) {
    const { play, stop, date, km, range } = makeBar();
    const zoom = el("button", "tab", S.ymapFull);
    zoom.type = "button";
    let focused = true;
    zoom.addEventListener("click", () => { focused = !focused; renderer.fit(focused); zoom.textContent = focused ? S.ymapFull : S.ymapNear; });
    play.parentNode.insertBefore(zoom, date);
    const trailEl = el("p", "ymap-trail"), kidsEl = el("div", "ymap-kids");
    trailEl.hidden = kidsEl.hidden = true;
    const legend = el("ul", "ymap-epochs");
    fig.append(trailEl, kidsEl, el("p", "dim ymap-epochs-lead", S.ymapEpochs), legend);
    const showCard = makeCard();
    const trail = [];
    let cur = null, chips = new Map(), atEnd = false, kids = [];

    function setLegend(rt) {
      legend.replaceChildren();
      const present = [...new Set(rt.runs.map((r) => r.epoch))].sort((a, b) => a - b);
      chips = new Map(present.map((e) => {
        const li = el("li");
        li.style.setProperty("--ep", epColor(e));
        li.appendChild(el("i"));
        li.appendChild(el("span", null, S[EP_KEY[C.EPOCHS[e].key]]));
        legend.appendChild(li);
        return [e, li];
      }));
    }

    function setTrail() {
      trailEl.replaceChildren();
      trailEl.hidden = trail.length < 2;
      trail.forEach((lv, i) => {
        if (i) trailEl.append(" → ");
        if (lv === cur) { const b = el("b", null, lv.name); b.tabIndex = -1; trailEl.appendChild(b); return; }
        const b = el("button", "ymap-crumb", lv.name);
        b.type = "button";
        b.addEventListener("click", () => { trail.length = i + 1; enter(lv, null); renderer.fit(focused); focusTrail(); });
        trailEl.appendChild(b);
      });
    }

    // the clicked chip or crumb is gone with the redraw: focus the current crumb, or Start back at the top level
    const focusTrail = () => { const b = trailEl.querySelector("b"); (b && !trailEl.hidden ? b : play).focus({ preventScroll: true }); };

    function setKids() {
      kidsEl.replaceChildren();
      kidsEl.hidden = !kids.length;
      if (!kids.length) return;
      const ul = el("ul", "ymap-branches");
      kids.forEach((kid, i) => {
        const li = el("li");
        li.style.setProperty("--br", brColor(i));
        li.appendChild(el("i"));
        const b = el("button", "ymap-crumb", kid.name + " · " + C.group(kid.n));
        b.type = "button"; b.title = fmt(S.ymapKidGo, { name: kid.name });
        b.addEventListener("click", () => descend(kid));
        const a = el("a", "ymap-kid-page", "↗");
        a.href = pageOf(kid.slug); a.title = S.ymapInfoPage; a.setAttribute("aria-label", S.ymapInfoPage + ": " + kid.name);
        li.append(b, a);
        ul.appendChild(li);
      });
      kidsEl.append(el("p", "dim ymap-epochs-lead", S.ymapKids), ul);
    }

    // a child's own part of the path: from where it leaves the current branch's path to its end; null without one
    const routes = new Map();
    function kidOf(lv, [name, slug, n], file) {
      if (routes.get(slug) === null) return null;
      if (!routes.has(slug)) {
        try { routes.set(slug, route(file.b, geomOf(file))); } catch (e) { console.error("ymap:", slug, e); routes.set(slug, null); return null; }
      }
      try {
        const rt = routes.get(slug), at = C.forkAt(lv.rt.names, rt.names);
        if (at >= rt.marks.length - 1) return null;
        D.pages[name] = pageOf(slug);
        return { name, slug, n, file, rt, at, pts: rt.path.slice(rt.marks[at].i), end: rt.marks[rt.marks.length - 1] };
      } catch (e) {
        console.error("ymap:", slug, e);
        return null;
      }
    }

    async function loadKids(lv) {
      const list = lv.file.k || [];
      const got = await Promise.all(list.map((k) => files(k[1]).catch(() => null)));
      return list.map((k, i) => (got[i] ? kidOf(lv, k, got[i]) : null)).filter(Boolean);
    }

    // show a level: play it from tau `from`, or show it finished when from is null
    function enter(lv, from) {
      cur = lv;
      cur.rt.onPick = (k) => showCard(cur.rt.marks[k], cur.slug + "|" + k);
      showCard.hide();
      renderer.setRoute(cur.rt);
      setLegend(cur.rt); setTrail();
      kids = []; setKids();
      atEnd = false;
      clock.retime(cur.rt.tl.total, from == null ? cur.rt.tl.total : from, from != null);
      loadKids(lv).then((ks) => {
        if (cur !== lv) return;
        kids = ks;
        renderer.setFork(kids, descend, atEnd);
        setKids();
      }).catch((e) => console.error("ymap:", e));
    }

    function descend(kid) {
      const lv = { name: kid.name, slug: kid.slug, file: kid.file, rt: kid.rt };
      trail.push(lv);
      enter(lv, C.reachedAt(lv.rt.tl, kid.at));
      renderer.fitFrom(lv.rt.marks[kid.at].i);
      focusTrail();
    }

    const clock = makeClock({ play, stop, range }, 1, (tau) => {
      if (!cur) return;
      const rt = cur.rt, s = C.stateAt(rt.tl, tau), pos = C.locate(rt.path, s.d), epoch = C.epochAt(pos.t);
      renderer.draw(pos, s.d, s.reached, epoch);
      const end = s.reached === rt.marks.length - 1;
      if (end !== atEnd) { atEnd = end; renderer.showFork(end); }
      chips.forEach((li, e) => li.classList.toggle("is-current", e === epoch));
      const y = year(pos.t);
      date.textContent = "≈ " + y.era + " · " + y.ago + " · " + S[EP_KEY[C.EPOCHS[epoch].key]];
      km.textContent = fmt(S.ymapKm, { d: C.group(Math.round(s.d)), total: C.group(Math.round(rt.total)) });
    }, (playing) => renderer.follow.set(playing));

    const lv = { name: first.name, slug: first.slug, file: first.file, rt: route(first.file.b, geomOf(first.file)) };
    trail.push(lv);
    enter(lv, 0);
    renderer.fit(true);
  }

  // ---- several branches on one map, one calendar clock ----

  const brColor = (i) => cssVar("--br-" + (i % 5));

  function branchRoute(rec, geom) {
    const a = C.assemble(rec, geom);
    const sm = C.smooth(a.path, 8);
    const path = C.monotonic(sm.path);
    const items = [a.start, ...a.nodes];
    const idx = items.map((n) => sm.index[n.i]);
    const marks = items.map((n, k) => {
      const i = idx[k], p = path[i], y = year(p[2]);
      const text = k === 0 ? n.name : n.name + (n.label ? " (" + n.label + ")" : "");
      return { name: n.name, virtual: k === 0, text, lat: p[0], lng: p[1], i, t: p[2], era: y.era, ago: y.ago, epoch: C.epochAt(p[2]), key: (k ? n.name + "|" + rec[2][k - 1][1] : "s|" + n.name) };
    });
    return { path, marks, segs: rec[2].map((n, k) => ({ id: n[1], a: idx[k], b: idx[k + 1] })) };
  }

  async function multiRenderer(host, scene) {
    const { Map, Polyline } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    const map = new Map(host, mapOptions({ lat: 45, lng: 40 }));
    // the whole path from the deep trunk, or only the Holocene part with the outline (where the branches ended up)
    const fit = (focus) => {
      const bounds = new google.maps.LatLngBounds();
      scene.routes.forEach((r) => r.path.forEach((p) => { if (!focus || p[2] >= D.now - FOCUS_YEARS) bounds.extend(LL(p[0], p[1])); }));
      if (scene.geometry) scene.geometry.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach(([lng, lat]) => bounds.extend({ lat, lng }))));
      map.fitBounds(bounds, { top: 40, left: 40, bottom: 40, right: 60 });
    };
    if (scene.geometry) {
      map.data.addGeoJson({ type: "Feature", geometry: scene.geometry });
      map.data.setStyle({ fillColor: accent(), fillOpacity: 0.28, strokeColor: accent(), strokeOpacity: 0.95, strokeWeight: 2.5, clickable: false });
    }
    fit(true);
    const line = (pts, color, opacity, weight, z) => new Polyline({ map, geodesic: true, path: pts.map((p) => (LL(p[0], p[1]))), strokeColor: color, strokeOpacity: opacity, strokeWeight: weight, zIndex: z, clickable: false });
    const trunk = cssVar("--trunk");
    const shared = scene.plan.shared.map((s) => {
      const o = s.owners[0], path = scene.routes[o.r].path;
      line(C.prefix(path, o.a, o.b, 1), trunk, 0.35, 3, 1);
      return { ...s, walked: line([], trunk, 1, 5, 2) };
    });
    const own = scene.plan.own.map((runs, r) => runs.map((run) => {
      line(C.prefix(scene.routes[r].path, run.a, run.b, 1), brColor(r), 0.4, 3, 3);
      return { ...run, walked: line([], brColor(r), 1, 5, 4) };
    }));
    const place = (content, mark, z) => new AdvancedMarkerElement({ map, position: LL(mark.lat, mark.lng), content, zIndex: z });
    const dots = scene.dots.map((d) => {
      const b = el("button", "ymap-pip"); b.type = "button"; b.title = d.mark.text + ", " + d.mark.era;
      b.style.setProperty("--br", brColor(d.r));
      b.addEventListener("click", () => scene.onPick(d.mark));
      place(b, d.mark, 5);
      return b;
    });
    const sides = C.labelSides(scene.ends.map((e) => e.mark));
    const ends = scene.ends.map((e, k) => {
      const node = el("div", "ymap-node ymap-node--" + "rltb"[sides[k]] + " ymap-end");
      node.style.setProperty("--br", brColor(e.r));
      node.appendChild(el("span", "ymap-dot"));
      const tag = el("button", "ymap-tag", e.mark.name);
      tag.type = "button"; tag.title = e.mark.text + ", " + e.mark.era;
      tag.addEventListener("click", () => scene.onPick(e.mark));
      node.appendChild(tag);
      place(node, e.mark, 20 + k);
      return node;
    });
    const n = scene.routes.length;
    const walkers = scene.routes.map((rt, r) => {
      const w = el("div", "ymap-walker");
      w.style.setProperty("--br", brColor(r));
      w.style.setProperty("--off", (r - (n - 1) / 2) * WALKER_STEP + "px");
      w.style.display = "none";
      const m = new AdvancedMarkerElement({ map, position: LL(rt.path[0][0], rt.path[0][1]), content: w, zIndex: 100 + r });
      return { w, m };
    });
    const follow = makeFollower(map);
    return {
      fit, follow,
      draw(year, locs) {
        follow.keep(locs.filter((l) => l.started).map((l) => LL(l.lat, l.lng)));
        locs.forEach((loc, r) => {
          walkers[r].w.style.display = loc.started ? "" : "none";
          walkers[r].m.position = LL(loc.lat, loc.lng);
          for (const run of own[r]) run.walked.setPath(C.prefix(scene.routes[r].path, run.a, run.b, loc.started ? C.fraction(scene.routes[r].path, run.a, run.b, loc.d) : 0).map((p) => (LL(p[0], p[1]))));
        });
        for (const s of shared) {
          const f = Math.max(...s.owners.map((o) => (locs[o.r].started ? C.fraction(scene.routes[o.r].path, o.a, o.b, locs[o.r].d) : 0)));
          const o = s.owners[0];
          s.walked.setPath(C.prefix(scene.routes[o.r].path, o.a, o.b, f).map((p) => (LL(p[0], p[1]))));
        }
        dots.forEach((d, k) => d.classList.toggle("is-passed", year >= scene.dots[k].mark.t));
        ends.forEach((e, k) => e.classList.toggle("is-passed", year >= scene.ends[k].mark.t));
      },
    };
  }

  function mountMulti(routes, outline, renderer) {
    const now = D.now;
    const y0 = Math.max(Math.min(...routes.map((r) => r.path[0][2])), now - ORIGIN_YEARS);
    const y1 = Math.max(...routes.map((r) => r.path[r.path.length - 1][2]));
    const scale = C.timeScale(y0, y1, now);
    const endNames = new Set(routes.map((r) => r.marks[r.marks.length - 1].name));
    const seen = new Set(), dots = [];
    routes.forEach((rt, r) => rt.marks.forEach((m, k) => {
      if (k === rt.marks.length - 1 || endNames.has(m.name) || seen.has(m.key)) return;
      seen.add(m.key); dots.push({ r, mark: m });
    }));
    const ends = routes.map((rt, r) => ({ r, mark: rt.marks[rt.marks.length - 1] }));
    const scene = { routes, geometry: outline && C.outlineGeoJson(outline, D.precision), dots, ends, plan: C.planRuns(routes) };
    const showCard = makeCard();
    scene.onPick = (m) => showCard(m, m.key);
    return renderer(scene).then((rend) => {
      const { play, stop, date, km, range } = makeBar();
      km.remove();
      const zoom = el("button", "tab", S.ymapFull);
      zoom.type = "button";
      let focused = true;
      zoom.addEventListener("click", () => { focused = !focused; rend.fit(focused); zoom.textContent = focused ? S.ymapFull : S.ymapFocus; });
      play.parentNode.insertBefore(zoom, date);
      const total = START_DWELL + RUN_SECONDS;
      const clock = makeClock({ play, stop, range }, total, (tau) => {
        const u = Math.min(1, Math.max(0, (tau - START_DWELL) / RUN_SECONDS)), yr = scale.toYear(u);
        rend.draw(yr, routes.map((rt) => C.locateAt(rt.path, yr)));
        const y = year(yr);
        date.textContent = "≈ " + y.era + " · " + y.ago + " · " + S[EP_KEY[C.EPOCHS[C.epochAt(yr)].key]];
      }, (playing) => rend.follow.set(playing));
      clock.settle();
    });
  }

  async function openMulti(gate) {
    const root = await getJson("/data/ymap-root.json");
    const [files, outline] = await Promise.all([
      Promise.all(D.branches.map((b) => getJson("/data/ymap/" + b.slug + ".json"))),
      D.outline ? getJson("/data/outline/" + D.outline + ".json") : null,
      loadGoogle(D.key),
    ]);
    const routes = files.map((f) => branchRoute(f.b, (id) => f.g[id] || root.g[id]));
    gate.remove();
    const host = el("div", "ymap-map");
    frame.appendChild(host);
    await mountMulti(routes, outline, (scene) => multiRenderer(host, scene));
  }

  async function openSingle(gate) {
    const cache = new Map();
    const files = (slug) => {
      if (!cache.has(slug)) cache.set(slug, getJson("/data/ymap/" + slug + ".json").catch((e) => { cache.delete(slug); throw e; }));
      return cache.get(slug);
    };
    const [file, root] = await Promise.all([files(D.slug), getJson("/data/ymap-root.json"), loadGoogle(D.key)]);
    const geomOf = (f) => (id) => f.g[id] || root.g[id];
    const at = C.decodePolyline(geomOf(file)(file.b[2][0][1]))[0];
    gate.remove();
    const host = el("div", "ymap-map");
    frame.appendChild(host);
    mountSingle({ name: D.name, slug: D.slug, file }, await googleRenderer(host, at), geomOf, files);
  }

  async function open() {
    const gate = frame.querySelector(".ymap-gate");
    try {
      await (D.mode === "multi" ? openMulti(gate) : openSingle(gate));
    } catch (e) {
      gate.querySelector("p").textContent = S.ymapError;
      console.error("ymap:", e);
    }
  }

  // a key rejected by Google (referrer, quota) arrives after the map was built: replace it with our message
  window.gm_authFailure = () => {
    document.querySelectorAll(".ymap-bar, .ymap-card").forEach((e) => e.remove());
    frame.replaceChildren(el("p", "dim ymap-gate", S.ymapError));
    console.error("ymap: Google Maps rejected the key");
  };

  // the inline loader (render-ymap.js) has already unfolded the block; later unfoldings do nothing new
  let opened = false;
  const unfolded = () => { if (fold.open && !opened) { opened = true; open(); } };
  fold.addEventListener("toggle", unfolded);
  unfolded();
})();
