(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MtFastaCore = factory();
})(this, function () {
  "use strict";

  // sample length may differ from rCRS by this much; a partial read (HVR only) is refused
  const MAX_LEN_DIFF = 300;
  const BAND = 40;
  const MATCH = 1, MISMATCH = -3, GAP_OPEN = 6, GAP_EXT = 1;
  const NEG = -1e9;
  const MAX_DIFFS = 250;
  // an indel is judged by the sample's length around it: an aligner may put it at either end of a repeat
  const FLANK = 20;
  // positions HaploGrep leaves out of scoring: length polymorphisms and the most recurrent sites
  const SKIP = new Set([309, 315, 523, 524, 3107, 16182, 16183, 16193, 16519]);
  const BASES = /^[ACGT]$/;
  // length-polymorphic stretches: an aligner can place their indels either way, so they are not reported as extras
  const NOISY = [[303, 317], [514, 525], [567, 573], [3107, 3107], [16180, 16195], [16519, 16519]];
  /** @param {number} p */
  const noisy = (p) => NOISY.some(([a, b]) => p >= a && p <= b);

  /** @param {string} text */
  function parseFasta(text) {
    const lines = String(text || "").split(/\r\n?|\n/);
    let name = "", seq = "", started = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line[0] === ">") { if (started) break; name = line.slice(1).trim(); started = true; continue; }
      if (line[0] === ";") continue;
      started = true;
      seq += line;
    }
    return { name, seq: seq.toUpperCase().replace(/[^A-Z-]/g, "").replace(/-/g, "").replace(/U/g, "T") };
  }

  // banded affine global alignment; out: base at each rCRS position ("-" deleted, "N" unknown) and insertions after it
  /** @param {string} ref @param {string} s */
  function align(ref, s) {
    const n = ref.length, m = s.length, diff = m - n;
    if (Math.abs(diff) > MAX_LEN_DIFF) return null;
    const lo = -BAND + Math.min(0, diff), W = 2 * BAND + Math.abs(diff) + 1;
    const tb = new Uint8Array((n + 1) * W);
    let pM = new Float64Array(W).fill(NEG), pX = new Float64Array(W).fill(NEG), pY = new Float64Array(W).fill(NEG);
    let cM = new Float64Array(W), cX = new Float64Array(W), cY = new Float64Array(W);
    // row 0: only leading insertions
    for (let k = 0; k < W; k++) { const j = lo + k; if (j === 0) pM[k] = 0; else if (j > 0 && j <= m) pY[k] = -GAP_OPEN - (j - 1) * GAP_EXT; }
    for (let i = 1; i <= n; i++) {
      const r = ref.charCodeAt(i - 1), rN = r === 78;
      cM.fill(NEG); cX.fill(NEG); cY.fill(NEG);
      for (let k = 0; k < W; k++) {
        const j = i + lo + k;
        if (j < 0 || j > m) continue;
        let t = 0;
        if (j >= 1) {
          const a = pM[k], b = pX[k], c = pY[k];
          let best = a, from = 0;
          if (b > best) { best = b; from = 1; }
          if (c > best) { best = c; from = 2; }
          if (best > NEG / 2) {
            const q = s.charCodeAt(j - 1);
            cM[k] = best + (rN || q === 78 ? 0 : q === r ? MATCH : MISMATCH);
            t |= from;
          }
        }
        if (k + 1 < W) {
          const o = pM[k + 1] - GAP_OPEN, e = pX[k + 1] - GAP_EXT;
          if (e > o) { cX[k] = e; t |= 4; } else cX[k] = o;
        }
        if (k > 0 && j >= 1) {
          const o = cM[k - 1] - GAP_OPEN, e = cY[k - 1] - GAP_EXT;
          if (e > o) { cY[k] = e; t |= 8; } else cY[k] = o;
        }
        tb[i * W + k] = t;
      }
      [pM, cM] = [cM, pM]; [pX, cX] = [cX, pX]; [pY, cY] = [cY, pY];
    }
    const kEnd = m - n - lo;
    if (kEnd < 0 || kEnd >= W) return null;
    const end = Math.max(pM[kEnd], pX[kEnd], pY[kEnd]);
    let state = pM[kEnd] === end ? 0 : pX[kEnd] === end ? 1 : 2;
    const base = new Array(n + 1).fill("N"), ins = /** @type {Record<number, string>} */ ({});
    let i = n, k = kEnd, mismatches = 0, gaps = 0;
    while (i > 0 || lo + k > 0) {
      const j = i + lo + k, t = tb[i * W + k];
      if (i === 0) { k--; continue; }
      if (state === 0) {
        const q = s[j - 1];
        base[i] = q;
        if (q !== ref[i - 1] && q !== "N" && ref[i - 1] !== "N") mismatches++;
        state = t & 3; i--;
      } else if (state === 1) {
        base[i] = "-"; gaps++;
        state = t & 4 ? 1 : 0; i--; k++;
      } else {
        ins[i] = s[j - 1] + (ins[i] || ""); gaps++;
        state = t & 8 ? 2 : 0; k--;
      }
    }
    // a sequence this far from rCRS is not an mtDNA read in rCRS order
    if (mismatches + gaps > MAX_DIFFS) return null;
    return { base, ins, mismatches, gaps };
  }

  // "G3705A", "C15853a" (transversion), "T152C!" (back mutation), "(G263A)" (unstable), "A2395d", "2484.1C", "292.1AT", "A2156.1d!", "8281-8289d",
  // "[2]8289CCCCCTCTA[1]" (a repeat of 2 units down to 1, ending at 8289)
  const MUT = /^(\()?([ACGTRYKMSWBDHVN]?)(\d+)(?:-(\d+))?(?:\.(\d+))?([ACGT]+|[acgt]|d)(!*)\)?$/;
  const REPEAT = /^(\()?\[(\d+)\](\d+)([ACGT]+)\[(\d+)\](!*)\)?$/;
  /** @param {string} token */
  function parseMutation(token) {
    const r = REPEAT.exec(token);
    if (r) {
      const p = +r[3], unit = r[4], d = (+r[5] - +r[2]) * unit.length;
      if (!d) return null;
      return { token, p: d < 0 ? p + d + 1 : p, end: p, from: "", ins: 0, to: d < 0 ? "-" : "", len: d, w: r[1] ? 0.5 : 1, indel: true };
    }
    const m = MUT.exec(token);
    if (!m) return null;
    const p = +m[3], end = m[4] ? +m[4] : p, raw = m[6], ins = m[5] ? +m[5] : 0;
    if (raw.length > 1 && !ins) return null;
    const to = raw === "d" ? "-" : raw.toUpperCase();
    // the length change against rCRS order: a deletion removes the range, an insertion adds its bases, an inserted base taken back adds none
    const len = ins ? (to === "-" ? 0 : to.length) : to === "-" ? -(end - p + 1) : 0;
    const out = { token, p, end, from: m[2] || "", ins, to, len, w: m[1] ? 0.5 : 1, indel: Boolean(ins) || to === "-" };
    if (SKIP.has(p) || (ins && p === 16193)) out.w = 0;
    return out;
  }

  /** @param {{ base: string[], ins: Record<number, string> }} a @param {number} from @param {number} to sample bases over rCRS positions from..to, or null if one is unread */
  function around(a, from, to) {
    let s = "";
    for (let x = Math.max(1, from); x <= Math.min(a.base.length - 1, to); x++) {
      const b = a.base[x];
      if (b === "N") return null;
      if (b !== "-") s += b;
      if (x < to && a.ins[x]) s += a.ins[x];
    }
    return s;
  }

  /** @param {{ p: number, end: number, ins: number, to: string, len: number, indel: boolean }} mu @param {{ base: string[], ins: Record<number, string> }} a 1 match, -1 mismatch, 0 unknown */
  function state(mu, a) {
    if (mu.indel) {
      const from = mu.p - FLANK, to = mu.end + FLANK, w = around(a, from, to);
      if (w == null) return 0;
      const refLen = Math.min(a.base.length - 1, to) - Math.max(1, from) + 1;
      return w.length - refLen === mu.len ? 1 : -1;
    }
    const b = a.base[mu.p];
    if (b === "-") return -1;
    if (!BASES.test(b)) return 0;
    return b === mu.to ? 1 : -1;
  }

  // one slot per position: a substitution, a deletion range, or the n-th inserted base after a position (a repeat that grows counts as .1)
  /** @param {{ p: number, end: number, ins: number, len: number, indel: boolean }} mu */
  const keyOf = (mu) => (mu.ins ? mu.p + "." + mu.ins : mu.indel ? (mu.len > 0 ? mu.p + ".1" : mu.p + "-" + mu.end) : String(mu.p));

  /** @param {{ nodes: any[] }} data */
  function prepare(data) {
    const nodes = data.nodes.map((r, i) => ({ i, name: r[0], parent: r[1], muts: r[2] ? String(r[2]).split(" ").map(parseMutation).filter(Boolean) : [], raw: r[2] ? String(r[2]).split(" ") : [], link: r[3], n: r[4] || 0, kids: /** @type {number[]} */ ([]) }));
    for (const x of nodes) if (x.parent >= 0) nodes[x.parent].kids.push(x.i);
    return nodes;
  }

  // a node's score: every position counts by the last mutation on the path from the root, so a back mutation replaces its forward one
  /** @param {ReturnType<typeof prepare>} nodes @param {{ base: string[], ins: Record<number, string> }} a */
  function classify(nodes, a) {
    const score = new Float64Array(nodes.length), hits = new Int32Array(nodes.length), miss = new Int32Array(nodes.length), depth = new Int32Array(nodes.length);
    const last = new Map();
    const stack = /** @type {[number, number][]} */ (nodes.filter((x) => x.parent < 0).map((x) => [x.i, 0]));
    const undo = /** @type {[string, any][][]} */ ([]);
    while (stack.length) {
      const [i, phase] = /** @type {[number, number]} */ (stack.pop());
      const x = nodes[i];
      if (phase === 1) { for (const [k, prev] of /** @type {[string, any][]} */ (undo.pop()).reverse()) { if (prev === undefined) last.delete(k); else last.set(k, prev); } continue; }
      const p = x.parent;
      let s = p >= 0 ? score[p] : 0, h = p >= 0 ? hits[p] : 0, ms = p >= 0 ? miss[p] : 0;
      const saved = /** @type {[string, any][]} */ ([]);
      for (const mu of x.muts) {
        const k = keyOf(mu), prev = last.get(k);
        if (prev) { const st = prev.st; s -= prev.w * st; if (prev.w) { if (st > 0) h--; else if (st < 0) ms--; } }
        const st = state(mu, a);
        s += mu.w * st;
        if (mu.w) { if (st > 0) h++; else if (st < 0) ms++; }
        saved.push([k, prev]);
        last.set(k, { w: mu.w, st });
      }
      score[i] = s; hits[i] = h; miss[i] = ms; depth[i] = p >= 0 ? depth[p] + 1 : 0;
      undo.push(saved);
      stack.push([i, 1]);
      for (let c = x.kids.length - 1; c >= 0; c--) stack.push([x.kids[c], 0]);
    }
    // the best node; on a tie the shallower one, since its extra depth is not supported
    const order = nodes.map((x) => x.i).sort((u, v) => score[v] - score[u] || depth[u] - depth[v]);
    return { order, score, hits, miss, depth };
  }

  /** @param {ReturnType<typeof prepare>} nodes @param {number} i */
  function pathOf(nodes, i) { const out = []; for (let x = i; x >= 0; x = nodes[x].parent) out.push(x); return out.reverse(); }

  // per path mutation: matched, missing or unknown; the last mutation at a position decides
  /** @param {ReturnType<typeof prepare>} nodes @param {number} i @param {{ base: string[], ins: Record<number, string> }} a */
  function explain(nodes, i, a) {
    const path = pathOf(nodes, i), lastAt = new Map();
    for (const x of path) for (const mu of nodes[x].muts) lastAt.set(keyOf(mu), mu);
    return path.map((x) => ({ i: x, name: nodes[x].name, muts: nodes[x].muts.map((mu) => ({ token: mu.token, st: lastAt.get(keyOf(mu)) === mu ? state(mu, a) : 2, w: mu.w })) }));
  }

  // differences from the branch's expected sequence: rCRS, with the rCRS path undone back to the root and the branch path applied;
  // an indel on either path covers its flanks, where the sample's gaps and insertions are the branch's own
  /** @param {ReturnType<typeof prepare>} nodes @param {number} i @param {number} rcrsNode @param {string} ref @param {{ base: string[], ins: Record<number, string> }} a */
  function extras(nodes, i, rcrsNode, ref, a) {
    const expect = new Map(), zones = /** @type {[number, number][]} */ ([]);
    const zone = /** @param {any} mu */ (mu) => { if (mu.indel) zones.push([mu.p - FLANK, mu.end + FLANK]); };
    if (rcrsNode >= 0) for (const x of pathOf(nodes, rcrsNode).reverse()) for (const mu of nodes[x].muts) { zone(mu); if (!mu.indel && mu.from) expect.set(mu.p, mu.from); }
    for (const x of pathOf(nodes, i)) for (const mu of nodes[x].muts) { zone(mu); if (!mu.indel) expect.set(mu.p, mu.to); }
    const covered = /** @param {number} p */ (p) => noisy(p) || zones.some(([u, v]) => p >= u && p <= v);
    const out = [];
    for (let p = 1; p <= ref.length; p++) {
      const b = a.base[p], e = expect.has(p) ? expect.get(p) : ref[p - 1];
      if (noisy(p) || b === "N" || e === "N") continue;
      if (b === "-") { if (!covered(p)) out.push(e + p + "d"); continue; }
      if (BASES.test(b) && b !== e) out.push(e + p + b);
    }
    for (const [p, ins] of Object.entries(a.ins)) if (!covered(+p)) for (let k = 1; k <= ins.length; k++) out.push(p + "." + k + ins[k - 1]);
    return out.sort((u, v) => +(u.match(/\d+/) || [0])[0] - +(v.match(/\d+/) || [0])[0]);
  }

  /** @param {ReturnType<typeof prepare>} nodes @param {number} rcrsNode @param {string} ref RSRS: rCRS with the substitutions of its own path undone */
  function rsrsOf(nodes, rcrsNode, ref) {
    const out = ref.split("");
    if (rcrsNode >= 0) for (const x of pathOf(nodes, rcrsNode).reverse()) for (const mu of nodes[x].muts) if (!mu.indel && mu.from) out[mu.p - 1] = mu.from;
    return out.join("");
  }

  const HVR = [[16001, 16569], [1, 574]];
  const FULL_MIN = 10;
  const TOKEN = /^([ACGTRYKMSWBDHVN]?)(\d+)(?:-(\d+))?(?:\.(\d+))?([ACGTRYKMSWBDHVNacgtrykmswbdhvn]|d|del)$/;

  // a mutation list as FTDNA prints it (A16129G, 522.1A, C16189d) against RSRS, or against rCRS; FULL_MIN positions outside both HVRs make it a full list
  /** @param {string} text @param {string} ref @param {string} rsrs */
  function parseList(text, ref, rsrs) {
    const toks = String(text || "").split(/[\s,;]+/).map((t) => t.replace(/[()!*]/g, "")).filter(Boolean);
    /** @type {{ p: number, end: number, ins: number, from: string, to: string }[]} */
    const muts = [];
    let bad = 0;
    for (const t of toks) {
      const m = t.match(TOKEN);
      if (!m) { bad++; continue; }
      const p = +m[2], end = m[3] ? +m[3] : p, to = /^d/i.test(m[5]) && m[5] !== "D" ? "-" : m[5].toUpperCase();
      if (p < 1 || end > ref.length || end < p) { bad++; continue; }
      muts.push({ p, end, ins: m[4] ? +m[4] : 0, from: m[1].toUpperCase(), to });
    }
    if (!muts.length || bad > muts.length) return null;
    let vs = 0;
    for (const mu of muts) {
      const r = ref[mu.p - 1], s = rsrs[mu.p - 1];
      if (mu.ins || mu.to === "-" || r === s) continue;
      if (mu.from === s || (!mu.from && mu.to === r)) vs++;
      else if (mu.from === r || (!mu.from && mu.to === s)) vs--;
    }
    const onRsrs = vs >= 0, back = onRsrs ? rsrs : ref;
    const full = muts.filter((mu) => !HVR.some(([u, v]) => mu.p >= u && mu.end <= v)).length >= FULL_MIN;
    // only the HVRs the list touches were read: an HVR1 column alone says nothing about HVR2
    const read = HVR.filter(([u, v]) => muts.some((mu) => mu.p >= u && mu.end <= v));
    if (!full && !read.length) return null;
    const known = /** @param {number} p */ (p) => full || read.some(([u, v]) => p >= u && p <= v);
    const base = ["N"], ins = /** @type {Record<number, string>} */ ({});
    for (let p = 1; p <= ref.length; p++) base.push(known(p) ? back[p - 1] : "N");
    // RSRS lacks rCRS's 523–524, so FTDNA writes the usual AC there as 522.1A 522.2C
    if (onRsrs && known(523)) base[523] = base[524] = "-";
    for (const mu of muts.slice().sort((u, v) => u.p - v.p || u.ins - v.ins)) {
      if (mu.ins) { if (mu.to !== "-") ins[mu.p] = (ins[mu.p] || "") + mu.to; continue; }
      for (let x = mu.p; x <= mu.end; x++) base[x] = mu.to === "-" ? "-" : BASES.test(mu.to) ? mu.to : "N";
    }
    if (onRsrs && base[523] === "-" && base[524] === "-" && /^AC/.test(ins[522] || "")) { base[523] = "A"; base[524] = "C"; ins[522] = ins[522].slice(2); if (!ins[522]) delete ins[522]; }
    return { a: { base, ins, mismatches: muts.length, gaps: 0 }, full, onRsrs, count: muts.length, regions: read.map(([u]) => (u === HVR[0][0] ? "HVR1" : "HVR2")) };
  }

  // with much of the sequence unread many branches tie: the answer is the deepest branch holding 80 % of the weight e^(3·(score − best))
  /** @param {ReturnType<typeof prepare>} nodes @param {{ score: Float64Array }} r */
  function confident(nodes, r, lam = 3, share = 0.8) {
    let best = -Infinity;
    for (const s of r.score) if (s > best) best = s;
    const w = new Float64Array(nodes.length);
    for (let i = nodes.length - 1; i >= 0; i--) { w[i] += Math.exp(lam * (r.score[i] - best)); if (nodes[i].parent >= 0) w[nodes[i].parent] += w[i]; }
    let total = 0;
    for (const x of nodes) if (x.parent < 0) total += w[x.i];
    let at = nodes.find((x) => x.parent < 0 && w[x.i] >= share * total);
    if (!at) return -1;
    for (let k; (k = at.kids.find((c) => w[c] >= share * total)) != null;) at = nodes[k];
    return at.i;
  }

  return { MAX_LEN_DIFF, SKIP, parseFasta, align, parseMutation, state, prepare, classify, pathOf, explain, extras, rsrsOf, parseList, confident };
});
