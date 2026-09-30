  /* ---------------- Backyard pool ----------------
     POOL is the water (world coords). Anyone can wade in or climb out anywhere along the edge.
     Dogs swim in a float vest + goggles; a platypus dives under and breathes through a straw. */
  const POOL = {x: 560, y: -120, w: 600, h: 220, r: 34};
  const POOL_DECK = 28;
  const SWIM_SPEED_PUG = 242, SWIM_SPEED_PLAT = 225;   // platypus just a touch slower in the water
  function inPool(x, y){
    const P = POOL;
    if(x < P.x || x > P.x + P.w || y < P.y || y > P.y + P.h) return false;
    const cx = Math.max(P.x + P.r, Math.min(P.x + P.w - P.r, x)), cy = Math.max(P.y + P.r, Math.min(P.y + P.h - P.r, y));
    return Math.hypot(x - cx, y - cy) <= P.r;
  }
  function onPoolDeck(x, y){
    const d = POOL_DECK;
    return x >= POOL.x - d && x <= POOL.x + POOL.w + d && y >= POOL.y - d && y <= POOL.y + POOL.h + d;
  }
  function poolDecal(roomRect){
    const d = POOL_DECK, W = POOL.w + d*2, H = POOL.h + d*2;
    const left = POOL.x - d - roomRect.x, top = POOL.y - d - roomRect.y;
    const w = POOL.w, h = POOL.h, r = POOL.r;
    let tiles = "";
    for(let x = 18; x < W; x += 36) tiles += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
    for(let y = 18; y < H; y += 36) tiles += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
    let caust = "";
    for(let i = 0; i < 6; i++){
      const y = d + 30 + i * 34, x0 = d - 60 - (i % 2) * 26;
      let path = `M ${x0} ${y}`;
      for(let x = x0; x < d + w + 60; x += 40) path += ` q 10 -${5 + (i % 3) * 2} 20 0 t 20 0`;
      caust += `<path d="${path}" stroke-dasharray="${46 + (i % 3) * 14} ${58 + (i % 2) * 30}"/>`;
    }
    const ladder = (x, y, flip) => `<g transform="translate(${x} ${y})${flip ? " scale(1 -1)" : ""}" stroke="#241811" stroke-width="2.5" stroke-linecap="round">
      <path d="M 0 -18 Q 0 -30 12 -30 L 12 22" fill="none" stroke="#C9D3DC" stroke-width="7"/><path d="M 0 -18 Q 0 -30 12 -30 L 12 22" fill="none" stroke="#241811" stroke-width="1.5"/>
      <path d="M 34 -18 Q 34 -30 46 -30 L 46 22" fill="none" stroke="#C9D3DC" stroke-width="7"/><path d="M 34 -18 Q 34 -30 46 -30 L 46 22" fill="none" stroke="#241811" stroke-width="1.5"/>
      <line x1="12" y1="0" x2="46" y2="0" stroke="#C9D3DC" stroke-width="5"/><line x1="12" y1="14" x2="46" y2="14" stroke="#C9D3DC" stroke-width="5" opacity="0.6"/></g>`;
    return `<svg class="pool-decal" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:${left}px;top:${top}px;pointer-events:none;z-index:1">
<defs>
  <clipPath id="poolDeckClip"><rect x="2" y="2" width="${W-4}" height="${H-4}" rx="${r + d*0.6}"/></clipPath>
  <clipPath id="poolWaterClip"><rect x="${d}" y="${d}" width="${w}" height="${h}" rx="${r}"/></clipPath>
  <linearGradient id="poolWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FDBF5"/><stop offset="1" stop-color="#2E9BD1"/></linearGradient>
</defs>
<rect x="2" y="2" width="${W-4}" height="${H-4}" rx="${r + d*0.6}" fill="#EFE3CC" stroke="#241811" stroke-width="3"/>
<g stroke="#D8C6A6" stroke-width="2" clip-path="url(#poolDeckClip)">${tiles}</g>
<rect x="${d-8}" y="${d-8}" width="${w+16}" height="${h+16}" rx="${r+8}" fill="#FBF6EC" stroke="#241811" stroke-width="3"/>
<rect x="${d}" y="${d}" width="${w}" height="${h}" rx="${r}" fill="url(#poolWater)" stroke="#241811" stroke-width="3"/>
<g clip-path="url(#poolWaterClip)">
  <rect x="${d}" y="${d}" width="${w}" height="12" fill="#1F7FB0" opacity="0.55"/>
  <g stroke="#9FE3F7" stroke-width="3" opacity="0.8"><path d="M ${d} ${d+6} H ${d+w}" stroke-dasharray="6 6"/></g>
  <g class="pool-caustic" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.35">${caust}</g>
  <rect x="${d}" y="${d}" width="${w}" height="${h}" fill="none" stroke="#1F7FB0" stroke-width="10" opacity="0.25"/>
  <path d="M ${d + w*0.5} ${d+14} V ${d + h - 14}" stroke="#1F7FB0" stroke-width="3" stroke-dasharray="14 10" opacity="0.35"/>
</g>
${ladder(d + 40, d + 2, false)}${ladder(d + w - 100, d + h - 2, true)}
</svg>`;
  }
  // float vest + goggles for a swimming dog (drawn over the 56x65 sprite box)
  const SWIM_GEAR = `<svg viewBox="0 0 56 65" xmlns="http://www.w3.org/2000/svg">
<path d="M 9 41 Q 13 37 20 37 L 22 41 Q 28 44 34 41 L 36 37 Q 43 37 47 41 L 48 50 L 8 50 Z" fill="#FF7A2F" stroke="#241811" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M 10 45 H 46" stroke="#FFD34D" stroke-width="2.2"/><rect x="25.5" y="43" width="5" height="4.5" rx="1" fill="#3A3F46"/>
<path d="M 6 31 Q 28 25 50 31" fill="none" stroke="#2A6FA0" stroke-width="2.4" stroke-linecap="round"/>
<circle cx="19.5" cy="32.6" r="6.3" fill="rgba(140,220,255,0.45)" stroke="#1E5E86" stroke-width="2"/>
<circle cx="36.5" cy="32.6" r="6.3" fill="rgba(140,220,255,0.45)" stroke="#1E5E86" stroke-width="2"/>
<path d="M 25.6 32 Q 28 30 30.4 32" fill="none" stroke="#1E5E86" stroke-width="2"/>
<path d="M 16 29.5 Q 18 28 20 28.6 M 33 29.5 Q 35 28 37 28.6" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity="0.9"/>
</svg>`;
  // ---- the pool float tube (3D-ish torus). part: "full" | "back" | "front"
  let _tubeN = 0;
  function tubeSVG(part){
    const id = "tb" + (++_tubeN);
    const clip = part === "back" ? `<clipPath id="${id}c"><rect x="0" y="0" width="80" height="23"/></clipPath>`
               : part === "front" ? `<clipPath id="${id}c"><rect x="0" y="23" width="80" height="30"/></clipPath>` : "";
    const ring = "M 4 23 A 36 17 0 1 0 76 23 A 36 17 0 1 0 4 23 Z M 24 21 A 16 7 0 1 1 56 21 A 16 7 0 1 1 24 21 Z";
    return `<svg viewBox="0 0 80 50" xmlns="http://www.w3.org/2000/svg" overflow="visible"><defs>
<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD0E0"/><stop offset="0.45" stop-color="#FF86AE"/><stop offset="1" stop-color="#C23D72"/></linearGradient>
<radialGradient id="${id}h" cx="0.5" cy="0.35" r="0.6"><stop offset="0" stop-color="#1B5E88" stop-opacity="0.85"/><stop offset="1" stop-color="#3FA4D6" stop-opacity="0.55"/></radialGradient>
<clipPath id="${id}r"><path d="${ring}" clip-rule="evenodd"/></clipPath>${clip}</defs>
<g${clip ? ` clip-path="url(#${id}c)"` : ""}>
${part === "full" ? `<ellipse cx="41" cy="29" rx="37" ry="15" fill="#0E4E78" opacity="0.28"/><ellipse cx="40" cy="21" rx="16" ry="7" fill="url(#${id}h)"/>` : ""}
<path d="${ring}" fill-rule="evenodd" fill="url(#${id}g)" stroke="#241811" stroke-width="2.4"/>
<g clip-path="url(#${id}r)" fill="#FFFFFF" opacity="0.92">
  <path d="M 40 21 L 2 8 L 2 24 Z"/><path d="M 40 21 L 78 8 L 78 24 Z"/><path d="M 40 21 L 30 50 L 50 50 Z"/><path d="M 40 21 L 33 -2 L 47 -2 Z"/>
</g>
<g clip-path="url(#${id}r)"><ellipse cx="40" cy="30" rx="36" ry="12" fill="none" stroke="#8E2352" stroke-width="7" opacity="0.28"/>
  <ellipse cx="40" cy="19" rx="18" ry="8.5" fill="none" stroke="#7A1E47" stroke-width="3" opacity="0.35"/></g>
<path d="M 10 17 Q 20 8 38 7" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity="0.85"/>
<path d="M 60 34 Q 68 31 72 26" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
<path d="${ring}" fill="none" stroke="#241811" stroke-width="2.4"/>
</g></svg>`;
  }
  const TUBE_GRAB = 30, TUBE_BOOST = 1.4;
  const TUBE_HOME = {x: POOL.x + POOL.w * 0.72, y: POOL.y + POOL.h * 0.42};
  function clampIntoPool(x, y){
    const m = 30;
    return {x: Math.max(POOL.x + m, Math.min(POOL.x + POOL.w - m, x)), y: Math.max(POOL.y + m, Math.min(POOL.y + POOL.h - m, y))};
  }
  /* One float tube in the pool. Swim into it to put it on (only one wearer at a time);
     it follows you around, gives a speed boost, and slips off where you climb out.
     Single player: all local. Platytag: the host decides who has it (G.tube = {x, y, h}). */
  function updateTube(){
    if(!tubeEl || !spriteEl) return;
    const near = t => Math.hypot(state.pos.x - t.x, state.pos.y - t.y) < TUBE_GRAB;
    let free = null, mine = false;
    if(!state.mp){
      const T = state.tube;
      if(T.holder === "me" && !state.swimming){
        const d = clampIntoPool((state.lastSwimPos || T).x, (state.lastSwimPos || T).y);
        T.x = d.x; T.y = d.y; T.holder = null;
      } else if(!T.holder && state.swimming && near(T)){ T.holder = "me"; }
      mine = T.holder === "me";
      if(!T.holder) free = T;
    } else {
      const T = mp.g && mp.g.tube;
      if(!T){ tubeEl.style.display = "none"; state.wearingTube = false; spriteEl.classList.remove("tubed"); return; }
      const me = Net.myId();
      if(T.h !== me) mp.tubeDropPending = null;
      mine = T.h === me && !mp.tubeDropPending;
      if(mine && !state.swimming){
        const d = clampIntoPool((state.lastSwimPos || state.pos).x, (state.lastSwimPos || state.pos).y);
        mp.tdN = (mp.tdN || 0) + 1; mp.td = {n: mp.tdN, x: Math.round(d.x), y: Math.round(d.y)};
        mp.tubeDropPending = d; mine = false; sendMe(true);
      }
      if(mp.tubeDropPending) free = mp.tubeDropPending;
      else if(!T.h){
        free = T;
        if(state.swimming && near(T) && Date.now() - (mp.tqAt || 0) > 500){
          mp.tqAt = Date.now(); mp.tqN = (mp.tqN || 0) + 1; mp.tq = mp.tqN; sendMe(true);
        }
      }
    }
    state.wearingTube = mine && state.swimming;
    spriteEl.classList.toggle("tubed", state.wearingTube);
    tubeEl.style.display = free ? "" : "none";
    if(free){ tubeEl.style.left = free.x + "px"; tubeEl.style.top = free.y + "px"; }
  }
  /* Wet paw prints: for a few seconds after climbing out of the pool, anyone walking leaves
     little paw prints that linger a moment and then fade away. */
  const WET_MS = 3500, PAW_STEP = 20;
  const PAW_SVG = `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><g fill="#2C6E96">
<ellipse cx="10" cy="13" rx="4.6" ry="4"/><ellipse cx="4.2" cy="7.6" rx="1.9" ry="2.4"/><ellipse cx="8" cy="4.6" rx="1.9" ry="2.5"/>
<ellipse cx="12" cy="4.6" rx="1.9" ry="2.5"/><ellipse cx="15.8" cy="7.6" rx="1.9" ry="2.4"/></g></svg>`;
  // who: any object we can hang trail state on (state for me, the remote record for others)
  function pawTrail(who, x, y, wetNow, blocked){
    const now = performance.now();
    if(who._wasWet && !wetNow) who._wetUntil = now + WET_MS;          // just climbed out
    who._wasWet = wetNow;
    if(wetNow || blocked || !(who._wetUntil > now)){ who._pawLast = null; return; }
    const L = who._pawLast;
    if(!L){ who._pawLast = {x, y}; return; }
    const d = Math.hypot(x - L.x, y - L.y);
    if(d < PAW_STEP) return;
    const ang = Math.atan2(y - L.y, x - L.x);
    who._pawSide = -(who._pawSide || 1);
    const ox = -Math.sin(ang) * 5 * who._pawSide, oy = Math.cos(ang) * 5 * who._pawSide;
    const el = document.createElement("div");
    el.className = "paw-print";
    el.style.left = (x + ox) + "px"; el.style.top = (y + oy) + "px";
    el.style.transform = `translate(-50%, -50%) rotate(${(ang * 180 / Math.PI + 90).toFixed(0)}deg)`;
    el.innerHTML = PAW_SVG;
    worldEl.appendChild(el);
    setTimeout(() => el.remove(), 6200);
    who._pawLast = {x, y};
  }
  // goggles + vest for the original purple platypus (side view, eyes further forward)
  const SWIM_GEAR_OLDPLAT = `<svg viewBox="0 0 56 65" xmlns="http://www.w3.org/2000/svg">
<path d="M 24 43 Q 27 40 32 40 L 34 42.5 Q 38 44 42 42.5 L 44 40 Q 48 40 50 43 L 51 50 L 23 50 Z" fill="#FF7A2F" stroke="#241811" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M 24 46.5 H 50" stroke="#FFD34D" stroke-width="2.2"/><rect x="35.5" y="44.5" width="5" height="4.5" rx="1" fill="#3A3F46"/>
<path d="M 17 29 Q 34 23 52 27" fill="none" stroke="#2A6FA0" stroke-width="2.4" stroke-linecap="round"/>
<circle cx="11.7" cy="29.6" r="6.6" fill="rgba(140,220,255,0.45)" stroke="#1E5E86" stroke-width="2"/>
<circle cx="32.5" cy="30.7" r="6.6" fill="rgba(140,220,255,0.45)" stroke="#1E5E86" stroke-width="2"/>
<path d="M 18.3 29.4 Q 22 27.6 25.9 30" fill="none" stroke="#1E5E86" stroke-width="2"/>
<path d="M 8 26.5 Q 10 25 12 25.6 M 29 27.6 Q 31 26 33 26.6" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity="0.9"/>
</svg>`;
  // the platypus's breathing straw + sporadic bubbles
  const SWIM_STRAW = `<div class="swim-straw"><svg viewBox="0 0 20 40" xmlns="http://www.w3.org/2000/svg">
<path d="M 10 40 L 10 12 Q 10 5 16 5" fill="none" stroke="#241811" stroke-width="6.5" stroke-linecap="round"/>
<path d="M 10 40 L 10 12 Q 10 5 16 5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
<path d="M 10 40 L 10 12 Q 10 5 16 5" fill="none" stroke="#E8263A" stroke-width="4" stroke-dasharray="4 4" stroke-linecap="butt"/>
</svg><i class="bub b1"></i><i class="bub b2"></i><i class="bub b3"></i></div>`;
  function spriteMarkup(kind, svg, look){
    const gear = (kind === "plat" && (!look || look.b === "purple")) ? SWIM_GEAR_OLDPLAT : SWIM_GEAR;
    return `<span class="tube-worn tube-back">${tubeSVG("back")}</span>` +
      `<span class="flip">${kind === "plat" ? `<span class="plat-outline">${platypusSVG(look)}</span>` : ""}${svg}<span class="swim-gear">${gear}</span></span>` +
      (kind === "plat" ? SWIM_STRAW : "") + `<span class="swim-ring"></span>` +
      `<span class="tube-worn tube-front">${tubeSVG("front")}</span>`;
  }
  const ATTIC_DECALS = `<svg viewBox="0 0 260 330" width="260" height="330" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:0;top:0;pointer-events:none;z-index:1">
<g stroke="#5A3A22" stroke-width="2.5" fill="none" stroke-linecap="round">
<path d="M 40 150 l 30 0 M 36 162 l 38 0"/>
</g>
<path d="M 60 236 L 104 236 L 100 244 L 92 240 L 84 248 L 74 241 L 64 246 Z" fill="#2A1A10" stroke="#241811" stroke-width="2"/>
<path d="M 170 116 L 214 116 L 212 124 L 202 120 L 194 128 L 184 121 L 174 126 Z" fill="#2A1A10" stroke="#241811" stroke-width="2"/>
<path d="M 188 292 L 224 292 L 220 300 L 210 296 L 200 302 L 192 298 Z" fill="#2A1A10" stroke="#241811" stroke-width="2"/>
<g stroke="#5A3A22" stroke-width="2" fill="none" stroke-linecap="round">
<path d="M 110 300 L 118 290 L 124 298 L 132 286"/>
<path d="M 30 280 L 38 272 L 44 280"/>
</g>
</svg>`;
  function slideSVG(){ return `<svg viewBox="0 0 200 340" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="sBed" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#FFB93E"/></linearGradient>
<linearGradient id="sWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0584F"/><stop offset="1" stop-color="#C73B35"/></linearGradient>
<linearGradient id="sBlue" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6CC7F6"/><stop offset="1" stop-color="#3486C6"/></linearGradient>
</defs>
<path d="M 6 326 Q 100 346 196 316" stroke="rgba(0,0,0,0.16)" stroke-width="14" fill="none" stroke-linecap="round"/>
<!-- back ladder rail + support post -->
<path d="M 30 324 L 68 50" stroke="#241811" stroke-width="11" stroke-linecap="round"/>
<path d="M 30 324 L 68 50" stroke="#3486C6" stroke-width="6" stroke-linecap="round"/>
<path d="M 136 222 L 136 322" stroke="#241811" stroke-width="11" stroke-linecap="round"/>
<path d="M 136 222 L 136 322" stroke="#4FA6E0" stroke-width="6" stroke-linecap="round"/>
<!-- rungs -->
<g stroke="#241811" stroke-width="8" stroke-linecap="round"><line x1="15" y1="290" x2="35" y2="290"/><line x1="20" y1="250" x2="40" y2="250"/><line x1="26" y1="210" x2="46" y2="210"/><line x1="31" y1="170" x2="51" y2="170"/><line x1="37" y1="130" x2="57" y2="130"/><line x1="43" y1="90" x2="63" y2="90"/></g>
<g stroke="#A8743F" stroke-width="4.5" stroke-linecap="round"><line x1="15" y1="290" x2="35" y2="290"/><line x1="20" y1="250" x2="40" y2="250"/><line x1="26" y1="210" x2="46" y2="210"/><line x1="31" y1="170" x2="51" y2="170"/><line x1="37" y1="130" x2="57" y2="130"/><line x1="43" y1="90" x2="63" y2="90"/></g>
<!-- platform + hand rails -->
<path d="M 44 44 L 104 44 L 104 58 L 48 58 Z" fill="#3486C6" stroke="#241811" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M 54 44 C 50 22 64 12 78 20" fill="none" stroke="#241811" stroke-width="9" stroke-linecap="round"/>
<path d="M 54 44 C 50 22 64 12 78 20" fill="none" stroke="#6CC7F6" stroke-width="5" stroke-linecap="round"/>
<path d="M 92 44 C 90 24 102 16 114 26" fill="none" stroke="#241811" stroke-width="9" stroke-linecap="round"/>
<path d="M 92 44 C 90 24 102 16 114 26" fill="none" stroke="#6CC7F6" stroke-width="5" stroke-linecap="round"/>
<!-- chute side wall (profile) -->
<path d="M 76 56 C 102 78 114 132 122 180 C 130 228 138 274 160 294 L 198 306 L 198 320 L 158 308 C 134 288 124 240 116 190 C 108 142 98 92 76 70 Z" fill="url(#sWall)" stroke="#241811" stroke-width="4" stroke-linejoin="round"/>
<!-- front ladder rail -->
<path d="M 12 324 L 50 50" stroke="#241811" stroke-width="11" stroke-linecap="round"/>
<path d="M 12 324 L 50 50" stroke="#4FA6E0" stroke-width="6" stroke-linecap="round"/>
<!-- chute bed (the sliding surface) -->
<path d="M 104 44 C 130 66 142 120 150 168 C 158 216 166 262 188 282 L 198 288 L 198 306 L 160 294 C 138 274 130 228 122 180 C 114 132 102 78 76 56 L 76 44 Z" fill="url(#sBed)" stroke="#241811" stroke-width="4" stroke-linejoin="round"/>
<path d="M 94 54 C 118 78 128 128 136 174 C 144 220 152 262 176 286" fill="none" stroke="#fff" stroke-width="5" opacity="0.55" stroke-linecap="round"/>
<path d="M 104 44 C 130 66 142 120 150 168 C 158 216 166 262 188 282 L 198 288" fill="none" stroke="#F0584F" stroke-width="7" stroke-linecap="round"/>
<path d="M 76 56 C 102 78 114 132 122 180 C 130 228 138 274 160 294 L 198 306" fill="none" stroke="#F0584F" stroke-width="7" stroke-linecap="round"/>
<path d="M 104 44 C 130 66 142 120 150 168 C 158 216 166 262 188 282 L 198 288" fill="none" stroke="#241811" stroke-width="2"/>
<path d="M 76 56 C 102 78 114 132 122 180 C 130 228 138 274 160 294 L 198 306" fill="none" stroke="#241811" stroke-width="2"/>
<circle cx="136" cy="222" r="4" fill="#E8C35A" stroke="#241811" stroke-width="2"/>
</svg>`; }
  const CUSTOM_ART = {
    slide: slideSVG,
    decor: decorSVG, camping: campSVG,
    trunk: trunkSVG, wardrobe: wardrobeSVG, horse: horseSVG, bins: binsSVG, hedge: bushSVG, hedge2: bushSVG, oak: treeSVG,
    shed: shedSVG, doghouse: doghouseSVG, tree: treeSVG, bush: bushSVG,
    car: carSVG, shelf: shelfSVG, boxes: boxesSVG,
    fridge: fridgeSVG, cabinet: cabinetSVG, table: tableSVG,
    closet: closetSVG, dresser: dresserSVG, bed: bedSVG,
    tub: tubSVG, cabinet2: cabinet2SVG, basket: basketSVG,
    couch: couchSVG, tvstand: tvStandSVG, bookshelf: bookshelfSVG
  };

