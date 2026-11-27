# Fluffee Wallpapers

Wallpaper generators that run in the browser, with no install and no dependencies. Switch between them with the tabs at the top of the panel.

| Page | Style |
|---|---|
| `index.html` (Waves) | Silky, soft-lit waves and pastel gradients (WebGL) |
| `shards.html` (Shards) | Dark low-poly crystal blades with neon glowing edges (Canvas 2D) |
| `tiles.html` (Tiles) | 3D grey stone tiles with side walls and shadows, under a neon graphics layer of bars, lines, dot grids, dashes and ticks (Canvas 2D) |

## Use

Double-click `index.html` (or `shards.html` / `tiles.html`) to open it in any modern browser. Both pages share the same layout:

- **🎲 Randomize** (or `Space`) picks a random palette, seed and wave settings.
- **Seed** sets the wave shapes. The same seed with the same settings gives the same image.
- **Palette** offers presets. You can also pick your own 5 colors: glow, sky, and three wave colors.
- **Waves** sliders control layer count, amplitude, frequency, tilt, roundness, sheen, satin lines, shadows, depth blur, haze, light angle, color flow and grain.
- **Output** has size presets (FHD, QHD, 4K, 5K, ultrawide, phone, square) or a custom size up to 8192 px.
- **⬇ Save PNG** (or `S`) renders at full output resolution and downloads the file.
- **Animate preview** (or `A`, Waves only) makes the waves drift slowly. Saving captures the current frame.

Shards has its own sliders: shard count, direction, chaos, length, thickness, how many shards glow, glow size, lit faces, streaks, hollow frames, facet contrast, edge sheen, depth blur, ambient glow, light angle and grain. Its palettes are Crimson, Cyber Blue, Toxic, Gold, Violet, Magenta, Ember, Ice, Mono and Daylight.

Tiles has two groups of sliders. **Tiles:** count, irregularity, relief (height), face tilt, gap, edge sheen, shadows and light angle. **Graphics:** amount, direction, number of bands, band spread, bar size, opacity, dots & ticks, glow and grain. Its palettes are Cyan, Lime, Orange, Hot Pink, Violet, Gold, Red, Mint, Graphite and Concrete.

Waves renders on the GPU with a WebGL shader. Shards draws with Canvas 2D, and a 4K export takes about half a second.

## Phone app (PWA)

The output size defaults to **This device**, the exact pixel size of the screen you open it on. On phones it's always portrait. On a phone the layout stacks, with the preview pinned at the top. **Save PNG** opens a sheet where you can **Save / Share** (to Photos and other apps) or long-press the image to save it. Then set it as your wallpaper in the phone's settings; browsers can't set wallpapers themselves.

To install it as an app, it has to be served over **HTTPS**:

1. Host the folder anywhere static, such as GitHub Pages, Netlify or Cloudflare Pages.
2. Open the URL on the phone:
   - **Android (Chrome):** ⋮ menu → *Install app*.
   - **iPhone (Safari):** Share → *Add to Home Screen*.
3. It then opens full screen like a native app and works offline. The service worker in `sw.js` caches the files.

For a quick test on your home Wi-Fi, run `python -m http.server 8765` in this folder and open `http://<your-PC-IP>:8765` on the phone. That works in the phone's browser, but plain HTTP can't be installed or run offline.

Files: `manifest.webmanifest` (app info), `sw.js` (offline cache), `pwa.js` + `common.css` (shared phone code), and `icons/`.
