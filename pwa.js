// Shared by both generator pages: device-sized output, phone-friendly saving, offline support.

const isPhone = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 900;

// Physical pixel size of this screen. Phone wallpapers are portrait, whatever the current orientation.
function deviceSize() {
  const dpr = window.devicePixelRatio || 1;
  let w = Math.round(screen.width * dpr), h = Math.round(screen.height * dpr);
  if (isPhone && w > h) [w, h] = [h, w];
  return [Math.min(w, 8192), Math.min(h, 8192)];
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

// Desktop: plain download. Phone: a sheet with the image, a Share/Save button and long-press hint.
function saveImage(blob, filename) {
  const url = URL.createObjectURL(blob);
  if (!isPhone) {
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
        Then set it as your wallpaper in your phone's settings.</p>
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
