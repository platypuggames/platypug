  /* ---------------- Movement + camera engine ---------------- */
  let lastTs = null;
  /* ---------------- Front-yard flower bed ----------------
     Two rows of billowy white flowers down the left edge of the front yard. Anyone walking through
     pushes them aside for a moment (you can see the soil underneath). A blanket dropped in the bed
     tucks beneath the petals and snaps to the middle of the bed so it's fully covered. */
  const FLOWER_BED = {x: 26, y: 1194, w: 80, h: 416};
  const FLOWER_CX = FLOWER_BED.x + FLOWER_BED.w / 2;
  function inFlowerBed(x, y){
    const b = FLOWER_BED;
    return x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6;
  }
  function flowerSVG(hue){
    let petals = "";
    for(let i = 0; i < 8; i++){
      const a = i * 45;
      petals += `<ellipse cx="0" cy="-11" rx="7.5" ry="11" transform="rotate(${a})" fill="${hue}" stroke="#D6CEE3" stroke-width="1.3"/>`;
    }
    let inner = "";
    for(let i = 0; i < 8; i++){
      inner += `<ellipse cx="0" cy="-7" rx="5" ry="7" transform="rotate(${i * 45 + 22.5})" fill="#FFFFFF" stroke="#E4DDEE" stroke-width="1"/>`;
    }
    return `<svg viewBox="-25 -25 50 50" xmlns="http://www.w3.org/2000/svg">
      <path d="M-4 6 Q-20 10 -22 22 Q-10 20 -2 10 Z" fill="#6DBE5A" stroke="#3F8A35" stroke-width="1.2"/>
      <path d="M4 6 Q20 10 22 22 Q10 20 2 10 Z" fill="#79C865" stroke="#3F8A35" stroke-width="1.2"/>
      ${petals}${inner}
      <circle r="4.6" fill="#F7CF4A" stroke="#D9A628" stroke-width="1.2"/>
      <circle cx="-1.5" cy="-1.5" r="1.4" fill="#FFF3B8"/>
    </svg>`;
  }
  let FLOWERS = [];
  function buildFlowers(){
    FLOWERS = [];
    const b = FLOWER_BED;
    const soil = document.createElement("div");
    soil.className = "flower-soil";
    soil.style.left = b.x + "px"; soil.style.top = b.y + "px";
    soil.style.width = b.w + "px"; soil.style.height = b.h + "px";
    worldEl.appendChild(soil);
    const svgs = [flowerSVG("#FFFFFF"), flowerSVG("#FBF8FF"), flowerSVG("#FFFDF7")];
    let n = 0;
    for(let y = b.y + 18; y <= b.y + b.h - 14; y += 22){
      for(let c = 0; c < 2; c++){
        const x = b.x + 21 + c * 38 + ((n * 7) % 5) - 2;
        const yy = y + (c ? 11 : 0) + ((n * 3) % 4) - 2;
        if(yy > b.y + b.h - 10) continue;
        const el = document.createElement("div");
        el.className = "flower";
        el.style.left = x + "px"; el.style.top = yy + "px";
        el.innerHTML = svgs[n % 3];
        const rot = (n * 37) % 60 - 30, sc = 0.95 + ((n * 13) % 20) / 100;
        el.style.transform = `rotate(${rot}deg) scale(${sc})`;
        worldEl.appendChild(el);
        FLOWERS.push({el, x, y: yy, rot, sc, ox: 0, oy: 0, sq: 0, key: ""});
        n++;
      }
    }
  }
  const FLOWER_R = 50;
  function flowersFrame(dt){
    if(!FLOWERS.length || !FLOWERS[0].el.isConnected) return;
    const movers = [];
    const playing = spriteEl && (state.phase === "hiding" || state.phase === "seeking");
    if(playing && !state.underground && !spriteEl.classList.contains("hidden-away") && !(state.mp && mp.hide))
      movers.push(state.pos);
    if(state.mp && mp.remotes) for(const r of mp.remotes.values()) if(!r._hid && !r._ug) movers.push(r);
    const b = FLOWER_BED;
    const near = movers.filter(m => m.x > b.x - FLOWER_R && m.x < b.x + b.w + FLOWER_R && m.y > b.y - FLOWER_R && m.y < b.y + b.h + FLOWER_R);
    if(!near.length && FLOWERS.every(f => f.key === "rest")) return;
    for(const f of FLOWERS){
      let tx = 0, ty = 0, tsq = 0;
      for(const m of near){
        const dx = f.x - m.x, dy = (f.y - (m.y - 14)), d = Math.hypot(dx, dy);
        if(d >= FLOWER_R) continue;
        const k = 1 - d / FLOWER_R, ux = d ? dx / d : 1, uy = d ? dy / d : 0;
        tx += ux * 34 * k; ty += uy * 16 * k; tsq = Math.max(tsq, k);
      }
      const rate = (tsq > 0 ? 14 : 2.6) * dt;          // push aside fast, billow back slowly
      const e = Math.min(1, rate);
      f.ox += (tx - f.ox) * e; f.oy += (ty - f.oy) * e; f.sq += (tsq - f.sq) * e;
      if(Math.abs(f.ox) < 0.05 && Math.abs(f.oy) < 0.05 && f.sq < 0.005){ f.ox = f.oy = f.sq = 0; }
      const key = (f.ox || f.oy || f.sq) ? `${f.ox.toFixed(1)},${f.oy.toFixed(1)},${f.sq.toFixed(2)}` : "rest";
      if(key === f.key) continue;
      f.key = key;
      const sc = f.sc * (1 - 0.55 * f.sq), rot = f.rot + f.ox * 1.6;
      f.el.style.transform = `translate(${f.ox.toFixed(1)}px, ${f.oy.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
    }
  }
  // blanket dropped in the bed: centre it so the petals cover it completely
  function snapToFlowerBed(){
    if(state.underground || !inFlowerBed(state.pos.x, state.pos.y)) return;
    const b = FLOWER_BED;
    state.pos.x = FLOWER_CX;
    state.pos.y = clamp(state.pos.y, b.y + 42, b.y + b.h - 8);
    state.target = {x: state.pos.x, y: state.pos.y};
  }

  /* ---------------- Kitchen belly slide ----------------
     The kitchen is the platypus's home turf: run in a straight line on the tile and she flops onto
     her belly and slides, a bit faster. Turning, stopping, or leaving the kitchen stands her back up. */
  const BELLY_BOOST = 1.35, BELLY_WINDUP = 0.35;
  function bellySlideUpdate(dx, dy, dist, dt){
    const iAmPlat = state.mp ? (mp.inGame && mp.myRole === "plat" && state.phase === "seeking") : state.phase === "seeking";
    const can = iAmPlat && dist > 6 && !state.underground && !state.sliding && !state.onLadder && !state.exitGlide &&
      !state.swimming && !(state.frozenUntil && performance.now() < state.frozenUntil) && roomAt(state.pos.x, state.pos.y) === "kitchen";
    if(!can){ setBelly(false); state.bellyDir = null; state.bellyT = 0; return; }
    const ux = dx / dist, uy = dy / dist, d = state.bellyDir;
    const dot = d ? d.x * ux + d.y * uy : 0;
    if(dot > (state.belly ? 0.9 : 0.97)){ state.bellyT = (state.bellyT || 0) + dt; }
    else { state.bellyT = 0; setBelly(false); }
    state.bellyDir = {x: ux, y: uy};
    if(state.bellyT >= BELLY_WINDUP) setBelly(true);
  }
  function setBelly(on){
    if(!!state.belly === on && (!spriteEl || spriteEl.classList.contains("belly") === on)) return;
    state.belly = on;
    if(spriteEl) spriteEl.classList.toggle("belly", on);
  }

  /* ---------------- Living room light switch ----------------
     Step on the switch (lower-right corner) to turn the living room lights off or on.
     Lights off: the room goes very dark, furniture still shows, and you can't see anyone
     else in there (only yourself). Tagging works as normal. Platytag: the host owns it (G.lt). */
  const LIGHT_SW = {x: 1250, y: 872}, LIGHT_SW_R = 18;
  const lights = {darkEl: null, swEl: null, last: null};
  function lightsAreOff(){ return (state.mp && mp.inGame) ? !!(mp.g && mp.g.lt) : !!state.lightsOff; }
  function darkAt(x, y){ return lightsAreOff() && roomAt(x, y) === "livingroom"; }
  function lightsFrame(){
    const off = lightsAreOff();
    if(lights.darkEl) lights.darkEl.classList.toggle("on", off);
    if(lights.swEl) lights.swEl.classList.toggle("off", off);
    const playing = spriteEl && (state.phase === "hiding" || state.phase === "seeking");
    const myRoom = playing && !state.underground ? roomAt(state.pos.x, state.pos.y) : null;
    if(lights.last !== null && off !== lights.last && myRoom === "livingroom") showToast(off ? "Lights out!" : "Lights on!", 1200);
    lights.last = off;
    // classic: the hidden pug's blanket can't be seen in the dark (it can still be found by touch)
    if(!state.mp && blanketEl && blanketRoom === "livingroom") blanketEl.style.visibility = off ? "hidden" : "";
    if(!playing || state.underground || state.onLadder || state.busy){ state.onSwitch = false; return; }
    const on = Math.hypot(state.pos.x - LIGHT_SW.x, state.pos.y - LIGHT_SW.y) < LIGHT_SW_R;
    if(on && !state.onSwitch){
      if(state.mp && mp.inGame){ mp.lq = (mp.lq || 0) + 1; sendMe(true); }
      else state.lightsOff = !state.lightsOff;
    }
    state.onSwitch = on;
  }

  /* ---------------- Laundry basket decoy ----------------
     A pug touching the laundry basket makes an empty blanket pop out and land just below-left of it.
     It looks exactly like a pug's blanket. When a platypus touches it, it flattens and disappears.
     One decoy at a time. Classic: kept in state.decoy. Platytag: the host owns it (G.dc). */
  const DECOY_TOUCH_D = 8, DECOY_FLAT_R = 36;
  const decoy = {el: null, key: null, latched: false};
  function basketItem(){ return FURN_LIST.find(f => f.id === "basket"); }
  function decoySpot(){
    const b = basketItem();
    return b ? {x: Math.round(b.x - 8), y: Math.round(b.y + b.h + 34), bx: b.x + b.w / 2, by: b.y + b.h / 2} : null;
  }
  function showDecoy(key, animate){
    const sp = decoySpot();
    if(!sp) return;
    if(decoy.el) decoy.el.remove();
    const save = state.blanketTunnel; state.blanketTunnel = false;
    const el = makeBlanketEl(sp.x, sp.y);
    state.blanketTunnel = save;
    el.classList.add("decoy-blanket");
    el.removeAttribute("data-id");
    el.style.zIndex = blanketZ(sp.x, sp.y, false);
    if(animate){
      el.style.setProperty("--fx", (sp.bx - sp.x) + "px");
      el.style.setProperty("--fy", (sp.by - sp.y + 20) + "px");
      el.classList.add("pop");
    }
    worldEl.appendChild(el);
    decoy.el = el; decoy.key = key;
  }
  function flattenDecoy(){
    const el = decoy.el;
    decoy.el = null; decoy.key = null;
    if(!el) return;
    el.classList.remove("pop"); void el.offsetWidth;
    el.classList.add("flatten");
    setTimeout(() => el.remove(), 750);
  }
  function decoyFrame(){
    const playing = spriteEl && (state.phase === "hiding" || state.phase === "seeking");
    const inMp = state.mp && mp.inGame;
    let want = inMp ? ((mp.g && mp.g.dc) ? mp.g.dc.k : null) : (state.decoy ? state.decoy.k : null);
    if(inMp && want != null && want === mp.df) want = null;   // I just flattened it; the host will catch up
    // keep the drawn decoy in step with the game (buildWorld wipes it; the host may clear it)
    if(want == null){ if(decoy.el) flattenDecoy(); }
    else if(!decoy.el || !decoy.el.isConnected || decoy.key !== want){
      const fresh = inMp ? want !== decoy.key && (!mp.decoySeen || mp.decoySeen !== want) : !!(state.decoy && state.decoy.fresh);
      showDecoy(want, fresh);
      if(inMp) mp.decoySeen = want; else if(state.decoy) state.decoy.fresh = false;
    }
    if(!playing || state.underground || state.busy) return;
    const px = state.pos.x, py = state.pos.y;
    const iAmPug = inMp ? (mp.myRole === "pug" && !mp.hide) : state.phase === "hiding";
    const iAmPlat = inMp ? (mp.myRole === "plat" && state.phase === "seeking") : state.phase === "seeking";
    const b = basketItem();
    if(iAmPug && b){
      const near = distToItem(b, px, py) <= DECOY_TOUCH_D;
      if(near && !decoy.latched && want == null){
        if(inMp){ mp.dq = (mp.dq || 0) + 1; sendMe(true); }
        else state.decoy = {k: Date.now(), fresh: true};
      }
      if(near) decoy.latched = true; else if(distToItem(b, px, py) > REARM_D) decoy.latched = false;
    }
    if(iAmPlat && want != null){
      const sp = decoySpot();
      if(sp && Math.hypot(px - sp.x, py - (sp.y - 14)) < DECOY_FLAT_R){
        if(inMp){ mp.df = want; sendMe(true); flattenDecoy(); }
        else { state.decoy = null; flattenDecoy(); }
        showToast("Just laundry!", 1200);
      }
    }
  }

  /* ---------------- Attic ghost pug: purely decorative ----------------
     Each time you walk into the attic a little ghost pug swoops around for a few seconds.
     Lives inside the attic room div (clipped to it, under the fog), never touches game state. */
  const GHOST_SVG = `<svg viewBox="0 0 60 66" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 32 C9 12 19 4 30 4 C41 4 51 12 51 32 L51 56 Q46 64 41 56 Q35.5 64 30 56 Q24.5 64 19 56 Q14 64 9 56 Z" fill="#FFFFFF" fill-opacity="0.93" stroke="#CDBFEA" stroke-width="2" stroke-linejoin="round"/>
    <path d="M14 13 Q4 14 5 27 Q12 25 16 18 Z" fill="#8E84A6" fill-opacity="0.75"/>
    <path d="M46 13 Q56 14 55 27 Q48 25 44 18 Z" fill="#8E84A6" fill-opacity="0.75"/>
    <path d="M9 38 Q3 40 4 46 Q8 44 10 42 Z M51 38 Q57 40 56 46 Q52 44 50 42 Z" fill="#FFFFFF" fill-opacity="0.9" stroke="#CDBFEA" stroke-width="1.5"/>
    <ellipse cx="30" cy="31" rx="11" ry="8.5" fill="#6E6384" fill-opacity="0.45"/>
    <circle cx="21.5" cy="23" r="3.6" fill="#2A1E3A"/><circle cx="38.5" cy="23" r="3.6" fill="#2A1E3A"/>
    <circle cx="22.7" cy="21.8" r="1.2" fill="#fff"/><circle cx="39.7" cy="21.8" r="1.2" fill="#fff"/>
    <ellipse cx="30" cy="27.5" rx="3.4" ry="2.3" fill="#2A1E3A"/>
    <ellipse cx="30" cy="34" rx="2.1" ry="2.7" fill="#2A1E3A"/>
    <circle cx="15" cy="31" r="3" fill="#F5A9C6" fill-opacity="0.65"/><circle cx="45" cy="31" r="3" fill="#F5A9C6" fill-opacity="0.65"/>
  </svg>`;
  const atticGhost = {host: null, el: null, start: 0, wasIn: false, lastRoom: null, phase: 0, remoteRooms: new Map()};
  const GHOST_DUR = 6000, GHOST_W = 44, GHOST_H = 48;
  // Someone walked into the attic: (re)start the 6-second ghost. In Platytag only pugs wake it,
  // so a platypus who finds it floating knows a pug was just up there.
  function triggerAtticGhost(){
    const host = atticGhost.host;
    if(!host || !host.isConnected) return;
    if(!atticGhost.el || atticGhost.el.parentNode !== host){
      atticGhost.el = document.createElement("div");
      atticGhost.el.className = "attic-ghost";
      atticGhost.el.innerHTML = GHOST_SVG;
      host.appendChild(atticGhost.el);
    }
    atticGhost.start = performance.now(); atticGhost.phase = Math.random() * Math.PI * 2;
  }
  // remote players: call with their raw synced position each frame
  function atticGhostRemote(id, x, y, ug, role){
    const r = ug ? "tunnel" : roomAt(x, y);
    const prev = atticGhost.remoteRooms.get(id);
    if(!r) return;                                   // doorway: keep the last room
    atticGhost.remoteRooms.set(id, r);
    if(prev !== undefined && prev !== "attic" && r === "attic" && role === "pug") triggerAtticGhost();
  }
  function atticGhostFrame(ts){
    const playing = spriteEl && (state.phase === "hiding" || state.phase === "seeking");
    let inAttic = false;
    if(playing){
      const r = state.underground ? "tunnel" : roomAt(state.pos.x, state.pos.y);
      if(r) atticGhost.lastRoom = r;                  // doorways: keep the last room
      inAttic = atticGhost.lastRoom === "attic";
    } else { atticGhost.lastRoom = null; atticGhost.remoteRooms.clear(); }
    const iWake = !(state.mp && mp.inGame) || mp.myRole === "pug";
    if(inAttic && !atticGhost.wasIn && iWake) triggerAtticGhost();
    atticGhost.wasIn = inAttic;
    const el = atticGhost.el;
    if(!el || !el.isConnected) return;
    const e = Math.max(0, ts - atticGhost.start);
    if(!atticGhost.start || e > GHOST_DUR || !playing){ el.style.opacity = "0"; return; }
    const t = e / 1000, ph = atticGhost.phase;
    const W = ROOMS.attic.rect.w, H = ROOMS.attic.rect.h;
    const cx = (W - GHOST_W) / 2, cy = (H - GHOST_H) / 2 + 10;
    // lazy figure-8 loop with a gentle bob
    const x = cx + (cx - 10) * Math.sin(t * 0.9 + ph);
    const y = cy + (cy - 30) * Math.sin(t * 1.8 + ph * 2) * 0.8 + Math.sin(t * 6) * 4;
    const vx = Math.cos(t * 0.9 + ph);                          // sign of horizontal velocity
    const tilt = -vx * 10;
    const fade = Math.min(1, e / 600, (GHOST_DUR - e) / 900);
    el.style.opacity = (0.88 * fade).toFixed(3);
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${tilt.toFixed(1)}deg) scaleX(${vx < 0 ? -1 : 1})`;
  }

  function tick(ts){
    if(lastTs == null) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    if(typeof keysDown !== "undefined" && keysDown.size) updateKeyboardTarget();
    if(state.frozenUntil && performance.now() < state.frozenUntil){ state.target = {x: state.pos.x, y: state.pos.y}; }
    else if(state.holePull && !state.underground && !state.sliding && !state.onLadder){ state.target = {x: state.holePull.x, y: state.holePull.y}; checkHoleEntry(); }
    if(spriteEl && !(state.frozenUntil && performance.now() < state.frozenUntil)) handleBoard();

    if(spriteEl && (state.phase === "hiding" || state.phase === "seeking")){
      let speed = state.sliding ? (state.slideMode === "dive" ? (state.diving ? 440 : 380) : 760) : (state.mp && state.phase === "seeking" ? 350 : 300); // world px per second; platytag platypus ~17% faster
      if(state.phase === "seeking" && !state.sliding && nearDig(state.pos.x, state.pos.y)) speed *= 0.7;
      if(state.onLadder) speed *= LADDER_SLOW;
      if(!state.sliding && !state.underground && !state.onLadder && inPool(state.pos.x, state.pos.y)){
        speed = state.phase === "seeking" ? SWIM_SPEED_PLAT : SWIM_SPEED_PUG;
        if(state.wearingTube) speed *= TUBE_BOOST;                  // the float tube is fast
      }
      const dx = state.target.x - state.pos.x;
      const dy = state.target.y - state.pos.y;
      const dist = Math.hypot(dx, dy);
      bellySlideUpdate(dx, dy, dist, dt);
      if(state.belly) speed *= BELLY_BOOST;

      if(state.exitGlide){
        // sneaking out of a hiding spot: a quick straight run to the chosen side (no collisions)
        const G = state.exitGlide;
        G.t = Math.min(G.d, G.t + EXIT_GLIDE_SPEED * dt);
        const u = G.t / G.d, e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;   // ease in-out
        const px = state.pos.x;
        state.pos = {x: G.sx + (G.ex - G.sx) * e, y: G.sy + (G.ey - G.sy) * e};
        if(Math.abs(state.pos.x - px) > 0.3){
          const flip = spriteEl.querySelector(".flip");
          if(flip) flip.style.transform = state.pos.x < px ? "scaleX(1)" : "scaleX(-1)";
        }
        if(!state.walkingClassApplied){ spriteEl.classList.remove("idle"); spriteEl.classList.add("walking"); state.walkingClassApplied = true; }
        if(G.t >= G.d) state.exitGlide = null;
      } else if(dist > 1.2){
        const step = speed * dt;
        let nx, ny;
        if(step >= dist){ nx = state.target.x; ny = state.target.y; }
        else { nx = state.pos.x + (dx/dist)*step; ny = state.pos.y + (dy/dist)*step; }

        const prevX = state.pos.x, prevY = state.pos.y;
        const tm = state.onLadder ? ladderMove(nx, ny) : tunnelMove(nx, ny);
        const moved = tm || attemptMove(nx, ny);
        if(moved){ state.pos = moved; }
        handleSlide(prevX, prevY);
        checkHoleEntry();

        const movedDx = state.pos.x - prevX;
        if(Math.abs(movedDx) > 0.6){
          const flip = spriteEl.querySelector(".flip");
          if(flip) flip.style.transform = movedDx < 0 ? "scaleX(1)" : "scaleX(-1)";
        }
        if(!state.walkingClassApplied){
          spriteEl.classList.remove("idle");
          spriteEl.classList.add("walking");
          state.walkingClassApplied = true;
        }
      } else {
        state.pos.x = state.target.x;
        state.pos.y = state.target.y;
        if(state.dhHold && performance.now() > (state.dhHoldAt || 0) + 250) state.dhHold = false;   // standing still = you've let go
        if(state.ladHold && performance.now() > (state.ladHoldAt || 0) + 250) state.ladHold = false;
        if(state.walkingClassApplied){
          spriteEl.classList.remove("walking");
          spriteEl.classList.add("idle");
          state.walkingClassApplied = false;
        }
        if(state.onArrive){
          const cb = state.onArrive;
          state.onArrive = null;
          cb();
        }
      }

      spriteEl.style.left = state.pos.x + "px";
      spriteEl.style.top = state.pos.y + "px";
      const swimNow = !state.underground && !state.sliding && inPool(state.pos.x, state.pos.y);
      if(swimNow !== !!state.swimming){
        state.swimming = swimNow;
        spriteEl.classList.toggle("swimming", swimNow);
        footEl.classList.toggle("in-water", swimNow);
      }
      if(swimNow) state.lastSwimPos = {x: state.pos.x, y: state.pos.y};
      updateTube();
      pawTrail(state, state.pos.x, state.pos.y, swimNow || !!state.diving, state.underground || state.sliding);
      footEl.style.left = state.pos.x + "px";
      footEl.style.top = (state.pos.y + 3) + "px";

      // burrow-under-the-covers effect: swap the sprite for a wiggling lump
      // whenever the character is inside the bed's mattress area
      if(bedWorldRect){
        const margin = 16;
        const nowInBed = state.pos.x > bedWorldRect.x+margin && state.pos.x < bedWorldRect.x+bedWorldRect.w-margin &&
                         state.pos.y > bedWorldRect.y+34 && state.pos.y < bedWorldRect.y+bedWorldRect.h-margin;
        if(nowInBed !== inBedNow){
          inBedNow = nowInBed;
          spriteEl.style.visibility = inBedNow ? "hidden" : "visible";
          footEl.style.visibility = inBedNow ? "hidden" : "visible";
          if(bedLumpEl) bedLumpEl.classList.toggle("show", inBedNow);
        }
        if(inBedNow && bedLumpEl){
          bedLumpEl.style.left = state.pos.x + "px";
          bedLumpEl.style.top = state.pos.y + "px";
        }
      }

      const onPlate = Math.hypot(state.pos.x-PLATE.x, state.pos.y-PLATE.y) < 20;
      if(onPlate && !state.onPlate){
        state.garageOpen = !state.garageOpen;
        const i = SOLID_RECTS.indexOf(garageDoorSolid);
        if(state.garageOpen){ if(i >= 0) SOLID_RECTS.splice(i, 1); }
        else if(i < 0){ SOLID_RECTS.push(garageDoorSolid); }
        if(garageDoorEl) garageDoorEl.classList.toggle("open", state.garageOpen);
        if(garagePlateEl) garagePlateEl.classList.toggle("pressed", state.garageOpen);
        showToast(state.garageOpen ? "Garage door opened! 🚗" : "Garage door closed");
      }
      state.onPlate = onPlate;
      updateFog();
      updateProximity();

      // depth-sort: freestanding furniture covers the character when they're behind it
      for(let i=0;i<freestandingEls.length;i++){
        const item = freestandingEls[i];
        const z = (state.pos.y < item.depthY) ? "6" : "3";
        if(item.z !== z){ item.z = z; item.el.style.zIndex = z; }   // only touch the page when it changes
      }

      // camera follows, centered on character, clamped to world bounds
      const maxCamX = Math.max(0, WORLD.w - viewportW);
      const maxCamY = Math.max(camTop(), WORLD.h - viewportH);
      const wantX = clamp(state.pos.x - viewportW/2, 0, maxCamX);
      const wantY = clamp(state.pos.y - viewportH/2, camTop(), maxCamY);
      if(state.camLag){
        // just left a hiding spot: the camera trails behind and eases back onto you
        const age = (performance.now() - state.camLag) / 1000;
        const k = Math.min(1, (0.8 + age * age * 6) * dt);
        state.camX += (wantX - state.camX) * k;
        state.camY += (wantY - state.camY) * k;
        if(age > 0.8 && Math.abs(wantX - state.camX) < 0.5 && Math.abs(wantY - state.camY) < 0.5) state.camLag = null;
      } else { state.camX = wantX; state.camY = wantY; }
      worldEl.style.transform = `translate(${-state.camX}px, ${-state.camY}px)`;
    }
    if(state.mp) mpFrame(dt);
    atticGhostFrame(ts);
    flowersFrame(dt);
    decoyFrame();
    lightsFrame();
    debugFrame(ts);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

