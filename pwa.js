// Shared by all generator pages: style tabs, device-sized output, phone-friendly saving, offline support.

const PAGES = [
  ["index.html", "〰", "Waves"], ["shards.html", "◆", "Shards"], ["tiles.html", "⬢", "Tiles"], ["liquid.html", "◉", "Liquid"],
  ["blocks.html", "▦", "Blocks"], ["lattice.html", "⌗", "Lattice"], ["shells.html", "◐", "Shells"], ["satin.html", "≋", "Satin"],
];
{
  const tabs = document.querySelector(".tabs");
  const here = location.pathname.split("/").pop() || "index.html";
  if (tabs) tabs.innerHTML = PAGES.map(([href, icon, name]) =>
    `<a href="${href}"${href === here ? ' class="on"' : ""}>${icon} ${name}</a>`).join("");
}

const isPhone = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 900;
// iPadOS reports itself as a Mac, so also check for a touch screen.
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// iOS Safari refuses canvases over ~16.7 million pixels (it draws nothing and toBlob gives null).
const MAX_CANVAS_AREA = isIOS ? 16777216 : 268435456;

// Shrinks a size, keeping its aspect ratio, so it fits this browser's canvas limit.
function fitCanvasSize(w, h) {
  const k = Math.sqrt(MAX_CANVAS_AREA / (w * h));
  return k >= 1 ? [w, h] : [Math.floor(w * k), Math.floor(h * k)];
}

// Older Safari has no ctx.filter: setting it does nothing. Feature-test the prototype, not an instance.
const CANVAS_FILTER = typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;

// Runs draw() blurred by radius r (CSS px of blur, like filter: blur(r)). `color` is an opaque CSS colour the
// shape is painted in. Without ctx.filter it draws the shape off-canvas and lets its blurred shadow land in place.
function blurred(ctx, r, color, draw) {
  if (CANVAS_FILTER) { ctx.filter = `blur(${r}px)`; draw(); ctx.filter = "none"; return; }
  ctx.save();
  const m = ctx.getTransform(), off = ctx.canvas.width + ctx.canvas.height + 4 * r + 100;
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e - off, m.f);
  ctx.shadowColor = color; ctx.shadowBlur = 2 * r; ctx.shadowOffsetX = off; ctx.shadowOffsetY = 0;
  draw();
  ctx.restore();
}

// Physical pixel size of this screen. Phone wallpapers are portrait, whatever the current orientation.
function deviceSize() {
  const dpr = window.devicePixelRatio || 1;
  let w = Math.round(screen.width * dpr), h = Math.round(screen.height * dpr);
  if (isPhone && w > h) [w, h] = [h, w];
  return fitCanvasSize(Math.min(w, 8192), Math.min(h, 8192));
}

// Adds a "This device" entry to the size dropdown, selects it, and returns its size.
function setupDevicePreset(select) {
  const [w, h] = deviceSize();
  const opt = new Option(`This device (${w} × ${h})`, `${w}x${h}`);
  select.insertBefore(opt, select.firstChild);
  select.value = opt.value;
  return [w, h];
}

// Space inside the preview area, minus its padding.
function stageBox(stage) {
  const cs = getComputedStyle(stage);
  return [stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
          stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)];
}

// Desktop: plain download. Phones and all iOS devices (which can't save a download to Photos):
// a sheet with the image, a Share/Save button and long-press hint.
function saveImage(blob, filename) {
  if (!blob) { alert("The image couldn't be created — this device may not have enough memory. Try a smaller size."); return; }
  const url = URL.createObjectURL(blob);
  if (!isPhone && !isIOS) {
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File([blob], filename, { type: "image/png" });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const sheet = document.createElement("div");
  sheet.className = "save-sheet";
  sheet.innerHTML = `
    <div class="save-card">
      <img alt="Generated wallpaper">
      <div class="save-btns">
        ${canShare ? `<button class="primary" data-act="share">Save / Share…</button>` : ""}
        <button data-act="download">Download</button>
        <button data-act="close">Close</button>
      </div>
      <p class="save-hint">You can also long-press the image and choose <b>Save to Photos</b>.
        Then set it as your wallpaper in your device's settings.</p>
    </div>`;
  sheet.querySelector("img").src = url;
  const close = () => { sheet.remove(); URL.revokeObjectURL(url); };
  sheet.addEventListener("click", async e => {
    const act = e.target.dataset.act;
    if (e.target === sheet || act === "close") close();
    else if (act === "share") {
      try { await navigator.share({ files: [file], title: "Fluffee wallpaper" }); } catch (_) { /* user cancelled */ }
    } else if (act === "download") {
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    }
  });
  document.body.appendChild(sheet);
}

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
