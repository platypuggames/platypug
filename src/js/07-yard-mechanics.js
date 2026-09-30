  /* ---------------- Backyard slide ---------------- */
  // chute centerline (world coords) — follows the curved slide art, high end north, low end south-east
  const SLIDE_PTS = [[172, 1080], [210, 1116], [235, 1126], [270, 1137], [292, 1165], [300, 1186]];
  const SLIDE = {y1:172, y2:300, lowY:270, half:24};
  function chuteCenter(y){
    const P = SLIDE_PTS;
    if(y <= P[0][0]) return P[0][1];
    for(let i=1;i<P.length;i++){ if(y <= P[i][0]){ const t=(y-P[i-1][0])/(P[i][0]-P[i-1][0]); return P[i-1][1]+(P[i][1]-P[i-1][1])*t; } }
    return P[P.length-1][1];
  }
  function chuteX(y){ const c = chuteCenter(y); return {l: c - SLIDE.half, r: c + SLIDE.half}; }
  function inChute(x, y){ if(y < SLIDE.y1 || y > SLIDE.y2) return false; const c = chuteX(y); return x >= c.l && x <= c.r; }
  function inLowEnd(x, y){ return y >= SLIDE.lowY && inChute(x, y); }
  // the low end of the slide sits on the ground: you can't walk under it sideways,
  // only step onto it from the south (or slide off it)
  function slideBlocks(nx, ny){
    if(state.sliding) return false;
    if(!inLowEnd(nx, ny)) return false;
    if(inLowEnd(state.pos.x, state.pos.y)) return false;
    return !(state.pos.y > SLIDE.y2);
  }
  function onTopOfSlide(on){
    spriteEl.style.zIndex = on ? "7" : "";
    footEl.style.visibility = on ? "hidden" : "";
  }
  function startSlide(){
    state.sliding = true; state.busy = true; state.slideMode = "slide";
    onTopOfSlide(true);
    spriteEl.classList.add("sliding");
    state.pos.x = chuteCenter(state.pos.y);
    const pts = SLIDE_PTS.filter(p => p[0] > state.pos.y + 4).map(p => ({x:p[1], y:p[0]}));
    pts.push({x: 1186, y: SLIDE.y2 + 30});
    const next = () => {
      const p = pts.shift();
      if(!p){
        state.sliding = false; state.busy = false; state.slideMode = null;
        spriteEl.classList.remove("sliding");
        onTopOfSlide(false);
        return;
      }
      setTarget(p.x, p.y, next);
    };
    next();
  }
  const SLIDE_TOP = {x:1076, y:166, r:40};   // generous grab zone around the ladder top / platform
  function handleSlide(px, py){
    if(state.sliding) return;
    if(state.slideMode !== "climb" && Math.hypot(state.pos.x - SLIDE_TOP.x, state.pos.y - SLIDE_TOP.y) < SLIDE_TOP.r){
      startSlide();
      return;
    }
    const now = inChute(state.pos.x, state.pos.y), before = inChute(px, py);
    if(!state.slideMode){
      if(now && !before){
        if(py < SLIDE.y1) startSlide();                              // came down off the ladder: whee
        else if(py > SLIDE.y2){ state.slideMode = "climb"; onTopOfSlide(true); } // walking up from the bottom
        else state.slideMode = "under";                              // came in from the side: walk underneath
      }
    } else if(state.slideMode === "climb"){
      if(!now){ state.slideMode = null; onTopOfSlide(false); }
      else if(state.pos.y < (SLIDE.y1 + SLIDE.y2) / 2) startSlide(); // halfway up: slip back down
    } else if(state.slideMode === "under"){
      if(!now) state.slideMode = null;
    }
  }

  /* ---------------- Diving board (right end of the pool) ----------------
     Step near the back of the board and it pulls you on (like the slide top / tunnel holes):
     you trot to the tip, the board flexes, and you bounce up in an arc and splash into the middle. */
  const BOARD = {x: 1100, y: -40, backX: 1236, tipX: 1114, cy: -12, grabR: 40};
  const DIVE_LAND = {x: POOL.x + POOL.w / 2, y: POOL.y + POOL.h / 2};
  const BOARD_SVG = `<svg viewBox="0 0 170 60" width="170" height="60" xmlns="http://www.w3.org/2000/svg" overflow="visible">
<defs><linearGradient id="dbTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCEAF5"/></linearGradient></defs>
<ellipse cx="44" cy="50" rx="44" ry="7" fill="#0E4E78" opacity="0.22"/>
<rect x="124" y="30" width="38" height="24" rx="4" fill="#8E9AA6" stroke="#241811" stroke-width="2.5"/>
<rect x="128" y="34" width="30" height="6" rx="2" fill="#B8C3CD"/>
<circle cx="131" cy="48" r="2" fill="#241811"/><circle cx="155" cy="48" r="2" fill="#241811"/>
<g class="db-plank">
  <rect x="6" y="18" width="150" height="24" rx="11" fill="#1F7FB0" stroke="#241811" stroke-width="2.5"/>
  <rect x="6" y="14" width="150" height="24" rx="11" fill="url(#dbTop)" stroke="#241811" stroke-width="2.5"/>
  <g fill="#9FC3DE">${Array.from({length: 18}, (_, i) => `<circle cx="${20 + i * 7}" cy="${22 + (i % 2) * 7}" r="1.4"/>`).join("")}</g>
  <path d="M 16 18 H 146" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>
</g>
</svg>`;
  let boardEl = null;
  function buildBoard(){
    boardEl = document.createElement("div");
    boardEl.className = "dive-board";
    boardEl.style.left = BOARD.x + "px"; boardEl.style.top = BOARD.y + "px";
    boardEl.innerHTML = BOARD_SVG;
    worldEl.appendChild(boardEl);
  }
  function makeSplash(x, y){
    const el = document.createElement("div");
    el.className = "splash";
    el.style.left = x + "px"; el.style.top = y + "px";
    el.innerHTML = `<svg viewBox="-50 -40 100 70" xmlns="http://www.w3.org/2000/svg" overflow="visible">
<ellipse class="sp-ring" cx="0" cy="12" rx="30" ry="10" fill="none" stroke="#fff" stroke-width="4"/>
<ellipse class="sp-ring r2" cx="0" cy="12" rx="30" ry="10" fill="none" stroke="#DFF6FF" stroke-width="3"/>
${[-34, -20, -6, 8, 22, 34].map((dx, i) => `<circle class="sp-drop" style="--dx:${dx}px;--dy:${-22 - (i % 3) * 9}px" cx="0" cy="8" r="${3 + (i % 2)}" fill="#E6F8FF" stroke="#2E9BD1" stroke-width="1.5"/>`).join("")}
</svg>`;
    worldEl.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  function handleBoard(){
    if(state.busy || state.sliding || state.underground || state.swimming) { if(!state.sliding) state.boardPull = false; return; }
    if(state.phase !== "hiding" && state.phase !== "seeking") return;
    if(state.mp && mp.hide) return;
    const d = Math.hypot(state.pos.x - BOARD.backX, state.pos.y - BOARD.cy);
    if(state.boardLatch){ if(d > BOARD.grabR + 12) state.boardLatch = false; else return; }
    if(d < 10){ state.boardPull = false; startDive(); return; }
    if(d < BOARD.grabR){ state.boardPull = true; state.target = {x: BOARD.backX, y: BOARD.cy}; state.onArrive = null; }
    else state.boardPull = false;
  }
  function startDive(){
    state.busy = true; state.sliding = true; state.slideMode = "dive";
    onTopOfSlide(true);
    state.pos.x = BOARD.backX; state.pos.y = BOARD.cy;
    const flip = spriteEl.querySelector(".flip"); if(flip) flip.style.transform = "scaleX(1)";   // face the pool
    setTarget(BOARD.tipX, BOARD.cy, () => {
      boardEl.classList.remove("boing"); void boardEl.offsetWidth; boardEl.classList.add("boing");
      spriteEl.classList.add("board-squash");
      setTimeout(() => {
        spriteEl.classList.remove("board-squash");
        spriteEl.classList.add("diving"); state.diving = true;
        setTarget(DIVE_LAND.x, DIVE_LAND.y, () => {
          spriteEl.classList.remove("diving"); state.diving = false;
          state.sliding = false; state.busy = false; state.slideMode = null;
          onTopOfSlide(false);
          state.boardLatch = true;
          makeSplash(state.pos.x, state.pos.y);
        });
      }, 260);
    });
  }
  /* ---------------- Front-yard tunnel ---------------- */
  const HOLES = [{x:720, y:1330}, {x:1010, y:1330}];
  const TUNNEL_FLOOR = [[716, 1332], [724, 1334], [764, 1414], [966, 1414], [1006, 1334], [1014, 1332]];   // side-view floor line: dips down, runs flat, comes back up
  const TUN_OVERLAY = {x:630, y:1244};
  const HOLE_SVG = `<svg viewBox="0 0 80 54" width="80" height="54" xmlns="http://www.w3.org/2000/svg">
<path d="M 6 30 Q 4 14 22 12 Q 30 2 42 8 Q 56 2 62 12 Q 78 14 74 30 Q 76 44 60 44 L 20 44 Q 4 44 6 30 Z" fill="#9A6B44" stroke="#241811" stroke-width="2.5"/>
<g fill="#7A5236"><circle cx="16" cy="20" r="4"/><circle cx="64" cy="22" r="4.5"/><circle cx="40" cy="10" r="3.5"/><circle cx="10" cy="36" r="3"/><circle cx="70" cy="38" r="3"/></g>
<g fill="#B98A5E"><circle cx="26" cy="14" r="2.5"/><circle cx="56" cy="12" r="2.5"/><circle cx="72" cy="30" r="2"/></g>
<ellipse cx="40" cy="30" rx="24" ry="13" fill="#5A3A22" stroke="#241811" stroke-width="2.5"/>
<ellipse cx="40" cy="32" rx="19" ry="9" fill="#140A04"/>
<g fill="#9A6B44" stroke="#241811" stroke-width="1.5"><circle cx="4" cy="46" r="3"/><circle cx="76" cy="48" r="3.5"/><circle cx="30" cy="50" r="2.5"/><circle cx="54" cy="50" r="2.5"/></g>
</svg>`;
  const TUNNEL_SVG = `<svg viewBox="0 0 470 236" width="470" height="236" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="tuDirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E3F2A"/><stop offset="1" stop-color="#3A2618"/></linearGradient>
<linearGradient id="tuCave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2C2340"/><stop offset="1" stop-color="#171226"/></linearGradient>
<radialGradient id="tuVig" cx="50%" cy="55%" r="65%"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient>
</defs>
<rect x="0" y="36" width="470" height="200" rx="18" fill="url(#tuDirt)" stroke="#241811" stroke-width="4"/>
<ellipse cx="175" cy="98" rx="6" ry="2" fill="#6B4A33"/><ellipse cx="430" cy="197" rx="3" ry="4" fill="#6B4A33"/><ellipse cx="269" cy="114" rx="3" ry="2" fill="#3E2A1C"/><ellipse cx="224" cy="77" rx="4" ry="2" fill="#3E2A1C"/><ellipse cx="40" cy="204" rx="3" ry="3" fill="#6B4A33"/><ellipse cx="305" cy="209" rx="6" ry="2" fill="#5A3D2A"/><ellipse cx="33" cy="202" rx="4" ry="4" fill="#3E2A1C"/><ellipse cx="83" cy="198" rx="3" ry="4" fill="#5A3D2A"/><ellipse cx="62" cy="208" rx="7" ry="3" fill="#7A5A40"/><ellipse cx="59" cy="200" rx="8" ry="2" fill="#6B4A33"/><ellipse cx="326" cy="112" rx="6" ry="5" fill="#7A5A40"/><ellipse cx="248" cy="209" rx="6" ry="4" fill="#7A5A40"/><ellipse cx="137" cy="106" rx="8" ry="3" fill="#6B4A33"/><ellipse cx="304" cy="136" rx="7" ry="5" fill="#7A5A40"/><ellipse cx="383" cy="174" rx="5" ry="2" fill="#6B4A33"/><ellipse cx="272" cy="167" rx="4" ry="4" fill="#5A3D2A"/><ellipse cx="260" cy="167" rx="3" ry="2" fill="#7A5A40"/><ellipse cx="184" cy="149" rx="7" ry="5" fill="#3E2A1C"/><ellipse cx="45" cy="83" rx="5" ry="5" fill="#6B4A33"/><ellipse cx="41" cy="139" rx="8" ry="5" fill="#7A5A40"/><ellipse cx="376" cy="158" rx="8" ry="4" fill="#6B4A33"/><ellipse cx="246" cy="150" rx="4" ry="2" fill="#3E2A1C"/><ellipse cx="40" cy="115" rx="5" ry="3" fill="#5A3D2A"/><ellipse cx="213" cy="160" rx="6" ry="2" fill="#5A3D2A"/><ellipse cx="239" cy="162" rx="7" ry="4" fill="#5A3D2A"/><ellipse cx="429" cy="170" rx="7" ry="4" fill="#3E2A1C"/><ellipse cx="193" cy="157" rx="4" ry="3" fill="#6B4A33"/><ellipse cx="100" cy="98" rx="4" ry="3" fill="#6B4A33"/><ellipse cx="258" cy="210" rx="4" ry="4" fill="#7A5A40"/><ellipse cx="12" cy="97" rx="6" ry="4" fill="#7A5A40"/><ellipse cx="74" cy="191" rx="7" ry="2" fill="#3E2A1C"/><ellipse cx="455" cy="203" rx="6" ry="5" fill="#3E2A1C"/><ellipse cx="211" cy="86" rx="6" ry="5" fill="#6B4A33"/><ellipse cx="107" cy="77" rx="4" ry="5" fill="#5A3D2A"/><ellipse cx="66" cy="147" rx="7" ry="2" fill="#6B4A33"/><ellipse cx="10" cy="205" rx="4" ry="2" fill="#7A5A40"/><ellipse cx="324" cy="66" rx="3" ry="3" fill="#3E2A1C"/><ellipse cx="86" cy="222" rx="5" ry="4" fill="#7A5A40"/><ellipse cx="252" cy="91" rx="3" ry="5" fill="#3E2A1C"/><ellipse cx="255" cy="183" rx="5" ry="2" fill="#5A3D2A"/><ellipse cx="62" cy="147" rx="8" ry="4" fill="#3E2A1C"/><ellipse cx="434" cy="101" rx="7" ry="2" fill="#5A3D2A"/><ellipse cx="280" cy="152" rx="4" ry="2" fill="#7A5A40"/><ellipse cx="339" cy="83" rx="8" ry="4" fill="#7A5A40"/><ellipse cx="95" cy="151" rx="4" ry="4" fill="#5A3D2A"/><ellipse cx="323" cy="109" rx="4" ry="5" fill="#5A3D2A"/><ellipse cx="112" cy="192" rx="6" ry="4" fill="#6B4A33"/><ellipse cx="24" cy="131" rx="6" ry="4" fill="#5A3D2A"/><ellipse cx="364" cy="214" rx="5" ry="5" fill="#7A5A40"/><ellipse cx="196" cy="80" rx="4" ry="2" fill="#5A3D2A"/><ellipse cx="250" cy="110" rx="5" ry="3" fill="#3E2A1C"/><ellipse cx="329" cy="216" rx="3" ry="5" fill="#7A5A40"/><ellipse cx="419" cy="224" rx="3" ry="2" fill="#3E2A1C"/><ellipse cx="410" cy="111" rx="6" ry="3" fill="#3E2A1C"/><ellipse cx="414" cy="222" rx="5" ry="2" fill="#3E2A1C"/><ellipse cx="247" cy="162" rx="8" ry="2" fill="#5A3D2A"/><ellipse cx="97" cy="92" rx="3" ry="3" fill="#3E2A1C"/><ellipse cx="422" cy="97" rx="7" ry="5" fill="#7A5A40"/><ellipse cx="89" cy="200" rx="7" ry="3" fill="#6B4A33"/><ellipse cx="17" cy="226" rx="3" ry="3" fill="#3E2A1C"/><ellipse cx="456" cy="109" rx="4" ry="2" fill="#7A5A40"/><ellipse cx="118" cy="134" rx="7" ry="3" fill="#7A5A40"/><ellipse cx="142" cy="199" rx="6" ry="3" fill="#6B4A33"/><ellipse cx="388" cy="150" rx="6" ry="5" fill="#5A3D2A"/><ellipse cx="282" cy="98" rx="7" ry="2" fill="#3E2A1C"/><ellipse cx="407" cy="106" rx="7" ry="2" fill="#5A3D2A"/><ellipse cx="98" cy="96" rx="6" ry="2" fill="#6B4A33"/><ellipse cx="176" cy="192" rx="7" ry="5" fill="#6B4A33"/><ellipse cx="296" cy="74" rx="4" ry="3" fill="#7A5A40"/><ellipse cx="31" cy="85" rx="7" ry="5" fill="#6B4A33"/><path d="M 40 40 q 10 20 -4 36 q -8 10 4 22" stroke="#8C6A46" stroke-width="3" fill="none"/><path d="M 300 40 q -6 18 8 30" stroke="#8C6A46" stroke-width="3" fill="none"/><path d="M 440 40 q 8 24 -6 40" stroke="#8C6A46" stroke-width="3" fill="none"/><g transform="translate(60 110)"><path d="M 0 -7 L 6 0 L 0 7 L -6 0 Z" fill="#8FE8FF" stroke="#2A7FA8" stroke-width="1.5"/><circle r="12" fill="#8FE8FF" opacity="0.18"/></g><g transform="translate(420 104)"><path d="M 0 -7 L 6 0 L 0 7 L -6 0 Z" fill="#8FE8FF" stroke="#2A7FA8" stroke-width="1.5"/><circle r="12" fill="#8FE8FF" opacity="0.18"/></g><g transform="translate(42 168) rotate(62) scale(1.0)"><rect x="-16" y="-3.5" width="32" height="7" rx="3" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="-16" cy="-4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="-16" cy="4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="16" cy="-4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="16" cy="4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><rect x="-15" y="-2.5" width="30" height="5" fill="#F3EAD6"/></g><g transform="translate(318 214) rotate(-14) scale(1.0)"><rect x="-16" y="-3.5" width="32" height="7" rx="3" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="-16" cy="-4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="-16" cy="4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="16" cy="-4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="16" cy="4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><rect x="-15" y="-2.5" width="30" height="5" fill="#F3EAD6"/></g><g transform="translate(446 186) rotate(74) scale(0.9)"><rect x="-16" y="-3.5" width="32" height="7" rx="3" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="-16" cy="-4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="-16" cy="4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="16" cy="-4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="16" cy="4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><rect x="-15" y="-2.5" width="30" height="5" fill="#F3EAD6"/></g><g transform="translate(112 222) rotate(20) scale(0.7)"><rect x="-16" y="-3.5" width="32" height="7" rx="3" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="-16" cy="-4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="-16" cy="4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="16" cy="-4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="16" cy="4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><rect x="-15" y="-2.5" width="30" height="5" fill="#F3EAD6"/></g><g transform="translate(400 226) rotate(-8) scale(0.75)"><rect x="-16" y="-3.5" width="32" height="7" rx="3" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="-16" cy="-4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="-16" cy="4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="16" cy="-4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><circle cx="16" cy="4" r="4.5" fill="#F3EAD6" stroke="#241811" stroke-width="1.8"/><rect x="-15" y="-2.5" width="30" height="5" fill="#F3EAD6"/></g><g transform="translate(235 206)"><circle r="30" fill="#BFF3FF" opacity="0.22"/><circle r="18" fill="#DFFAFF" opacity="0.25"/><path d="M -20 -6 L -10 -18 L 10 -18 L 20 -6 L 0 20 Z" fill="#8FE8FF" stroke="#1E6E94" stroke-width="2.5" stroke-linejoin="round"/><path d="M -20 -6 L 20 -6 M -10 -18 L -5 -6 L 0 20 M 10 -18 L 5 -6 L 0 20 M -5 -6 L 0 -18 L 5 -6" stroke="#1E6E94" stroke-width="1.5" fill="none"/><path d="M -10 -18 L -5 -6 L -20 -6 Z" fill="#DFFAFF"/><path d="M 5 -6 L 10 -18 L 20 -6 Z" fill="#5CC8EA"/><path d="M 22 -20 l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 z" fill="#fff"/></g>
<path d="M 0 40 Q 235.0 30 470 40 L 470 48 Q 235.0 38 0 48 Z" fill="#5E9E4E"/>
<rect x="0" y="30" width="470" height="14" rx="7" fill="#7DC96A" stroke="#241811" stroke-width="3"/>
<path d="M 86 88 L 94 90 L 134 170 L 336 170 L 376 90 L 384 88 L 384 22 L 376 24 L 336 104 L 134 104 L 94 24 L 86 22 Z" fill="url(#tuCave)" stroke="#241811" stroke-width="3" stroke-linejoin="round"/>
<path d="M 86 88 L 94 90 L 134 170 L 336 170 L 376 90 L 384 88" fill="none" stroke="#A0785A" stroke-width="16" stroke-linejoin="round"/>
<path d="M 86 88 L 94 90 L 134 170 L 336 170 L 376 90 L 384 88" fill="none" stroke="#6E4E38" stroke-width="16" stroke-dasharray="3 22" stroke-linejoin="round"/>
<path d="M 86 88 L 94 90 L 134 170 L 336 170 L 376 90 L 384 88" fill="none" stroke="#C9A27A" stroke-width="3" stroke-linejoin="round" transform="translate(0 -7)"/>
<path d="M 86 22 L 94 24 L 134 104 L 336 104 L 376 24 L 384 22" fill="none" stroke="#8C6A55" stroke-width="14" stroke-linejoin="round"/>
<path d="M 86 22 L 94 24 L 134 104 L 336 104 L 376 24 L 384 22" fill="none" stroke="#5A4232" stroke-width="14" stroke-dasharray="3 22" stroke-linejoin="round"/>
<rect x="0" y="36" width="470" height="200" rx="18" fill="url(#tuVig)"/>
</svg>`;
  let tunnelPathEl = null;
  function tunnelFloorY(x){
    const F = TUNNEL_FLOOR;
    if(x <= F[0][0]) return F[0][1];
    for(let i=1;i<F.length;i++){ if(x <= F[i][0]){ const t=(x-F[i-1][0])/(F[i][0]-F[i-1][0]); return F[i-1][1]+(F[i][1]-F[i-1][1])*t; } }
    return F[F.length-1][1];
  }
  const TX_MIN = HOLES[0].x + 2, TX_MAX = HOLES[1].x - 2;
  function setUnderground(on){
    state.underground = on;
    spriteEl.classList.toggle("xray", on);
    footEl.style.visibility = on ? "hidden" : "";
    if(tunnelPathEl) tunnelPathEl.classList.toggle("show", on);
    applySecret();
  }
  function buildTunnel(){
    HOLES.forEach(h => {
      const el = document.createElement("div");
      el.className = "tunnel-hole";
      el.style.left = h.x + "px"; el.style.top = h.y + "px";
      el.innerHTML = HOLE_SVG;
      worldEl.appendChild(el);
    });
    tunnelPathEl = document.createElement("div");
    tunnelPathEl.className = "tunnel-path";
    tunnelPathEl.style.left = TUN_OVERLAY.x + "px"; tunnelPathEl.style.top = TUN_OVERLAY.y + "px";
    tunnelPathEl.innerHTML = TUNNEL_SVG;
    worldEl.appendChild(tunnelPathEl);
  }
  // underground: move left/right along the tunnel floor; only exit out the two ends
  /* ---------------- Attic window + trellis ladder (attic <-> backyard) ----------------
     Walk into the attic window (or the foot of the trellis in the backyard) and you're pulled on.
     You climb 30% slower. Nobody can be tagged while on it — but if the platypus steps onto the
     bottom of the trellis it shakes, and any dog on it falls off and is caught. */
  const LADDER_PTS = [[262,305],[298,305],[312,322],[312,440]];
  const LADDER_SEGS = (() => { const a = []; let L = 0;
    for(let i = 1; i < LADDER_PTS.length; i++){ const [x0, y0] = LADDER_PTS[i-1], [x1, y1] = LADDER_PTS[i]; const l = Math.hypot(x1-x0, y1-y0); a.push({x0, y0, x1, y1, l, s: L}); L += l; }
    a.L = L; return a; })();
  const LADDER_TOP = {x: 262, y: 305, r: 24, ladder: "top"};     // inside the attic, at the window
  const LADDER_BOT = {x: 316, y: 452, r: 28, ladder: "bot"};     // backyard, at the foot of the trellis
  const LADDER_SLOW = 0.7;
  function ladPoint(t){
    t = Math.max(0, Math.min(LADDER_SEGS.L, t));
    for(const g of LADDER_SEGS){ if(t <= g.s + g.l){ const u = (t - g.s) / g.l; return {x: g.x0 + (g.x1-g.x0)*u, y: g.y0 + (g.y1-g.y0)*u}; } }
    const e = LADDER_PTS[LADDER_PTS.length-1]; return {x: e[0], y: e[1]};
  }
  function ladProject(px, py){
    let best = 0, bd = Infinity;
    for(const g of LADDER_SEGS){ const vx = g.x1-g.x0, vy = g.y1-g.y0;
      const u = Math.max(0, Math.min(1, ((px-g.x0)*vx + (py-g.y0)*vy) / (g.l*g.l)));
      const d = Math.hypot(px - (g.x0+vx*u), py - (g.y0+vy*u)); if(d < bd){ bd = d; best = g.s + g.l*u; } }
    return {t: best, d: bd};
  }
  function ladTan(t, sgn){
    const tt = Math.max(0, Math.min(LADDER_SEGS.L, t + 0.6 * sgn));
    const g = LADDER_SEGS.find(g => tt >= g.s && tt <= g.s + g.l) || LADDER_SEGS[sgn > 0 ? LADDER_SEGS.length - 1 : 0];
    const l = g.l; return {x: (g.x1 - g.x0) / l * sgn, y: (g.y1 - g.y0) / l * sgn};
  }
  const LADDER_SVG = `<svg viewBox="0 0 40 160" width="40" height="160" xmlns="http://www.w3.org/2000/svg" overflow="visible">
<rect x="6" y="0" width="5" height="160" rx="2" fill="#B98A5E" stroke="#241811" stroke-width="1.5"/>
<rect x="29" y="0" width="5" height="160" rx="2" fill="#B98A5E" stroke="#241811" stroke-width="1.5"/>
<g stroke="#C9A27A" stroke-width="3" stroke-linecap="round">${Array.from({length: 9}, (_, i) => `<line x1="8" y1="${6 + i*18}" x2="32" y2="${24 + i*18}"/><line x1="32" y1="${6 + i*18}" x2="8" y2="${24 + i*18}"/>`).join("")}</g>
<g stroke="#241811" stroke-width="0.8" opacity="0.5">${Array.from({length: 9}, (_, i) => `<line x1="8" y1="${6 + i*18}" x2="32" y2="${24 + i*18}"/>`).join("")}</g>
<path d="M 12 158 C 2 130 26 118 16 94 C 6 70 30 60 20 34 C 14 18 24 8 20 0" fill="none" stroke="#4E9A42" stroke-width="2.6" stroke-linecap="round"/>
<g fill="#6CC05A" stroke="#2F6A28" stroke-width="0.8">${[[8,140],[22,122],[10,104],[25,84],[12,66],[27,46],[16,26],[24,10]].map(([x,y],i) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="3" transform="rotate(${i%2 ? 35 : -35} ${x} ${y})"/>`).join("")}</g>
<g>${[[27,128],[9,78],[28,34]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="#FF8FB3" stroke="#241811" stroke-width="0.8"/><circle cx="${x}" cy="${y}" r="1.2" fill="#FFE27A"/>`).join("")}</g>
</svg>`;
  const WINDOW_SVG = `<svg viewBox="0 0 30 48" width="30" height="48" xmlns="http://www.w3.org/2000/svg">
<rect x="2" y="2" width="26" height="44" rx="3" fill="#8C6A55" stroke="#241811" stroke-width="2"/>
<rect x="6" y="6" width="18" height="36" rx="2" fill="#BFE6F7" stroke="#241811" stroke-width="1.5"/>
<path d="M 15 6 V 42 M 6 24 H 24" stroke="#8C6A55" stroke-width="2"/>
<path d="M 9 10 L 12 10 M 9 14 L 11 14" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  let ladderEl = null;
  function buildLadder(){
    const win = document.createElement("div");
    win.className = "attic-window";
    win.style.left = "266px"; win.style.top = "281px";
    win.innerHTML = WINDOW_SVG;
    worldEl.appendChild(win);
    ladderEl = document.createElement("div");
    ladderEl.className = "trellis";
    ladderEl.style.left = "292px"; ladderEl.style.top = "296px";
    ladderEl.innerHTML = LADDER_SVG;
    worldEl.appendChild(ladderEl);
  }
  function shakeLadder(){
    if(!ladderEl) return;
    ladderEl.classList.remove("shake"); void ladderEl.offsetWidth; ladderEl.classList.add("shake");
  }
  function startLadder(end){
    const seeker = state.mp ? mp.myRole === "plat" : state.phase === "seeking";
    state.onLadder = true;
    state.ladT = end === "top" ? 0 : LADDER_SEGS.L;
    const p = ladPoint(state.ladT);
    state.pos.x = p.x; state.pos.y = p.y;
    state.target = {x: p.x, y: p.y};
    state.ladLockUntil = performance.now() + 450;
    state.ladHold = true; state.ladHoldAt = performance.now();
    spriteEl.classList.add("climbing");
    if(seeker && end === "bot"){                               // platypus grabs the trellis: it shakes!
      shakeLadder();
      if(state.mp){ mp.lskN = (mp.lskN || 0) + 1; mp.lsk = {n: mp.lskN, x: Math.round(LADDER_BOT.x), y: Math.round(LADDER_BOT.y)}; }
    }
    if(state.mp) sendMe(true);
  }
  function leaveLadder(end){
    state.onLadder = false;
    spriteEl.classList.remove("climbing");
    const out = end === "top" ? {x: LADDER_TOP.x - 34, y: LADDER_TOP.y} : {x: LADDER_BOT.x + 14, y: LADDER_BOT.y + 22};
    state.holeExited = end === "top" ? LADDER_TOP : LADDER_BOT; state.holePull = null;
    state.target = {x: out.x, y: out.y};
    if(state.mp) sendMe(true);
    return out;
  }
  // knocked off by a shake: drop down to where the platypus is
  function fallOffLadder(x, y){
    if(!state.onLadder) return;
    state.onLadder = false;
    spriteEl.classList.remove("climbing");
    state.pos.x = x + 26; state.pos.y = y + 6;
    state.target = {x: state.pos.x, y: state.pos.y};
    state.holeExited = LADDER_BOT;
    spriteEl.classList.remove("ladder-fall"); void spriteEl.offsetWidth; spriteEl.classList.add("ladder-fall");
    setTimeout(() => spriteEl && spriteEl.classList.remove("ladder-fall"), 600);
    if(state.mp) sendMe(true);
  }
  function ladderMove(nx, ny){
    const step = Math.hypot(nx - state.pos.x, ny - state.pos.y);
    const unlocked = performance.now() >= (state.ladLockUntil || 0);
    let t = state.ladT;
    const L = LADDER_SEGS.L;
    const kb = keyboardActive && state.keyDir;
    let d = kb ? state.keyDir : null;
    let goal = null, exitEnd = null;
    if(!kb){
      const tx = state.target.x, ty = state.target.y, rm = roomAt(tx, ty), pr = ladProject(tx, ty);
      if(rm === "attic" && Math.hypot(tx - LADDER_TOP.x, ty - LADDER_TOP.y) > 16){ goal = 0; exitEnd = "top"; }
      else if(rm === "backyard" && pr.d > 22){ goal = L; exitEnd = "bot"; }
      else goal = pr.t;
      if(!exitEnd) state.ladHold = false;
    } else {
      const outTop = -(ladTan(0, 1).x * d.x + ladTan(0, 1).y * d.y), outBot = ladTan(L, 1).x * d.x + ladTan(L, 1).y * d.y;
      if(t <= 0.5 && outTop > 0.3) exitEnd = "top";
      else if(t >= L - 0.5 && outBot > 0.3) exitEnd = "bot";
      else state.ladHold = false;
    }
    if(exitEnd && unlocked && !state.ladHold && ((exitEnd === "top" && t <= 0.5) || (exitEnd === "bot" && t >= L - 0.5))) return leaveLadder(exitEnd);
    let rem = step;
    for(let k = 0; k < 6 && rem > 0.01; k++){
      let sgn;
      if(kb){
        const f = t < L - 0.01 ? ladTan(t, 1) : null, b = t > 0.01 ? ladTan(t, -1) : null;
        const qf = f ? f.x*d.x + f.y*d.y : -1, qb = b ? b.x*d.x + b.y*d.y : -1;
        if(Math.max(qf, qb) < 0.25) break;
        sgn = qf >= qb ? 1 : -1;
      } else {
        if(Math.abs(goal - t) < 0.01) break;
        sgn = goal > t ? 1 : -1;
      }
      const bounds = [0].concat(LADDER_SEGS.map(g => g.s + g.l));
      let stop = sgn > 0 ? L : 0;
      if(!kb) stop = goal;
      for(const bb of bounds){ if(sgn > 0 && bb > t + 0.01 && bb < stop) stop = bb; if(sgn < 0 && bb < t - 0.01 && bb > stop) stop = bb; }
      const nt = sgn > 0 ? Math.min(stop, t + rem) : Math.max(stop, t - rem);
      rem -= Math.abs(nt - t); t = nt;
    }
    state.ladT = t;
    if(!kb){ const p = ladPoint(goal); state.target = exitEnd ? {x: state.target.x, y: state.target.y} : {x: p.x, y: p.y}; }
    return ladPoint(t);
  }
  /* ---------------- Secret passage ----------------
     Dig on the tunnel floor right above the buried diamond and a hidden passage opens, running
     under the front yard to a bare dirt patch in its bottom-left corner. Until it's dug open
     there's no sign of it underground, and the dirt patch can't be dug from above. */
  const SECRET_JX = 865;                                            // tunnel-floor x right above the diamond
  // straight 45° drop from the tunnel floor to the bottom of the yard, a flat run west, then the same
  // steep climb up to the hole as the original tunnel's ends
  // straight down from the dig spot, a run west, straight up to just right of the backyard doghouse,
  // then a 45° climb into its doorway
  const SECRET_PTS = [[865,1414],[865,1560],[590,1560],[590,510],[480,400]];
  const SECRET_HOLE = {x: 480, y: 410, r: 34};   // the doghouse doorway (walk into it to go down)
  const SECRET_OUT = {x: 480, y: 448};
  const SECRET_SEGS = (() => { const a = []; let L = 0;
    for(let i = 1; i < SECRET_PTS.length; i++){ const [x0, y0] = SECRET_PTS[i-1], [x1, y1] = SECRET_PTS[i]; const l = Math.hypot(x1-x0, y1-y0); a.push({x0, y0, x1, y1, l, s: L}); L += l; }
    a.L = L; return a; })();
  function secretPoint(t){
    t = Math.max(0, Math.min(SECRET_SEGS.L, t));
    for(const g of SECRET_SEGS){ if(t <= g.s + g.l){ const u = (t - g.s) / g.l; return {x: g.x0 + (g.x1-g.x0)*u, y: g.y0 + (g.y1-g.y0)*u}; } }
    const e = SECRET_PTS[SECRET_PTS.length-1]; return {x: e[0], y: e[1]};
  }
  function secretProject(px, py){
    let best = 0, bd = Infinity;
    for(const g of SECRET_SEGS){
      const vx = g.x1-g.x0, vy = g.y1-g.y0;
      const u = Math.max(0, Math.min(1, ((px-g.x0)*vx + (py-g.y0)*vy) / (g.l*g.l)));
      const d = Math.hypot(px - (g.x0+vx*u), py - (g.y0+vy*u));
      if(d < bd){ bd = d; best = g.s + g.l*u; }
    }
    return best;
  }
  const SECRET_O = {x: 360, y: 340};                                // overlay origin (world)
  // Drawn as one continuous tube (walls on both sides, dark inside) following the walking line,
  // so corners and vertical shafts join cleanly and walls never cross.
  function secretPathSVG(){
    const O = SECRET_O, HALF = 33, WALL = 16, DIRT = 34;
    const C = SECRET_PTS.map(([x, y]) => [x - O.x, y - O.y - HALF]);   // tube centre: the walking line is its floor
    const d = "M " + C.map(p => p.join(" ")).join(" L ");
    const mf = 1414 - O.y;
    // nothing is drawn inside the original tunnel: the passage only appears below its floor
    const M = {x0: 634 - O.x, x1: 1096 - O.x, y1: 1476 - O.y};
    const noMainCave = `M -300 -300 H 1300 V 1700 H -300 Z M ${M.x0} -300 H ${M.x1} V ${mf - 8} H ${M.x0} Z`;
    const noMainBox = `M -300 -300 H 1300 V 1700 H -300 Z M ${M.x0} -300 H ${M.x1} V ${M.y1} H ${M.x0} Z`;
    const W = 2 * HALF, tube = W + 2 * WALL, dirtW = tube + 2 * DIRT;
    let pebbles = "";
    for(let i = 1; i < C.length; i++){
      const [x0, y0] = C[i-1], [x1, y1] = C[i], L = Math.hypot(x1-x0, y1-y0), nx = -(y1-y0)/L, ny = (x1-x0)/L;
      for(let t = 40; t < L - 30; t += 58){
        const side = (Math.round(t / 58) % 2) ? 1 : -1, off = side * (tube/2 + 14 + (t % 9));
        pebbles += `<ellipse cx="${(x0 + (x1-x0)*t/L + nx*off).toFixed(1)}" cy="${(y0 + (y1-y0)*t/L + ny*off).toFixed(1)}" rx="${3 + t%4}" ry="2.5" fill="#6B4A33"/>`;
      }
    }
    return `<svg viewBox="0 0 760 1300" width="760" height="1300" xmlns="http://www.w3.org/2000/svg" overflow="visible">
<defs>
  <clipPath id="scNoCave"><path d="${noMainCave}" clip-rule="evenodd"/></clipPath>
  <clipPath id="scNoBox"><path d="${noMainBox}" clip-rule="evenodd"/></clipPath>
</defs>
<g clip-path="url(#scNoBox)" stroke-linejoin="miter" stroke-linecap="butt" fill="none">
  <path d="${d}" stroke="#241811" stroke-width="${dirtW + 6}"/>
  <path d="${d}" stroke="#402A1C" stroke-width="${dirtW}"/>
  ${pebbles}
</g>
<g clip-path="url(#scNoCave)" stroke-linejoin="miter" stroke-linecap="butt" fill="none">
  <path d="${d}" stroke="#A0785A" stroke-width="${tube}"/>
  <path d="${d}" stroke="#6E4E38" stroke-width="${tube}" stroke-dasharray="3 22"/>
  <path d="${d}" stroke="#171226" stroke-width="${W}"/>
</g>
</svg>`;
  }
  let secretPathEl = null;
  function buildSecret(){
    secretPathEl = document.createElement("div");
    secretPathEl.className = "tunnel-path secret-path";
    secretPathEl.style.left = SECRET_O.x + "px"; secretPathEl.style.top = SECRET_O.y + "px";
    secretPathEl.innerHTML = secretPathSVG();
    worldEl.appendChild(secretPathEl);
    applySecret();
  }
  function applySecret(){
    if(secretPathEl) secretPathEl.classList.toggle("show", !!(state.secretOpen && state.underground));
  }
  function openSecret(announce){
    if(state.secretOpen) return;
    state.secretOpen = true;
    applySecret();
    if(state.mp) sendMe(true);
    if(announce) showToast("💎 You dug up a secret passage!", 2200);
  }
  function canDigUnder(){
    if(!state.underground || state.busy || state.sliding || state.phase !== "hiding") return false;
    if(state.mp && (mp.hide || mp.myRole !== "pug")) return false;
    return true;
  }
  function digUnder(){
    state.busy = true;
    state.target = {x: state.pos.x, y: state.pos.y};
    spriteEl.classList.add("digging");
    setTimeout(() => {
      spriteEl.classList.remove("digging");
      state.busy = false;
      const above = (state.tunSeg || "A") === "A" && Math.abs(state.pos.x - SECRET_JX) < 24;
      if(above && !state.secretOpen) openSecret(true);
      else if(above) showToast("Already dug through here!");
      else showToast("Just dirt down here…", 1200);
    }, 550);
  }

  // underground: move along the tunnel floor (and the secret passage once it's open);
  // you only come up out of the ends
  /* Arrow keys underground work like any floor: each arrow moves you that way on the screen.
     You follow whichever bit of tunnel best matches the direction you're pushing (at corners and
     the 3-way junction too); pushing into a wall does nothing; pushing out of an end climbs out. */
  const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return {x: x / l, y: y / l}; };
  function aTan(x, sgn){ const e = 0.6 * sgn; return norm(sgn, (tunnelFloorY(x + e) - tunnelFloorY(x)) / Math.abs(e)); }
  function bTan(t, sgn){
    const L = SECRET_SEGS.L, tt = Math.max(0, Math.min(L, t + 0.6 * sgn));
    const g = SECRET_SEGS.find(g => tt >= g.s && tt <= g.s + g.l) || SECRET_SEGS[sgn > 0 ? 0 : SECRET_SEGS.length - 1];
    return norm((g.x1 - g.x0) * sgn, (g.y1 - g.y0) * sgn);
  }
  function tunnelKeyMove(step, d){
    const unlocked = performance.now() >= (state.tunnelLockUntil || 0);
    let seg = state.tunSeg || "A", t = state.tunT || 0, x = state.pos.x;
    const dot = v => v.x * d.x + v.y * d.y;
    const exitTo = (hole, out) => { setUnderground(false); state.holeExited = hole; state.holePull = null; state.target = {x: out.x, y: out.y}; return out; };
    // climbing out of an end
    if(unlocked && seg === "A" && x <= TX_MIN + 3 && dot(aTan(x + 1, -1)) > 0.3) return exitTo(HOLES[0], {x: HOLES[0].x - 42, y: HOLES[0].y});
    if(unlocked && seg === "A" && x >= TX_MAX - 3 && dot(aTan(x - 1, 1)) > 0.3) return exitTo(HOLES[1], {x: HOLES[1].x + 42, y: HOLES[1].y});
    if(seg === "B" && t >= SECRET_SEGS.L - 3 && dot(bTan(SECRET_SEGS.L, 1)) <= 0.3) state.dhHold = false;
    if(unlocked && seg === "B" && t >= SECRET_SEGS.L - 3 && !state.dhHold && dot(bTan(SECRET_SEGS.L, 1)) > 0.3) return exitTo(SECRET_HOLE, {x: SECRET_OUT.x, y: SECRET_OUT.y});
    // the ways you can go from a spot (junction / corners included)
    const SNAP = 52;
    const bCorners = SECRET_SEGS.slice(0, -1).map(g => g.s + g.l);
    function optionsAt(sg, p){
      const atJ = state.secretOpen && ((sg === "A" && Math.abs(p - SECRET_JX) < 0.5) || (sg === "B" && p < 0.5));
      const o = [];
      if(sg === "A" || atJ){ const ax = atJ ? SECRET_JX : p;
        if(ax < TX_MAX - 0.01) o.push({seg: "A", sgn: 1, v: aTan(ax, 1)});
        if(ax > TX_MIN + 0.01) o.push({seg: "A", sgn: -1, v: aTan(ax, -1)}); }
      if(sg === "B" || atJ){ const bt = atJ ? 0 : p;
        if(bt < SECRET_SEGS.L - 0.01) o.push({seg: "B", sgn: 1, v: bTan(bt, 1)});
        if(bt > 0.5) o.push({seg: "B", sgn: -1, v: bTan(bt, -1)}); }
      return o;
    }
    const bestOf = o => { let b = null, bd = 0.25; for(const q of o){ const v = dot(q.v); if(v > bd){ bd = v; b = Object.assign({q: v}, q); } } return b; };
    let rem = step;
    for(let k = 0; k < 8 && rem > 0.01; k++){
      const p = seg === "A" ? x : t;
      let best = bestOf(optionsAt(seg, p));
      // close to a junction/corner where a turn fits the arrow better? keep going to it, then turn
      const nodes = seg === "A" ? (state.secretOpen ? [SECRET_JX] : []) : [0].concat(bCorners);
      for(const nd of nodes){
        const gap = nd - p;
        if(Math.abs(gap) < 0.5 || Math.abs(gap) > SNAP) continue;
        const nb = bestOf(optionsAt(seg, nd).filter(o => !(o.seg === seg && o.sgn === -Math.sign(gap))));
        if(nb && (!best || nb.q > best.q + 0.05)){
          const sgn = Math.sign(gap);
          best = {seg, sgn, v: seg === "A" ? aTan(p, sgn) : bTan(p, sgn), q: nb.q, to: nd};
        }
      }
      if(!best) break;                                        // pushing into a wall
      const atJ = state.secretOpen && ((seg === "A" && Math.abs(x - SECRET_JX) < 0.5) || (seg === "B" && t < 0.5));
      if(atJ && best.seg !== seg){ if(best.seg === "A"){ seg = "A"; x = SECRET_JX; } else { seg = "B"; t = 0; } }
      if(best.seg === "A"){
        const slope = best.v;
        let stop = best.sgn > 0 ? TX_MAX : TX_MIN;
        if(state.secretOpen && (x - SECRET_JX) * best.sgn < -0.5) stop = SECRET_JX;    // pause at the junction to re-choose
        const nx = best.sgn > 0 ? Math.min(stop, x + rem * Math.abs(slope.x)) : Math.max(stop, x - rem * Math.abs(slope.x));
        rem -= Math.abs(nx - x) / Math.max(0.05, Math.abs(slope.x));
        x = nx;
        if(Math.abs(nx - stop) > 0.01) rem = 0;
      } else {
        const bounds = [0].concat(bCorners, [SECRET_SEGS.L]);          // pause at each corner to re-choose
        let stop = best.sgn > 0 ? SECRET_SEGS.L : 0;
        for(const bb of bounds){ if(best.sgn > 0 && bb > t + 0.01 && bb < stop) stop = bb; if(best.sgn < 0 && bb < t - 0.01 && bb > stop) stop = bb; }
        const nt = best.sgn > 0 ? Math.min(stop, t + rem) : Math.max(stop, t - rem);
        rem -= Math.abs(nt - t); t = nt;
      }
    }
    state.tunSeg = seg; state.tunT = t;
    return seg === "A" ? {x, y: tunnelFloorY(x)} : secretPoint(t);
  }
  function tunnelMove(nx, ny){
    if(!state.underground) return null;
    const step = Math.hypot(nx - state.pos.x, ny - state.pos.y);
    if(keyboardActive && state.keyDir) return tunnelKeyMove(step, state.keyDir);
    const tx = state.target.x, ty = state.target.y;
    const unlocked = performance.now() >= (state.tunnelLockUntil || 0);
    let seg = state.tunSeg || "A", t = state.tunT || 0, x = state.pos.x;
    if(seg === "A" && unlocked && state.pos.x <= TX_MIN + 3 && tx < HOLES[0].x - 10){
      setUnderground(false); state.holeExited = HOLES[0]; state.holePull = null;
      const out = {x: HOLES[0].x - 42, y: HOLES[0].y};
      state.target = {x: out.x, y: out.y};
      return out;
    }
    if(seg === "A" && unlocked && state.pos.x >= TX_MAX - 3 && tx > HOLES[1].x + 10){
      setUnderground(false); state.holeExited = HOLES[1]; state.holePull = null;
      const out = {x: HOLES[1].x + 42, y: HOLES[1].y};
      state.target = {x: out.x, y: out.y};
      return out;
    }
    // where on the tunnels is the player aiming?
    const aX = Math.max(TX_MIN, Math.min(TX_MAX, tx));
    const dA = Math.hypot(tx - aX, ty - tunnelFloorY(aX));
    let goal = "A", tb = 0;
    // like the hole ends: at the doghouse end, keep pushing on past it (up into the doghouse) to climb out
    const [ex0, ey0] = SECRET_PTS[SECRET_PTS.length - 2], [ex1, ey1] = SECRET_PTS[SECRET_PTS.length - 1];
    const eL = Math.hypot(ex1 - ex0, ey1 - ey0), ux = (ex1 - ex0) / eL, uy = (ey1 - ey0) / eL;
    const pastEnd = state.secretOpen && ((tx - ex1) * ux + (ty - ey1) * uy) > 10;
    if(state.secretOpen){
      tb = pastEnd ? SECRET_SEGS.L : secretProject(tx, ty);
      const bp = secretPoint(tb);
      if(pastEnd && seg === "B") goal = "B";
      else if(Math.hypot(tx - bp.x, ty - bp.y) < dA) goal = "B";
    }
    if(!pastEnd) state.dhHold = false;           // you came in through the doghouse still pushing that way: let go first
    if(seg === "B" && goal === "B" && unlocked && t >= SECRET_SEGS.L - 3 && pastEnd && !state.dhHold){
      setUnderground(false); state.holeExited = SECRET_HOLE; state.holePull = null;
      const out = {x: SECRET_OUT.x, y: SECRET_OUT.y};
      state.target = {x: out.x, y: out.y};
      return out;
    }
    let rem = step;
    for(let k = 0; k < 3 && rem > 0; k++){
      if(seg === "A"){
        const gx = goal === "A" ? aX : SECRET_JX, d = gx - x;
        if(Math.abs(d) <= rem){ x = gx; rem -= Math.abs(d); if(goal === "B"){ seg = "B"; t = 0; continue; } break; }
        x += Math.sign(d) * rem; rem = 0;
      } else {
        const gt = goal === "B" ? tb : 0, d = gt - t;
        if(Math.abs(d) <= rem){ t = gt; rem -= Math.abs(d); if(goal === "A"){ seg = "A"; x = SECRET_JX; continue; } break; }
        t += Math.sign(d) * rem; rem = 0;
      }
    }
    state.tunSeg = seg; state.tunT = t;
    // keep the tick heading for a point on the tunnels (or keep pushing past an end so the exit can trigger)
    if(goal === "A"){
      state.target = {x: (tx < TX_MIN || tx > TX_MAX) ? tx : aX, y: tunnelFloorY(aX)};
    } else {
      const bp = secretPoint(tb);
      state.target = pastEnd ? {x: tx, y: ty} : {x: bp.x, y: bp.y};
    }
    if(seg === "A") return {x, y: tunnelFloorY(x)};
    return secretPoint(t);
  }
  // a fresh tap or key press after coming down through the doghouse counts as letting go
  window.addEventListener("pointerdown", () => { state.dhHold = false; state.ladHold = false; }, true);
  window.addEventListener("keydown", e => { if(!e.repeat){ state.dhHold = false; state.ladHold = false; } }, true);
  // Like the top of the slide: get anywhere near an entrance (from any side) and you're
  // pulled into it. Just after climbing out, the hole you left ignores you until you step away.
  const HOLE_GRAB_R = 40, HOLE_ENTER_R = 12;
  function checkHoleEntry(){
    if(state.underground || state.sliding || state.onLadder || state.busy) return;
    for(const h of (state.secretOpen ? HOLES.concat([SECRET_HOLE]) : HOLES).concat([LADDER_TOP, LADDER_BOT])){
      const d = Math.hypot(state.pos.x - h.x, state.pos.y - h.y);
      const grab = h.r || HOLE_GRAB_R;
      if(state.holeExited === h){ if(d > grab + 8) state.holeExited = null; else continue; }
      if(d < grab && d >= HOLE_ENTER_R && !state.holePull){
        state.holePull = h;                                   // start the slurp toward the hole
        state.target = {x: h.x, y: h.y};
        continue;
      }
      if(d < HOLE_ENTER_R){
        state.holePull = null;
        if(h.ladder){ startLadder(h.ladder); return; }
        if(h === SECRET_HOLE){
          state.tunSeg = "B"; state.tunT = SECRET_SEGS.L;
          const e = secretPoint(SECRET_SEGS.L);
          state.pos.x = e.x; state.pos.y = e.y;
          state.target = {x: state.pos.x, y: state.pos.y};
          state.tunnelLockUntil = performance.now() + 600;
          state.dhHold = true; state.dhHoldAt = performance.now();
          setUnderground(true);
          return;
        }
        state.tunSeg = "A"; state.tunT = 0;
        const x = h === HOLES[0] ? TX_MIN : TX_MAX;
        state.pos.x = x; state.pos.y = tunnelFloorY(x);
        state.target = {x: state.pos.x, y: state.pos.y};
        state.tunnelLockUntil = performance.now() + 600;
        setUnderground(true);
        return;
      }
    }
  }


  /* ---------------- Pug dig ability (yards only) ---------------- */
  const DIG_SVG = '<svg viewBox="0 0 76 42" width="76" height="42" xmlns="http://www.w3.org/2000/svg"><ellipse cx="24" cy="24" rx="21" ry="12" fill="#8C5E36"/><ellipse cx="24" cy="24" rx="17" ry="9" fill="#5A3A22" stroke="#241811" stroke-width="2"/><ellipse cx="24" cy="26" rx="13" ry="6" fill="#140A04"/><path d="M 44 34 Q 46 16 58 14 Q 72 14 74 32 Q 74 38 60 38 L 50 38 Q 44 38 44 34 Z" fill="#9A6B44" stroke="#241811" stroke-width="2"/><g fill="#7A5236"><circle cx="54" cy="22" r="3"/><circle cx="66" cy="26" r="2.5"/><circle cx="58" cy="32" r="2"/></g><g fill="#B98A5E"><circle cx="62" cy="18" r="2"/><circle cx="50" cy="30" r="1.5"/></g><g fill="#9A6B44" stroke="#241811" stroke-width="1"><circle cx="6" cy="36" r="2"/><circle cx="42" cy="12" r="2"/></g></svg>';
  const DIG_SLOW_R = 30;
  function addDigEl(d, fresh){
    const el = document.createElement("div");
    el.className = "dig-spot" + (fresh ? " fresh" : "");
    el.style.left = d.x + "px"; el.style.top = d.y + "px";
    el.innerHTML = DIG_SVG;
    worldEl.appendChild(el);
    return el;
  }
  function canDigHere(){
    if(state.mp && (mp.hide || mp.myRole !== "pug")) return false;
    if(state.phase !== "hiding" || state.busy || state.underground || state.sliding) return false;
    const r = roomAt(state.pos.x, state.pos.y);
    if(onPoolDeck(state.pos.x, state.pos.y)) return false;
    return r === "frontyard" || r === "backyard";
  }
  function nearDig(x, y){
    return (state.digs || []).some(d => Math.hypot(x - (d.x + 14), y - d.y) < DIG_SLOW_R + 8);
  }
  digBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  digBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if(canDigUnder()){ digUnder(); return; }
    if(!canDigHere()) return;
    if((state.digs || []).some(d => Math.hypot(state.pos.x - d.x, state.pos.y - d.y) < 34)){ showToast("Already dug here!"); return; }
    state.busy = true;
    state.target = {x: state.pos.x, y: state.pos.y};
    spriteEl.classList.add("digging");
    setTimeout(() => {
      spriteEl.classList.remove("digging");
      const d = {x: Math.round(state.pos.x), y: Math.round(state.pos.y + 4)};
      if(state.mp){
        mp.myDigs.push(d);
        if(mp.myDigs.length > MP_MAX_DIGS) mp.myDigs.shift();   // oldest hole fills back in
        syncHoles();
        sendMe(true);                                            // share with everyone
      } else {
        state.digs = state.digs || [];
        state.digs.push(d);
        addDigEl(d, true);
      }
      state.busy = false;
    }, 550);
  });
