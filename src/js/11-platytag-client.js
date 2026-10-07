  /* ---------- My character ---------- */
  // a tagged dog keeps its breed + sex: e.g. husky -> platyhusky, fawn pug -> fawn platypug
  function lookFromCode(code, kind){
    const [b, g] = String(code || "pugFawn|-").split("|");
    return {b: (kind === "pug" && b === "purple") ? "pugFawn" : b, g: g === "g"};
  }
  function mpLookCode(id){ return ((mp.g && mp.g.lk) || {})[id] || null; }
  function setSpriteRole(role){
    const code = mpLookCode(Net.myId());
    state.looks = {pug: lookFromCode(code, "pug"), plat: lookFromCode(code, "plat")};
    mp.myLook = code;
    spriteEl.className = "critter-sprite idle " + (role === "pug" ? "pug" : "plat it") + (state.underground ? " xray" : "");
    spriteEl.innerHTML = role === "pug" ? spriteMarkup("pug", pugSVG(state.looks.pug), state.looks.pug) : spriteMarkup("plat", platypusSVG(state.looks.plat), state.looks.plat);
    state.walkingClassApplied = false;
  }
  function pickSpawn(){ return spawnPoint(mp.myRole); }
  function startTagRound(role){
    state.mp = true;
    Object.assign(mp, {inGame: true, overShown: false, tgSeen: 0, ldSeen: null, decoySeen: null, spawned: false, hide: null, myBlanketEl: null, chk: null, chks: {}, myRole: role, lastSent: "", myDigs: [], holeEls: new Map(),
      tq: 0, td: null, tubeDropPending: null});
    Object.assign(state, {underground: false, sliding: false, slideMode: null, garageOpen: false, onPlate: false, onSwitch: false, exitGlide: null, camLag: null, secretOpen: false, tunSeg: "A", tunT: 0,
      blanketPos: null, blanketTunnel: false, pugLumpPos: null, digs: [], wantId: null, hidingRoom: null,
      hidingSpot: null, pendingSpot: null, busy: false, checkedSpots: 0, checkedIds: new Set(), touchLatch: new Set()});
    confirmFab.classList.remove("show"); digBtn.classList.remove("show"); plainBtn.classList.remove("show");
    mp.remotes = new Map();                 // buildWorld wipes the old remote sprites
    pfaReset();
    state.phase = "hiding";
    switchScreen(gameScreen);
    measureViewport();
    buildWorld();
    if(role === "pug"){ spawnMe(); }
    else {
      state.phase = "waiting";
      spriteEl.style.visibility = "hidden"; footEl.style.visibility = "hidden";
      interstitial.style.display = "flex";
      interstitial.innerHTML = `<h2>You're the platypus!</h2><p>The pugs are running off to hide. Tag them by touching them, or check the furniture they're hiding in.</p><div class="count" id="mp-count">${(mp.g && mp.g.hl) || HEAD_START}</div>`;
      Net.setMe({role, sp: 0, x: null, y: null, hid: null, bl: null, chk: null, ug: 0});
    }
    updateHud();
  }
  function spawnMe(){
    mp.spawned = true;
    interstitial.style.display = "none";
    state.phase = mp.myRole === "pug" ? "hiding" : "seeking";
    setSpriteRole(mp.myRole);
    const s = pickSpawn();
    placeSpriteAt(s.x, s.y);
    mp.lastX = s.x;
    spriteEl.style.visibility = ""; footEl.style.visibility = "";
    plainBtn.classList.toggle("show", mp.myRole === "pug"); blanketLabel();
    if(mp.myRole === "plat") showToast("Go find those pugs!", 1600);
    else if(isPfa()) showToast("The bunny is in the front yard. Go grab it!", 2200);
    sendMe(true);
    updateHud();
  }
  function becomeRole(role){
    const wasPug = mp.myRole === "pug";
    mp.myRole = role;
    mpUnhide();
    if(state.phase === "waiting") return;
    state.phase = role === "pug" ? "hiding" : "seeking";
    setSpriteRole(role);
    if(inBedNow){ spriteEl.style.visibility = "hidden"; }
    plainBtn.classList.toggle("show", role === "pug"); blanketLabel();
    state.pendingSpot = null; confirmFab.classList.remove("show");
    worldEl.querySelectorAll(".furniture.selected").forEach(x => x.classList.remove("selected"));
    if(wasPug && role === "plat" && state.onLadder) fallOffLadder(LADDER_BOT.x, LADDER_BOT.y);
    if(wasPug && role === "plat"){
      // make getting caught unmissable: stop in place for a moment and pulse the red outline
      state.frozenUntil = performance.now() + TAG_FREEZE_MS;
      state.target = {x: state.pos.x, y: state.pos.y};
      spriteEl.classList.add("just-tagged");
      setTimeout(() => spriteEl.classList.remove("just-tagged"), TAG_FREEZE_MS + 100);
      if(navigator.vibrate) try { navigator.vibrate([120, 60, 120]); } catch(e){}
      showToast("You got tagged! You're on the platypus team now", 2400);
    }
    sendMe(true);
  }

  /* ---------- Pug hiding (tag mode) ---------- */
  function mpConfirm(){
    if(!state.pendingSpot) return;
    if(state.phase === "seeking"){ mpSearch(state.pendingSpot.spotId); return; }
    if(state.phase !== "hiding" || mp.hide) return;
    mp.hide = {type: "furn", id: state.pendingSpot.spotId};
    state.exitGlide = null;
    state.target = {x: state.pos.x, y: state.pos.y};
    spriteEl.classList.add("hidden-away");
    confirmFab.classList.remove("show");
    showToast("Hidden! Move to sneak back out.", 1500);
    sendMe(true);
  }
  function mpBlanket(){
    if(state.phase !== "hiding" || state.busy || mp.hide) return;
    state.target = {x: state.pos.x, y: state.pos.y};
    if(inBedNow && !state.underground){ showToast("Snuggled under the covers 🛏️", 1400); return; }   // the lump is what everyone sees
    state.blanketTunnel = !!state.underground;
    snapToFlowerBed();
    mp.hide = {type: "blanket", x: Math.round(state.pos.x), y: Math.round(state.pos.y), t: state.blanketTunnel ? 1 : 0};
    const el = makeBlanketEl(state.pos.x, state.pos.y);
    el.classList.add("blanket-drop");
    el.style.zIndex = blanketZ(state.pos.x, state.pos.y, !!state.underground);
    el.style.pointerEvents = "none";
    worldEl.appendChild(el);
    mp.myBlanketEl = el;
    blanketLabel();
    confirmFab.classList.remove("show");
    setTimeout(() => { if(mp.hide && mp.hide.type === "blanket") spriteEl.classList.add("hidden-away"); }, 250);
    sendMe(true);
  }
  function mpUnhide(){
    if(!mp.hide) return;
    mp.hide = null;
    spriteEl.classList.remove("hidden-away");
    if(mp.myBlanketEl){ mp.myBlanketEl.remove(); mp.myBlanketEl = null; }
    state.pendingSpot = null;                 // lets the Hide button reappear if still next to furniture
    blanketLabel();
    sendMe(true);
  }
  // the blanket button toggles: under a blanket it becomes "Peek out" (peekaboo!)
  function blanketLabel(){
    plainBtn.textContent = (state.mp && mp.hide && mp.hide.type === "blanket") ? "🧺 Peek out" : "🧺 Blanket";
  }

  /* ---------- Platypus checking furniture (tag mode) ---------- */
  function mpSearch(fid){
    const item = FURN_LIST.find(f => f.id === fid);
    if(!item) return;
    wiggleEl(item.el);
    const roles = (mp.g && mp.g.roles) || {};
    const hit = Net.peers().some(pp => !pp.isMe && roles[pp.id] === "pug" && pp.p.hid === fid);
    mp.chks = mp.chks || {};
    mp.chks[fid] = Date.now() + 1500;   // the host tags any pug hiding here
    sendMe(true);
    if(hit){ item.el.classList.add("found-here"); setTimeout(() => item.el.classList.remove("found-here"), 1200); }
    else if(!state.checkedIds.has(fid)){ state.checkedIds.add(fid); showToast("Not here! 🔍"); }
  }

  /* ---------- Sending my state ---------- */
  function sendMe(force){
    if(!mp.inGame) return;
    const now = Date.now();
    mp.chks = mp.chks || {};
    for(const k in mp.chks){ if(now > mp.chks[k]) delete mp.chks[k]; }
    const chkList = Object.keys(mp.chks).sort().join(",");
    const live = mp.spawned && state.phase !== "waiting";
    const h = mp.hide;
    const o = {
      role: mp.myRole, sp: live ? 1 : 0,
      x: live ? Math.round(state.pos.x) : null, y: live ? Math.round(state.pos.y) : null,
      f: mp.face, w: state.walkingClassApplied ? 1 : 0,
      hid: h && h.type === "furn" ? h.id : null,
      bl: h && h.type === "blanket" ? {x: h.x, y: h.y, t: h.t} : null,
      chk: chkList || null, ug: state.underground ? 1 : 0,
      dg: mp.myDigs && mp.myDigs.length ? mp.myDigs.map(d => [d.x, d.y]) : null,
      dgr: mp.g ? mp.g.rid : 0,
      tq: mp.tq || 0, td: mp.td || null, dv: state.diving ? 1 : 0,
      so: state.secretOpen && mp.g ? mp.g.rid : 0,
      ld: state.onLadder ? 1 : 0, lsk: mp.lsk || null,
      dq: mp.dq || 0, df: mp.df || null, lq: mp.lq || 0, bs: state.belly ? 1 : 0
    };
    const holding = isPfa() && mp.g.bn && mp.g.bn.h === Net.myId();   // Pug for All: I carry the bunny's position
    o.bx = holding ? Math.round(pfa.x) : null; o.by = holding ? Math.round(pfa.y) : null;
    const s = JSON.stringify(o);
    if(!force && s === mp.lastSent) return;
    mp.lastSent = s;
    o.t = Math.round(Net.serverNow());            // when this was true (shared server clock) for smooth playback
    Net.setMe(o);
  }

  /* ---------- ?debug overlay: frame rate + network health ---------- */
  const DEBUG = /[?&]debug\b/.test(location.search);
  const dbg = {el: null, frames: 0, t0: 0, ev0: 0, se0: 0, worst: 0};
  function debugFrame(ts){
    if(!DEBUG) return;
    if(!dbg.el){
      dbg.el = document.createElement("div");
      dbg.el.style.cssText = "position:fixed;left:6px;bottom:6px;z-index:9999;background:rgba(0,0,0,.72);color:#9f9;font:11px/1.35 ui-monospace,Menlo,monospace;padding:5px 7px;border-radius:6px;pointer-events:none;white-space:pre";
      document.body.appendChild(dbg.el);
      dbg.t0 = ts; dbg.ev0 = NetStats.events; dbg.se0 = NetStats.sends;
    }
    dbg.frames++;
    if(dbg.last) dbg.worst = Math.max(dbg.worst, ts - dbg.last);
    dbg.last = ts;
    const span = ts - dbg.t0;
    if(span < 1000) return;
    const s = span / 1000;
    const fps = dbg.frames / s, ev = (NetStats.events - dbg.ev0) / s, se = (NetStats.sends - dbg.se0) / s;
    const players = (state.mp && mp.code) ? Net.peers().length : 0;
    dbg.el.textContent =
      `fps ${fps.toFixed(0)}  worst frame ${dbg.worst.toFixed(0)}ms\n` +
      `net in ${ev.toFixed(1)}/s  out ${se.toFixed(1)}/s  players ${players}\n` +
      `late ${NetStats.jit == null ? "-" : NetStats.jit.toFixed(0) + "ms"}  worst ${NetStats.lateMax == null ? "-" : NetStats.lateMax.toFixed(0) + "ms"}\n` +
      `clock+net ${NetStats.clock == null ? "-" : NetStats.clock.toFixed(0) + "ms"}`;
    NetStats.lateMax = 0;
    dbg.frames = 0; dbg.worst = 0; dbg.t0 = ts; dbg.ev0 = NetStats.events; dbg.se0 = NetStats.sends;
  }

  /* ---------- Smooth playback of other players ----------
     Every position update carries a server-clock time. Other players are drawn a little in the past
     (INTERP_DELAY), gliding between the two updates around that moment, so uneven network delivery
     doesn't make them stutter or rubber-band. Big jumps (tunnel, spawn, ladder) snap. */
  const INTERP_DELAY = 100, INTERP_KEEP = 1000;
  function remoteInterp(r, p){
    const buf = r.buf || (r.buf = []);
    const t = p.t || 0;
    if(p.x != null && t && t !== r.lastT){
      const now = Net.serverNow(), lag = now - t;
      // fastest delivery seen lately (drifts up slowly): absorbs clock differences between phones
      r.minLag = r.minLag == null ? lag : Math.min(lag, r.minLag + (now - (r.lastRecv || now)) * 0.01);
      r.lastRecv = now; r.lastT = t;
      const last = buf[buf.length - 1];
      if(last && Math.hypot(p.x - last.x, p.y - last.y) > 160) buf.length = 0;   // teleport-sized jump: don't glide
      buf.push({t: t + r.minLag, x: p.x, y: p.y});
      if(buf.length > 30) buf.shift();
      // debug numbers: "late" = extra delay beyond this player's best (real lag); "clock" = their best delivery
      // time, which also soaks up any disagreement between the two phones' clocks
      const late = lag - r.minLag;
      NetStats.jit = NetStats.jit == null ? late : NetStats.jit * 0.9 + late * 0.1;
      NetStats.lateMax = Math.max(NetStats.lateMax || 0, late);
      NetStats.clock = r.minLag;
    }
    if(!buf.length){ if(p.x != null){ r.x = p.x; r.y = p.y; } return; }
    const rt = Net.serverNow() - INTERP_DELAY;
    while(buf.length > 2 && buf[1].t <= rt) buf.shift();
    while(buf.length > 1 && buf[0].t < rt - INTERP_KEEP) buf.shift();
    const a = buf[0], b = buf[1];
    if(!b || rt <= a.t){ r.x = a.x; r.y = a.y; if(rt >= a.t || !b) return; }
    if(b){
      if(rt >= b.t){ r.x = b.x; r.y = b.y; return; }
      const u = Math.max(0, Math.min(1, (rt - a.t) / ((b.t - a.t) || 1)));
      r.x = a.x + (b.x - a.x) * u; r.y = a.y + (b.y - a.y) * u;
    }
  }

  /* ---------- Drawing the other players ---------- */
  function pointInBed(x, y){
    const b = bedWorldRect; if(!b) return false;
    const m = 16;
    return x > b.x + m && x < b.x + b.w - m && y > b.y + 34 && y < b.y + b.h - m;
  }
  function makeRemote(role, p, lk){
    const el = document.createElement("div");
    el.className = "critter-sprite remote idle " + (role === "pug" ? "pug" : "plat it");
    el.innerHTML = role === "pug" ? spriteMarkup("pug", pugSVG(lookFromCode(lk, "pug")), lookFromCode(lk, "pug")) : spriteMarkup("plat", platypusSVG(lookFromCode(lk, "plat")), lookFromCode(lk, "plat"));
    worldEl.appendChild(el);
    const tag = document.createElement("div");
    tag.className = "name-tag" + (role === "plat" ? " plat" : "");
    tag.textContent = String(p.n || "Player").slice(0, 14);
    worldEl.appendChild(tag);
    const lump = document.createElement("div");
    lump.className = "bed-lump";
    lump.innerHTML = LUMP_SVG;
    worldEl.appendChild(lump);
    return {role, lk, el, tag, lump, flip: el.querySelector(".flip"), x: p.x, y: p.y, walking: false, face: null, blanket: null, blKey: null};
  }
  function removeRemote(r){ r.el.remove(); r.tag.remove(); r.lump.remove(); if(r.blanket) r.blanket.remove(); }
  const MP_MAX_DIGS = 20;   // per pug; digging a 21st fills in that pug's oldest hole
  // Holes on screen = my holes + every other player's current holes (this round only)
  function syncHoles(){
    const want = new Map();
    (mp.myDigs || []).forEach(d => want.set(d.x + "," + d.y, d));
    const rid = mp.g ? mp.g.rid : null;
    for(const pp of Net.peers()){
      if(pp.isMe || !Array.isArray(pp.p.dg) || pp.p.dgr !== rid) continue;
      pp.p.dg.forEach(h => { if(Array.isArray(h)) want.set(h[0] + "," + h[1], {x: h[0], y: h[1]}); });
    }
    for(const [k, el] of mp.holeEls){ if(!want.has(k)){ el.remove(); mp.holeEls.delete(k); } }
    for(const [k, d] of want){ if(!mp.holeEls.has(k)) mp.holeEls.set(k, addDigEl(d, true)); }
    state.digs = [...want.values()];
  }
  function renderRemotes(dt){
    // dig holes + the secret passage only change when someone digs: check a few times a second, not every frame
    const nowMs = performance.now();
    if(!(mp.slowAt > nowMs - 250) || (mp.myDigs || []).length !== mp.slowDigs){
      mp.slowAt = nowMs; mp.slowDigs = (mp.myDigs || []).length;
      syncHoles();
      if(!state.secretOpen && mp.g && Net.peers().some(pp => !pp.isMe && pp.p && pp.p.so && pp.p.so === mp.g.rid)) openSecret(false);   // someone dug it open
    }
    const roles = (mp.g && mp.g.roles) || {};
    const seen = new Set();
    const k = Math.min(1, dt * 12);
    for(const pp of Net.peers()){
      if(pp.isMe) continue;
      const p = pp.p, role = roles[pp.id];

      if(!role || !p.sp || p.x == null) continue;
      seen.add(pp.id);
      let r = mp.remotes.get(pp.id);
      const lk = mpLookCode(pp.id);
      if(!r || r.role !== role || r.lk !== lk){
        const wasPug = r && r.role === "pug";
        if(r) removeRemote(r); r = makeRemote(role, p, lk); mp.remotes.set(pp.id, r);
        if(wasPug && role === "plat"){ r.el.classList.add("just-tagged"); setTimeout(() => r.el.classList.remove("just-tagged"), 1900); }
      }
      atticGhostRemote(pp.id, p.x, p.y, !!p.ug, role);
      remoteInterp(r, p);
      const pk = Math.round(r.x * 4) + "," + Math.round(r.y * 4);
      if(pk !== r.posKey){                                         // only move them when they moved
        r.posKey = pk;
        r.el.style.left = r.x + "px"; r.el.style.top = r.y + "px";
        r.tag.style.left = r.x + "px"; r.tag.style.top = (r.y + 6) + "px";
      }
      const walking = !!p.w;
      if(walking !== r.walking){ r.el.classList.toggle("walking", walking); r.el.classList.toggle("idle", !walking); r.walking = walking; }
      const face = p.f ? "scaleX(-1)" : "scaleX(1)";
      if(face !== r.face && r.flip){ r.flip.style.transform = face; r.face = face; }
      r.el.classList.toggle("xray", !!p.ug);
      r.el.classList.toggle("climbing", !!p.ld);
      r.el.classList.toggle("belly", !!p.bs);
      if(r.lskN === undefined) r.lskN = p.lsk ? p.lsk.n : 0;
      else if(p.lsk && p.lsk.n !== r.lskN){
        r.lskN = p.lsk.n;
        if(mp.g && mp.g.roles && mp.g.roles[pp.id] === "plat") shakeLadder();   // the host decides who gets knocked off (they fall when caught)
      }
      if(!!p.dv !== !!r.dv){ if(r.dv && !p.dv) makeSplash(p.x, p.y); r.dv = !!p.dv; r.el.classList.toggle("diving", r.dv); r.el.style.zIndex = r.dv ? "7" : ""; }
      const rSwim = !p.ug && !p.dv && inPool(r.x, r.y);
      r.el.classList.toggle("swimming", rSwim);
      const rDark = !p.ug && darkAt(r.x, r.y);                   // lights out: can't see anyone else in there
      pawTrail(r, r.x, r.y, rSwim || !!p.dv, !!p.ug || !!p.hid || !!p.bl || rDark);
      r.el.classList.toggle("tubed", !!(mp.g && mp.g.tube && mp.g.tube.h === pp.id) && inPool(r.x, r.y));
      const inBed = !p.ug && pointInBed(r.x, r.y);
      const tunnelHidden = !!p.ug && !state.underground;          // underground players are only visible from the tunnel
      const hidden = !!p.hid || !!p.bl || inBed || tunnelHidden || rDark;
      r._hid = !!p.hid || !!p.bl; r._ug = !!p.ug;
      r.el.style.visibility = hidden ? "hidden" : "";
      r.tag.style.visibility = hidden ? "hidden" : "";
      r.lump.classList.toggle("show", inBed && !p.hid && !p.bl);
      if(inBed){ r.lump.style.left = r.x + "px"; r.lump.style.top = r.y + "px"; }
      const bk = p.bl ? `${p.bl.x},${p.bl.y},${p.bl.t|0}` : null;
      if(bk !== r.blKey){
        if(r.blanket){ r.blanket.remove(); r.blanket = null; }
        if(p.bl){
          const save = state.blanketTunnel;
          state.blanketTunnel = !!p.bl.t;
          const b = makeBlanketEl(p.bl.x, p.bl.y, lookFromCode(r.lk, "pug"));
          state.blanketTunnel = save;
          b.style.zIndex = blanketZ(p.bl.x, p.bl.y, !!p.bl.t);
          b.style.pointerEvents = "none";
          worldEl.appendChild(b);
          r.blanket = b;
        }
        r.blKey = bk;
      }
      if(r.blanket) r.blanket.style.display = ((p.bl && p.bl.t && !state.underground) || (p.bl && !p.bl.t && darkAt(p.bl.x, p.bl.y))) ? "none" : "";
      if(r.blanket && mp.myRole === "plat" && state.phase === "seeking" && !!p.bl.t === !!state.underground && blanketTouchedBy(state.pos.x, state.pos.y, p.bl)){
        if(!r.blTouched){ r.blTouched = true; wiggleEl(r.blanket); }
      } else r.blTouched = false;
    }
    for(const [id, r] of mp.remotes){ if(!seen.has(id)){ removeRemote(r); mp.remotes.delete(id); } }
  }

  function mpFrame(dt){
    if(!mp.inGame) return;
    const dx = state.pos.x - mp.lastX;
    if(Math.abs(dx) > 0.6) mp.face = dx < 0 ? 0 : 1;
    mp.lastX = state.pos.x;
    pfaFrame(dt);
    sendMe(false);
    renderRemotes(dt);
  }

  function mpHud(){
    if(isPfa()){ pfaHud(); return; }
    const G = mp.g || {};
    const pugs = Object.values(G.roles || {}).filter(r => r === "pug").length;
    phasePill.innerHTML = mp.myRole === "pug" ? "🐶 Pug" : "Platypus";
    if(G.ld){
      leadPill.style.display = "";
      leadPill.innerHTML = "👑 <span></span>";
      leadPill.querySelector("span").textContent = G.ld === Net.myId() ? "You" : (G.ldn || "Platypus");
    } else leadPill.style.display = "none";
    if(G.ph === "head") statPill.textContent = mp.myRole === "pug" ? `Hide! ${G.hl}s` : `Released in ${G.hl}s`;
    else statPill.textContent = `🐶 ${pugs} · ⏱ ${fmt(Math.max(0, TAG_TIME - (G.el | 0)))}`;
  }

  function showTagOver(){
    if(mp.overShown) return;
    mp.overShown = true;
    const G = JSON.parse(JSON.stringify(mp.g));
    mp.inGame = false;
    state.phase = "over";
    plainBtn.classList.remove("show"); confirmFab.classList.remove("show");
    document.getElementById("tagover-count-lbl").textContent = "PUGS TAGGED";
    if(G.md === "pfa"){
      pfaShowOver(G);
      if(G.win && !G.win.none) playFinale(G, () => { if(!mp.inGame) switchScreen(tagoverScreen); });
      else setTimeout(() => { if(!mp.inGame) switchScreen(tagoverScreen); }, 900);
      return;
    }
    const tg = G.tg || [];
    document.getElementById("tagover-time").textContent = fmt(G.el);
    document.getElementById("tagover-count").textContent = tg.length;
    const list = document.getElementById("tagover-list");
    list.innerHTML = "";
    tg.forEach((t, i) => {
      const li = document.createElement("li");
      const a = document.createElement("span"); a.textContent = `${i + 1}. ${t.n}`;
      const b = document.createElement("span"); b.className = "tag"; b.textContent = fmt(t.t);
      li.append(a, b); list.appendChild(li);
    });
    const last = tg[tg.length - 1];
    if(G.win){
      document.getElementById("tagover-title").textContent = "Time's up! Pugs win!";
      const sv = G.sv || [G.win.n];
      document.getElementById("tagover-sub").textContent = sv.length > 1 ? `Still free: ${sv.join(", ")}.` : `${sv[0]} escaped the platypus!`;
    } else {
      document.getElementById("tagover-title").textContent = "All pugs tagged!";
      document.getElementById("tagover-sub").textContent = last ? `${last.n} was the last pug standing.` : "Every pug has been found.";
    }
    if(G.fin || (G.win && !G.win.none)) playFinale(G, () => { if(!mp.inGame) switchScreen(tagoverScreen); });
    else setTimeout(() => { if(!mp.inGame) switchScreen(tagoverScreen); }, 900);
  }

  /* Final tag scene (~5s, everyone at once): every screen snaps to the spot, the last pug
     does a little dance and runs off the bottom of the screen, then pops up huge and licks the glass. */
  // Tongue for the big face: one soft, rounded shape whose length / sideways bend / squash are
  // animated every frame, so it flops out, flattens against the glass, swipes, and slurps back in.
  const TONGUE_SVG = `<svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg" overflow="visible">
<defs>
  <linearGradient id="tgFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#DE557A"/><stop offset="0.3" stop-color="#FF8CA8"/><stop offset="0.7" stop-color="#FF8CA8"/><stop offset="1" stop-color="#CF4C70"/></linearGradient>
  <radialGradient id="tgWet" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFE4EC" stop-opacity="0.9"/><stop offset="1" stop-color="#FFE4EC" stop-opacity="0"/></radialGradient>
  <clipPath id="tgClip"><rect x="-200" y="9" width="500" height="600"/></clipPath>
</defs>
<ellipse cx="50" cy="9" rx="34" ry="11" fill="#3E1420" stroke="#241811" stroke-width="2.5"/>
<g clip-path="url(#tgClip)"><g class="tg-rot">
  <path class="tg-body" fill="url(#tgFill)" stroke="#241811" stroke-width="2.6" stroke-linejoin="round"/>
  <path class="tg-groove" fill="none" stroke="#C0415F" stroke-width="3.4" stroke-linecap="round"/>
  <path class="tg-shine" fill="none" stroke="#FFD6E0" stroke-width="4.5" stroke-linecap="round" opacity="0.8"/>
  <ellipse class="tg-wet" rx="0" ry="0" fill="url(#tgWet)"/>
</g></g>
</svg>`;
  // len: 0..1 how far out, ang: swing in degrees, drag: how much the tip lags the swing,
  // wide/flat: squash when it's pressed flat against the glass
  function drawTongue(svg, len, ang, drag, wide, flat){
    const bx = 50, by = 2, bw = 24;
    const tw = 34 * wide;
    const tx = bx + drag * 26, ty = by + 26 + len * 150;
    const sh = ty - tw * 0.8, k = sh - by;
    const lx = tx - tw, rx = tx + tw;
    const body = `M ${bx-bw} ${by} C ${bx-bw-4} ${by + k*0.5} ${lx + drag*8} ${sh - k*0.35} ${lx} ${sh} ` +
      `C ${lx} ${ty + tw*flat} ${rx} ${ty + tw*flat} ${rx} ${sh} ` +
      `C ${rx + drag*8} ${sh - k*0.35} ${bx+bw+4} ${by + k*0.5} ${bx+bw} ${by} Z`;
    svg.querySelector(".tg-rot").setAttribute("transform", `rotate(${ang.toFixed(2)} 50 8)`);
    svg.querySelector(".tg-body").setAttribute("d", body);
    svg.querySelector(".tg-groove").setAttribute("d", `M ${bx} ${by + 14} Q ${(bx + tx)/2 + drag*10} ${(by + sh)/2} ${tx} ${ty - tw*0.45}`);
    svg.querySelector(".tg-shine").setAttribute("d", len > 0.3 ? `M ${bx - bw*0.55} ${by + 20} Q ${(bx + tx)/2 - tw*0.55 + drag*8} ${(by + sh)/2} ${tx - tw*0.62} ${sh}` : "");
    const wet = svg.querySelector(".tg-wet");
    wet.setAttribute("cx", tx); wet.setAttribute("cy", ty - tw*0.25);
    wet.setAttribute("rx", (tw * 0.8 * (1 - flat) * 1.4).toFixed(1)); wet.setAttribute("ry", (tw * 0.35 * (1 - flat) * 1.4).toFixed(1));
    const r = ang * Math.PI / 180, dx = tx - 50, dy = ty - 8;              // tip in svg coords after rotation
    return {x: 50 + dx*Math.cos(r) - dy*Math.sin(r), y: 8 + dx*Math.sin(r) + dy*Math.cos(r)};
  }
  const easeIO = t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
  const easeOutBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  // Two big slurpy licks (the second swipes the other way); panting wobble in between
  function animateTongue(face, t0, licksAt, onSmear){
    const svg = face.querySelector(".ff-tongue svg"), wrap = face.querySelector(".ff-wrap"), box = face.querySelector(".ff-tongue");
    const LICK = 950;
    const smeared = new Set();
    const frame = now => {
      if(!face.classList.contains("show")){ wrap.style.scale = ""; wrap.style.translate = ""; return; }
      const t = now - t0;
      // resting: tongue hanging out, panting
      let len = 0.22 + 0.06 * Math.max(0, Math.sin(t / 70)), ang = 4 * Math.sin(t / 160), drag = 0, wide = 1, flat = 1, push = 0;
      const i = licksAt.findIndex(st => t >= st && t < st + LICK);
      if(i >= 0){
        const p = (t - licksAt[i]) / LICK, dir = i % 2 ? -1 : 1;
        if(p < 0.2){                                        // shoots out, a little past, cocked to one side
          const e = easeOutBack(p / 0.2);
          len = 0.22 + 0.78 * e; ang = 22 * dir * Math.min(1, e); drag = -0.15 * dir * e;
        } else if(p < 0.62){                                // pressed on the glass, swiping across
          const q = easeIO((p - 0.2) / 0.42), bump = Math.sin(q * Math.PI);
          ang = dir * (22 - 44 * q); drag = dir * (0.45 * q - 0.25) * 1.2;   // tip trails behind the swing
          len = 1 - 0.12 * bump; wide = 1 + 0.4 * bump; flat = 1 - 0.65 * bump; push = bump;
          if(q > 0.5 && !smeared.has(i)){
            smeared.add(i);
            const tip = drawTongue(svg, len, ang, drag, wide, flat), r = box.getBoundingClientRect(), fr = face.getBoundingClientRect();
            onSmear((r.left - fr.left + tip.x / 100 * r.width) / fr.width * 100, (r.top - fr.top + tip.y / 200 * r.height) / fr.height * 100, dir);
          }
        } else {                                            // slurps back in with a flick
          const e = easeIO((p - 0.62) / 0.38);
          len = 1 - 0.78 * e; ang = dir * (-22 * (1 - e) + 6 * Math.sin(e * Math.PI)); drag = dir * 0.3 * (1 - e);
        }
      }
      drawTongue(svg, len, ang, drag, wide, flat);
      wrap.style.scale = String(1 + 0.06 * push);               // face leans into the screen
      wrap.style.translate = `0 ${(4 * Math.sin(t / 190) - 12 * push).toFixed(1)}px`;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  function playFinale(G, done){
    const F = G.fin || G.win, me = Net.myId(), timeUp = !G.fin;
    const look = lookFromCode((G.lk || {})[F.id], "pug");
    state.busy = true;
    [confirmFab, digBtn, plainBtn].forEach(b => b.classList.remove("show"));
    interstitial.style.display = "none";
    // snap every camera to where it happened, lights on
    const W = viewportW, H = viewportH;
    state.camX = clamp(F.x - W/2, 0, Math.max(0, WORLD.w - W));
    state.camY = clamp(F.y - H/2, camTop(), Math.max(camTop(), WORLD.h - H));
    worldEl.style.transform = `translate(${-state.camX}px, ${-state.camY}px)`;
    for(const k in ROOM_FOG) ROOM_FOG[k].classList.remove("on");
    if(tunnelPathEl) tunnelPathEl.classList.toggle("show", !!F.ug);
    applySecret();
    if(secretPathEl) secretPathEl.classList.toggle("show", !!(F.ug && state.secretOpen));
    // the caught pug stays a pug for its goodbye (hide whatever was drawn for them)
    if(F.id === me){ spriteEl.style.visibility = "hidden"; footEl.style.visibility = "hidden"; }
    else { const r = mp.remotes.get(F.id); if(r){ r.el.style.visibility = "hidden"; r.tag.style.visibility = "hidden"; r.lump.classList.remove("show"); if(r.blanket) r.blanket.style.display = "none"; } }
    if(F.id === me && mp.myBlanketEl) mp.myBlanketEl.style.display = "none";
    const actor = document.createElement("div");
    actor.className = "critter-sprite pug idle finale-actor" + (F.ug ? " xray" : "");
    actor.innerHTML = spriteMarkup("pug", pugSVG(look), look);
    actor.style.left = F.x + "px"; actor.style.top = F.y + "px";
    worldEl.appendChild(actor);
    const banner = document.getElementById("finale-banner");
    banner.textContent = G.md === "pfa" ? (F.id === me ? "Time's up! You kept the bunny longest!" : `Time's up! ${F.n} kept the bunny longest!`)
      : timeUp ? (F.id === me ? "⏰ Time's up! You survived!" : `⏰ Time's up! ${F.n} and the pugs win!`)
      : F.by === me ? "🎉 You got the final tag!" : F.id === me ? `${F.bn} caught you last!` : `🎉 ${F.bn} got the final tag!`;
    banner.classList.add("show");
    const face = document.getElementById("finale-face");
    face.querySelector(".ff-dog").innerHTML = pugSVG(look);
    face.querySelector(".ff-tongue").innerHTML = TONGUE_SVG;
    face.querySelectorAll(".lick-smear").forEach(e => e.remove());
    face.className = "";
    const T = [];
    const at = (ms, fn) => T.push(setTimeout(fn, ms));
    at(250, () => actor.classList.add("dance"));
    at(1400, () => {                                   // run straight down and off the screen
      actor.classList.remove("dance"); actor.classList.add("walking", "run-off");
      const flip = actor.querySelector(".flip"); if(flip) flip.style.transform = "scaleX(1)";
      actor.style.top = (state.camY + H + 120) + "px";
    });
    at(2250, () => { face.classList.add("show"); void face.offsetWidth; face.classList.add("up"); });
    const smear = (cx, cy, dir) => { const e = document.createElement("div"); e.className = "lick-smear";
      e.style.cssText = `left:${cx - 30}%;top:${cy - 9}%;width:60%;height:18%;transform:rotate(${dir * 18}deg)`; face.appendChild(e); requestAnimationFrame(() => e.classList.add("on")); };
    at(2250, () => animateTongue(face, performance.now(), [450, 1400], smear));
    at(4800, () => { face.classList.add("out"); banner.classList.remove("show"); });
    at(5250, () => {
      face.className = ""; actor.remove();
      state.busy = false;
      done();
    });
    mp.finaleTimers = T;
  }
