  /* ---------------- Pointer input: touch-and-chase ---------------- */
  let dragging = false;

  function worldPosFromEvent(e){
    const rect = stage.getBoundingClientRect();
    let wx = state.camX + (e.clientX - rect.left);
    let wy = state.camY + (e.clientY - rect.top);
    wx = Math.max(4, Math.min(WORLD.w-4, wx));
    wy = Math.max(WORLD.y0 - CAM_PAD_TOP, Math.min(WORLD.h-4, wy));
    return {x:wx, y:wy};
  }

  function resolveActionAt(e){
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if(!el) return null;
    const furn = el.closest(".furniture");
    if(furn) return {type:"furniture", el:furn};
    return null;
  }

  function updateFromPointer(e){
    // Only the seeker taps furniture to walk to it; the pug just walks where you touch
    // (so you can stop anywhere, e.g. under the bed covers). Proximity still lights things up.
    const action = null;   // both characters simply walk to where you touch; the platypus searches whatever she bumps into
    if(action && action.type === "furniture"){
      const item = FURN_LIST.find(f => f.el === action.el);
      if(!item) return;
      const pad = 16;
      const tx = clamp(state.pos.x, item.x - pad, item.x + item.w + pad);
      const ty = clamp(state.pos.y, item.y - pad, item.y + item.h + pad);
      state.wantId = item.id;
      setTarget(tx, ty, null);
    } else {
      state.wantId = null;
      const p = worldPosFromEvent(e);
      setTarget(p.x, p.y, null);
    }
  }


  function updateFog(){
    const r = state.underground ? "tunnel" : roomAt(state.pos.x, state.pos.y);
    if(!r || r === curSeekRoom) return;   // in a doorway: keep the last room lit
    curSeekRoom = r;
    for(const k in ROOM_FOG) ROOM_FOG[k].classList.toggle("on", k !== r);
    if(blanketEl && blanketRoom !== "tunnel"){
      const vis = (r === blanketRoom);
      blanketEl.style.display = vis ? "" : "none";
      const it = FURN_LIST.find(f => f.id === "blanket");
      if(it) it.hidden = !vis;
    }
  }
  /* ---------------- Proximity: any side of an object counts ---------------- */
  const NEAR = 30;
  function distToItem(item, px, py){
    const dx = Math.max(item.x - px, 0, px - (item.x + item.w));
    const dy = Math.max(item.y - py, 0, py - (item.y + item.h));
    return Math.hypot(dx, dy);
  }
  // underground you can't reach the furniture up in the rooms overhead (only a blanket down in the tunnel)
  function reachable(item){ if(state.onLadder) return false; return !state.underground || (item.id === "blanket" && blanketRoom === "tunnel"); }
  function nearestItem(){
    let best = null, bestD = Infinity;
    for(const item of FURN_LIST){
      if(item.hidden || !reachable(item)) continue;
      const d = distToItem(item, state.pos.x, state.pos.y);
      if(d < bestD){ bestD = d; best = item; }
    }
    return bestD <= NEAR ? best : null;
  }
  function updateProximity(){
    digBtn.classList.toggle("show", (canDigHere() || canDigUnder()) && !state.pendingSpot && !confirmFab.classList.contains("show"));
    if(blanketEl && blanketRoom === "tunnel" && state.phase === "seeking"){
      const vis = !!state.underground;
      blanketEl.style.display = vis ? "" : "none";
      const it = FURN_LIST.find(f => f.id === "blanket"); if(it) it.hidden = !vis;
    }
    if(state.busy || (state.phase !== "hiding" && state.phase !== "seeking")) return;
    if(state.phase === "seeking"){
      if(state.pendingSpot || confirmFab.classList.contains("show")){
        state.pendingSpot = null;
        confirmFab.classList.remove("show");
        worldEl.querySelectorAll(".furniture.selected").forEach(x => x.classList.remove("selected"));
      }
      seekerTouch();
      return;
    }
    if(state.mp && isPfa()) pfaTouchSearch();          // Pug for All: bumping furniture searches it for a hidden bunny
    const item = nearestItem();
    const curId = state.pendingSpot ? state.pendingSpot.spotId : null;
    const newId = item ? item.id : null;
    if(newId !== curId){
      worldEl.querySelectorAll(".furniture.selected").forEach(x => x.classList.remove("selected"));
      if(item){
        item.el.classList.add("selected");
        state.pendingSpot = {room: item.room, spotId: item.id};
        confirmFab.textContent = state.phase === "hiding" ? "✅ Hide!" : "🔍 Search";
        confirmFab.classList.add("show");
      } else {
        state.pendingSpot = null;
        confirmFab.classList.remove("show");
      }
    }
    // tapped an object as the seeker: search it automatically once close enough
    if(item && state.phase === "seeking" && state.wantId === item.id){
      state.wantId = null;
      doSearch(item.id, item.room);
    }
  }

  function onPointerDown(e){
    if(state.busy) return;
    dragging = true;
    if(stage.setPointerCapture){ try{ stage.setPointerCapture(e.pointerId); }catch(err){} }
    updateFromPointer(e);
  }
  function onPointerMove(e){
    if(!dragging || state.busy) return;
    updateFromPointer(e);
  }
  function onPointerUp(){ dragging = false; }

  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  /* ---------------- Keyboard input (desktop/trackpad; touch is untouched) ---------------- */
  const KEY_DIR = {
    ArrowUp:{x:0,y:-1}, ArrowDown:{x:0,y:1}, ArrowLeft:{x:-1,y:0}, ArrowRight:{x:1,y:0},
    KeyW:{x:0,y:-1}, KeyS:{x:0,y:1}, KeyA:{x:-1,y:0}, KeyD:{x:1,y:0}
  };
  const keysDown = new Set();
  let keyboardActive = false;
  const KEY_REACH = 600; // project a far target in the held direction; walls/attemptMove stop it naturally

  function updateKeyboardTarget(){
    if(state.busy || (state.phase !== "hiding" && state.phase !== "seeking")) return;
    let dx = 0, dy = 0;
    keysDown.forEach(code => { const d = KEY_DIR[code]; if(d){ dx += d.x; dy += d.y; } });
    if(dx === 0 && dy === 0){
      if(keyboardActive){ keyboardActive = false; state.keyDir = null; setTarget(state.pos.x, state.pos.y, null); }
      return;
    }
    keyboardActive = true;
    state.keyDir = {x: dx / (Math.hypot(dx, dy) || 1), y: dy / (Math.hypot(dx, dy) || 1)};
    dragging = false;
    state.wantId = null;
    const len = Math.hypot(dx, dy) || 1;
    const tx = clamp(state.pos.x + (dx/len)*KEY_REACH, 0, WORLD.w);
    const ty = clamp(state.pos.y + (dy/len)*KEY_REACH, WORLD.y0, WORLD.h);
    setTarget(tx, ty, null);
  }

  function typingOrMenu(e){
    const t = e.target;
    if(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return true;
    return gameScreen.classList.contains("hidden");   // game keys only while the game is on screen
  }
  window.addEventListener("keydown", (e) => {
    if(typingOrMenu(e)) return;
    if(e.repeat) return;
    if(KEY_DIR[e.code]){
      keysDown.add(e.code);
      updateKeyboardTarget();
      e.preventDefault();
    } else if(e.code === "Space" || e.code === "Enter"){
      if(confirmFab.classList.contains("show")){ confirmFab.click(); }
      e.preventDefault();
    } else if(e.code === "KeyF" || e.code === "KeyE"){
      if(digBtn.classList.contains("show")){ digBtn.click(); }
    } else if(e.code === "KeyB"){
      if(plainBtn.classList.contains("show")){ plainBtn.click(); }
    }
  });
  window.addEventListener("keyup", (e) => {
    if(typingOrMenu(e)){ keysDown.clear(); return; }
    if(KEY_DIR[e.code]){
      keysDown.delete(e.code);
      updateKeyboardTarget();
      e.preventDefault();
    }
  });
  window.addEventListener("blur", () => { keysDown.clear(); keyboardActive = false; });

  function updateHud(){
    if(state.mp){ mpHud(); return; }
    leadPill.style.display = "none";
    if(state.phase === "hiding"){
      phasePill.innerHTML = "🐶 Hiding";
      statPill.textContent = "Pick a cozy spot";
    } else if(state.phase === "seeking"){
      phasePill.innerHTML = "Seeking";
      statPill.textContent = "Spots checked: " + state.checkedSpots;
    }
  }


