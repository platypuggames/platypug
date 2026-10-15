  /* =====================================================================
     PLATYTRIVIA: trivia on a yard + physical challenges + treats. TEST SITE ONLY for now: the title-screen
     button stays hidden unless ROOM_PREFIX is set (the test build sets "test_"; live is "").

     Built to be lifted out later as its own app. It owns its screens (#tv-*), CSS (06-platytrivia.css) and
     questions (13-trivia-bank.js). It shares only: Net (room transport), critterSVG/pugSVG/dogCode/myDog (a
     player's look), switchScreen/titleScreen/randCode. It never reads or writes Platytag's `mp` or `state`.

     Rules (all tunable in the constants below):
       - 10 questions, 15 s each. Everyone walks onto one of 5 answer pads and is locked in when time runs out.
         While answering you can't see anyone else. Then everyone is revealed on their pads and frozen.
       - Right answer = treats (TV_POINTS, rising with the question). Wrong or no answer = you throw up 1 treat.
         Eat it (before the next question) and you get it back, but the next question is double or nothing:
         right = double treats, wrong = you lose one extra treat on top of the usual one.
       - A physical challenge after question 3, 6 and 10 (TV_CHALLENGE_AFTER): the winner gets a treat, last
         place throws one up. One round per game. Highest treats at the end wins.
     Host-authoritative like the other modes: the host's record carries G (the game state); everyone else only
     writes their own answers/scores. G.ph = lobby | q | reveal | ch | chres | over.
     ===================================================================== */
  const TV_ENABLED = ROOM_PREFIX !== "";           // test site only for now
  const TV_ROOM = "TV";                            // prefix on the room code so trivia rooms never collide with other modes' rooms
  const TV_MAX_PLAYERS = 10;
  const TV_QUESTIONS = 10;                         // questions per game (one round)
  const TV_Q_SECONDS = 15;                         // time to answer
  const TV_LEAD_MS = 1800;                         // "get ready" pause before a question / challenge starts (covers network delay)
  const TV_ANSWER_GRACE_MS = 3000;                 // host waits this long past the deadline for a missing answer
  const TV_REVEAL_MS = 7000;                       // everyone frozen on their pads; also the window to eat the vomit
  const TV_CH_RESULT_MS = 5500;                    // challenge results screen
  const TV_POINTS = [1, 1, 1, 2, 2, 2, 3, 3, 3, 5];   // treats for a right answer, by question number (rises as the game goes on)
  const TV_CHALLENGE_AFTER = [3, 6, 10];           // a challenge follows after this many answered questions
  const TV_CH_WIN_TREATS = 1;                      // treats the challenge winner(s) get
  const TV_TIERS = ["Kid", "Tween", "Teen", "Adult"];
  const TV_SPEED = 300;                            // px/s a pug walks
  // answer pads as fractions of the arena (x, y, w, h). The start zone (y .74-.97) is where everyone spawns.
  const TV_PADS = [
    {x: .04, y: .03, w: .45, h: .19}, {x: .51, y: .03, w: .45, h: .19},
    {x: .04, y: .26, w: .45, h: .19}, {x: .51, y: .26, w: .45, h: .19},
    {x: .275, y: .49, w: .45, h: .19}
  ];
  const TV_BOUNDS = {x0: .04, x1: .96, y0: .05, y1: .97};
  // physical challenges. Each id must have a builder/handler in tvChBuild/tvChTick. More are added here over time.
  const TV_CHALLENGES = {
    tippy: {name: "Tippy Taps", dur: 20, blurb: "Tap the paw as many times as you can before time runs out!"}
  };
  const TV_BANK_BY_ID = new Map(TRIVIA_BANK.map(q => [q.id, q]));

  const tvEl = id => document.getElementById(id);
  const tvScr = {lobby: tvEl("tv-lobby-screen"), game: tvEl("tv-game-screen"), over: tvEl("tv-over-screen")};
  const tv = {
    code: null, isHost: false, hadHost: false, g: null, hostG: null, timer: null, joinTimer: null, joinedAt: 0,
    inGame: false, viewKey: "", W: 0, H: 0, me: {x: .5, y: .85, tx: .5, ty: .85, f: 1}, keys: {}, down: false,
    canMove: false, locked: false, ate: false, chScore: 0, chSent: false, chCanTap: false, raf: 0, lastT: 0,
    meEl: null, revEls: [], placed: ""
  };
  /* tv-hook */

  /* ---------- small helpers ---------- */
  function tvEsc(s){ return String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c])); }
  function tvMyName(){ return (tvEl("tv-nick").value || "").trim().slice(0, 14) || "Player"; }
  function tvPeerP(id){ const x = Net.peers().find(pp => pp.id === id); return x ? x.p : null; }
  function tvNameOf(G, id){ const p = tvPeerP(id); return (p && p.n) ? String(p.n).slice(0, 14) : ((G.nm || {})[id] || "Player"); }
  function tvDogOf(G, id){ const p = tvPeerP(id); return (p && p.dog) || (G.dg || {})[id] || "pugFawn|-"; }
  function tvPresent(G){ const ids = new Set(Net.peers().map(pp => pp.id)); return (G.pl || []).filter(id => ids.has(id)); }
  function tvRoster(){
    return Net.peers().filter(pp => pp.p && pp.p.n)
      .sort((a, b) => (b.p.h|0) - (a.p.h|0) || (a.p.jt || 0) - (b.p.jt || 0) || (a.id < b.id ? -1 : 1));
  }
  function tvLook(code){ const d = String(code || "pugFawn|-").split("|"); return {b: DOG_BREEDS.includes(d[0]) ? d[0] : "pugFawn", g: d[1] === "g"}; }
  function tvShuffle(a){ a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const tvClamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TV_TREAT_SVG = `<svg viewBox="0 0 44 24" xmlns="http://www.w3.org/2000/svg"><g stroke="#241811" stroke-width="2.4" fill="#F3C77A"><rect x="9" y="7" width="26" height="10" rx="3"/><circle cx="8" cy="7" r="4.5"/><circle cx="8" cy="17" r="4.5"/><circle cx="36" cy="7" r="4.5"/><circle cx="36" cy="17" r="4.5"/></g><rect x="10" y="8.2" width="24" height="7.6" rx="2" fill="#F3C77A"/></svg>`;
  const TV_PUDDLE_SVG = `<svg viewBox="0 0 60 26" xmlns="http://www.w3.org/2000/svg"><path d="M6 16C4 8 18 4 28 7 36 2 52 6 54 14 58 20 44 24 30 23 16 25 8 22 6 16Z" fill="#A9D46B" stroke="#241811" stroke-width="2.4" stroke-linejoin="round"/><circle cx="22" cy="14" r="2" fill="#7FA83F"/><circle cx="38" cy="16" r="2.4" fill="#7FA83F"/></svg>`;
  const TV_PAW_SVG = `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><g fill="#241811"><ellipse cx="30" cy="38" rx="15" ry="12"/><ellipse cx="12" cy="24" rx="5.5" ry="7.5"/><ellipse cx="24" cy="14" rx="5.5" ry="8"/><ellipse cx="36" cy="14" rx="5.5" ry="8"/><ellipse cx="48" cy="24" rx="5.5" ry="7.5"/></g></svg>`;
  const tvTreatIcon = () => `<span class="tv-treat-inline">${TV_TREAT_SVG}</span>`;

  /* ---------- Arena (built once) ---------- */
  const tvArena = tvEl("tv-arena");
  (function tvBuildArena(){
    TV_PADS.forEach((p, i) => {
      const d = document.createElement("div");
      d.className = "tv-pad p" + i;
      d.style.cssText = `left:${p.x * 100}%;top:${p.y * 100}%;width:${p.w * 100}%;height:${p.h * 100}%;`;
      d.innerHTML = `<b>${"ABCDE"[i]}</b><span></span>`;
      tvArena.appendChild(d);
    });
    const me = document.createElement("div");
    me.className = "tv-sprite"; me.style.visibility = "hidden";
    me.innerHTML = `<div class="tv-flip"><div class="tv-sp"></div></div><div class="tv-name"></div>`;
    tvArena.appendChild(me);
    tv.meEl = me;
    tvEl("tv-treat-ico").innerHTML = TV_TREAT_SVG;
    const quit = document.createElement("button");
    quit.className = "tv-quit"; quit.textContent = "Quit";
    quit.addEventListener("click", () => { if(window.confirm("Leave this game?")) tvLeave().then(() => switchScreen(titleScreen)); });
    tvEl("tv-qn").parentNode.appendChild(quit);
  })();
  function tvMeasure(){ const r = tvArena.getBoundingClientRect(); tv.W = r.width; tv.H = r.height; }
  window.addEventListener("resize", () => { if(tv.inGame) tvMeasure(); });
  function tvPadAt(x, y){ return TV_PADS.findIndex(p => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h); }
  function tvPlaceMe(){
    const m = tv.me, key = m.x.toFixed(4) + "," + m.y.toFixed(4) + "," + m.f;
    if(key === tv.placed) return;
    tv.placed = key;
    tv.meEl.style.left = (m.x * 100) + "%"; tv.meEl.style.top = (m.y * 100) + "%";
    tv.meEl.firstChild.style.transform = m.f < 0 ? "scaleX(-1)" : "";
  }
  function tvClearRev(){ tv.revEls.forEach(e => e.remove()); tv.revEls = []; }
  function tvMakeSprite(code, name, cls){
    const el = document.createElement("div");
    el.className = "tv-sprite " + (cls || "");
    el.innerHTML = `<div class="tv-flip"><div class="tv-sp">${pugSVG(tvLook(code))}</div></div><div class="tv-name">${tvEsc(name)}</div>`;
    return el;
  }
  function tvBanner(text){ const b = tvEl("tv-banner"); if(text){ b.textContent = text; b.classList.add("show"); } else b.classList.remove("show"); }

  /* ---------- Movement + input ---------- */
  function tvPointer(e){
    if(!tv.canMove) return;
    const r = tvArena.getBoundingClientRect();
    tv.me.tx = tvClamp((e.clientX - r.left) / r.width, TV_BOUNDS.x0, TV_BOUNDS.x1);
    tv.me.ty = tvClamp((e.clientY - r.top) / r.height, TV_BOUNDS.y0, TV_BOUNDS.y1);
  }
  tvArena.addEventListener("pointerdown", e => { tv.down = true; try{ tvArena.setPointerCapture(e.pointerId); }catch(_){} tvPointer(e); });
  tvArena.addEventListener("pointermove", e => { if(tv.down) tvPointer(e); });
  ["pointerup", "pointercancel"].forEach(t => tvArena.addEventListener(t, () => { tv.down = false; }));
  const TV_KEYS = {ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r", ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d"};
  document.addEventListener("keydown", e => { const k = TV_KEYS[e.code]; if(k && tv.inGame){ tv.keys[k] = true; e.preventDefault(); } });
  document.addEventListener("keyup", e => { const k = TV_KEYS[e.code]; if(k) tv.keys[k] = false; });
  function tvFrame(t){
    tv.raf = requestAnimationFrame(tvFrame);
    const dt = Math.min(.05, (t - (tv.lastT || t)) / 1000); tv.lastT = t;
    if(!tv.canMove || !tv.W || !tv.H) return;
    const m = tv.me, k = tv.keys;
    if(k.l || k.r || k.u || k.d){
      m.tx = tvClamp(m.x + ((k.r ? 1 : 0) - (k.l ? 1 : 0)) * .4, TV_BOUNDS.x0, TV_BOUNDS.x1);
      m.ty = tvClamp(m.y + ((k.d ? 1 : 0) - (k.u ? 1 : 0)) * .4, TV_BOUNDS.y0, TV_BOUNDS.y1);
    }
    const ex = (m.tx - m.x) * tv.W, ey = (m.ty - m.y) * tv.H, d = Math.hypot(ex, ey);
    if(d > .5){
      const s = Math.min(d, TV_SPEED * dt);
      m.x += ex / d * s / tv.W; m.y += ey / d * s / tv.H;
      if(Math.abs(ex) > 2) m.f = ex < 0 ? -1 : 1;
      tvPlaceMe();
    }
  }

  /* ---------- Lobby ---------- */
  function tvShowJoin(note){
    tvEl("tv-join").style.display = ""; tvEl("tv-room").style.display = "none";
    tvEl("tv-status").textContent = note || "Answer trivia on the yard, win treats, survive the challenges.";
  }
  async function tvOpenLobby(){
    switchScreen(tvScr.lobby);
    if(tv.code){ tvRenderLobby(); return; }
    try{ tvEl("tv-nick").value = localStorage.getItem("platytag_name") || tvEl("tv-nick").value; }catch(e){}
    tvShowJoin("Connecting…");
    tvEl("tv-create").disabled = tvEl("tv-joinbtn").disabled = true;
    const ok = navigator.onLine !== false && await Net.available();
    tvEl("tv-create").disabled = tvEl("tv-joinbtn").disabled = !ok;
    tvEl("tv-nick").disabled = tvEl("tv-code").disabled = !ok;
    tvEl("tv-status").textContent = ok ? "Answer trivia on the yard, win treats, survive the challenges." : "Platytrivia needs an internet connection.";
  }
  async function tvEnterRoom(code, asHost){
    try{ localStorage.setItem("platytag_name", tvMyName()); }catch(e){}
    tvEl("tv-create").disabled = tvEl("tv-joinbtn").disabled = true;
    tvEl("tv-status").textContent = "Joining…";
    try{
      await Promise.race([Net.join(TV_ROOM + code), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 10000))]);
    }catch(e){
      tvEl("tv-create").disabled = tvEl("tv-joinbtn").disabled = false;
      tvEl("tv-status").textContent = navigator.onLine === false ? "Platytrivia needs an internet connection." : "Couldn't connect. Check your internet and try again.";
      try{ await Net.leave(); }catch(_){}
      return;
    }
    tvEl("tv-create").disabled = tvEl("tv-joinbtn").disabled = false;
    Object.assign(tv, {code, isHost: asHost, hadHost: false, g: null, inGame: false, viewKey: "", joinedAt: Date.now()});
    const me = {n: tvMyName(), dog: dogCode(), jt: tv.joinedAt, h: asHost ? 1 : 0};
    if(asHost){
      tv.hostG = {md: "trivia", ph: "lobby", gv: 0, tier: "Kid", pl: []};
      tv.g = tv.hostG;
      me.g = JSON.parse(JSON.stringify(tv.hostG));
    }else{
      clearTimeout(tv.joinTimer);
      tv.joinTimer = setTimeout(() => {
        if(tv.code === code && !tv.hadHost) tvLeave().then(() => tvShowJoin(`No game found with code ${code}. Check the code and try again.`));
      }, 12000);
    }
    clearInterval(tv.timer); tv.timer = setInterval(tvTick, 100);
    Net.setMe(me);
    tvEl("tv-join").style.display = "none"; tvEl("tv-room").style.display = "";
    tvEl("tv-status").textContent = asHost ? "Share this code with the other players." : "Joined! Waiting for the host…";
    tvEl("tv-name").value = tvMyName();
    renderDogPickers();
    tvRenderLobby();
  }
  async function tvLeave(){
    clearInterval(tv.timer); tv.timer = null; clearTimeout(tv.joinTimer);
    cancelAnimationFrame(tv.raf); tv.raf = 0;
    Object.assign(tv, {code: null, isHost: false, hadHost: false, g: null, hostG: null, inGame: false, viewKey: "", canMove: false});
    tvClearRev(); tv.meEl.style.visibility = "hidden";
    try{ await Net.leave(); }catch(e){}
    tvShowJoin();
  }
  function tvRenderLobby(){
    if(!tv.code) return;
    const G = tv.g || {ph: "lobby", tier: "Kid"};
    tvEl("tv-room-code").textContent = tv.code;
    const peers = tvRoster().slice(0, TV_MAX_PLAYERS);
    const list = tvEl("tv-players"); list.innerHTML = "";
    peers.forEach(pp => {
      const li = document.createElement("li");
      const a = document.createElement("span");
      const ic = document.createElement("span"); ic.className = "pl-dog"; ic.innerHTML = pugSVG(tvLook(pp.p.dog));
      a.append(ic, document.createTextNode(String(pp.p.n).slice(0, 14) + (pp.isMe ? " (you)" : "")));
      const b = document.createElement("span"); b.className = "tag"; b.textContent = pp.p.h ? "Host" : "";
      li.append(a, b); list.appendChild(li);
    });
    const tiers = tvEl("tv-tiers");
    if(tiers.children.length !== TV_TIERS.length){
      tiers.innerHTML = TV_TIERS.map(t => `<button type="button" class="tv-tier" data-tier="${t}">${t}</button>`).join("");
    }
    tiers.querySelectorAll(".tv-tier").forEach(b => { b.classList.toggle("sel", b.dataset.tier === G.tier); b.disabled = !tv.isHost; });
    const idle = G.ph === "lobby" || G.ph === "over";
    const start = tvEl("tv-start");
    start.style.display = tv.isHost ? "" : "none";
    start.disabled = !(tv.isHost && idle && peers.length >= 2);
    const wait = tvEl("tv-wait");
    if(tv.isHost) wait.textContent = peers.length < 2 ? "Waiting for players to join…" : `${peers.length}/${TV_MAX_PLAYERS} players. Pick a level and start when ready.`;
    else if(!idle && !(G.pl || []).includes(Net.myId())) wait.textContent = "A game is in progress. You'll join the next one.";
    else wait.textContent = "Waiting for the host to start…";
  }
  tvEl("tv-tiers").addEventListener("click", e => {
    const b = e.target.closest(".tv-tier");
    if(!b || !tv.isHost || !tv.hostG || tv.hostG.ph === "q") return;
    tv.hostG.tier = b.dataset.tier; tvPushHost();
  });
  tvEl("tv-name").addEventListener("input", () => {
    const v = tvEl("tv-name").value.replace(/\s+/g, " ").slice(0, 14);
    if(!v.trim()) return;
    tvEl("tv-nick").value = v.trim();
    try{ localStorage.setItem("platytag_name", v.trim()); }catch(e){}
    if(tv.code) Net.setMe({n: tvMyName()});
    clearTimeout(tvEl("tv-name")._t); tvEl("tv-name")._t = setTimeout(tvRenderLobby, 120);
  });
  tvEl("tv-name").addEventListener("blur", () => { tvEl("tv-name").value = tvMyName(); });
  tvEl("tv-name").addEventListener("keydown", e => { if(e.key === "Enter") tvEl("tv-name").blur(); });
  document.addEventListener("click", e => {   // runs after the shared dog-picker handler has updated myDog
    if(!e.target.closest("#tv-lobby-screen .dog-picker button") || !tv.code) return;
    Net.setMe({dog: dogCode()}); setTimeout(tvRenderLobby, 50);
  });
  tvEl("tv-create").addEventListener("click", () => tvEnterRoom(randCode(), true));
  tvEl("tv-joinbtn").addEventListener("click", () => {
    const code = tvEl("tv-code").value.trim().toUpperCase();
    if(code.length !== 4){ tvEl("tv-status").textContent = "Enter the 4-letter room code."; return; }
    tvEnterRoom(code, false);
  });
  tvEl("tv-code").addEventListener("keydown", e => { if(e.key === "Enter") tvEl("tv-joinbtn").click(); });
  tvEl("tv-back").addEventListener("click", async () => { await tvLeave(); switchScreen(titleScreen); });
  tvEl("tv-start").addEventListener("click", tvHostStart);
  tvEl("trivia-btn").addEventListener("click", tvOpenLobby);
  if(TV_ENABLED) tvEl("trivia-card").style.display = "";

  /* ---------- Networking ---------- */
  Net.onChange(tvOnNet);
  function tvOnNet(err, id){
    if(!tv.code) return;
    if(err){ if(!tv.inGame) tvShowJoin("Lost connection to the room."); return; }
    if(tv.isHost) tv.g = tv.hostG;
    else{
      const hosts = Net.peers().filter(pp => !pp.isMe && pp.p && pp.p.h && pp.p.g).sort((a, b) => a.id < b.id ? -1 : 1);
      if(hosts.length){ tv.hadHost = true; tv.g = hosts[0].p.g; }
      else if(tv.hadHost){ tvHostGone(); return; }
    }
    tvSync();
    if(!tvScr.lobby.classList.contains("hidden")) tvRenderLobby();
  }
  async function tvHostGone(){
    const wasPlaying = tv.inGame || !tvScr.lobby.classList.contains("hidden") || !tvScr.over.classList.contains("hidden");
    await tvLeave();
    if(wasPlaying){ switchScreen(tvScr.lobby); tvShowJoin("The host left the game. Create or join another one."); }
  }
  function tvPushHost(){
    const G = tv.hostG;
    G.gv = (G.gv || 0) + 1;
    tv.g = G;
    Net.setMe({g: JSON.parse(JSON.stringify(G)), gt: Math.round(Net.serverNow())});
    tvSync();
    if(!tvScr.lobby.classList.contains("hidden")) tvRenderLobby();
  }

  /* ---------- Host: referee ---------- */
  function tvHostStart(){
    if(!tv.isHost || !tv.hostG) return;
    const peers = tvRoster().slice(0, TV_MAX_PLAYERS);
    if(peers.length < 2) return;
    const G = tv.hostG;
    const pool = TRIVIA_BANK.filter(q => q.tier === G.tier);
    const ql = tvShuffle(pool).slice(0, TV_QUESTIONS).map(q => ({id: q.id, p: tvShuffle([0, 1, 2, 3, 4])}));   // p[i] = which original option shows on pad i
    const keys = tvShuffle(Object.keys(TV_CHALLENGES));
    G.chl = TV_CHALLENGE_AFTER.map((_, i) => keys[i % keys.length]);
    G.pl = peers.map(pp => pp.id);
    G.nm = {}; G.dg = {}; G.tr = {}; G.don = {};
    peers.forEach(pp => { G.nm[pp.id] = String(pp.p.n).slice(0, 14); G.dg[pp.id] = pp.p.dog || "pugFawn|-"; G.tr[pp.id] = 0; });
    G.ql = ql; G.res = null; G.cres = null;
    tvHostBeginQ(0);
  }
  function tvHostBeginQ(n){
    const G = tv.hostG;
    G.ph = "q"; G.qn = n; G.qs = Math.round(Net.serverNow()) + TV_LEAD_MS; G.res = null;
    tvPushHost();
  }
  function tvHostBeginCh(ci){
    const G = tv.hostG;
    G.ph = "ch"; G.ci = ci; G.cid = G.chl[ci]; G.cdur = TV_CHALLENGES[G.cid].dur; G.cs = Math.round(Net.serverNow()) + TV_LEAD_MS; G.cres = null;
    tvPushHost();
  }
  function tvHostTick(){
    const G = tv.hostG;
    if(!G || G.ph === "lobby" || G.ph === "over") return;
    const now = Net.serverNow(), ids = tvPresent(G);
    if(G.ph === "q"){
      const end = G.qs + TV_Q_SECONDS * 1000;
      const allIn = ids.every(id => { const p = tvPeerP(id) || {}; return p.qa === G.qn && p.a !== undefined; });
      if(now >= end && (allIn || now >= end + TV_ANSWER_GRACE_MS)) tvHostResolveQ();
    }else if(G.ph === "reveal"){
      if(now >= G.rs + TV_REVEAL_MS) tvHostAfterReveal();
    }else if(G.ph === "ch"){
      const end = G.cs + G.cdur * 1000;
      const allIn = ids.every(id => (tvPeerP(id) || {}).cq === G.ci);
      if(now >= end && (allIn || now >= end + TV_ANSWER_GRACE_MS)) tvHostResolveCh();
    }else if(G.ph === "chres"){
      if(now >= G.rs + TV_CH_RESULT_MS) tvHostAfterCh();
    }
  }
  function tvHostResolveQ(){
    const G = tv.hostG, ent = G.ql[G.qn], q = TV_BANK_BY_ID.get(ent.id);
    const correctPad = ent.p.indexOf(q.a), base = TV_POINTS[G.qn] || 1;
    const res = {};
    G.pl.forEach(id => {
      const p = tvPeerP(id) || {};
      const a = (p.qa === G.qn && Number.isInteger(p.a)) ? p.a : -1;
      const dbl = !!G.don[id], ok = a === correctPad;
      const r = {a, ok, pts: 0, vm: 0, ex: 0, d: dbl};
      if(ok){ r.pts = base * (dbl ? 2 : 1); G.tr[id] += r.pts; }
      else{
        if(G.tr[id] > 0){ r.vm = 1; G.tr[id] -= 1; }                       // threw up one treat
        if(dbl && G.tr[id] > 0){ r.ex = 1; G.tr[id] -= 1; }                // double or nothing: lose one more
      }
      res[id] = r;
    });
    G.don = {};
    G.res = res; G.ph = "reveal"; G.rs = Math.round(Net.serverNow());
    tvPushHost();
  }
  function tvHostAfterReveal(){
    const G = tv.hostG, last = G.qn + 1 >= TV_QUESTIONS;
    Object.keys(G.res || {}).forEach(id => {                 // players who chose to eat their vomit get the treat back and play double or nothing
      if(last || !(G.res[id].vm > 0)) return;
      const p = tvPeerP(id);
      if(p && p.ea === G.qn){ G.tr[id] += 1; G.don[id] = true; }
    });
    const ci = TV_CHALLENGE_AFTER.indexOf(G.qn + 1);
    if(ci >= 0) tvHostBeginCh(ci); else tvHostBeginQ(G.qn + 1);
  }
  function tvHostResolveCh(){
    const G = tv.hostG, ids = tvPresent(G), sc = {};
    ids.forEach(id => { const p = tvPeerP(id) || {}; sc[id] = p.cq === G.ci ? (p.cv | 0) : 0; });
    const vals = ids.map(id => sc[id]), max = Math.max(...vals), min = Math.min(...vals);
    const cres = {};
    G.pl.forEach(id => {
      const v = sc[id] === undefined ? 0 : sc[id], r = {v, w: 0, l: 0, vm: 0};
      if(ids.includes(id) && max !== min){
        if(v === max){ r.w = 1; G.tr[id] += TV_CH_WIN_TREATS; }
        else if(v === min){ r.l = 1; if(G.tr[id] > 0){ r.vm = 1; G.tr[id] -= 1; } }
      }
      cres[id] = r;
    });
    G.cres = cres; G.ph = "chres"; G.rs = Math.round(Net.serverNow());
    tvPushHost();
  }
  function tvHostAfterCh(){
    const G = tv.hostG;
    if(G.qn + 1 >= TV_QUESTIONS){ G.ph = "over"; tvPushHost(); }
    else tvHostBeginQ(G.qn + 1);
  }
  tvEl("tv-over-btn").addEventListener("click", () => {
    if(tv.isHost && tv.hostG){ tv.hostG.ph = "lobby"; tvPushHost(); return; }
    switchScreen(tvScr.lobby); tvRenderLobby();
  });

  /* ---------- Client: follow the host's phase ---------- */
  function tvSync(){
    const G = tv.g;
    if(!G) return;
    const me = Net.myId(), inGame = (G.pl || []).includes(me);
    if(G.ph === "lobby"){
      if(tv.inGame || tv.viewKey){
        tv.inGame = false; tv.viewKey = ""; tv.canMove = false; tvClearRev(); tv.meEl.style.visibility = "hidden";
        switchScreen(tvScr.lobby); tvEl("tv-join").style.display = "none"; tvEl("tv-room").style.display = "";
      }
      return;
    }
    if(!inGame) return;
    const key = G.ph + ":" + (G.ph === "ch" || G.ph === "chres" ? "c" + G.ci : "q" + G.qn);
    if(key === tv.viewKey) return;
    tv.viewKey = key;
    if(G.ph === "over"){ tv.inGame = false; tv.canMove = false; tvEnterOver(G); return; }
    if(!tv.inGame){ tv.inGame = true; switchScreen(tvScr.game); if(!tv.raf) tv.raf = requestAnimationFrame(tvFrame); }
    tvMeasure();
    if(G.ph === "q") tvEnterQ(G);
    else if(G.ph === "reveal") tvEnterReveal(G);
    else if(G.ph === "ch") tvEnterCh(G);
    else if(G.ph === "chres") tvEnterChRes(G);
  }
  function tvTick(){
    if(!tv.code) return;
    const G = tv.g;
    if(G && tv.inGame) tvClientTick(G);
    if(tv.isHost) tvHostTick();
  }
  function tvClientTick(G){
    const now = Net.serverNow(), me = Net.myId(), timer = tvEl("tv-timer");
    tvEl("tv-treat-n").textContent = String((G.tr || {})[me] || 0);
    if(G.ph === "q"){
      const start = G.qs, end = start + TV_Q_SECONDS * 1000;
      if(now < start){ tv.canMove = false; timer.textContent = String(TV_Q_SECONDS); timer.classList.remove("low"); tvBanner("Get ready!"); }
      else if(now < end){
        tv.canMove = !tv.locked; tvBanner("");
        const left = Math.ceil((end - now) / 1000);
        timer.textContent = String(left); timer.classList.toggle("low", left <= 5);
      }else if(!tv.locked){
        tv.locked = true; tv.canMove = false; tv.down = false;
        const m = tv.me;
        Net.setMe({qa: G.qn, a: tvPadAt(m.x, m.y), x: Math.round(m.x * 1000), y: Math.round(m.y * 1000)});
        timer.textContent = "0"; tvBanner("Time's up!");
      }
    }else if(G.ph === "ch") tvChTick(G, now);
  }

  /* ---------- Views ---------- */
  function tvHud(G, label){
    tvEl("tv-qn").textContent = label;
    tvEl("tv-treat-n").textContent = String((G.tr || {})[Net.myId()] || 0);
  }
  function tvEnterQ(G){
    const ent = G.ql[G.qn], q = TV_BANK_BY_ID.get(ent.id), me = Net.myId();
    tvClearRev(); tvBanner("");
    tvEl("tv-sheet").style.display = "none"; tvEl("tv-challenge").style.display = "none";
    tv.locked = false; tv.canMove = false; tv.ate = false;
    tvEl("tv-qcard").style.display = "";
    tvEl("tv-cat").textContent = q.cat; tvEl("tv-qtext").textContent = q.q;
    tvEl("tv-don").style.display = (G.don || {})[me] ? "" : "none";
    tvArena.querySelectorAll(".tv-pad").forEach((pad, i) => {
      pad.querySelector("span").textContent = q.o[ent.p[i]];
      pad.classList.remove("glow", "dim");
    });
    const idx = Math.max(0, (G.pl || []).indexOf(me));                 // spread everyone across the start zone
    tv.me.x = tv.me.tx = .12 + ((idx * .618) % 1) * .76;
    tv.me.y = tv.me.ty = .82 + (idx % 3) * .045;
    tv.me.f = 1; tv.placed = "";
    const meEl = tv.meEl;
    meEl.firstChild.firstChild.innerHTML = pugSVG(tvLook(dogCode()));
    meEl.querySelector(".tv-name").textContent = tvMyName();
    meEl.style.visibility = "";
    tvPlaceMe();
    tvHud(G, `Q ${G.qn + 1}/${TV_QUESTIONS}`);
    tvEl("tv-timer").textContent = String(TV_Q_SECONDS); tvEl("tv-timer").classList.remove("low");
  }
  function tvStandings(G){
    return (G.pl || []).slice().sort((a, b) => ((G.tr || {})[b] || 0) - ((G.tr || {})[a] || 0));
  }
  function tvEnterReveal(G){
    const ent = G.ql[G.qn], q = TV_BANK_BY_ID.get(ent.id), me = Net.myId(), res = G.res || {};
    const correctPad = ent.p.indexOf(q.a);
    tv.canMove = false; tvBanner("");
    tvEl("tv-timer").textContent = "0"; tvEl("tv-timer").classList.remove("low");
    tv.meEl.style.visibility = "hidden"; tvClearRev();
    tvArena.querySelectorAll(".tv-pad").forEach((pad, i) => { pad.classList.toggle("glow", i === correctPad); pad.classList.toggle("dim", i !== correctPad); });
    const byPad = {};
    (G.pl || []).forEach(id => { const r = res[id]; if(r && r.a >= 0) (byPad[r.a] = byPad[r.a] || []).push(id); });
    Object.keys(byPad).forEach(k => {
      const pad = TV_PADS[k], ids = byPad[k], n = ids.length, cols = Math.min(n, 4), rows = Math.ceil(n / cols), small = n > 2;
      ids.forEach((id, j) => {
        const c = j % cols, r = Math.floor(j / cols), rr = res[id];
        const el = tvMakeSprite(tvDogOf(G, id), tvNameOf(G, id), small ? "sm" : "");
        const x = pad.x + pad.w * (c + .5) / cols, y = pad.y + pad.h * (rows === 1 ? .95 : (r === 0 ? .72 : .98));
        el.style.left = (x * 100) + "%"; el.style.top = (y * 100) + "%";
        if(rr.ok) el.insertAdjacentHTML("beforeend", `<div class="tv-chip good">+${rr.pts}</div>`);
        else if(rr.vm > 0){
          el.classList.add("sick");
          el.insertAdjacentHTML("beforeend", `<div class="tv-chip bad">-${rr.vm + rr.ex}</div><div class="tv-puddle">${TV_PUDDLE_SVG}</div>`);
        }
        tvArena.appendChild(el); tv.revEls.push(el);
      });
    });
    tvHud(G, `Q ${G.qn + 1}/${TV_QUESTIONS}`);
    // results sheet: answer, standings, and the eat-it choice if you threw up
    const mine = res[me] || {};
    let html = `<h3>Answer: ${tvEsc(q.o[q.a])}</h3>`;
    if(mine.ok) html += `<div class="tv-msg">Right! +${mine.pts} ${tvTreatIcon()}${mine.d ? " (double or nothing paid off)" : ""}</div>`;
    else if(mine.a < 0) html += `<div class="tv-msg">No answer.${mine.vm ? " You threw up a treat." : ""}</div>`;
    else html += `<div class="tv-msg">Not this time.${mine.vm ? " You threw up a treat." : ""}${mine.ex ? " Double or nothing cost you one more." : ""}</div>`;
    html += `<div class="tv-chiprow">` + tvStandings(G).map(id => {
      const r = res[id] || {}, net = (r.pts || 0) - (r.vm || 0) - (r.ex || 0);
      const d = net > 0 ? `<span class="d-good">+${net}</span>` : net < 0 ? `<span class="d-bad">${net}</span>` : `<span class="d-none">0</span>`;
      return `<div class="tv-st${id === me ? " me" : ""}">${tvEsc(tvNameOf(G, id))} <b>${(G.tr || {})[id] || 0}</b>${tvTreatIcon()} ${d}</div>`;
    }).join("") + `</div>`;
    const canEat = mine.vm > 0 && G.qn + 1 < TV_QUESTIONS;
    if(canEat) html += `<div class="tv-btnrow"><button class="tv-btn eat" id="tv-eat">Eat it: next question is double or nothing</button><button class="tv-btn" id="tv-leave-it">Leave it</button></div>`;
    const sheet = tvEl("tv-sheet"); sheet.innerHTML = html; sheet.style.display = "";
    if(canEat){
      tvEl("tv-eat").addEventListener("click", () => {
        tv.ate = true; Net.setMe({ea: G.qn});
        tvEl("tv-eat").disabled = true; tvEl("tv-eat").textContent = "Gulp! Double or nothing next";
        tvEl("tv-leave-it").style.display = "none";
      });
      tvEl("tv-leave-it").addEventListener("click", () => { tvEl("tv-eat").style.display = tvEl("tv-leave-it").style.display = "none"; });
    }
  }

  /* ---------- Challenges ---------- */
  function tvEnterCh(G){
    const c = TV_CHALLENGES[G.cid];
    tvClearRev(); tv.meEl.style.visibility = "hidden"; tv.canMove = false; tvBanner("");
    tvEl("tv-sheet").style.display = "none"; tvEl("tv-qcard").style.display = "none";
    tv.chScore = 0; tv.chSent = false; tv.chCanTap = false;
    const box = tvEl("tv-challenge");
    box.style.display = "";
    box.innerHTML = `<h2>${tvEsc(c.name)}</h2><div class="tv-ch-blurb">${tvEsc(c.blurb)}</div>` +
      `<div class="tv-ch-timer" id="tv-ch-timer">${c.dur}</div>` +
      `<button class="tv-tap" id="tv-tap" disabled aria-label="Tap">${TV_PAW_SVG}</button><div class="tv-tapcount" id="tv-tapcount">0</div>`;
    tvEl("tv-tap").addEventListener("pointerdown", () => {
      if(!tv.chCanTap) return;
      tv.chScore++; tvEl("tv-tapcount").textContent = String(tv.chScore);
    });
    tvHud(G, `Challenge ${G.ci + 1}/${TV_CHALLENGE_AFTER.length}`);
    tvEl("tv-timer").textContent = String(c.dur); tvEl("tv-timer").classList.remove("low");
  }
  function tvChTick(G, now){
    const start = G.cs, end = start + G.cdur * 1000, t = tvEl("tv-ch-timer"), tap = tvEl("tv-tap");
    if(!t || !tap) return;
    if(now < start){ tv.chCanTap = false; tap.disabled = true; t.textContent = String(G.cdur); tvBanner("Get ready!"); }
    else if(now < end){
      tv.chCanTap = true; tap.disabled = false; tvBanner("");
      const left = Math.ceil((end - now) / 1000);
      t.textContent = String(left); tvEl("tv-timer").textContent = String(left); tvEl("tv-timer").classList.toggle("low", left <= 5);
    }else if(!tv.chSent){
      tv.chSent = true; tv.chCanTap = false; tap.disabled = true;
      Net.setMe({cq: G.ci, cv: tv.chScore});
      t.textContent = "0"; tvEl("tv-timer").textContent = "0"; tvBanner("Time!");
    }
  }
  function tvEnterChRes(G){
    const me = Net.myId(), cres = G.cres || {}, c = TV_CHALLENGES[G.cid];
    tvBanner(""); tvEl("tv-challenge").style.display = "none";
    const order = (G.pl || []).slice().sort((a, b) => ((cres[b] || {}).v || 0) - ((cres[a] || {}).v || 0));
    const mine = cres[me] || {};
    let html = `<h3>${tvEsc(c.name)} results</h3>`;
    if(mine.w) html += `<div class="tv-msg">You won! +${TV_CH_WIN_TREATS} ${tvTreatIcon()}</div>`;
    else if(mine.l) html += `<div class="tv-msg">Last place.${mine.vm ? " You threw up a treat." : ""}</div>`;
    else html += `<div class="tv-msg">${order.every(id => (cres[id] || {}).v === (cres[order[0]] || {}).v) ? "Everyone tied. No winner, no vomit." : "Not the winner, not the loser."}</div>`;
    html += `<div class="tv-chiprow">` + order.map(id => {
      const r = cres[id] || {};
      const tag = r.w ? `<span class="d-good">+${TV_CH_WIN_TREATS}</span>` : r.vm ? `<span class="d-bad">-1</span>` : "";
      return `<div class="tv-st${id === me ? " me" : ""}">${tvEsc(tvNameOf(G, id))} <b>${r.v || 0}</b> ${tag}</div>`;
    }).join("") + `</div>`;
    html += `<div class="tv-msg" style="margin-top:8px;">Treats: ` + tvStandings(G).map(id => `${tvEsc(tvNameOf(G, id))} ${(G.tr || {})[id] || 0}`).join(", ") + `</div>`;
    const sheet = tvEl("tv-sheet"); sheet.innerHTML = html; sheet.style.display = "";
    tvHud(G, `Challenge ${G.ci + 1}/${TV_CHALLENGE_AFTER.length}`);
  }

  /* ---------- End of game ---------- */
  function tvEnterOver(G){
    const me = Net.myId(), order = tvStandings(G), list = tvEl("tv-final"), tr = G.tr || {};
    tvClearRev(); tv.meEl.style.visibility = "hidden"; tvBanner("");
    list.innerHTML = "";
    let place = 0, prev = null;
    order.forEach((id, i) => {
      if(tr[id] !== prev){ place = i + 1; prev = tr[id]; }
      const li = document.createElement("li");
      const a = document.createElement("span");
      const pl = document.createElement("span"); pl.className = "tv-place"; pl.textContent = place + ".";
      const ic = document.createElement("span"); ic.className = "pl-dog"; ic.innerHTML = pugSVG(tvLook(tvDogOf(G, id)));
      a.append(pl, ic, document.createTextNode(tvNameOf(G, id) + (id === me ? " (you)" : "")));
      const b = document.createElement("span"); b.className = "tag"; b.innerHTML = `<b>${tr[id] || 0}</b> ${tvTreatIcon()}`;
      li.append(a, b); list.appendChild(li);
    });
    const top = order.length ? tr[order[0]] : 0, winners = order.filter(id => tr[id] === top).map(id => tvNameOf(G, id));
    tvEl("tv-over-sub").textContent = winners.length > 1 ? `${winners.join(" and ")} tie for the most treats!` : `${winners[0] || "Nobody"} has the most treats!`;
    tvEl("tv-over-btn").textContent = tv.isHost ? "Back to lobby" : "Back to lobby";
    switchScreen(tvScr.over);
  }
