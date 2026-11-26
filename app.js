(() => {
  'use strict';

  const canvas = document.getElementById('glCanvas');
  const fixationTarget = document.getElementById('fixationTarget');
  const statusBadge = document.getElementById('statusBadge');
  const fpsReadout = document.getElementById('fpsReadout');
  const timerReadout = document.getElementById('timerReadout');
  const pauseBanner = document.getElementById('pauseBanner');
  const controlPanel = document.getElementById('controlPanel');
  const showHudBtn = document.getElementById('showHudBtn');

  const playPauseBtn = document.getElementById('playPauseBtn');
  const reverseBtn = document.getElementById('reverseBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const hideHudBtn = document.getElementById('hideHudBtn');

  const stopwatchReadout = document.getElementById('stopwatchReadout');
  const stopwatchStartStopBtn = document.getElementById('stopwatchStartStopBtn');
  const stopwatchResetBtn = document.getElementById('stopwatchResetBtn');
  const topPlayPauseBtn = document.getElementById('topPlayPauseBtn');

  const patternSelect = document.getElementById('patternSelect');
  const directionSelect = document.getElementById('directionSelect');
  const speedRange = document.getElementById('speedRange');
  const speedVal = document.getElementById('speedVal');
  const densityRange = document.getElementById('densityRange');
  const densityVal = document.getElementById('densityVal');
  const distortionRange = document.getElementById('distortionRange');
  const distortionVal = document.getElementById('distortionVal');
  const themeSelect = document.getElementById('themeSelect');
  const targetSelect = document.getElementById('targetSelect');
  const timerSelect = document.getElementById('timerSelect');
  const autoHideCheck = document.getElementById('autoHideCheck');
  const showFpsCheck = document.getElementById('showFpsCheck');
  const presetButtons = Array.from(document.querySelectorAll('.chip[data-preset]'));

  const THEMES = {
    bw:    { c1: [0.02, 0.02, 0.02], c2: [0.98, 0.98, 0.98] },
    soft:  { c1: [0.22, 0.24, 0.27], c2: [0.76, 0.78, 0.81] },
    rw:    { c1: [0.85, 0.08, 0.12], c2: [0.98, 0.98, 0.98] },
    by:    { c1: [0.08, 0.36, 0.88], c2: [0.98, 0.98, 0.98] },
    amber: { c1: [0.07, 0.05, 0.02], c2: [0.95, 0.68, 0.22] },
  };

  const PRESETS = {
    'vertical-up':      { pattern: 'stripes', direction: 'up',    speed: 1.8, density: 10, distortion: 0  },
    'vertical-down':    { pattern: 'stripes', direction: 'down',  speed: 1.8, density: 10, distortion: 0  },
    'distortion-up':    { pattern: 'stripes', direction: 'up',    speed: 1.6, density: 11, distortion: 45 },
    'distortion-down':  { pattern: 'stripes', direction: 'down',  speed: 1.6, density: 11, distortion: 45 },
    'horizontal-right': { pattern: 'stripes', direction: 'right', speed: 1.8, density: 12, distortion: 0  },
    'checker-up':       { pattern: 'checker', direction: 'up',    speed: 1.4, density: 8,  distortion: 25 },
  };

  const state = {
    running: false,
    pattern: 'stripes',
    direction: 'up',
    speed: 1.8,
    density: 10,
    distortion: 0,
    theme: 'bw',
    target: 'red-dot',
    timerDuration: 0,
    timerRemaining: 0,
    stopwatchRunning: false,
    stopwatchElapsed: 0,
    phase: 0,
    elapsed: 0,
    hudHidden: false,
    autoHide: true,
    showFps: true,
  };

  // --- WebGL Setup (with Canvas2D fallback) ---
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });

  let useWebGL = Boolean(gl);
  let ctx2d = null;
  let glUniforms = null;

  if (useWebGL) {
    const vertSrc = `
      attribute vec2 a_pos;
      void main() {
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `;

    const fragSrc = `
      precision highp float;
      uniform vec2 u_res;
      uniform float u_phase;
      uniform float u_time;
      uniform float u_density;
      uniform float u_distortion;
      uniform int u_pattern;   // 0 = stripes, 1 = checker, 2 = radial
      uniform int u_dir;       // 0 = up, 1 = down, 2 = right, 3 = left
      uniform vec3 u_c1;
      uniform vec3 u_c2;

      const float PI = 3.14159265359;

      void main() {
        vec2 uv = gl_FragCoord.xy / u_res;
        float aspect = u_res.x / max(u_res.y, 1.0);
        vec2 p = uv;

        // Smooth organic wave distortion (0.0 -> perfectly straight)
        float dist = u_distortion;
        if (dist > 0.001) {
          float wave1 = sin(p.x * 2.0 * PI * 2.0 + u_time * 1.1) * 0.055 * dist;
          float wave2 = sin(p.x * 2.0 * PI * 4.5 - u_time * 0.7) * 0.025 * dist;
          float waveY1 = sin(p.y * 2.0 * PI * 2.0 + u_time * 1.1) * 0.055 * dist;
          float waveY2 = sin(p.y * 2.0 * PI * 4.5 - u_time * 0.7) * 0.025 * dist;

          // Subtle radial perspective bulge when distortion is active
          vec2 centered = (p - 0.5) * vec2(aspect, 1.0);
          float r2 = dot(centered, centered);
          vec2 bulge = centered * (r2 * 0.28 * dist);

          if (u_dir == 0 || u_dir == 1) {
            p.y += wave1 + wave2 + bulge.y;
            p.x += bulge.x * 0.5;
          } else {
            p.x += waveY1 + waveY2 + bulge.x;
            p.y += bulge.y * 0.5;
          }
        }

        float v = 0.0;
        float edge = 0.04;

        if (u_pattern == 0) {
          // Stripes
          float coord = 0.0;
          if (u_dir == 0) coord = (1.0 - p.y) * u_density + u_phase;      // moving up
          else if (u_dir == 1) coord = (1.0 - p.y) * u_density - u_phase; // going down
          else if (u_dir == 2) coord = (p.x * aspect) * u_density - u_phase; // left to right
          else coord = (p.x * aspect) * u_density + u_phase;              // right to left

          float s = sin(coord * 2.0 * PI);
          v = smoothstep(-edge, edge, s);
        } else if (u_pattern == 1) {
          // Checkerboard
          float xCoord = (p.x * aspect) * u_density;
          float yCoord = (1.0 - p.y) * u_density;
          if (u_dir == 0) yCoord += u_phase;
          else if (u_dir == 1) yCoord -= u_phase;
          else if (u_dir == 2) xCoord -= u_phase;
          else xCoord += u_phase;

          float sx = sin(xCoord * 2.0 * PI);
          float sy = sin(yCoord * 2.0 * PI);
          v = smoothstep(-edge, edge, sx * sy);
        } else {
          // Radial tunnel
          vec2 c = (p - 0.5) * vec2(aspect, 1.0);
          float r = length(c) * u_density * 1.4;
          float dirSign = (u_dir == 0 || u_dir == 2) ? -1.0 : 1.0;
          float s = sin((r + dirSign * u_phase) * 2.0 * PI);
          v = smoothstep(-edge, edge, s);
        }

        vec3 col = mix(u_c1, u_c2, v);
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }

    const vs = compile(gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);

    if (vs && fs) {
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
          gl.STATIC_DRAW
        );
        const loc = gl.getAttribLocation(prog, 'a_pos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        glUniforms = {
          res: gl.getUniformLocation(prog, 'u_res'),
          phase: gl.getUniformLocation(prog, 'u_phase'),
          time: gl.getUniformLocation(prog, 'u_time'),
          density: gl.getUniformLocation(prog, 'u_density'),
          distortion: gl.getUniformLocation(prog, 'u_distortion'),
          pattern: gl.getUniformLocation(prog, 'u_pattern'),
          dir: gl.getUniformLocation(prog, 'u_dir'),
          c1: gl.getUniformLocation(prog, 'u_c1'),
          c2: gl.getUniformLocation(prog, 'u_c2'),
        };
      } else {
        useWebGL = false;
      }
    } else {
      useWebGL = false;
    }
  }

  if (!useWebGL) {
    ctx2d = canvas.getContext('2d', { alpha: false });
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(window.innerWidth * dpr));
    const h = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      if (useWebGL) {
        gl.viewport(0, 0, w, h);
      }
    }
  }

  window.addEventListener('resize', resize);
  resize();

  // --- UI Synchronization ---
  function updateTargetVisual() {
    fixationTarget.className = `fixation-target ${state.target}`;
  }

  // --- Screen Wake Lock (prevents phone/tablet from dimming during sessions) ---
  let wakeLock = null;

  async function syncWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      if (state.running && document.visibilityState === 'visible') {
        if (!wakeLock) {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release', () => { wakeLock = null; });
        }
      } else if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (_) {
      // Ignore if browser/OS rejects wake lock
    }
  }

  document.addEventListener('visibilitychange', syncWakeLock);

  // Register Service Worker for offline PWA support
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  function updatePauseVisual() {
    playPauseBtn.textContent = state.running ? 'Pause' : 'Play';
    topPlayPauseBtn.textContent = state.running ? 'Pause' : 'Start';
    topPlayPauseBtn.classList.toggle('sw-btn-pause', state.running);
    topPlayPauseBtn.classList.toggle('sw-btn-start', !state.running);
    pauseBanner.classList.toggle('hidden', state.running);
    syncWakeLock();
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  function updateTimerDisplay() {
    if (state.timerDuration > 0) {
      timerReadout.classList.remove('hidden');
      timerReadout.textContent = formatTime(state.timerRemaining);
    } else {
      timerReadout.classList.add('hidden');
    }
  }

  function updateStatusBadgeVisibility() {
    const showAnything = state.showFps || state.timerDuration > 0;
    statusBadge.classList.toggle('hidden', !showAnything);
    fpsReadout.classList.toggle('hidden', !state.showFps);
  }

  function syncControlsFromState() {
    patternSelect.value = state.pattern;
    directionSelect.value = state.direction;
    speedRange.value = String(state.speed);
    speedVal.textContent = state.speed.toFixed(1);
    densityRange.value = String(state.density);
    densityVal.textContent = String(state.density);
    distortionRange.value = String(state.distortion);
    distortionVal.textContent = `${state.distortion}%`;
    themeSelect.value = state.theme;
    targetSelect.value = state.target;
    updateTargetVisual();
    updatePauseVisual();
    updateTimerDisplay();
    updateStatusBadgeVisibility();
  }

  function clearActivePreset() {
    presetButtons.forEach((btn) => btn.classList.remove('active'));
  }

  function applyPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    state.pattern = p.pattern;
    state.direction = p.direction;
    state.speed = p.speed;
    state.density = p.density;
    state.distortion = p.distortion;
    presetButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.preset === key));
    syncControlsFromState();
  }

  function flipDirection() {
    const map = { up: 'down', down: 'up', left: 'right', right: 'left' };
    state.direction = map[state.direction] || 'up';
    clearActivePreset();
    syncControlsFromState();
  }

  // --- Auto-Hide HUD ---
  let idleTimer = null;

  function setHudHidden(hidden) {
    state.hudHidden = hidden;
    controlPanel.classList.toggle('hud-hidden', hidden);
    showHudBtn.classList.toggle('hidden', !hidden);
    document.body.classList.toggle('cursor-hidden', hidden && state.running);
  }

  function scheduleAutoHide() {
    clearTimeout(idleTimer);
    if (!state.autoHide || !state.running) return;
    idleTimer = setTimeout(() => {
      if (!controlPanel.matches(':hover')) {
        setHudHidden(true);
      }
    }, 3500);
  }

  function wakeHud(e) {
    if (e && e.target && e.target.closest && e.target.closest('#stopwatchBar, #motionBar, #showHudBtn')) {
      return;
    }
    if (state.hudHidden) {
      setHudHidden(false);
    }
    scheduleAutoHide();
  }

  window.addEventListener('mousemove', wakeHud, { passive: true });
  window.addEventListener('touchstart', wakeHud, { passive: true });
  controlPanel.addEventListener('mouseenter', () => clearTimeout(idleTimer));
  controlPanel.addEventListener('mouseleave', scheduleAutoHide);

  function toggleMovement(affectHud) {
    state.running = !state.running;
    if (state.running && state.timerDuration > 0 && state.timerRemaining <= 0) {
      state.timerRemaining = state.timerDuration;
    }
    updatePauseVisual();
    if (affectHud) {
      scheduleAutoHide();
    } else if (state.hudHidden) {
      document.body.classList.toggle('cursor-hidden', state.running);
    }
  }

  topPlayPauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMovement(false);
  });

  function formatStopwatch(sec) {
    const total = Math.floor(Math.max(0, sec));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateStopwatchUI() {
    stopwatchReadout.textContent = formatStopwatch(state.stopwatchElapsed);
    if (state.stopwatchRunning) {
      stopwatchStartStopBtn.textContent = 'Stop';
      stopwatchStartStopBtn.classList.remove('sw-btn-start');
      stopwatchStartStopBtn.classList.add('sw-btn-stop');
    } else {
      stopwatchStartStopBtn.textContent = state.stopwatchElapsed > 0 ? 'Resume' : 'Start Timer';
      stopwatchStartStopBtn.classList.remove('sw-btn-stop');
      stopwatchStartStopBtn.classList.add('sw-btn-start');
    }
  }

  stopwatchStartStopBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.stopwatchRunning = !state.stopwatchRunning;
    updateStopwatchUI();
  });

  stopwatchResetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.stopwatchRunning = false;
    state.stopwatchElapsed = 0;
    updateStopwatchUI();
  });

  // --- Event Listeners ---
  playPauseBtn.addEventListener('click', () => {
    toggleMovement(true);
  });

  reverseBtn.addEventListener('click', flipDirection);

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  hideHudBtn.addEventListener('click', () => setHudHidden(true));
  showHudBtn.addEventListener('click', () => {
    setHudHidden(false);
    scheduleAutoHide();
  });

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  patternSelect.addEventListener('change', () => {
    state.pattern = patternSelect.value;
    clearActivePreset();
  });

  directionSelect.addEventListener('change', () => {
    state.direction = directionSelect.value;
    clearActivePreset();
  });

  speedRange.addEventListener('input', () => {
    state.speed = parseFloat(speedRange.value);
    speedVal.textContent = state.speed.toFixed(1);
    clearActivePreset();
  });

  densityRange.addEventListener('input', () => {
    state.density = parseInt(densityRange.value, 10);
    densityVal.textContent = String(state.density);
    clearActivePreset();
  });

  distortionRange.addEventListener('input', () => {
    state.distortion = parseInt(distortionRange.value, 10);
    distortionVal.textContent = `${state.distortion}%`;
    clearActivePreset();
  });

  themeSelect.addEventListener('change', () => {
    state.theme = themeSelect.value;
  });

  targetSelect.addEventListener('change', () => {
    state.target = targetSelect.value;
    updateTargetVisual();
  });

  timerSelect.addEventListener('change', () => {
    state.timerDuration = parseInt(timerSelect.value, 10);
    state.timerRemaining = state.timerDuration;
    updateTimerDisplay();
    updateStatusBadgeVisibility();
  });

  autoHideCheck.addEventListener('change', () => {
    state.autoHide = autoHideCheck.checked;
    if (state.autoHide) scheduleAutoHide();
    else clearTimeout(idleTimer);
  });

  showFpsCheck.addEventListener('change', () => {
    state.showFps = showFpsCheck.checked;
    updateStatusBadgeVisibility();
  });

  // Keyboard & TV Remote Controls
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }

    switch (e.key) {
      case ' ':
      case 'MediaPlayPause':
        e.preventDefault();
        playPauseBtn.click();
        break;
      case 'r':
      case 'R':
        flipDirection();
        break;
      case 'f':
      case 'F':
        fullscreenBtn.click();
        break;
      case 'h':
      case 'H':
        setHudHidden(!state.hudHidden);
        break;
      case 'ArrowUp':
        state.direction = 'up';
        clearActivePreset();
        syncControlsFromState();
        break;
      case 'ArrowDown':
        state.direction = 'down';
        clearActivePreset();
        syncControlsFromState();
        break;
      case 'ArrowLeft':
        state.direction = 'left';
        clearActivePreset();
        syncControlsFromState();
        break;
      case 'ArrowRight':
        state.direction = 'right';
        clearActivePreset();
        syncControlsFromState();
        break;
      default:
        break;
    }
  });

  // --- Render Loop (Locks to Native Monitor Refresh Rate: 60Hz / 120Hz / 144Hz / 240Hz) ---
  let lastNow = performance.now();
  let fpsFrames = 0;
  let fpsLastCheck = lastNow;

  function renderWebGL() {
    const theme = THEMES[state.theme] || THEMES.bw;
    const patIdx = state.pattern === 'stripes' ? 0 : state.pattern === 'checker' ? 1 : 2;
    const dirIdx = state.direction === 'up' ? 0 : state.direction === 'down' ? 1 : state.direction === 'right' ? 2 : 3;

    gl.uniform2f(glUniforms.res, canvas.width, canvas.height);
    gl.uniform1f(glUniforms.phase, state.phase);
    gl.uniform1f(glUniforms.time, state.elapsed);
    gl.uniform1f(glUniforms.density, state.density);
    gl.uniform1f(glUniforms.distortion, state.distortion / 100);
    gl.uniform1i(glUniforms.pattern, patIdx);
    gl.uniform1i(glUniforms.dir, dirIdx);
    gl.uniform3fv(glUniforms.c1, theme.c1);
    gl.uniform3fv(glUniforms.c2, theme.c2);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function renderCanvas2D() {
    const theme = THEMES[state.theme] || THEMES.bw;
    const toCss = (c) => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
    const c1 = toCss(theme.c1);
    const c2 = toCss(theme.c2);
    const w = canvas.width;
    const h = canvas.height;

    ctx2d.fillStyle = c1;
    ctx2d.fillRect(0, 0, w, h);
    ctx2d.fillStyle = c2;

    const vertical = state.direction === 'up' || state.direction === 'down';
    const size = (vertical ? h : w) / state.density;
    const sign = (state.direction === 'up' || state.direction === 'left') ? -1 : 1;
    const offset = (((state.phase * size * sign) % size) + size) % size;

    if (vertical) {
      for (let y = offset - size; y < h + size; y += size) {
        ctx2d.fillRect(0, y, w, size * 0.5);
      }
    } else {
      for (let x = offset - size; x < w + size; x += size) {
        ctx2d.fillRect(x, 0, size * 0.5, h);
      }
    }
  }

  function frame(now) {
    const dt = Math.min((now - lastNow) / 1000, 0.1);
    lastNow = now;

    // Measure actual live FPS
    fpsFrames++;
    if (now - fpsLastCheck >= 500) {
      const measured = Math.round((fpsFrames * 1000) / (now - fpsLastCheck));
      fpsReadout.textContent = `${measured} FPS`;
      fpsFrames = 0;
      fpsLastCheck = now;
    }

    if (state.stopwatchRunning) {
      state.stopwatchElapsed += dt;
      stopwatchReadout.textContent = formatStopwatch(state.stopwatchElapsed);
    }

    if (state.running) {
      state.phase = (state.phase + state.speed * dt) % 1000;
      state.elapsed += dt;

      if (state.timerDuration > 0) {
        state.timerRemaining -= dt;
        if (state.timerRemaining <= 0) {
          state.timerRemaining = 0;
          state.running = false;
          updatePauseVisual();
          setHudHidden(false);
        }
        updateTimerDisplay();
      }
    }

    if (useWebGL) renderWebGL();
    else renderCanvas2D();

    requestAnimationFrame(frame);
  }

  syncControlsFromState();
  scheduleAutoHide();
  requestAnimationFrame(frame);
})();
