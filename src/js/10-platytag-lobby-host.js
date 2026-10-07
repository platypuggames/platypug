  /* ---------- Lobby flow ---------- */
  // which game this lobby is for: the room's mode once you're in one, else the button you came from
  function lobbyMode(){ return (mp.code && mp.g && mp.g.md) || mp.wantMode || "tag"; }
  function showJoinCard(note){
    lobbyJoin.style.display = ""; lobbyRoom.style.display = "none";
    lobbyTitle.textContent = MODE_INFO[lobbyMode()].title;
    lobbyStatus.textContent = note || MODE_INFO[lobbyMode()].note;
  }
  const lobbyTitle = document.getElementById("lobby-title");
  document.getElementById("tag-btn").addEventListener("click", () => openLobby("tag"));
  document.getElementById("pfa-btn").addEventListener("click", () => openLobby("pfa"));
  async function openLobby(mode){
    switchScreen(lobbyScreen);
    if(mp.code){ renderLobby(); return; }
    mp.wantMode = mode;
    renderBunnyPicker();
    showJoinCard("Connecting…");
    createBtn.disabled = joinBtn.disabled = true;
    const ok = navigator.onLine !== false && await Net.available();
    createBtn.disabled = joinBtn.disabled = !ok;
    lobbyStatus.textContent = ok ? MODE_INFO[lobbyMode()].note : `${MODE_INFO[lobbyMode()].title} needs an internet connection. Pug and Seek works offline!`;
    nickInput.disabled = codeInput.disabled = !ok;
  }
  createBtn.addEventListener("click", () => enterRoom(randCode(), true));
  joinBtn.addEventListener("click", () => {
    const code = codeInput.value.trim().toUpperCase();
    if(code.length !== 4){ lobbyStatus.textContent = "Enter the 4-letter room code."; return; }
    enterRoom(code, false);
  });
  codeInput.addEventListener("keydown", e => { if(e.key === "Enter") joinBtn.click(); });
  document.getElementById("lobby-back").addEventListener("click", async () => { await leaveRoom(); switchScreen(titleScreen); });

  async function enterRoom(code, asHost){
    try{ localStorage.setItem("platytag_name", myName()); }catch(e){}
    createBtn.disabled = joinBtn.disabled = true;
    lobbyStatus.textContent = "Joining…";
    try{
      // offline, joining never finishes: give up after 10 seconds instead of hanging on "Joining…"
      await Promise.race([Net.join(code), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 10000))]);
    }
    catch(e){
      createBtn.disabled = joinBtn.disabled = false;
      lobbyStatus.textContent = navigator.onLine === false ? `${MODE_INFO[lobbyMode()].title} needs an internet connection. Pug and Seek works offline!` : "Couldn't connect. Check your internet and try again.";
      try{ await Net.leave(); }catch(_){}
      return;
    }
    createBtn.disabled = joinBtn.disabled = false;
    Object.assign(mp, {code, isHost: asHost, hadHost: false, g: null, lastRid: null, inGame: false});
    mp.joinedAt = Date.now();
    const me = {n: myName(), dog: dogCode(), bb: myBunnyPick(), jt: mp.joinedAt, h: asHost ? 1 : 0, role: null, sp: 0, x: null, y: null, hid: null, bl: null, chk: null, ug: 0};
    if(asHost){
      mp.hostG = {md: mp.wantMode === "pfa" ? "pfa" : "tag", ph: "lobby", rid: 0, roles: {}, tg: [], hl: HEAD_START, el: 0};
      me.g = JSON.parse(JSON.stringify(mp.hostG));
      mp.g = mp.hostG;
      clearInterval(mp.hostTimer);
      mp.hostTimer = setInterval(hostTick, 100);
    } else {
      clearTimeout(mp.joinTimer);
      mp.joinTimer = setTimeout(() => {
        if(mp.code === code && !mp.hadHost){ leaveRoom(); showJoinCard(`No game found with code ${code}. Check the code and try again.`); }
      }, 12000);
    }
    Net.setMe(me);
    if(!asHost) setTimeout(() => { if(mp.code === code) onNetChange(); }, 1700);   // re-check room capacity once settled
    lobbyJoin.style.display = "none"; lobbyRoom.style.display = "";
    lobbyStatus.textContent = asHost ? "Share this code with the other players." : "Joined! Waiting for the host…";
    renderDogPickers();
    renderBunnyPicker();
    syncLobbyName();
    renderLobby();
  }
  // rename yourself while in the lobby (everyone's player list updates)
  const lobbyName = document.getElementById("lobby-name");
  function syncLobbyName(){ if(document.activeElement !== lobbyName) lobbyName.value = myName(); }
  lobbyName.addEventListener("input", () => {
    const v = lobbyName.value.replace(/\s+/g, " ").slice(0, 14);
    if(!v.trim()) return;
    nickInput.value = v.trim();
    try{ localStorage.setItem("platytag_name", nickInput.value); }catch(e){}
    if(mp.code) Net.setMe({n: myName()});
    clearTimeout(lobbyName._t); lobbyName._t = setTimeout(renderLobby, 120);
  });
  lobbyName.addEventListener("blur", () => { lobbyName.value = myName(); });
  lobbyName.addEventListener("keydown", e => { if(e.key === "Enter") lobbyName.blur(); });
  function onDogChanged(){ if(mp.code){ Net.setMe({dog: dogCode()}); setTimeout(renderLobby, 50); } }

  async function leaveRoom(){
    clearInterval(mp.hostTimer); mp.hostTimer = null;
    clearTimeout(mp.joinTimer);
    Object.assign(mp, {code: null, isHost: false, hadHost: false, g: null, hostG: null, inGame: false, myRole: null, hide: null});
    state.mp = false;
    await Net.leave();
    showJoinCard();
  }

  // Room order: host first, then by join time. Only the first MAX_PLAYERS are in the game.
  function roster(){
    return Net.peers().filter(pp => pp.p && pp.p.n)
      .sort((a, b) => (b.p.h|0) - (a.p.h|0) || (a.p.jt || 0) - (b.p.jt || 0) || (a.id < b.id ? -1 : 1));
  }
  function checkFull(){
    if(mp.isHost || !mp.hadHost || mp.inGame || Date.now() - mp.joinedAt < 1500) return false;
    const me = Net.myId();
    const idx = roster().findIndex(pp => pp.id === me);
    if(idx >= MAX_PLAYERS){
      leaveRoom().then(() => showJoinCard(`That game is full (${MAX_PLAYERS} players max).`));
      return true;
    }
    return false;
  }
  function renderLobby(){
    if(!mp.code) return;
    roomCodeEl.textContent = mp.code;
    lobbyTitle.textContent = MODE_INFO[lobbyMode()].title;
    if(mp.shownMode !== lobbyMode()){ mp.shownMode = lobbyMode(); renderBunnyPicker(); }
    const G = mp.g;
    const peers = roster().slice(0, MAX_PLAYERS);
    playerList.innerHTML = "";
    peers.forEach(pp => {
      const li = document.createElement("li");
      const a = document.createElement("span");
      const d = String(pp.p.dog || "pugFawn|-").split("|");
      const ic = document.createElement("span"); ic.className = "pl-dog"; ic.innerHTML = critterSVG("pug", {b: d[0], g: d[1] === "g"});
      a.append(ic, document.createTextNode(String(pp.p.n).slice(0, 14) + (pp.isMe ? " (you)" : "")));
      const b = document.createElement("span"); b.className = "tag"; b.textContent = pp.p.h ? "Host" : "";
      li.append(a, b); playerList.appendChild(li);
    });
    const idle = !G || G.ph === "lobby" || G.ph === "over";
    startBtn.style.display = mp.isHost ? "" : "none";
    startBtn.disabled = !(mp.isHost && idle && peers.length >= 2);
    if(mp.isHost) waitNote.textContent = peers.length < 2 ? "Waiting for players to join…" :
      `${peers.length}/${MAX_PLAYERS} players. Start when ready. ` + (lobbyMode() === "pfa" ? "The bunny is waiting in the front yard." : "The platypus is picked at random.");
    else if(G && !idle && !(G.roles || {})[Net.myId()]) waitNote.textContent = "A round is in progress — you'll join the next one.";
    else waitNote.textContent = "Waiting for the host to start…";
    const others = peers.length - 1;
    document.getElementById("net-note").textContent =
      (Net.connected() ? "🟢 Connected" : "🟡 Connecting…") + ` · ${others} other player${others === 1 ? "" : "s"} in this room` +
      ` · ${Net.allDevices()} device${Net.allDevices() === 1 ? "" : "s"} on this game link`;
  }

  startBtn.addEventListener("click", hostStartRound);
  function hostStartRound(){
    if(!mp.isHost) return;
    const ids = roster().slice(0, MAX_PLAYERS).map(pp => pp.id);
    if(ids.length < 2) return;
    if(mp.hostG && mp.hostG.md === "pfa"){
      const pb = {}; roster().forEach(pp => { pb[pp.id] = pp.p; });
      pfaHostStart(ids, pb);
      return;
    }
    const platId = ids[Math.floor(Math.random()*ids.length)];
    const roles = {}, lk = {};
    const peerById = {}; roster().forEach(pp => { peerById[pp.id] = pp.p; });
    ids.forEach(id => {
      roles[id] = id === platId ? "plat" : "pug";
      // everyone keeps the dog they picked (used if they're a dog now, or once they're tagged);
      // the starting platypus is always the classic purple one
      const d = String((peerById[id] || {}).dog || "");
      lk[id] = id === platId ? "purple|-" : (DOG_BREEDS.includes(d.split("|")[0]) ? d : dogCode(randLook("pug")));
    });
    mp.hostG = {md: "tag", ph: "head", rid: (mp.hostG ? mp.hostG.rid : 0) + 1, roles, lk, tg: [], hl: HEAD_START, el: 0,
      ld: platId, ldn: String((peerById[platId] || {}).n || "Platypus").slice(0, 14),
      tube: {x: Math.round(TUBE_HOME.x), y: Math.round(TUBE_HOME.y), h: null}};
    mp.tubeSeenTq = {}; mp.tubeSeenTd = {}; mp.tubeLast = null;
    roster().forEach(pp => { mp.tubeSeenTq[pp.id] = pp.p.tq || 0; mp.tubeSeenTd[pp.id] = pp.p.td ? pp.p.td.n : 0; });
    mp.hostT0 = Date.now();
    mp.hostDq = {}; mp.hostLq = {};
    mp.overShown = false;
    pushHost();
  }

  tagoverBtn.addEventListener("click", () => {
    if(mp.isHost && mp.hostG){ mp.hostG.ph = "lobby"; pushHost(); }
    switchScreen(lobbyScreen);
    if(mp.code){ lobbyJoin.style.display = "none"; lobbyRoom.style.display = ""; syncLobbyName(); renderLobby(); }
    else showJoinCard();
  });

  /* ---------- Host: referee for the whole room ---------- */
  function pushHost(){
    mp.hostG.gv = (mp.hostG.gv || 0) + 1;       // version: lets clients skip work when nothing changed
    mp.g = mp.hostG;
    Net.setMe({g: JSON.parse(JSON.stringify(mp.hostG))});
    onNetChange();
  }
  // the platypus has to touch the blanket itself (run behind the object it's tucked behind)
  function blanketTouchedBy(px, py, bl){
    return Math.hypot(px - bl.x, py - bl.y) < BLANKET_TAG_R;
  }
  function isTag(pl, pg){
    if(pl.ld || pg.ld) return false;                          // no tagging on the trellis ladder
    if(!!pl.ug !== !!pg.ug) return false;
    if(pg.hid === "bed" && pointInBed(pl.x, pl.y) && Math.hypot(pl.x - pg.x, pl.y - pg.y) < TAG_R + 20) return true;   // under the covers together
    if(pg.hid) return typeof pl.chk === "string" && pl.chk.split(",").includes(pg.hid);   // hiding in furniture: platypus must touch that spot
    if(pg.bl) return blanketTouchedBy(pl.x, pl.y, pg.bl);
    return Math.hypot(pl.x - pg.x, pl.y - pg.y) < TAG_R;
  }
  function hostTick(){
    const G = mp.hostG;
    if(!G || G.ph === "lobby" || G.ph === "over") return;
    let lastTag = null;
    const peers = Net.peers();
    const byId = new Map(peers.map(pp => [pp.id, pp.p]));
    let changed = false;
    for(const id of Object.keys(G.roles)){ if(!byId.has(id)){ delete G.roles[id]; changed = true; } }   // dropped players
    const elapsed = (Date.now() - mp.hostT0) / 1000;
    if(G.ph === "head"){
      const hl = Math.max(0, Math.ceil(HEAD_START - elapsed));
      if(hl !== G.hl){ G.hl = hl; changed = true; }
      if(elapsed >= HEAD_START){ G.ph = "play"; changed = true; }
    }
    if(G.tube){
      const T = G.tube;
      mp.tubeSeenTq = mp.tubeSeenTq || {}; mp.tubeSeenTd = mp.tubeSeenTd || {};
      if(T.h){
        const hp = byId.get(T.h);
        if(!hp || !hp.sp || hp.x == null){                 // wearer left the game: tube floats where they were
          const d = clampIntoPool((mp.tubeLast || T).x, (mp.tubeLast || T).y);
          T.x = Math.round(d.x); T.y = Math.round(d.y); T.h = null; changed = true;
        } else mp.tubeLast = {x: hp.x, y: hp.y};
      }
      for(const [id, p] of byId){
        if(!p) continue;
        if(p.td && p.td.n !== mp.tubeSeenTd[id]){
          mp.tubeSeenTd[id] = p.td.n;
          if(T.h === id){ const d = clampIntoPool(p.td.x, p.td.y); T.x = Math.round(d.x); T.y = Math.round(d.y); T.h = null; changed = true; }
        }
      }
      for(const [id, p] of byId){
        if(!p || !p.tq || p.tq === mp.tubeSeenTq[id]) continue;
        mp.tubeSeenTq[id] = p.tq;
        if(!T.h && p.sp && p.x != null && !p.ug && inPool(p.x, p.y) && Math.hypot(p.x - T.x, p.y - T.y) < 70){ T.h = id; changed = true; }
      }
    }
    // laundry decoy: a pug's touch makes one (if none out), a platypus's touch flattens it
    mp.hostDq = mp.hostDq || {}; mp.hostLq = mp.hostLq || {};
    for(const [id, p] of byId){
      if(!p) continue;
      const q = p.dq || 0;
      if(mp.hostDq[id] === undefined){ mp.hostDq[id] = q; continue; }
      if(q !== mp.hostDq[id]){
        mp.hostDq[id] = q;
        if(!G.dc && G.roles[id] === "pug"){ G.dcn = (G.dcn || 0) + 1; G.dc = {k: G.rid * 1000 + G.dcn}; changed = true; }
      }
      if(G.dc && p.df === G.dc.k && G.roles[id] === "plat"){ G.dc = null; changed = true; }
      const lq = p.lq || 0;                             // living room light switch
      if(mp.hostLq[id] === undefined) mp.hostLq[id] = lq;
      else if(lq !== mp.hostLq[id]){ mp.hostLq[id] = lq; if(G.roles[id]){ G.lt = G.lt ? 0 : 1; changed = true; } }
    }
    if(G.md === "pfa"){                                   // Pug for All has its own rules (12-pug-for-all.js)
      if(pfaHostRules(G, byId, elapsed)) changed = true;
      if(changed) pushHost();
      return;
    }
    if(G.ph === "play"){
      const el = Math.floor(elapsed - HEAD_START);
      if(el !== G.el){ G.el = el; changed = true; }
      const plats = Object.keys(G.roles).filter(id => G.roles[id] === "plat")
        .map(id => byId.get(id)).filter(p => p && p.sp && p.x != null);
      const platIds = Object.keys(G.roles).filter(id => G.roles[id] === "plat" && byId.get(id) && byId.get(id).sp && byId.get(id).x != null);
      for(const id of Object.keys(G.roles)){
        if(G.roles[id] !== "pug") continue;
        const pg = byId.get(id);
        if(!pg || !pg.sp || pg.x == null) continue;
        mp.hostLsk = mp.hostLsk || {};
        const shaker = pg.ld ? platIds.find(pid => { const q = byId.get(pid); return q.lsk && q.lsk.n !== mp.hostLsk[pid] && mp.hostLsk[pid] !== undefined; }) : null;
        if(shaker || plats.some(pl => isTag(pl, pg))){
          const by = shaker || platIds.find(pid => isTag(byId.get(pid), pg)) || null;
          const at = shaker ? byId.get(shaker).lsk : pg;
          lastTag = {id, x: Math.round(at.x), y: Math.round(at.y), ug: pg.ug ? 1 : 0, by, bn: by ? String((byId.get(by) || {}).n || "The platypus").slice(0, 14) : "The platypus", n: String(pg.n || "Pug").slice(0, 14)};
          G.roles[id] = "plat";
          G.tg.push({id, n: String(pg.n || "Pug").slice(0, 14), t: el});
          changed = true;
        }
      }
      platIds.forEach(pid => { const q = byId.get(pid); mp.hostLsk = mp.hostLsk || {}; mp.hostLsk[pid] = q.lsk ? q.lsk.n : 0; });
    }
    let pugIds = Object.keys(G.roles).filter(id => G.roles[id] === "pug");
    // time's up: every pug still free wins; one of them (random) gets the end-of-game scene
    if(G.ph === "play" && pugIds.length > 0 && G.el >= TAG_TIME && Object.keys(G.roles).length >= 2){
      G.el = TAG_TIME;
      const live = pugIds.filter(id => { const q = byId.get(id); return q && q.sp && q.x != null; });
      const pool = live.length ? live : pugIds;
      const wid = pool[Math.floor(Math.random() * pool.length)], wq = byId.get(wid) || {};
      G.sv = pugIds.map(id => String((byId.get(id) || {}).n || "Pug").slice(0, 14));
      if(wq.x != null) G.win = {id: wid, x: Math.round(wq.x), y: Math.round(wq.y), ug: wq.ug ? 1 : 0, n: String(wq.n || "Pug").slice(0, 14)};
      else G.win = {id: wid, none: 1, n: String(wq.n || "Pug").slice(0, 14)};
      G.ph = "over"; pushHost(); return;
    }
    const platCount = Object.keys(G.roles).length - pugIds.length;
    if(pugIds.length === 0 && lastTag && G.ph === "play") G.fin = lastTag;   // for everyone's end-of-game scene
    if(pugIds.length === 0 || Object.keys(G.roles).length < 2 && G.ph === "play"){
      if(G.ph !== "over"){ G.ph = "over"; changed = true; }
    } else if(platCount === 0){
      const nid = pugIds[Math.floor(Math.random()*pugIds.length)];
      G.roles[nid] = "plat";   // the platypus left: promote a pug
      G.ld = nid; G.ldn = String((byId.get(nid) || {}).n || "Platypus").slice(0, 14);
      changed = true;
    }
    if(G.ld && !G.roles[G.ld]){                                        // the lead platypus left: next platypus takes over
      const nid = Object.keys(G.roles).find(id => G.roles[id] === "plat");
      if(nid){ G.ld = nid; G.ldn = String((byId.get(nid) || {}).n || "Platypus").slice(0, 14); changed = true; }
    }
    if(changed) pushHost();
  }

  /* ---------- Everyone: follow the host's game state ---------- */
  Net.onChange(onNetChange);
  function onNetChange(err, id){
    if(!mp.code) return;
    if(err){ if(!mp.inGame) showJoinCard("Lost connection to the room."); return; }
    if(mp.isHost){ mp.g = mp.hostG; }
    else {
      const hosts = Net.peers().filter(pp => !pp.isMe && pp.p && pp.p.h && pp.p.g).sort((a, b) => a.id < b.id ? -1 : 1);
      if(hosts.length){ mp.hadHost = true; mp.g = hosts[0].p.g; }
      else if(mp.hadHost){ hostGone(); return; }
    }
    // mid-game, a player just moved: the frame loop draws them; only re-sync when the host's state changed
    if(mp.inGame && id && mp.g && mp.g.gv != null && mp.g.gv === mp.lastGv) return;
    if(mp.g) mp.lastGv = mp.g.gv;
    if(checkFull()) return;
    mpSync();
    if(!lobbyScreen.classList.contains("hidden")) renderLobby();
  }

  async function hostGone(){
    const wasInGame = mp.inGame;
    await leaveRoom();
    if(wasInGame || !lobbyScreen.classList.contains("hidden") || !tagoverScreen.classList.contains("hidden")){
      switchScreen(lobbyScreen);
      showJoinCard("The host left the game. Create or join another one.");
    }
  }

  function mpSync(){
    const G = mp.g;
    if(!G) return;
    const role = (G.roles || {})[Net.myId()];
    if(G.ph === "lobby"){
      if(mp.inGame){ mp.inGame = false; state.mp = false; state.phase = "title"; switchScreen(lobbyScreen); lobbyJoin.style.display = "none"; lobbyRoom.style.display = ""; }
      return;
    }
    if((G.ph === "head" || G.ph === "play") && role && G.rid !== mp.lastRid){
      mp.lastRid = G.rid;
      startTagRound(role);
    }
    if(!mp.inGame) return;
    if(role && role !== mp.myRole) becomeRole(role);
    if(state.phase === "waiting"){
      const c = document.getElementById("mp-count");
      if(c) c.textContent = G.hl;
      if(G.ph !== "head") spawnMe();
    }
    if(G.ld && G.ld !== mp.ldSeen && (G.ph === "head" || G.ph === "play")){
      const first = !mp.ldSeen;
      mp.ldSeen = G.ld;
      if(G.ld === Net.myId()){ if(!first) showToast("👑 You're the lead platypus now!", 2400); }
      else showToast(first ? `👑 ${G.ldn} is the platypus!` : `👑 ${G.ldn} is the lead platypus now`, 2600);
    }
    const tg = G.tg || [];
    if(tg.length > mp.tgSeen){
      const last = tg[tg.length - 1];
      if(last.id !== Net.myId()) showToast(`${last.n} was tagged!`, 1800);
      mp.tgSeen = tg.length;
    }
    updateHud();
    if(G.ph === "over") showTagOver();
  }

