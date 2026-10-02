  /* ---------------- Search / hide actions ---------------- */
  /* The platypus searches anything she bumps into, while she keeps moving.
     Each object is searched once per contact; walk away (~20px) and touch it again to re-check. */
  const TOUCH_D = 6, REARM_D = 22;
  function rectHas(it, x, y, pad){ pad = pad || 4; return x >= it.x - pad && x <= it.x + it.w + pad && y >= it.y - pad && y <= it.y + it.h + pad; }
  function wiggleEl(el){
    if(!el) return;
    el.classList.remove("checking"); void el.offsetWidth;
    el.classList.add("checking");
    clearTimeout(el._wig); el._wig = setTimeout(() => el.classList.remove("checking"), 520);
  }
  function seekerTouch(){
    const px = state.pos.x, py = state.pos.y;
    if(!state.touchLatch) state.touchLatch = new Set();
    for(const id of [...state.touchLatch]){
      const it = FURN_LIST.find(f => f.id === id);
      if(!it || distToItem(it, px, py) > REARM_D) state.touchLatch.delete(id);
    }
    const touching = FURN_LIST.filter(it => !it.hidden && reachable(it) && distToItem(it, px, py) <= TOUCH_D);
    touching.sort((a, b) => (b.id === "blanket") - (a.id === "blanket"));   // blanket first
    // classic: pug snuggled under the bed covers (blanket button in bed) — she has to get under there too
    if(!state.mp && state.hidingSpot === "bedlump" && state.pugLumpPos && !state.busy &&
       Math.hypot(px - state.pugLumpPos.x, py - state.pugLumpPos.y) < 34){
      state.busy = true;
      state.target = {x: px, y: py};
      wiggleEl(worldEl.querySelector(".pug-lump"));
      endGame();
      return;
    }
    // Platytag: while you're still touching something, keep telling the host you're checking it
    // (so a dog that hides there while you're pressed against it — or under the covers with you — is caught)
    if(state.mp) for(const it of touching){ if(state.touchLatch.has(it.id) && it.id !== "blanket"){ mp.chks[it.id] = Date.now() + 600; } }
    for(const it of touching){
      if(state.touchLatch.has(it.id)) continue;
      state.touchLatch.add(it.id);
      doSearch(it.id, it.room);
      if(state.busy) break;   // found (classic): game is ending
    }
  }
  function doSearch(fid, roomKey){
    if(state.mp){ mpSearch(fid); return; }
    const item = FURN_LIST.find(f => f.id === fid);
    if(!item || state.busy) return;
    const el = item.el;
    wiggleEl(el);
    if(roomKey === state.hidingRoom && fid === state.hidingSpot){
      state.busy = true;
      state.target = {x: state.pos.x, y: state.pos.y};
      const sess = gameSession;
      setTimeout(() => { if(sess !== gameSession) return; el.classList.add("found-here"); endGame(); }, 480);
    } else {
      if(!state.checkedIds.has(fid)){
        state.checkedIds.add(fid); state.checkedSpots += 1;
        showToast("Not here! 🔍");
        updateHud();
      }
    }
  }

  confirmFab.addEventListener("click", (e) => {
    e.stopPropagation();
    if(state.busy || !state.pendingSpot) return;
    if(state.mp){ mpConfirm(); return; }
    if(state.phase === "seeking"){
      doSearch(state.pendingSpot.spotId, state.pendingSpot.room);
      return;
    }
    state.busy = true;
    state.hidingRoom = state.pendingSpot.room;
    state.hidingSpot = state.pendingSpot.spotId;
    confirmFab.classList.remove("show");
    spriteEl.classList.add("hidden-away");
    setTimeout(() => { startSeekTransition(); }, 380);
  });
  confirmFab.addEventListener("pointerdown", (e) => e.stopPropagation());


  /* ---------------- Hide in plain sight: blanket ---------------- */
  // Tunnel blanket: the hider's own dog (whatever breed they are) peeks out, shivering a little
  function coldBlanketSVG(look){
    const dog = pugSVG(look || {b: "pugFawn", g: false}).replace('width="100%" height="100%"', 'x="21" y="-6" width="48" height="55.5"');
    return `<svg viewBox="0 0 90 70" xmlns="http://www.w3.org/2000/svg" overflow="visible">
<ellipse cx="45" cy="66" rx="38" ry="4" fill="rgba(0,0,0,0.3)"/>
<g class="cold-dog">${dog}</g>
<path d="M 4 62 C 2 44 14 30 30 34 Q 45 42 60 34 C 76 30 88 44 86 62 Q 66 67 45 65 Q 24 67 4 62 Z" fill="#7E9CE0" stroke="#241811" stroke-width="2.5" stroke-linejoin="round"/>
<g stroke="#5C7BC8" stroke-width="3" opacity="0.8"><line x1="14" y1="44" x2="14" y2="62"/><line x1="30" y1="40" x2="30" y2="64"/><line x1="60" y1="40" x2="60" y2="64"/><line x1="76" y1="44" x2="76" y2="62"/><line x1="6" y1="54" x2="84" y2="54"/></g>
<g stroke="#F6E7C8" stroke-width="1.5" opacity="0.7"><line x1="22" y1="40" x2="22" y2="64"/><line x1="68" y1="40" x2="68" y2="64"/></g>
<path d="M 26 40 Q 36 46 45 44" stroke="#241811" stroke-width="2" fill="none" opacity="0.5"/>
<g stroke="#BFE6F7" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M 12 20 q 3 -3 0 -6 q -3 -3 0 -6"/><path d="M 78 20 q 3 -3 0 -6 q -3 -3 0 -6"/></g>
</svg>`;
  }
  // Blankets sit on the floor: tucked behind/under an object they layer beneath it
  function blanketZ(x, y, tunnel){
    if(tunnel) return "12";
    if(inFlowerBed(x, y)) return "2";          // tucked under the flower petals
    const behind = FURN_LIST.some(it => it.id !== "blanket" && x >= it.x && x <= it.x + it.w && y - 10 >= it.y && y - 10 <= it.y + it.h);
    return behind ? "2" : "7";
  }
  function makeBlanketEl(x, y, look){
    if(state.blanketTunnel){
      const el = document.createElement("div");
      el.className = "furniture illustrated blanket-spot cold";
      el.dataset.id = "blanket";
      el.style.left = (x - 40) + "px"; el.style.top = (y - 58) + "px";
      el.innerHTML = coldBlanketSVG(look || (state.looks || {}).pug);
      return el;
    }
    const rk = roomAt(x, y);
    const col = rk ? ROOMS[rk].floorA : "#DECBA0";
    const el = document.createElement("div");
    el.className = "furniture illustrated blanket-spot";
    el.dataset.id = "blanket";
    el.style.left = (x - 35) + "px";
    el.style.top = (y - 38) + "px";
    el.innerHTML = blanketSVG(col);
    return el;
  }
  plainBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  plainBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if(!state.underground && inPool(state.pos.x, state.pos.y)){ showToast("Blankets don't float! Hop out of the pool first.", 1800); return; }
    if(state.mp){ if(mp.hide && mp.hide.type === "blanket") mpUnhide(); else mpBlanket(); return; }
    if(state.busy || state.phase !== "hiding") return;
    state.busy = true;
    state.target = {x: state.pos.x, y: state.pos.y};
    state.blanketTunnel = !!state.underground;
    confirmFab.classList.remove("show");
    plainBtn.classList.remove("show");
    worldEl.querySelectorAll(".furniture.selected").forEach(x => x.classList.remove("selected"));

    // Already under the bed covers: stay a lump, no blanket spawns — counts as hiding in the bed
    const bedItem = FURN_LIST.find(f => f.id === "bed");
    if(inBedNow && !state.underground && bedItem){
      state.blanketTunnel = false;
      state.blanketPos = null;
      state.hidingRoom = bedItem.room;
      state.hidingSpot = "bedlump";   // platypus must go under the covers to find this pug
      state.pugLumpPos = {x: state.pos.x, y: state.pos.y};
      setTimeout(() => { startSeekTransition(); }, 900);
      return;
    }

    snapToFlowerBed();
    state.blanketPos = {x: state.pos.x, y: state.pos.y};
    const el = makeBlanketEl(state.pos.x, state.pos.y);
    el.classList.add("blanket-drop");
    el.style.zIndex = blanketZ(state.pos.x, state.pos.y, !!state.underground);
    worldEl.appendChild(el);
    setTimeout(() => { spriteEl.classList.add("hidden-away"); footEl.style.visibility = "hidden"; }, 250);
    state.hidingRoom = "floor";
    state.hidingSpot = "blanket";
    setTimeout(() => { startSeekTransition(); }, 900);
  });

  /* ---------------- Transition to seeking ---------------- */
  function startSeekTransition(){
    if(state.phase !== "hiding") return;         // the player quit to the menu in the meantime
    const sess = gameSession;
    plainBtn.classList.remove("show");
    digBtn.classList.remove("show");
    state.phase = "transition";
    interstitial.style.display = "flex";
    let n = 3;
    interstitial.innerHTML = `<h2>Nicely hidden!</h2><p>The platypus is on the way. Get ready to search...</p><div class="count">${n}</div>`;
    const iv = setInterval(() => {
      if(sess !== gameSession){ clearInterval(iv); return; }
      n -= 1;
      if(n <= 0){
        clearInterval(iv);
        interstitial.style.display = "none";
        beginSeekPhase();
      } else {
        interstitial.querySelector(".count").textContent = n;
      }
    }, 700);
  }

  function beginSeekPhase(){
    state.phase = "seeking";
    state.underground = false;
    state.sliding = false; state.slideMode = null;
    state.garageOpen = false;
    state.onPlate = false;
    state.onSwitch = false;             // lights stay how the pug left them
    state.pendingSpot = null;
    state.wantId = null;
    state.checkedSpots = 0;
    state.touchLatch = new Set();
    state.checkedIds = new Set();
    state.startTime = Date.now();
    state.busy = false;
    measureViewport();
    buildWorld();
    const spawn = spawnPoint("plat");
    placeSpriteAt(spawn.x, spawn.y);
    updateHud();
  }

  /* ---------------- Win / end game ---------------- */
  function endGame(){
    const elapsed = Math.max(1, Math.round((Date.now() - state.startTime)/1000));
    const sess = gameSession;
    setTimeout(() => {
      if(sess !== gameSession) return;
      document.getElementById("win-time").textContent = elapsed + "s";
      document.getElementById("win-checks").textContent = state.checkedSpots;

      let best = null;
      try {
        const raw = localStorage.getItem("pugseek_best");
        best = raw ? parseInt(raw,10) : null;
        if(best === null || elapsed < best){
          localStorage.setItem("pugseek_best", String(elapsed));
          best = elapsed;
        }
      } catch(e){ /* storage unavailable, ignore */ }
      document.getElementById("win-best").textContent = best !== null ? best+"s" : "--";

      const subs = [
        "The platypus checked every cozy corner before spotting that wiggly tail.",
        "Found! That pug never had a chance against a determined platypus.",
        "Sniffed out and spotted — better hiding spot next time, pup."
      ];
      document.getElementById("win-sub").textContent = subs[Math.floor(Math.random()*subs.length)];

      switchScreen(winScreen);
    }, 550);
  }

  /* ---------------- Screen switching ---------------- */
  function switchScreen(target){
    document.querySelectorAll("#app > .screen").forEach(s => s.classList.add("hidden"));
    target.classList.remove("hidden");
  }

  function startHidingPhase(){
    state.mp = false;
    state.secretOpen = false;
    state.looks = {pug: {b: myDog.b, g: myDog.g}, plat: {b: "purple", g: false}};   // the dog you picked vs the classic platypus
    document.getElementById("win-critters").innerHTML = pugSVG(state.looks.pug) + platypusSVG(state.looks.plat);
    state.phase = "hiding";
    state.underground = false;
    state.sliding = false; state.slideMode = null;
    state.garageOpen = false;
    state.onPlate = false;
    state.blanketPos = null;
    state.blanketTunnel = false;
    state.pugLumpPos = null;
    state.digs = [];
    plainBtn.classList.add("show"); blanketLabel();
    state.wantId = null;
    state.hidingRoom = null;
    state.hidingSpot = null;
    state.decoy = null;
    state.lightsOff = false; state.onSwitch = false;
    state.pendingSpot = null;
    state.busy = false;
    confirmFab.classList.remove("show");
    switchScreen(gameScreen);
    measureViewport();
    buildWorld();
    const spawn = spawnPoint("pug");
    placeSpriteAt(spawn.x, spawn.y);
    updateHud();
  }

  document.getElementById("play-btn").addEventListener("click", () => { renderDogPickers(); switchScreen(document.getElementById("dog-screen")); });
  document.getElementById("dog-go-btn").addEventListener("click", startHidingPhase);
  document.getElementById("dog-back").addEventListener("click", () => switchScreen(document.getElementById("title-screen")));
  document.getElementById("again-btn").addEventListener("click", startHidingPhase);
  document.getElementById("win-home").addEventListener("click", () => switchScreen(titleScreen));

  /* ---------- No text selection / long-press menus anywhere except text boxes ---------- */
  const isTextBox = t => t && t.closest && t.closest("input, textarea");
  document.addEventListener("selectstart", e => { if(!isTextBox(e.target)) e.preventDefault(); });
  document.addEventListener("contextmenu", e => { if(!isTextBox(e.target)) e.preventDefault(); });
  document.addEventListener("dragstart", e => e.preventDefault());

  /* ---------- Menu button: quit a round mid-game (no browser reload in the app) ---------- */
  let gameSession = 0;                               // bumps on quit so pending timers from the old round do nothing
  const quitCard = document.getElementById("quit-card");
  ["pointerdown", "touchstart", "mousedown"].forEach(ev => quitCard.addEventListener(ev, e => e.stopPropagation()));
  document.getElementById("menu-btn").addEventListener("pointerdown", e => e.stopPropagation());
  document.getElementById("menu-btn").addEventListener("click", () => {
    document.getElementById("quit-note").textContent = (state.mp && mp.code) ? "You'll leave the room. The others can keep playing." : "This round will end.";
    quitCard.style.display = "flex";
  });
  document.getElementById("quit-stay").addEventListener("click", () => { quitCard.style.display = "none"; });
  document.getElementById("quit-leave").addEventListener("click", async () => {
    quitCard.style.display = "none";
    gameSession++;
    state.phase = "title"; state.busy = false; state.target = {x: state.pos.x, y: state.pos.y};
    interstitial.style.display = "none";
    plainBtn.classList.remove("show"); digBtn.classList.remove("show"); confirmFab.classList.remove("show");
    switchScreen(titleScreen);
    if(state.mp || mp.code){ try{ await leaveRoom(); }catch(e){} }
  });

  document.getElementById("howto-btn").addEventListener("click", () => {
    const card = document.getElementById("howto-card");
    card.style.display = card.style.display === "none" ? "block" : "none";
  });

