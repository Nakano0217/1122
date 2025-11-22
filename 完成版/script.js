(() => {
  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  // smoother strokes: use round caps/joins
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
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
    // Resize canvas to match the visible viewport size and back it with device pixels.
    // Use visualViewport when available because mobile browsers (iOS Safari) change
    // the visual viewport height when the address bar shows/hides which breaks
    // mapping between client coordinates and canvas CSS size.
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(1, Math.floor(window.visualViewport?.width || window.innerWidth));
    const cssH = Math.max(1, Math.floor(window.visualViewport?.height || window.innerHeight));

    // Always set sizes to match the current visual viewport to avoid mismatches
    // between the canvas CSS size and getBoundingClientRect() reported size.
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    // Use actual backing ratio derived from canvas dimensions and rect width if needed
    // but here we keep drawing coordinates in CSS pixels by applying dpr transform.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fill black background in CSS pixels space
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  // smoothing state
  let points = [];
  let lastMid = null;

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

    // normalize clientX/clientY for pointer or touch events
    let clientX, clientY;
    if ('clientX' in e && typeof e.clientX === 'number') {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if (e.touches && e.touches.length) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      // fallback
      clientX = 0; clientY = 0;
    }

    // Because we used ctx.setTransform(dpr,...), our drawing coordinate system
    // matches CSS pixels. So we should return coordinates in CSS pixels.
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function pointerDown(e) {
    e.preventDefault();
    drawing = true;
    const p = pointerPos(e);
    last.x = p.x; last.y = p.y;
    // start smoothing buffer
    points = [ { x: p.x, y: p.y } ];
    lastMid = { x: p.x, y: p.y };
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    // ensure lineWidth reflects the current tool's remembered thickness
    ctx.lineWidth = parseFloat(thickness.value);
    // If pointer events are available, capture this pointer so we continue
    // receiving move/up events even if the pointer leaves the canvas.
    if (e.pointerId && canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
  }

  function pointerMove(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pointerPos(e);
    // append point
    points.push({ x: p.x, y: p.y });
    ctx.lineWidth = parseFloat(thickness.value);

    if (points.length >= 2) {
      const prev = points[points.length - 2];
      const cur = points[points.length - 1];
      const mid = { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 };

      ctx.beginPath();
      ctx.moveTo(lastMid.x, lastMid.y);
      ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
      ctx.stroke();

      lastMid = mid;
    }
    last.x = p.x; last.y = p.y;
  }

  function pointerUp(e) {
    if (!drawing) return;
    drawing = false;
    // flush remaining points
    if (points.length === 2) {
      // straight line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
    } else if (points.length > 2) {
      const prev = points[points.length - 2];
      const cur = points[points.length - 1];
      const mid = { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(lastMid.x, lastMid.y);
      ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
      ctx.stroke();
    }
    ctx.closePath();
    points = [];
    lastMid = null;
    if (e.pointerId && canvas.releasePointerCapture) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
  }

  // wire up events
  window.addEventListener('resize', fitCanvasToWindow);
  // On mobile browsers (iOS Safari etc.) the visual viewport can change size when
  // the address bar hides/shows or the keyboard appears. Use visualViewport events
  // when available to re-fit the canvas so coordinate mapping stays accurate.
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitCanvasToWindow);
    window.visualViewport.addEventListener('scroll', fitCanvasToWindow);
  }
  fitCanvasToWindow();

  // default tool
  setTool('pen');

  // pointer events (works for mouse + touch)
  canvas.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);

  // If the browser does not support pointer events, fall back to touch events.
  // Avoid registering both pointer and touch listeners to prevent duplicate events
  if (!('onpointerdown' in window)) {
    canvas.addEventListener('touchstart', (ev) => pointerDown(ev), { passive: false });
    window.addEventListener('touchmove', (ev) => pointerMove(ev), { passive: false });
    window.addEventListener('touchend', (ev) => pointerUp(ev));
  }

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
