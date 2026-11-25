# Optokinetic Trainer (`opk.billig.ca`)

A lightweight, GPU-accelerated (WebGL) optokinetic visual stimulus website designed for vestibular and gaze-stabilization exercises. It locks directly to your display's native refresh rate (**60Hz, 120Hz, 144Hz, or 240Hz**) with zero video compression artifacts.

## Features
- **Vertical Motion & Vertical Distortion** (Moving Up / Going Down) with a live **Distortion / Warp** slider (`0%` = crisp straight stripes, `>0%` = organic wave/perspective warp)
- **Additional Patterns:** Horizontal stripes, Checkerboard, and Radial Tunnel
- **Central Fixation Target:** Red dot, Green dot, Crosshair, or Off
- **Session Timer** & **Live FPS Readout**
- **TV & Keyboard Friendly:** Auto-hiding HUD, Fullscreen (`F`), Pause (`Space`), Flip Direction (`R`), Arrow keys for direction

## Live URL
- `https://opk.billig.ca` (hosted via GitHub Pages on `cbillig/optokinetic-trainer`)

## Local Preview
Double-click `index.html` to open it directly in Chrome/Edge/Safari, or serve it over local Wi-Fi:
```bash
python -m http.server 8000
```
