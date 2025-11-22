(() => {
  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  const toolToggle = document.getElementById('toolToggle');
  const clearBtn = document.getElementById('clearBtn');
  const thickness = document.getElementById('thickness');

  let drawing = false;
  let last = { x: 0, y: 0 };
  let tool = 'pen'; // 'pen' or 'eraser'
  // remember thickness separately for pen and eraser
  let penThickness = parseFloat(thickness.value) || 6;
  let eraserThickness = 20;

  function fitCanvasToWindow() {
    // preserve content during resize by copying to an offscreen image
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width === w && canvas.height === h) return;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = w;
    canvas.height = h;
    // fill black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
      ctx.putImageData(img, 0, 0);
    } catch (e) {
      // if putImageData fails (different sizes), ignore and continue with blank canvas
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function setTool(newTool) {
    tool = newTool;
    toolToggle.textContent = tool === 'pen' ? 'ペン' : '消しゴム';
    toolToggle.setAttribute('aria-pressed', tool === 'eraser');
    if (tool === 'pen') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#fff';
      thickness.value = penThickness;
      ctx.lineWidth = penThickness;
    } else {
      // Eraser will remove strokes: use destination-out for true erasing
      ctx.globalCompositeOperation = 'destination-out';
      // color doesn't matter in destination-out; lineWidth matters
      thickness.value = eraserThickness;
      ctx.lineWidth = eraserThickness;
    }
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX || e.touches?.[0]?.clientX) - rect.left,
      y: (e.clientY || e.touches?.[0]?.clientY) - rect.top
    };
  }

  function pointerDown(e) {
    e.preventDefault();
    drawing = true;
    const p = pointerPos(e);
    last.x = p.x; last.y = p.y;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    // ensure lineWidth reflects the current tool's remembered thickness
    ctx.lineWidth = parseFloat(thickness.value);
  }

  function pointerMove(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pointerPos(e);
    ctx.lineWidth = parseFloat(thickness.value);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.x = p.x; last.y = p.y;
  }

  function pointerUp(e) {
    if (!drawing) return;
    drawing = false;
    ctx.closePath();
  }

  // wire up events
  window.addEventListener('resize', fitCanvasToWindow);
  fitCanvasToWindow();

  // default tool
  setTool('pen');

  // pointer events (works for mouse + touch)
  canvas.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);

  // Also support touch events for older browsers
  canvas.addEventListener('touchstart', pointerDown, { passive: false });
  window.addEventListener('touchmove', pointerMove, { passive: false });
  window.addEventListener('touchend', pointerUp);

  toolToggle.addEventListener('click', () => {
    setTool(tool === 'pen' ? 'eraser' : 'pen');
  });

  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Refill black background so erasing shows correctly
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // restore composite mode
    setTool(tool);
  });

  // update stroke settings when thickness changes and remember per tool
  thickness.addEventListener('input', () => {
    const val = parseFloat(thickness.value);
    if (tool === 'pen') penThickness = val;
    else eraserThickness = val;
    ctx.lineWidth = val;
  });

  // initialize canvas background black
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ensure thickness reflects the default tool's remembered value
  thickness.value = penThickness;
  ctx.lineWidth = penThickness;

  // accessibility: allow pressing 'e' to toggle eraser, 'c' to clear
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'e' || ev.key === 'E') {
      setTool(tool === 'pen' ? 'eraser' : 'pen');
    }
    if (ev.key === 'c' || ev.key === 'C') {
      clearBtn.click();
    }
  });

})();
