  /* =====================================================================
     PLATYTRIVIA CHALLENGE: PUG DASH (race). Part of Platytrivia (14-platytrivia.js), TEST SITE ONLY for now.
     A one-way obstacle course through a living room, a kitchen and a backyard. It moves like running around the
     Platytag house (drag or tap to walk, the camera follows you) but its own map. The way is always DOWN the
     screen: big chevrons mark the fast route and the finish line is at the bottom.
       - Living room: weave around the couch and table.
       - Kitchen: the shiny strip is a tummy slide (you belly-slide at BELLY x speed).
       - Backyard: step on the ladder and ride the slide over the fence maze (or walk the long way round),
         then the pool blocks the path. Swim slowly across, or hit the diving board and fly over it.
     Everyone races at once as see-through ghosts (no collisions). A bar on the right edge shows where every
     player is, so you can see who is winning live. Finish time decides it: fastest = winner, last = vomit.
     Result value sent to the host (cv): finished = TV_RACE_WIN - elapsed ms; didn't finish = progress (px down).
     ===================================================================== */
  const RC = {
    W: 760, H: 2560, START_Y: 250, FINISH_Y: 2400,
    SPEED: 300,              // px/s, same walking speed as Platytag
    BELLY: 2.2,              // speed multiplier on the tummy-slide strip
    SWIM: 0.45,              // speed multiplier in the pool
    SLIDE_SPEED: 720,        // px/s down the slide
    DIVE_MS: 950, DIVE_LIFT: 120,   // diving board flight time and arc height
    SEND_MS: 100,            // how often my position goes out
    CAM_EASE: 9, GHOST_EASE: 12,
    SPRITE: 54
  };
  // walkable rooms + doorways (x, y, w, h). Anything outside these is wall.
  const RC_ZONES = [
    {k: "frontyard", x: 20, y: 20, w: 720, h: 300},
    {x: 300, y: 310, w: 160, h: 60},
    {k: "livingroom", x: 40, y: 360, w: 680, h: 420},
    {x: 520, y: 770, w: 120, h: 60},
    {k: "kitchen", x: 40, y: 820, w: 680, h: 400},
    {x: 100, y: 1210, w: 130, h: 60},
    {k: "backyard", x: 20, y: 1260, w: 720, h: 1260}
  ];
  const RC_SOLIDS = [   // furniture, fences and hedges you can't walk through
    {x: 40, y: 360, w: 140, h: 60, e: "📺", c: "#8C6A55"}, {x: 200, y: 470, w: 300, h: 80, e: "🛋️", c: "#E58B8B"},
    {x: 560, y: 620, w: 120, h: 70, e: "🪑", c: "#C99A5F"}, {x: 640, y: 360, w: 80, h: 140, e: "📚", c: "#A57A55"},
    {x: 60, y: 690, w: 60, h: 60, e: "🪴", c: "#7FC07A"},
    {x: 40, y: 820, w: 90, h: 110, e: "🧊", c: "#BFE0F0"}, {x: 300, y: 1050, w: 160, h: 90, e: "🍽️", c: "#C99A5F"},
    {x: 540, y: 1100, w: 150, h: 90, e: "🍳", c: "#B9BEC4"},
    {x: 20, y: 1480, w: 520, h: 28, f: 1}, {x: 240, y: 1700, w: 500, h: 28, f: 1},      // fence maze (gaps: right, then left)
    {x: 20, y: 1900, w: 60, h: 300, e: "🌿", c: "#4FA55A"}, {x: 680, y: 1900, w: 60, h: 300, e: "🌿", c: "#4FA55A"}   // hedges beside the pool
  ];
  const RC_POOL = {x: 80, y: 1900, w: 600, h: 300};
  const RC_BELLY_STRIP = {x: 80, y: 930, w: 600, h: 80};
  const RC_SLIDE_PATH = [[165, 1325], [215, 1420], [330, 1560], [470, 1680], [540, 1780], [560, 1830]];
  const RC_SLIDE_PAD = {x: 165, y: 1325, r: 34};
  const RC_BOARD = {x: 420, y: 1862, r: 30, land: {x: 420, y: 2262}};
  const RC_ROUTE = [[380, 270], [380, 400], [150, 440], [130, 600], [300, 700], [450, 720], [580, 790], [580, 880], [560, 970], [140, 970], [150, 1100], [165, 1240], [165, 1300],
    null, [560, 1840], [470, 1862], null, [420, 1960], [420, 2200], null, [420, 2290], [390, 2390]];   // null = a gap in the trail (slide / dive)
  const RC_LANE_X0 = 90, RC_LANE_DX = 64;     // start positions across the yard

  const rc = {box: null, world: null, bar: null, hud: null, big: null, built: false, r: null};

  function rcInZone(x, y){ return RC_ZONES.some(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h); }
  function rcInRect(r, x, y){ return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  function rcWalk(x, y){ return rcInZone(x, y) && !RC_SOLIDS.some(s => rcInRect(s, x, y)); }
  function rcOrdinal(n){ return n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ({1: "st", 2: "nd", 3: "rd"}[n % 10] || "th")); }
  function rcFmt(v){ return v >= TV_RACE_WIN / 2 ? ((TV_RACE_WIN - v) / 1000).toFixed(1) + "s" : "DNF"; }
  function rcBox(parent, x, y, w, h, css, html){
    const d = document.createElement("div");
    d.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;box-sizing:border-box;${css || ""}`;
    if(html) d.innerHTML = html;
    parent.appendChild(d); return d;
  }

  /* ---------- Build the course once ---------- */
  function rcBuild(){
    if(rc.built) return;
    rc.built = true;
    const box = document.createElement("div");
    box.className = "tv-race"; box.id = "tv-race"; box.style.display = "none";
    const world = document.createElement("div");
    world.className = "rc-world"; world.style.width = RC.W + "px"; world.style.height = RC.H + "px";
    box.appendChild(world);
    box.insertAdjacentHTML("beforeend",
      `<div class="rc-hud"><div class="tv-pill" id="rc-rank">1st</div><div class="tv-timer" id="rc-time">0</div><div class="tv-pill" id="rc-pct">0%</div></div>` +
      `<div class="rc-bar" id="rc-bar"></div><div class="rc-big" id="rc-big"></div>`);
    tvScr.game.appendChild(box);
    rc.box = box; rc.world = world; rc.bar = box.querySelector("#rc-bar"); rc.big = box.querySelector("#rc-big");
    // floors: the real room colours, with a dark wall showing between rooms
    RC_ZONES.forEach(z => {
      const room = z.k ? ROOMS[z.k] : null;
      const el = rcBox(world, z.x, z.y, z.w, z.h, room ? `background:${floorCss(room)};border:6px solid #6A4A2C;border-radius:14px;` : "background:#D8C9B0;z-index:1;");
      if(!room){ el.style.borderLeft = el.style.borderRight = "0"; }
    });
    // the pool (water + deck)
    rcBox(world, RC_POOL.x - 14, RC_POOL.y - 14, RC_POOL.w + 28, RC_POOL.h + 28, "background:#E9F4F8;border:4px solid #241811;border-radius:42px;");
    rcBox(world, RC_POOL.x, RC_POOL.y, RC_POOL.w, RC_POOL.h, "background:radial-gradient(circle at 30% 30%,#7FD6F5,#2E9BD1);border:5px solid #1b6a99;border-radius:34px;");
    // tummy-slide strip
    rcBox(world, RC_BELLY_STRIP.x, RC_BELLY_STRIP.y, RC_BELLY_STRIP.w, RC_BELLY_STRIP.h,
      "background:repeating-linear-gradient(90deg,#fff 0 28px,#CFF1FF 28px 56px);border:4px solid #241811;border-radius:30px;opacity:.92;box-shadow:inset 0 0 0 4px rgba(255,255,255,.7);")
      .innerHTML = `<div class="rc-label">TUMMY SLIDE</div>`;
    // furniture, fences, hedges
    RC_SOLIDS.forEach(s => {
      if(s.f) rcBox(world, s.x, s.y, s.w, s.h, "background:repeating-linear-gradient(90deg,#C99A5F 0 22px,#B5854D 22px 26px);border:3px solid #6A4A2C;border-radius:8px;z-index:2;");
      else rcBox(world, s.x, s.y, s.w, s.h, `background:${s.c};border:4px solid #241811;border-radius:16px;z-index:2;display:grid;place-items:center;font-size:${Math.min(44, s.h * .6)}px;`, s.e);
    });
    // slide: chute, ladder pad
    const pts = RC_SLIDE_PATH.map(p => p.join(",")).join(" ");
    world.insertAdjacentHTML("beforeend", `<svg class="rc-svg" width="${RC.W}" height="${RC.H}" viewBox="0 0 ${RC.W} ${RC.H}">
      <polyline points="${pts}" fill="none" stroke="#241811" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="${pts}" fill="none" stroke="#FF9A8A" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="${pts}" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="4 16" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
      <circle cx="${RC_SLIDE_PAD.x}" cy="${RC_SLIDE_PAD.y}" r="38" fill="#FFD966" stroke="#241811" stroke-width="5"/>
      <text x="${RC_SLIDE_PAD.x}" y="${RC_SLIDE_PAD.y + 7}" text-anchor="middle" font-family="Baloo 2,Fredoka,sans-serif" font-weight="700" font-size="20" fill="#241811">SLIDE</text>
      <rect x="${RC_BOARD.x - 18}" y="${RC_BOARD.y - 30}" width="36" height="104" rx="14" fill="#fff" stroke="#241811" stroke-width="5"/>
      <rect x="${RC_BOARD.x - 26}" y="${RC_BOARD.y - 40}" width="52" height="26" rx="8" fill="#8E9AA6" stroke="#241811" stroke-width="5"/>
      <text x="${RC_BOARD.x}" y="${RC_BOARD.y + 4}" text-anchor="middle" font-family="Baloo 2,Fredoka,sans-serif" font-weight="700" font-size="14" fill="#241811">DIVE</text>
    </svg>`);
    // start line and finish banner
    rcBox(world, 40, RC.START_Y + 14, RC.W - 80, 8, "background:#fff;border-radius:4px;opacity:.9;z-index:1;");
    rcBox(world, 40, RC.START_Y + 26, 200, 30, "font:700 20px/30px 'Baloo 2',Fredoka,sans-serif;letter-spacing:5px;color:rgba(255,255,255,.9);text-shadow:0 2px 0 #241811;z-index:1;", "START");
    rcBox(world, 20, RC.FINISH_Y, RC.W - 40, 40, "background:repeating-conic-gradient(#241811 0 25%,#fff 0 50%) 0 0/40px 40px;border:4px solid #241811;z-index:1;");
    rcBox(world, 20, RC.FINISH_Y + 44, RC.W - 40, 50, "text-align:center;font:700 34px/50px 'Baloo 2',Fredoka,sans-serif;color:#fff;-webkit-text-stroke:2px #241811;paint-order:stroke fill;letter-spacing:6px;z-index:1;", "FINISH");
    // chevrons along the fast route
    let prev = null;
    RC_ROUTE.forEach(p => {
      if(!p){ prev = null; return; }
      if(prev){
        const dx = p[0] - prev[0], dy = p[1] - prev[1], len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
        for(let d = 40; d < len - 20; d += 120){
          const c = rcBox(world, prev[0] + dx * d / len - 18, prev[1] + dy * d / len - 18, 36, 36, `transform:rotate(${ang}deg);z-index:1;opacity:.75;`);
          c.innerHTML = `<svg viewBox="0 0 36 36" width="36" height="36"><path d="M10 6 L26 18 L10 30" fill="none" stroke="#241811" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 6 L26 18 L10 30" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }
      }
      prev = p;
    });
    // pointer: drag or tap to walk, like Platytag
    const aim = e => {
      const r = rc.r;
      if(!r || !r.on || r.mode) return;
      const b = box.getBoundingClientRect();
      r.tx = tvClamp(e.clientX - b.left + r.cx, 0, RC.W); r.ty = tvClamp(e.clientY - b.top + r.cy, 0, RC.H);
    };
    box.addEventListener("pointerdown", e => { rc.down = true; try{ box.setPointerCapture(e.pointerId); }catch(_){} aim(e); });
    box.addEventListener("pointermove", e => { if(rc.down) aim(e); });
    ["pointerup", "pointercancel"].forEach(t => box.addEventListener(t, () => { rc.down = false; }));
  }

  /* ---------- Enter / leave ---------- */
  function rcMakeSprite(code, name, ghost){
    const el = tvMakeSprite(code, name, ghost ? "rc-ghost" : "rc-me");
    rc.world.appendChild(el); return el;
  }
  function rcEnter(G){
    rcBuild();
    rcExit();
    tvClearRev(); tv.meEl.style.visibility = "hidden"; tv.canMove = false; tvBanner("");
    tvEl("tv-sheet").style.display = "none"; tvEl("tv-qcard").style.display = "none"; tvEl("tv-challenge").style.display = "none";
    rc.world.querySelectorAll(".tv-sprite").forEach(e => e.remove());
    const me = Net.myId(), ids = G.pl || [], idx = Math.max(0, ids.indexOf(me));
    const x0 = RC_LANE_X0 + (idx % 10) * RC_LANE_DX, y0 = RC.START_Y;
    const r = rc.r = {on: true, G, x: x0, y: y0, tx: x0, ty: y0, f: 1, mode: null, fin: false, finMs: 0, cx: 0, cy: 0, ghosts: new Map(), lastSend: 0, sx: -1, sy: -1,
      latchSlide: false, latchBoard: false, swim: false, belly: false, bars: new Map(), place: 0};
    r.el = rcMakeSprite(dogCode(), tvMyName(), false);
    ids.forEach((id, i) => {
      if(id === me) return;
      const gx = RC_LANE_X0 + (i % 10) * RC_LANE_DX;
      r.ghosts.set(id, {el: rcMakeSprite(tvDogOf(G, id), tvNameOf(G, id), true), x: gx, y: y0, tx: gx, ty: y0, seen: false});
    });
    rc.bar.innerHTML = "";
    ids.forEach(id => { const d = document.createElement("div"); d.className = "rc-dot" + (id === me ? " me" : ""); rc.bar.appendChild(d); r.bars.set(id, d); });
    rc.box.style.display = "";
    rc.big.textContent = "";
    r.cx = tvClamp(x0 - rc.box.clientWidth / 2, 0, Math.max(0, RC.W - rc.box.clientWidth)); r.cy = Math.max(0, y0 - rc.box.clientHeight * .5);
    tv.chSent = false; tv.chScore = 0;
    rcPaint(0);
  }
  function rcExit(){
    if(rc.r) rc.r.on = false;
    if(rc.box) rc.box.style.display = "none";
  }

  /* ---------- Per-frame ---------- */
  function rcPlace(el, x, y, f, lift){
    el.style.left = x + "px"; el.style.top = (y - (lift || 0)) + "px"; el.style.zIndex = String(10 + Math.floor(y / 4));
    el.firstChild.style.transform = f < 0 ? "scaleX(-1)" : "";
  }
  function rcSplash(x, y){
    const s = rcBox(rc.world, x - 40, y - 20, 80, 40, "border:4px solid #fff;border-radius:50%;z-index:900;pointer-events:none;");
    s.className = "rc-splash"; setTimeout(() => s.remove(), 800);
  }
  function rcStartForced(r, mode, now, path){
    r.mode = mode; r.t0 = now; r.path = path; r.tx = r.x; r.ty = r.y;
    let len = 0; r.seg = [0];
    for(let i = 1; i < path.length; i++){ len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); r.seg.push(len); }
    r.len = len; r.from = {x: r.x, y: r.y};
    r.el.classList.toggle("rc-sliding", mode === "slide"); r.el.classList.toggle("rc-diving", mode === "dive");
  }
  function rcFrame(dt){
    const r = rc.r;
    if(!r || !r.on) return;
    const G = r.G, now = Net.serverNow(), started = now >= G.cs, vw = rc.box.clientWidth, vh = rc.box.clientHeight;
    // --- me ---
    let lift = 0;
    if(r.mode === "slide"){
      const d = Math.min(r.len, (now - r.t0) / 1000 * RC.SLIDE_SPEED);
      let i = 1; while(i < r.seg.length - 1 && r.seg[i] < d) i++;
      const t = (d - r.seg[i - 1]) / Math.max(1, r.seg[i] - r.seg[i - 1]), a = r.path[i - 1], b = r.path[i];
      r.x = a[0] + (b[0] - a[0]) * t; r.y = a[1] + (b[1] - a[1]) * t; r.f = b[0] >= a[0] ? 1 : -1;
      if(d >= r.len){ r.mode = null; r.tx = r.x; r.ty = r.y; r.el.classList.remove("rc-sliding"); }
    }else if(r.mode === "dive"){
      const t = Math.min(1, (now - r.t0) / RC.DIVE_MS), a = r.path[0], b = r.path[1];
      r.x = a[0] + (b[0] - a[0]) * t; r.y = a[1] + (b[1] - a[1]) * t; lift = 4 * RC.DIVE_LIFT * t * (1 - t);
      if(t >= 1){ r.mode = null; r.tx = r.x; r.ty = r.y; r.el.classList.remove("rc-diving"); rcSplash(r.x, r.y); r.latchBoard = true; }
    }else if(started && now < G.cs + G.cdur * 1000){
      const k = tv.keys;
      if(k.l || k.r || k.u || k.d){
        r.tx = tvClamp(r.x + ((k.r ? 1 : 0) - (k.l ? 1 : 0)) * 300, 0, RC.W);
        r.ty = tvClamp(r.y + ((k.d ? 1 : 0) - (k.u ? 1 : 0)) * 300, 0, RC.H);
      }
      const ex = r.tx - r.x, ey = r.ty - r.y, d = Math.hypot(ex, ey);
      r.belly = rcInRect(RC_BELLY_STRIP, r.x, r.y);
      r.swim = rcInRect(RC_POOL, r.x, r.y);
      if(d > .5){
        const sp = RC.SPEED * (r.belly ? RC.BELLY : r.swim ? RC.SWIM : 1) * dt, s = Math.min(d, sp), nx = r.x + ex / d * s, ny = r.y + ey / d * s;
        if(rcWalk(nx, ny)){ r.x = nx; r.y = ny; }
        else if(rcWalk(nx, r.y) && Math.abs(ex) > 1){ r.x = nx; }
        else if(rcWalk(r.x, ny) && Math.abs(ey) > 1){ r.y = ny; }
        if(Math.abs(ex) > 2) r.f = ex < 0 ? -1 : 1;
      }
      // slide ladder and diving board pull you on, like the Platytag yard
      const dSl = Math.hypot(r.x - RC_SLIDE_PAD.x, r.y - RC_SLIDE_PAD.y), dBo = Math.hypot(r.x - RC_BOARD.x, r.y - RC_BOARD.y);
      if(r.latchSlide && dSl > RC_SLIDE_PAD.r + 14) r.latchSlide = false;
      if(r.latchBoard && dBo > RC_BOARD.r + 14) r.latchBoard = false;
      if(!r.fin && !r.latchSlide && dSl < RC_SLIDE_PAD.r){ r.latchSlide = true; rcStartForced(r, "slide", now, RC_SLIDE_PATH.slice()); }
      else if(!r.fin && !r.latchBoard && dBo < RC_BOARD.r){ r.latchBoard = true; rcStartForced(r, "dive", now, [[RC_BOARD.x, RC_BOARD.y], [RC_BOARD.land.x, RC_BOARD.land.y]]); }
    }
    r.el.classList.toggle("rc-belly", r.belly && !r.mode);
    r.el.classList.toggle("rc-swim", r.swim && !r.mode);
    rcPlace(r.el, r.x, r.y, r.f, lift);
    // finish
    if(!r.fin && r.y >= RC.FINISH_Y && !r.mode && started){
      r.fin = true; r.finMs = Math.max(0, Math.round(now - G.cs)); tv.chSent = true;
      Net.setMe({cq: G.ci, cv: TV_RACE_WIN - r.finMs, rq: G.ci, rx: Math.round(r.x), ry: Math.round(r.y)});
    }
    // --- ghosts ---
    const peers = Net.peers(), k = 1 - Math.exp(-RC.GHOST_EASE * dt);
    r.ghosts.forEach((g, id) => {
      const pp = peers.find(q => q.id === id), p = pp && pp.p;
      if(p && p.rq === G.ci && p.rx != null){ g.tx = p.rx; g.ty = p.ry; if(!g.seen){ g.seen = true; g.x = g.tx; g.y = g.ty; } }
      const ox = g.x; g.x += (g.tx - g.x) * k; g.y += (g.ty - g.y) * k;
      if(Math.abs(g.x - ox) > .3) g.f = g.x < ox ? -1 : 1;
      rcPlace(g.el, g.x, g.y, g.f || 1, 0);
    });
    // --- camera ---
    const tcx = RC.W <= vw ? (RC.W - vw) / 2 : tvClamp(r.x - vw / 2, 0, RC.W - vw), tcy = tvClamp(r.y - vh * .5, 0, Math.max(0, RC.H - vh)), kc = 1 - Math.exp(-RC.CAM_EASE * dt);
    r.cx += (tcx - r.cx) * kc; r.cy += (tcy - r.cy) * kc;
    rc.world.style.transform = `translate3d(${-Math.round(r.cx)}px,${-Math.round(r.cy)}px,0)`;
    rcPaint(now);
    // send my position
    const t = performance.now();
    if(t - r.lastSend >= RC.SEND_MS && (Math.abs(r.x - r.sx) > 1 || Math.abs(r.y - r.sy) > 1)){
      r.lastSend = t; r.sx = r.x; r.sy = r.y;
      Net.setMe({rq: G.ci, rx: Math.round(r.x), ry: Math.round(r.y)});
    }
  }

  /* ---------- HUD: rank, timer, live progress bar ---------- */
  function rcStandings(r, G){
    const peers = Net.peers(), me = Net.myId();
    return (G.pl || []).map(id => {
      const p = id === me ? null : (peers.find(q => q.id === id) || {}).p || {};
      let key;
      if(id === me) key = r.fin ? 1e7 + (TV_RACE_WIN - r.finMs) : r.y;
      else if(p.cq === G.ci && p.cv >= TV_RACE_WIN / 2) key = 1e7 + p.cv;
      else key = p.rq === G.ci && p.ry != null ? p.ry : 0;
      return {id, key, y: id === me ? r.y : (p.rq === G.ci && p.ry != null ? p.ry : RC.START_Y)};
    }).sort((a, b) => b.key - a.key);
  }
  function rcPaint(now){
    const r = rc.r, G = r.G, st = rcStandings(r, G), me = Net.myId(), n = st.length;
    const place = st.findIndex(s => s.id === me) + 1;
    tvEl("rc-rank").textContent = rcOrdinal(place) + " / " + n;
    const left = Math.max(0, Math.ceil((G.cs + G.cdur * 1000 - now) / 1000));
    tvEl("rc-time").textContent = r.fin ? (r.finMs / 1000).toFixed(1) : String(now < G.cs ? G.cdur : left);
    tvEl("rc-pct").textContent = Math.round(tvClamp((r.y - RC.START_Y) / (RC.FINISH_Y - RC.START_Y), 0, 1) * 100) + "%";
    const bh = rc.bar.clientHeight || 1;
    st.forEach(s => {
      const d = r.bars.get(s.id); if(!d) return;
      d.style.top = (tvClamp((s.y - RC.START_Y) / (RC.FINISH_Y - RC.START_Y), 0, 1) * (bh - 14)) + "px";
      d.style.zIndex = s.id === me ? "3" : "1";
    });
    if(now < G.cs){ const c = Math.ceil((G.cs - now) / 1000); rc.big.textContent = c > 0 ? String(c) : "GO!"; rc.big.classList.add("show"); }
    else if(r.fin){ rc.big.textContent = "Finished! " + rcOrdinal(place) + " so far"; rc.big.classList.add("show", "small"); }
    else if(now < G.cs + 900){ rc.big.textContent = "GO!"; rc.big.classList.add("show"); rc.big.classList.remove("small"); }
    else rc.big.classList.remove("show", "small");
  }
  // 100 ms timer (from tvChTick): time limit
  function rcTick(G, now){
    const r = rc.r;
    if(!r || !r.on) return;
    if(!tv.chSent && now >= G.cs + G.cdur * 1000){
      tv.chSent = true;
      Net.setMe({cq: G.ci, cv: Math.max(0, Math.round(r.y)), rq: G.ci, rx: Math.round(r.x), ry: Math.round(r.y)});
      rc.big.textContent = "Time!"; rc.big.classList.add("show");
    }
  }
