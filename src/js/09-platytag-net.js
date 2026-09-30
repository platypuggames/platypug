  /* =====================================================================
     PLATYTAG — multiplayer tag mode
     ===================================================================== */

  /* ---------- Network adapter ----------
     This is the ONLY part that knows about claude.ai. To host the game elsewhere
     (e.g. GitHub Pages + Firebase), replace createClaudeNet() with an object that
     has the same members:
       available()   -> Promise<boolean>   can this device go online at all?
       join(code)    -> Promise            enter the room for a 4-letter code
       setMe(obj)    -> void               merge obj into MY shared state
       peers()       -> [{id, isMe, p}]    everyone in the room + their shared state
       myId()        -> string|null        my id within peers()
       onChange(fn)  -> void               fn() whenever anyone's state/presence changes
       leave()       -> Promise
     Everything below talks only to Net, never to claude.* directly. */
  // counters for the ?debug overlay
  const NetStats = {events: 0, sends: 0};
  function createClaudeNet(){
    let roomNs = null, code = null, myId = null, mine = {}, subscribed = false;
    const listeners = [];
    async function getRoomNs(){
      if(roomNs !== null) return roomNs;
      for(let i = 0; i < 30 && !(window.claude && typeof window.claude.use === "function"); i++){
        await new Promise(r => setTimeout(r, 100));
      }
      try{
        roomNs = (window.claude && typeof window.claude.use === "function") ? ((await window.claude.use("room")) || false) : false;
      }catch(e){ roomNs = false; }
      return roomNs;
    }
    const fire = (err) => listeners.forEach(fn => { try{ fn(err); }catch(e){ console.error(e); } });
    return {
      async available(){ return !!(await getRoomNs()); },
      async join(c){
        const r = await getRoomNs();
        if(!r) throw new Error("unavailable");
        if(!subscribed){
          subscribed = true;
          r.onPeers(ch => {
            const me = ch.peers.find(p => p.sameTab);
            if(me) myId = me.peer;
            if(code) fire();
          }, err => fire(err));
          r.onConnection(() => { if(code) fire(); });
        }
        code = c;
        mine = {c};
        await r.presence({c});
      },
      setMe(obj){
        if(!roomNs || !code) return;
        Object.assign(mine, obj);
        roomNs.presence(Object.assign({c: code}, obj)).catch(() => {});
      },
      peers(){
        if(!roomNs || !code) return [];
        return roomNs.peers()
          .filter(p => p.sameTab || (p.presence && p.presence.c === code))
          .map(p => ({id: p.peer, isMe: !!p.sameTab, p: p.sameTab ? Object.assign({}, p.presence, mine) : (p.presence || {})}));
      },
      myId(){
        if(!myId && roomNs){ const m = roomNs.peers().find(p => p.sameTab); if(m) myId = m.peer; }
        return myId;
      },
      connected(){ return !!(roomNs && roomNs.connected()); },
      allDevices(){ return roomNs ? roomNs.peers().length : 0; },
      serverNow(){ return Date.now(); },
      onChange(fn){ listeners.push(fn); },
      async leave(){
        if(!roomNs || !code) return;
        const clear = {}; Object.keys(mine).forEach(k => { clear[k] = null; }); clear.c = null;
        code = null; mine = {};
        try{ await roomNs.presence(clear); }catch(e){}
      }
    };
  }

  /* ---------- Firebase adapter (used when the game is hosted outside claude.ai, e.g. GitHub Pages) ---------- */
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC_lbYEijRpjRQXEylPG499opD5axX8VeA",
    authDomain: "platypug-99b31.firebaseapp.com",
    databaseURL: "https://platypug-99b31-default-rtdb.firebaseio.com",
    projectId: "platypug-99b31",
    appId: "1:266525704767:web:98764adae656dd79d52e8a"
  };
  function createFirebaseNet(){
    let db = null, code = null, meRef = null, playersRef = null, players = {}, mine = {}, isConnected = false, clockOffset = 0;
    let pending = null, flushTimer = null;
    const myId = "p" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    const listeners = [];
    const fire = (err, id) => { NetStats.events++; listeners.forEach(fn => { try{ fn(err, id); }catch(e){ console.error(e); } }); };
    function init(){
      if(db) return true;
      try{
        const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
        db = app.database();
        db.ref(".info/connected").on("value", snap => { isConnected = !!snap.val(); if(code) fire(); });
        db.ref(".info/serverTimeOffset").on("value", snap => { clockOffset = snap.val() || 0; });
        return true;
      }catch(e){ console.error(e); return false; }
    }
    function flush(){
      flushTimer = null;
      if(!pending || !meRef) return;
      const patch = pending; pending = null;
      NetStats.sends++;
      meRef.update(patch).catch(() => {});
    }
    const clean = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));
    return {
      async available(){ return init(); },
      async join(c){
        if(!init()) throw new Error("unavailable");
        await this.leave();
        code = c;
        mine = {t: Date.now()};
        meRef = db.ref(`rooms/${code}/players/${myId}`);
        playersRef = db.ref(`rooms/${code}/players`);
        await meRef.onDisconnect().remove();
        await meRef.set(mine);
        // one event per player that changed (not the whole room every time)
        const upd = snap => { if(snap.key === myId) return; players[snap.key] = snap.val() || {}; fire(null, snap.key); };
        playersRef.on("child_added", upd, err => fire(err));
        playersRef.on("child_changed", upd, err => fire(err));
        playersRef.on("child_removed", snap => { delete players[snap.key]; fire(null, snap.key); }, err => fire(err));
      },
      setMe(obj){
        if(!meRef) return;
        const patch = {};
        for(const k in obj){ patch[k] = clean(obj[k]); if(patch[k] === null) delete mine[k]; else mine[k] = patch[k]; }
        pending = Object.assign(pending || {}, patch);
        if(!flushTimer) flushTimer = setTimeout(flush, 66);   // ~15 updates/sec max
      },
      peers(){
        if(!code) return [];
        const all = Object.assign({}, players, {[myId]: mine});
        return Object.keys(all).map(id => ({id, isMe: id === myId, p: all[id] || {}}));
      },
      myId(){ return code ? myId : null; },
      serverNow(){ return Date.now() + clockOffset; },
      connected(){ return isConnected; },
      allDevices(){ return code ? Object.keys(Object.assign({}, players, {[myId]: 1})).length : 0; },
      onChange(fn){ listeners.push(fn); },
      async leave(){
        if(!meRef) return;
        const r = meRef, pr = playersRef;
        meRef = null; playersRef = null; code = null; players = {}; mine = {}; pending = null;
        clearTimeout(flushTimer); flushTimer = null;
        try{ pr.off(); }catch(e){}
        try{ await r.onDisconnect().cancel(); await r.remove(); }catch(e){}
      }
    };
  }
  // Hosted on the open web (GitHub Pages): Firebase. Inside claude.ai: the built-in rooms.
  const Net = (window.firebase && typeof window.firebase.initializeApp === "function") ? createFirebaseNet() : createClaudeNet();

  /* ---------- Rules ---------- */
  const MAX_PLAYERS = 10;
  const HEAD_START = 15;      // seconds the pugs get before the platypus spawns
  const TAG_TIME = 150;       // Platytag round cap (after the head start): pugs still free at 2:30 win
  const TAG_R = 34;           // touch distance for a tag (a little forgiving for lag)
  const BLANKET_TAG_R = 40;   // touching a pug's blanket tags it
  const LUMP_SVG = `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="30" cy="22" rx="27" ry="15" fill="#FCC7DA"/>
        <ellipse cx="30" cy="16" rx="27" ry="10" fill="#FFE0EA"/>
        <path d="M6 20 Q30 8 54 20" stroke="#F2A6C4" stroke-width="2.5" fill="none" opacity="0.6"/>
      </svg>`;

  const TAG_FREEZE_MS = 1800;   // tagged players are held in place this long
  const mp = {
    code: null, isHost: false, hadHost: false, g: null, hostG: null, hostT0: 0, hostTimer: null,
    inGame: false, myRole: null, spawned: false, lastRid: null, tgSeen: 0, overShown: false,
    hide: null, myBlanketEl: null, chk: null, chkUntil: 0, lastSent: "", face: 1, lastX: 0,
    remotes: new Map(), joinTimer: null
  };

  const lobbyScreen = document.getElementById("lobby-screen");
  const tagoverScreen = document.getElementById("tagover-screen");
  const lobbyStatus = document.getElementById("lobby-status");
  const lobbyJoin = document.getElementById("lobby-join");
  const lobbyRoom = document.getElementById("lobby-room");
  const nickInput = document.getElementById("nick-input");
  const codeInput = document.getElementById("code-input");
  const createBtn = document.getElementById("create-btn");
  const joinBtn = document.getElementById("join-btn");
  const startBtn = document.getElementById("start-btn");
  const waitNote = document.getElementById("wait-note");
  const playerList = document.getElementById("player-list");
  const roomCodeEl = document.getElementById("room-code");
  const tagoverBtn = document.getElementById("tagover-btn");
  document.getElementById("tagover-critters").innerHTML = pugSVG({b: "pugFawn", g: false}) + platypusSVG({b: "purple"});

  const DEFAULT_NOTE = "One platypus, lots of pugs. Tagged pugs join the hunt!";
  function fmt(sec){ sec = Math.max(0, sec|0); const m = Math.floor(sec/60), s = sec % 60; return m ? `${m}:${String(s).padStart(2,"0")}` : `${s}s`; }
  function myName(){ return (nickInput.value || "").trim().slice(0, 14) || "Player"; }
  try{ nickInput.value = localStorage.getItem("platytag_name") || ""; }catch(e){}
  function randCode(){ const A = "ABCDEFGHJKMNPQRSTUVWXYZ"; let c = ""; for(let i = 0; i < 4; i++) c += A[Math.floor(Math.random()*A.length)]; return c; }
  codeInput.addEventListener("input", () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4); });

