// Shared harness for the newer generator pages: builds the side panel and wires palettes, sliders,
// seed, output size, randomize and save. A page only supplies its palettes, sliders and renderer.
//
// Studio.create({
//   file: "liquid", sub: "…", colorHint: "A · B · C",
//   palettes: { Name: ["#hex", …] }, seed: 1,
//   groups: [["Group title", [[key, label, min, max, step, default], …]], …],
//   render(ctx, W, H, S)          // Canvas 2D pages
//   webgl: true, init(gl) => (W, H, S) => {…}   // WebGL pages
//   randomize(lerp, r) => ({ key: value, … })
// })

const Studio = (() => {
  const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hexToRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const rgba = (c, a = 1) => `rgba(${clamp(c[0], 0, 255) | 0},${clamp(c[1], 0, 255) | 0},${clamp(c[2], 0, 255) | 0},${a})`;

  let noiseCanvas = null;
  function noise() {
    if (noiseCanvas) return noiseCanvas;
    noiseCanvas = document.createElement("canvas");
    noiseCanvas.width = noiseCanvas.height = 256;
    const nctx = noiseCanvas.getContext("2d"), img = nctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    nctx.putImageData(img, 0, 0);
    return noiseCanvas;
  }

  // Vignette plus film grain, the last step of every 2D render.
  function finish(ctx, W, H, vignette, grain) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.filter = "none"; ctx.shadowBlur = 0;
    if (vignette > 0) {
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${vignette})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    if (grain > 0) {
      ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = grain * 0.35;
      ctx.fillStyle = ctx.createPattern(noise(), "repeat"); ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    }
  }

  // Keep the part of a convex polygon where dot(p, n) <= c.
  function clipHalf(poly, n, c) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = a[0] * n[0] + a[1] * n[1] - c, db = b[0] * n[0] + b[1] * n[1] - c;
      if (da <= 0) out.push(a);
      if ((da < 0) !== (db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }

  // Adds a convex polygon with rounded corners (radius r, shrunk where edges are too short) to a path.
  function roundPoly(path, pts, r, dx = 0, dy = 0) {
    const n = pts.length;
    for (let i = 0; i <= n; i++) {
      const p0 = pts[(i + n - 1) % n], p1 = pts[i % n], p2 = pts[(i + 1) % n];
      const ax = p0[0] - p1[0], ay = p0[1] - p1[1], bx = p2[0] - p1[0], by = p2[1] - p1[1];
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      const cos = clamp((ax * bx + ay * by) / (la * lb || 1), -1, 1), half = Math.acos(cos) / 2;
      const rr = Math.max(0, Math.min(r, Math.min(la, lb) * 0.5 * Math.tan(half)));
      if (i === 0) path.moveTo((p0[0] + p1[0]) / 2 + dx, (p0[1] + p1[1]) / 2 + dy);
      else path.arcTo(p1[0] + dx, p1[1] + dy, p2[0] + dx, p2[1] + dy, rr);
    }
    path.closePath();
  }

  // Full-screen triangle with the given fragment shader; returns a cached uniform lookup.
  function glProgram(gl, fs) {
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }"));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const cache = {};
    return name => name in cache ? cache[name] : (cache[name] = gl.getUniformLocation(prog, name));
  }

  const GLSL_NOISE = `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++){ v += a * vnoise(p); p = m * p; a *= .5; } return v; }`;

  function create(cfg) {
    const $ = id => document.getElementById(id);
    const sizes = [["1920x1080", "1920 × 1080 (FHD)"], ["2560x1440", "2560 × 1440 (QHD)"], ["3840x2160", "3840 × 2160 (4K)"],
      ["3440x1440", "3440 × 1440 (Ultrawide)"], ["5120x2880", "5120 × 2880 (5K)"], ["1170x2532", "1170 × 2532 (Phone)"],
      ["1440x3200", "1440 × 3200 (Phone tall)"], ["2048x2048", "2048 × 2048 (Square)"], ["custom", "Custom…"]];
    document.querySelector("aside").insertAdjacentHTML("beforeend", `
      <h1>Fluffee Wallpapers</h1>
      <p class="sub">${cfg.sub}</p>
      <div class="btns">
        <button class="primary" id="randomize">🎲 Randomize</button>
        <button id="download">⬇ Save PNG</button>
      </div>
      <div class="row" style="margin-top:10px">
        <label>Seed</label>
        <input type="number" id="seed" style="flex:1">
        <button id="newSeed" title="New seed, keep everything else">↻</button>
      </div>
      <h2>Colors</h2>
      <div class="row"><label>Palette</label><select id="palette"></select></div>
      <div class="swatches" id="swatches"></div>
      <div class="hint">${cfg.colorHint}</div>
      ${cfg.groups.map(([title], i) => `<h2>${title}</h2><div id="sliders-${i}"></div>`).join("")}
      <h2>Output</h2>
      <div class="row"><label>Size</label><select id="preset">
        ${sizes.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}
      </select></div>
      <div class="res">
        <input type="number" id="w" min="64" max="8192"> ×
        <input type="number" id="h" min="64" max="8192">
      </div>
      <div class="hint keys">Shortcuts: <b>Space</b> randomize · <b>S</b> save</div>`);

    const names = Object.keys(cfg.palettes);
    const S = { seed: cfg.seed ?? 1, palette: names[0], colors: [...cfg.palettes[names[0]]], w: 3840, h: 2160 };
    const sliders = cfg.groups.flatMap(g => g[1]);
    sliders.forEach(([k, , , , , v]) => S[k] = v);

    // ---------- Rendering ----------
    const canvas = $("c");
    let paint;
    if (cfg.webgl) {
      const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false });
      if (!gl) { document.body.innerHTML = "<p style='padding:40px'>WebGL is not available in this browser.</p>"; return; }
      const glRender = cfg.init(gl);
      paint = (W, H) => { gl.viewport(0, 0, W, H); glRender(W, H, S); };
    } else {
      const ctx = canvas.getContext("2d");
      paint = (W, H) => cfg.render(ctx, W, H, S);
    }

    function draw() {
      const [maxW, maxH] = stageBox($("stage"));
      const sc = Math.min(maxW / S.w, maxH / S.h);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = Math.round(S.w * sc) + "px";
      canvas.style.height = Math.round(S.h * sc) + "px";
      canvas.width = Math.max(1, Math.round(S.w * sc * dpr));
      canvas.height = Math.max(1, Math.round(S.h * sc * dpr));
      paint(canvas.width, canvas.height);
    }
    let pending = false;
    const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; draw(); }); } };

    // ---------- UI ----------
    const fmt = (v, step) => step >= 1 ? String(Math.round(v)) : v.toFixed(2);
    const sliderEls = {};
    cfg.groups.forEach(([, list], gi) => list.forEach(([key, label, min, max, step]) => {
      const row = document.createElement("div"); row.className = "row";
      row.innerHTML = `<label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
      const input = row.querySelector("input"), out = row.querySelector("output");
      input.addEventListener("input", () => { S[key] = +input.value; out.textContent = fmt(+input.value, step); schedule(); });
      sliderEls[key] = { input, out, step };
      $("sliders-" + gi).appendChild(row);
    }));

    names.forEach(name => $("palette").add(new Option(name, name)));
    $("palette").add(new Option("Custom", "Custom"));
    const colorEls = S.colors.map((_, i) => {
      const el = document.createElement("input"); el.type = "color";
      el.addEventListener("input", () => { S.colors[i] = el.value; S.palette = "Custom"; $("palette").value = "Custom"; schedule(); });
      $("swatches").appendChild(el); return el;
    });

    function syncUI() {
      sliders.forEach(([k]) => { const s = sliderEls[k]; s.input.value = S[k]; s.out.textContent = fmt(S[k], s.step); });
      colorEls.forEach((el, i) => el.value = S.colors[i]);
      $("palette").value = S.palette;
      $("seed").value = S.seed;
      $("w").value = S.w; $("h").value = S.h;
    }

    $("palette").addEventListener("change", e => {
      if (cfg.palettes[e.target.value]) { S.palette = e.target.value; S.colors = [...cfg.palettes[S.palette]]; syncUI(); schedule(); }
    });
    $("seed").addEventListener("input", e => { S.seed = (+e.target.value) | 0; schedule(); });
    $("newSeed").addEventListener("click", () => { S.seed = (Math.random() * 1e6) | 0; syncUI(); schedule(); });
    $("preset").addEventListener("change", e => {
      if (e.target.value === "custom") return;
      const [w, h] = e.target.value.split("x").map(Number); S.w = w; S.h = h; syncUI(); schedule();
    });
    ["w", "h"].forEach(id => $(id).addEventListener("change", e => {
      S[id] = Math.max(64, Math.min(8192, (+e.target.value) | 0)); $("preset").value = "custom"; syncUI(); schedule();
    }));

    function randomize() {
      const r = Math.random, lerp = (a, b) => a + (b - a) * r();
      S.seed = (r() * 1e6) | 0;
      S.palette = names[(r() * names.length) | 0];
      S.colors = [...cfg.palettes[S.palette]];
      const next = cfg.randomize(lerp, r);
      sliders.forEach(([k, , , , step]) => { if (k in next) S[k] = step >= 1 ? Math.round(next[k]) : next[k]; });
      syncUI(); schedule();
    }
    $("randomize").addEventListener("click", randomize);

    function download() {
      const name = `fluffee-${cfg.file}-${S.palette.toLowerCase().replace(/\s+/g, "-")}-${S.seed}-${S.w}x${S.h}.png`;
      if (cfg.webgl) {
        canvas.width = S.w; canvas.height = S.h; paint(S.w, S.h);
        canvas.toBlob(blob => { saveImage(blob, name); draw(); }, "image/png");
      } else {
        const out = document.createElement("canvas");
        out.width = S.w; out.height = S.h;
        cfg.render(out.getContext("2d"), S.w, S.h, S);
        out.toBlob(blob => saveImage(blob, name), "image/png");
      }
    }
    $("download").addEventListener("click", download);

    window.addEventListener("keydown", e => {
      if (e.target.tagName === "INPUT" && e.target.type !== "range") return;
      if (e.code === "Space") { e.preventDefault(); randomize(); }
      else if (e.key === "s") download();
    });
    window.addEventListener("resize", schedule);

    [S.w, S.h] = setupDevicePreset($("preset"));
    syncUI(); draw();
  }

  return { create, rng, hexToRgb, clamp, mixc, rgba, finish, clipHalf, roundPoly, glProgram, GLSL_NOISE };
})();
