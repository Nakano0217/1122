// Simple drawing app: white on black, pen/eraser, clear, thickness
(function(){
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');

  const toolToggle = document.getElementById('toolToggle');
  const clearBtn = document.getElementById('clearBtn');
  const sizeInput = document.getElementById('size');

  let drawing = false;
  let last = {x:0,y:0};
  let tool = 'pen'; // 'pen' or 'eraser'
  let pointsQueue = [];
  let rafScheduled = false;

  function getPointFromEvent(e){
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: (typeof e.pressure === 'number' && e.pressure > 0) ? e.pressure : 0.5
    };
  }

  function resizeCanvas(){
    // Reset transforms then size to avoid cumulative scaling
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(window.innerWidth);
    const h = Math.floor(window.innerHeight);
    // reset
    ctx.setTransform(1,0,0,1,0,0);
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);
    // fill black background so eraser can draw black
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,w,h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function setTool(t){
    tool = t;
    // update single toggle button UI
    if(toolToggle){
      if(t === 'pen'){
        toolToggle.innerText = 'ペン';
        toolToggle.title = 'ペン';
        toolToggle.setAttribute('aria-pressed','true');
        toolToggle.classList.add('active');
      } else {
        toolToggle.innerText = '消しゴム';
        toolToggle.title = '消しゴム';
        toolToggle.setAttribute('aria-pressed','false');
        toolToggle.classList.remove('active');
      }
    }
    // cursor feedback
    canvas.style.cursor = (t === 'pen') ? 'crosshair' : 'cell';
  }

  if(toolToggle){
    toolToggle.addEventListener('click', ()=> setTool(tool === 'pen' ? 'eraser' : 'pen'));
  }

  clearBtn.addEventListener('click', ()=>{
    // clear to black
    ctx.setTransform(1,0,0,1,0,0);
    resizeCanvas();
    setTool('pen');
  });

  function getPos(e){
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    drawing = true;
    last = getPos(e);
    pointsQueue.length = 0;
  });

  function scheduleDraw(){
    if(rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(()=>{
      rafScheduled = false;
      if(pointsQueue.length === 0) return;
      // choose composite mode for eraser vs pen
      const prevComposite = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = (tool === 'eraser') ? 'destination-out' : 'source-over';

      // draw queued points as a single continuous path to avoid gaps
      // compute average pressure for this batch to pick a stable lineWidth
      let sumPressure = 0;
      for(const pt of pointsQueue) sumPressure += pt.pressure;
      const avgPressure = sumPressure / pointsQueue.length;
      const base = Number(sizeInput.value) || 1;
      const width = Math.max(1, base * (0.25 + 0.75 * avgPressure));

      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      // ensure round caps and joins for continuous look
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // If the first queued point is unexpectedly far from `last` (gap),
      // draw a straight connector to avoid a visible break.
      const firstPt = pointsQueue[0];
      const dx0 = firstPt.x - last.x;
      const dy0 = firstPt.y - last.y;
      const dist0 = Math.sqrt(dx0*dx0 + dy0*dy0);
      // threshold in pixels; adjust if necessary
      const gapThreshold = Math.max(8, base * 0.5);
      if(dist0 > gapThreshold){
        ctx.lineTo(firstPt.x, firstPt.y);
        // set last to first so subsequent midpoints connect
        last = firstPt;
      }
  // Connect consecutive points; if distance between points is large,
  // insert a straight connector to avoid visible gaps. Otherwise use quadratic smoothing.
      for(let i = 0; i < pointsQueue.length; i++){
        const p = pointsQueue[i];
        const dx = p.x - last.x;
        const dy = p.y - last.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist > gapThreshold){
          ctx.lineTo(p.x, p.y);
          last = p;
          continue;
        }
        const mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
        ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
        last = p;
      }
      ctx.lineWidth = width;
      ctx.strokeStyle = (tool === 'pen') ? '#fff' : '#000';
      ctx.stroke();

      ctx.globalCompositeOperation = prevComposite;
      pointsQueue.length = 0;
    });
  }

  canvas.addEventListener('pointermove', (e)=>{
    if(!drawing) return;
    e.preventDefault();
    // prefer high-resolution sample points when available (important for Apple Pencil)
    const events = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : [e];
    for(const ev of events){
      pointsQueue.push(getPointFromEvent(ev));
    }
    scheduleDraw();
  });

  ['pointerup','pointercancel'].forEach(name => {
    canvas.addEventListener(name, (e)=>{
      // flush pending points synchronously to avoid final gap
      if(pointsQueue.length){
        const prevComposite = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = (tool === 'eraser') ? 'destination-out' : 'source-over';
        // draw queued points as one path on flush as well
        let sumPressure2 = 0;
        for(const pt of pointsQueue) sumPressure2 += pt.pressure;
        const avgPressure2 = sumPressure2 / pointsQueue.length;
        const base2 = Number(sizeInput.value) || 1;
        const width2 = Math.max(1, base2 * (0.25 + 0.75 * avgPressure2));

        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        // flush: same gap-handling as RAF draw
        const gapThreshold2 = Math.max(8, base2 * 0.5);
        for(let i = 0; i < pointsQueue.length; i++){
          const p = pointsQueue[i];
          const dx = p.x - last.x;
          const dy = p.y - last.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if(dist > gapThreshold2){
            ctx.lineTo(p.x, p.y);
            last = p;
            continue;
          }
          const mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
          ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
          last = p;
        }
        ctx.lineWidth = width2;
        ctx.strokeStyle = (tool === 'pen') ? '#fff' : '#000';
        ctx.stroke();
        ctx.globalCompositeOperation = prevComposite;
        pointsQueue.length = 0;
        rafScheduled = false;
      }
      drawing = false;
      try{ canvas.releasePointerCapture(e.pointerId); } catch(_){ }
    });
  });

  // prevent default gestures on touch devices
  canvas.addEventListener('touchstart', (e)=> e.preventDefault(), {passive:false});

  // initial tool
  setTool('pen');

  // expose a small API for debugging (optional)
  window._boogie = { clear: () => clearBtn.click(), setTool };
})();
