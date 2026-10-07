  /* ======================================================================
     PUG FOR ALL (multiplayer free-for-all). Every player is a dog. One baby bunny starts by the front
     yard's left hole and hops around the front yard. Touch it to grab it; it then follows you closely
     (Pikachu-style) wherever you go: pool, tunnel, trellis, under the covers. Whoever holds it is "it",
     and the host logs how long each player held it. Others steal it by touching it (or, if its holder is
     hiding in furniture, by touch-searching that furniture). After a steal it can't be taken for 0.5s.
     2:30 rounds; longest total hold wins.
     Host-authoritative like Platytag: G.md === "pfa", G.bn = bunny state, G.ht = seconds held per player.
     While held, the bunny's position is simulated on the holder's phone and sent as bx/by.
     ====================================================================== */
  const PFA_TIME = 150;                 // seconds per round
  const BUNNY_GRAB_R = 28;              // how close a dog must get to the bunny (or its tiny blanket) to take it
  const BUNNY_STEAL_LOCK_MS = 500;      // after any grab, nobody can take it for this long
  const BUNNY_FOLLOW_DIST = 42;         // how far behind its holder (along their path) the bunny trots
  const BUNNY_SPEED = 380;              // px/s it can move catching up (dogs walk 300)
  const BUNNY_HOLE_SLOW = 0.55;         // speed multiplier while crossing a dug hole
  const BUNNY_TELEPORT = 140;           // holder jumped further than this in one frame (tunnel/slide/spawn): bunny pops to them
  const BUNNY_WILD_SPEED = 70;          // px/s while hopping around on its own
  const BUNNY_HOP_MIN = 40, BUNNY_HOP_MAX = 120;         // wander distance per hop run
  const BUNNY_PAUSE_MIN = 500, BUNNY_PAUSE_MAX = 1400;  // ms sitting still between runs
  const BUNNY_YARD_PAD = 40;            // keep the wild bunny this far inside the front yard edges
  const BUNNY_STORE_KEY = "pfa_bunny";  // the breed you want the bunny to become while you hold it
  const BUNNY_PICKS = BUNNY_BREEDS.filter(b => b !== "white");   // white is the wild bunny everyone starts with
  const BUNNY_NAMES = {brown: "Brown", patchy: "Patchy", yellow: "Yellow", pink: "Pink", dragon: "Dragon", unicorn: "Unicorn"};

  // pool ring the bunny paddles around in while swimming
  const BUNNY_FLOAT_SVG = `<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg">
<ellipse cx="50" cy="20" rx="45" ry="14" fill="none" stroke="#241811" stroke-width="13"/>
<ellipse cx="50" cy="20" rx="45" ry="14" fill="none" stroke="#FF8FB1" stroke-width="9"/>
<ellipse cx="50" cy="20" rx="45" ry="14" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-dasharray="14 18"/>
<path d="M 18 12 Q 50 3 82 12" fill="none" stroke="#fff" stroke-width="2.4" opacity="0.7" stroke-linecap="round"/>
</svg>`;
  function isPfa(){ return !!(mp.g && mp.g.md === "pfa"); }
  function myBunnyPick(){
    let b = null;
    try{ b = localStorage.getItem(BUNNY_STORE_KEY); }catch(e){}
    if(!BUNNY_PICKS.includes(b)){
      b = BUNNY_PICKS[Math.floor(Math.random() * BUNNY_PICKS.length)];
      try{ localStorage.setItem(BUNNY_STORE_KEY, b); }catch(e){}
    }
    return b;
  }

  /* ---------- Lobby: pick the bunny you'll carry ---------- */
  function renderBunnyPicker(){
    const box = document.getElementById("bunny-picker"), lbl = document.getElementById("bunny-pick-label");
    if(!box) return;
    const on = lobbyMode() === "pfa";
    box.style.display = lbl.style.display = on ? "" : "none";
    if(!on) return;
    const cur = myBunnyPick();
    box.innerHTML = BUNNY_PICKS.map(b => `<button type="button" class="dog-opt${b === cur ? " sel" : ""}" data-bunny="${b}"><span class="bunny-pic">${bunnySVG(b)}</span><span>${BUNNY_NAMES[b]}</span></button>`).join("");
  }
  document.addEventListener("click", e => {
    const opt = e.target.closest("#bunny-picker button");
    if(!opt) return;
    try{ localStorage.setItem(BUNNY_STORE_KEY, opt.dataset.bunny); }catch(err){}
    renderBunnyPicker();
    if(mp.code) Net.setMe({bb: opt.dataset.bunny});
  });

  /* ---------- Wild bunny: hops between random spots in the front yard (same on every phone) ---------- */
  function bunnySpawn(){
    const h = HOLES[0];                                       // the front yard's left hole
    for(const dx of [34, -34, 0]){ const p = {x: h.x + dx, y: h.y + 26}; if(isWalkable(p.x, p.y)) return p; }
    return {x: h.x, y: h.y + 40};
  }
  function wildPos(w, now){
    if(!w) return {x: 0, y: 0, moving: false};
    const u = w.d > 0 ? Math.max(0, Math.min(1, (now - w.t0) / w.d)) : 1;
    return {x: w.x0 + (w.x1 - w.x0) * u, y: w.y0 + (w.y1 - w.y0) * u, moving: u > 0 && u < 1, dir: w.x1 - w.x0};
  }
  function nextWildSeg(from, now){
    const R = ROOMS.frontyard.rect, pad = BUNNY_YARD_PAD;
    for(let i = 0; i < 40; i++){
      const a = Math.random() * Math.PI * 2, d = BUNNY_HOP_MIN + Math.random() * (BUNNY_HOP_MAX - BUNNY_HOP_MIN);
      const x = from.x + Math.cos(a) * d, y = from.y + Math.sin(a) * d;
      if(x < R.x + pad || x > R.x + R.w - pad || y < R.y + pad || y > R.y + R.h - pad) continue;
      let ok = true;                                          // straight hop must stay on open ground
      for(let k = 1; k <= 6 && ok; k++){ const t = k / 6; ok = isWalkable(from.x + (x - from.x) * t, from.y + (y - from.y) * t) && roomAt(from.x + (x - from.x) * t, from.y + (y - from.y) * t) === "frontyard"; }
      if(!ok) continue;
      return {x0: Math.round(from.x), y0: Math.round(from.y), x1: Math.round(x), y1: Math.round(y), t0: Math.round(now),
        d: Math.round(d / BUNNY_WILD_SPEED * 1000), p: Math.round(BUNNY_PAUSE_MIN + Math.random() * (BUNNY_PAUSE_MAX - BUNNY_PAUSE_MIN))};
    }
    return {x0: Math.round(from.x), y0: Math.round(from.y), x1: Math.round(from.x), y1: Math.round(from.y), t0: Math.round(now), d: 0, p: BUNNY_PAUSE_MAX};
  }

  /* ---------- Host ---------- */
  function pfaHostStart(ids, peerById){
    const roles = {}, lk = {}, bb = {}, ey = {};
    ids.forEach(id => {
      roles[id] = "pug";
      const d = String((peerById[id] || {}).dog || "");
      lk[id] = DOG_BREEDS.includes(d.split("|")[0]) ? d : dogCode(randLook("pug"));
      const want = (peerById[id] || {}).bb;
      bb[id] = BUNNY_PICKS.includes(want) ? want : BUNNY_PICKS[Math.floor(Math.random() * BUNNY_PICKS.length)];
      ey[id] = BUNNY_EYES[Math.floor(Math.random() * BUNNY_EYES.length)];
    });
    const now = Net.serverNow(), sp = bunnySpawn();
    mp.hostG = {md: "pfa", ph: "play", rid: (mp.hostG ? mp.hostG.rid : 0) + 1, roles, lk, bb, ey, el: 0, ht: {}, le: {}, ev: 0, evn: null,
      bn: {h: null, since: 0, st: 0, w: {x0: sp.x, y0: sp.y, x1: sp.x, y1: sp.y, t0: Math.round(now), d: 0, p: 1200}},
      tube: {x: Math.round(TUBE_HOME.x), y: Math.round(TUBE_HOME.y), h: null}};
    mp.tubeSeenTq = {}; mp.tubeSeenTd = {}; mp.tubeLast = null;
    roster().forEach(pp => { mp.tubeSeenTq[pp.id] = pp.p.tq || 0; mp.tubeSeenTd[pp.id] = pp.p.td ? pp.p.td.n : 0; });
    mp.hostT0 = Date.now();
    mp.hostDq = {}; mp.hostLq = {};
    mp.overShown = false;
    pushHost();
  }
  // where the bunny is as far as the host can tell (for grabs)
  function pfaHostBunny(G, byId, now){
    const B = G.bn;
    if(!B.h){ const w = wildPos(B.w, now); return {x: w.x, y: w.y, ug: 0, hid: null}; }
    const hp = byId.get(B.h) || {};
    if(hp.hid) return {x: hp.x, y: hp.y, ug: 0, hid: hp.hid};
    return {x: hp.bx != null ? hp.bx : hp.x, y: hp.by != null ? hp.by : hp.y, ug: hp.ug ? 1 : 0, hid: null};
  }
  function pfaCredit(G, now){
    const B = G.bn;
    if(!B.h) return;
    G.ht[B.h] = Math.round(((G.ht[B.h] || 0) + Math.max(0, now - B.since) / 1000) * 10) / 10;
    G.le[B.h] = Math.round(now);
  }
  function pfaHostRules(G, byId, elapsed){
    let changed = false;
    const now = Net.serverNow(), B = G.bn;
    const el = Math.floor(elapsed);
    if(el !== G.el){ G.el = el; changed = true; }
    const nameOf = id => String((byId.get(id) || {}).n || "A pug").slice(0, 14);
    // holder left the game: the bunny runs back to its hole
    if(B.h && !(byId.get(B.h) && byId.get(B.h).sp)){
      pfaCredit(G, now);
      const sp = bunnySpawn();
      Object.assign(B, {h: null, since: 0, st: Math.round(now), w: {x0: sp.x, y0: sp.y, x1: sp.x, y1: sp.y, t0: Math.round(now), d: 0, p: 1200}});
      G.ev++; G.evn = {to: null, from: null, back: 1};
      changed = true;
    }
    if(!B.h && now >= B.w.t0 + B.w.d + B.w.p){ B.w = nextWildSeg({x: B.w.x1, y: B.w.y1}, now); changed = true; }
    if(now - B.st >= BUNNY_STEAL_LOCK_MS && G.el < PFA_TIME){
      const bp = pfaHostBunny(G, byId, now);
      let best = null, bestD = Infinity;
      for(const id of Object.keys(G.roles)){
        if(id === B.h) continue;
        const p = byId.get(id);
        if(!p || !p.sp || p.x == null || p.hid || p.bl) continue;          // a hidden dog can't grab
        let d;
        if(bp.hid) d = (typeof p.chk === "string" && p.chk.split(",").includes(bp.hid)) ? 0 : Infinity;   // search the holder's hiding spot
        else d = (!!p.ug === !!bp.ug) ? Math.hypot(p.x - bp.x, p.y - bp.y) : Infinity;
        if(d < BUNNY_GRAB_R && d < bestD){ best = id; bestD = d; }
      }
      if(best){
        const from = B.h;
        pfaCredit(G, now);
        Object.assign(B, {h: best, since: Math.round(now), st: Math.round(now)});
        G.ev++; G.evn = {to: best, tn: nameOf(best), from: from || null, fn: from ? nameOf(from) : null};
        changed = true;
      }
    }
    if(G.el >= PFA_TIME){
      G.el = PFA_TIME;
      pfaCredit(G, now);
      const ids = Object.keys(G.roles);
      const lb = ids.map(id => ({id, n: nameOf(id), s: G.ht[id] || 0})).sort((a, b) => b.s - a.s || (G.le[b.id] || 0) - (G.le[a.id] || 0));
      G.lb = lb;
      const top = lb[0];
      if(top && top.s > 0){
        const wq = byId.get(top.id) || {};
        G.win = wq.x != null ? {id: top.id, x: Math.round(wq.x), y: Math.round(wq.y), ug: wq.ug ? 1 : 0, n: top.n} : {id: top.id, none: 1, n: top.n};
      } else G.win = null;
      G.ph = "over";
      changed = true;
    }
    if(Object.keys(G.roles).length === 0 && G.ph !== "over"){ G.ph = "over"; G.lb = []; G.win = null; changed = true; }
    return changed;
  }

  /* ---------- Everyone: the bunny on screen ---------- */
  const pfa = {el: null, blEl: null, lumpEl: null, key: null, h: undefined, trail: [], bs: 0, x: 0, y: 0, rx: null, ry: null, R: null, ev: 0, face: 1};
  function pfaReset(){
    Object.assign(pfa, {el: null, blEl: null, lumpEl: null, key: null, h: undefined, trail: [], bs: 0, R: null, ev: (mp.g && mp.g.ev) || 0});
    mp.pfaLatch = new Set();
  }
  function pfaEnsureEls(){
    if(pfa.el && pfa.el.isConnected) return;
    pfa.el = document.createElement("div");
    pfa.el.className = "bunny-sprite";
    pfa.el.innerHTML = `<div class="bn-flip"><div class="bn-body"><div class="bn-hop"></div><div class="bn-float">${BUNNY_FLOAT_SVG}</div></div></div>`;
    worldEl.appendChild(pfa.el);
    pfa.lumpEl = document.createElement("div");
    pfa.lumpEl.className = "bed-lump bunny-lump";
    pfa.lumpEl.innerHTML = LUMP_SVG;
    worldEl.appendChild(pfa.lumpEl);
    pfa.blEl = null; pfa.key = null;
  }
  // holder's phone: trot along my path, BUNNY_FOLLOW_DIST behind me
  function pfaFollow(dt){
    const T = pfa.trail, hx = state.pos.x, hy = state.pos.y;
    const last = T[T.length - 1];
    const jump = last ? Math.hypot(hx - last.x, hy - last.y) : Infinity;
    if(!last || jump > BUNNY_TELEPORT){ pfa.trail = [{x: hx, y: hy, s: 0}]; pfa.bs = 0; pfa.x = hx; pfa.y = hy; return; }
    if(jump > 2) T.push({x: hx, y: hy, s: last.s + jump});
    const headS = T[T.length - 1].s;
    const want = Math.max(T[0].s, headS - BUNNY_FOLLOW_DIST);
    const sp = BUNNY_SPEED * (nearDig(pfa.x, pfa.y) ? BUNNY_HOLE_SLOW : 1);
    if(want > pfa.bs) pfa.bs = Math.min(want, pfa.bs + sp * dt);
    let i = 1;
    while(i < T.length - 1 && T[i].s < pfa.bs) i++;
    const a = T[i - 1], b = T[i] || a, span = (b.s - a.s) || 1, u = Math.max(0, Math.min(1, (pfa.bs - a.s) / span));
    pfa.x = a.x + (b.x - a.x) * u; pfa.y = a.y + (b.y - a.y) * u;
    if(i > 2) T.splice(0, i - 2);                         // forget path the bunny has already covered
  }
  function pfaFrame(dt){
    const G = mp.g;
    if(!G || G.md !== "pfa" || !G.bn) return;
    const me = Net.myId(), now = Net.serverNow(), B = G.bn;
    pfaEnsureEls();
    if(B.h !== pfa.h){                                      // new holder: the bunny pops onto them
      pfa.h = B.h; pfa.trail = []; pfa.R = null;
      pfa.el.classList.remove("pop"); void pfa.el.offsetWidth; pfa.el.classList.add("pop");
    }
    if((G.ev || 0) !== pfa.ev){ pfa.ev = G.ev || 0; pfaAnnounce(G); }
    let x, y, ug = false, hid = false, blanket = false, moving = false;
    if(!B.h){
      const w = wildPos(B.w, now); x = w.x; y = w.y; moving = w.moving; if(moving && w.dir) pfa.face = w.dir > 0 ? -1 : 1;
    } else if(B.h === me){
      pfaFollow(dt);
      x = pfa.x; y = pfa.y; ug = !!state.underground;
      hid = !!(mp.hide && mp.hide.type === "furn"); blanket = !!(mp.hide && mp.hide.type === "blanket");
    } else {
      const pp = Net.peers().find(q => q.id === B.h), p = pp && pp.p;
      if(!p || p.x == null) return pfaHide();
      pfa.R = pfa.R || {};
      remoteInterp(pfa.R, {x: p.bx != null ? p.bx : p.x, y: p.by != null ? p.by : p.y, t: p.t});
      x = pfa.R.x; y = pfa.R.y; ug = !!p.ug; hid = !!p.hid; blanket = !!p.bl;
    }
    if(pfa.rx != null){ const dx = x - pfa.rx; if(B.h && Math.abs(dx) > 0.4) pfa.face = dx > 0 ? -1 : 1; if(B.h) moving = Math.hypot(dx, y - pfa.ry) > 0.5; }
    pfa.rx = x; pfa.ry = y;
    // what this viewer can see (same rules as other players)
    const inBed = !ug && pointInBed(x, y);
    const invisible = hid || (ug && !state.underground) || (B.h !== me && !ug && darkAt(x, y));
    const showSprite = !invisible && !inBed && !blanket;
    // art: white while wild, then the holder's chosen breed with their eye style
    const breed = B.h ? ((G.bb || {})[B.h] || "white") : "white";
    const eye = B.h ? ((G.ey || {})[B.h] || null) : null;
    const key = breed + "|" + eye;
    if(key !== pfa.key){ pfa.key = key; pfa.el.querySelector(".bn-hop").innerHTML = bunnySVG(breed, eye); }
    pfa.el.style.left = x + "px"; pfa.el.style.top = y + "px";
    pfa.el.style.visibility = showSprite ? "" : "hidden";
    pfa.el.classList.toggle("hopping", moving);
    pfa.el.classList.toggle("xray", ug);
    pfa.el.classList.toggle("swim", !ug && inPool(x, y));
    pfa.el.querySelector(".bn-flip").style.transform = `scaleX(${pfa.face})`;
    pfa.lumpEl.classList.toggle("show", inBed && !invisible && !blanket);
    if(inBed){ pfa.lumpEl.style.left = x + "px"; pfa.lumpEl.style.top = y + "px"; }
    // its own tiny blanket while its holder is under a blanket
    const bk = blanket && !invisible ? Math.round(x) + "," + Math.round(y) + "," + (ug ? 1 : 0) : null;
    if(bk !== pfa.blKey){
      if(pfa.blEl){ pfa.blEl.remove(); pfa.blEl = null; }
      if(bk){
        const save = state.blanketTunnel; state.blanketTunnel = ug;
        const b = makeBlanketEl(x, y);
        state.blanketTunnel = save;
        b.classList.add("bunny-blanket"); b.removeAttribute("data-id");
        b.style.zIndex = blanketZ(x, y, ug); b.style.pointerEvents = "none";
        worldEl.appendChild(b); pfa.blEl = b;
      }
      pfa.blKey = bk;
    }
  }
  function pfaHide(){ if(pfa.el) pfa.el.style.visibility = "hidden"; if(pfa.lumpEl) pfa.lumpEl.classList.remove("show"); }
  function pfaAnnounce(G){
    const E = G.evn, me = Net.myId();
    if(!E) return;
    if(E.back){ showToast("The bunny ran back to the front yard!", 2000); return; }
    if(E.to === me){ showToast(E.from ? `You took the bunny from ${E.fn}!` : "You caught the bunny!", 1800); if(navigator.vibrate) try{ navigator.vibrate(60); }catch(e){} }
    else if(E.from === me) showToast(`${E.tn} stole the bunny!`, 1800);
    else showToast(`${E.tn} has the bunny!`, 1500);
  }
  // non-holders search furniture by bumping into it (that's how you steal from a hidden holder)
  function pfaTouchSearch(){
    const G = mp.g;
    if(!G || !G.bn || G.bn.h === Net.myId() || mp.hide || state.underground || state.onLadder) return;
    const px = state.pos.x, py = state.pos.y;
    for(const id of [...mp.pfaLatch]){
      const it = FURN_LIST.find(f => f.id === id);
      if(!it || distToItem(it, px, py) > REARM_D) mp.pfaLatch.delete(id);
    }
    for(const it of FURN_LIST){
      if(it.hidden || it.id === "blanket" || distToItem(it, px, py) > TOUCH_D) continue;
      mp.chks[it.id] = Date.now() + 600;
      if(!mp.pfaLatch.has(it.id)){ mp.pfaLatch.add(it.id); wiggleEl(it.el); }
    }
  }
  function pfaHeldSeconds(G, id){
    const B = G.bn || {};
    return (G.ht && G.ht[id] || 0) + (B.h === id ? Math.max(0, Net.serverNow() - B.since) / 1000 : 0);
  }
  function pfaHud(){
    const G = mp.g || {}, me = Net.myId(), B = G.bn || {};
    phasePill.innerHTML = "🐶 Pug";
    leadPill.style.display = "";
    leadPill.innerHTML = "Bunny: <span></span>";
    const holder = B.h ? (B.h === me ? "You" : String(((Net.peers().find(q => q.id === B.h) || {}).p || {}).n || "?").slice(0, 14)) : "loose";
    leadPill.querySelector("span").textContent = holder;
    statPill.textContent = `${fmt(Math.floor(pfaHeldSeconds(G, me)))} · ⏱ ${fmt(Math.max(0, PFA_TIME - (G.el | 0)))}`;
  }
  function pfaShowOver(G){
    document.getElementById("tagover-title").textContent = "Time's up!";
    document.getElementById("tagover-sub").textContent = G.win ? `${G.win.n} held the bunny the longest!` : "Nobody caught the bunny!";
    document.getElementById("tagover-time").textContent = fmt(G.el);
    document.getElementById("tagover-count").textContent = G.ev || 0;
    document.getElementById("tagover-count-lbl").textContent = "BUNNY GRABS";
    const list = document.getElementById("tagover-list");
    list.innerHTML = "";
    (G.lb || []).forEach((r, i) => {
      const li = document.createElement("li");
      const a = document.createElement("span"); a.textContent = `${i + 1}. ${r.n}${r.id === Net.myId() ? " (you)" : ""}`;
      const b = document.createElement("span"); b.className = "tag"; b.textContent = fmt(Math.floor(r.s));
      li.append(a, b); list.appendChild(li);
    });
  }
