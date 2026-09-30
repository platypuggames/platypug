  /* ---------------- World layout: whole house loaded at once ---------------- */
  // Furniture x/y/w/h below are now fixed PIXEL sizes and offsets from each
  // room's top-left corner (not percentages) — so enlarging a room never
  // changes furniture size, only how much open floor surrounds it.
  const WORLD = { w: 1300, h: 1660, y0: -300 };
  // The camera may look past the top edge (as far as half a screen), so someone standing right at the
  // backyard's top edge stays in the middle of everyone's view instead of being cut off at the top.
  const CAM_PAD_TOP = 700;
  function camTop(){ return WORLD.y0 - Math.min(CAM_PAD_TOP, viewportH / 2); }   // y0: the backyard reaches above the original top edge

  const ROOMS = {
    attic: {
      name: "Attic", emoji: "📦",
      wall: "#8C6A55", floorA: "#C9A27A", floorB: "#B98F65",
      floorPattern: "plank",
      rect: {x:20, y:150, w:260, h:330}, decals: "ATTIC",
      furniture: [
        {id:"camping", label:"Camping Gear", emoji:"🏕️", x:140, y:20,  w:104, h:96,  wall:true},
        {id:"trunk",      label:"Trunk",      emoji:"🧳", x:20,  y:130, w:110, h:85,  wall:false},
        {id:"decor",      label:"Decorations", emoji:"🎄", x:120, y:200, w:128, h:110, wall:false},
      ]
    },
    frontyard: {
      name: "Front Yard", emoji: "🏡",
      wall: "#BFE6F7", floorA: "#95D680", floorB: "#8ACD74",
      floorPattern: "grass", noWall: true,
      rect: {x:20, y:1180, w:1260, h:440},
      furniture: [
        {id:"oak",    label:"Tree",  emoji:"🌳", x:120, y:90,  w:180, h:230, wall:false},
        {id:"hedge",  label:"Hedge", emoji:"🌿", x:470, y:250, w:140, h:100, wall:false},
        {id:"bins",   label:"Bins",  emoji:"🗑️", x:1080, y:200, w:130, h:110, wall:false},
      ]
    },
    backyard: {
      name: "Backyard", emoji: "🌳",
      wall: "#BFE6F7", floorA: "#8FD27A", floorB: "#84C96E",
      floorPattern: "grass", fence: true,
      rect: {x:300, y:-300, w:980, h:780}, wallH: 135, decals: "POOL",
      furniture: [
        {id:"shed",     label:"Shed",     emoji:"🏚️", x:30,  y:8,   w:170, h:170, wall:true},
        {id:"doghouse", label:"Doghouse", emoji:"🏠", x:110, y:570, w:140, h:130, wall:false},
        {id:"slide",    label:"Slide",    emoji:"🛝", x:690, y:450, w:200, h:170, wall:false, passthrough:true, zTop:true},
      ]
    },
    kitchen: {
      name: "Kitchen", emoji: "🍳",
      wall: "var(--kitchen-wall)", floorA: "var(--kitchen-floor-a)", floorB: "var(--kitchen-floor-b)",
      floorPattern: "check",
      rect: {x:380, y:520, w:560, h:320},
      furniture: [
        {id:"fridge",  label:"Fridge",  emoji:"🧊", x:16,  y:6, w:84,  h:166, wall:true},
        {id:"cabinet", label:"Cabinet", emoji:"🍽️", x:340, y:6, w:184, h:88,  wall:true},
        {id:"table",   label:"Table",   emoji:"🪑", x:210, y:200, w:138, h:84, wall:false},
      ]
    },
    bedroom: {
      name: "Bedroom", emoji: "🛏️",
      wall: "var(--bedroom-wall)", floorA: "var(--bedroom-floor-a)", floorB: "var(--bedroom-floor-b)",
      floorPattern: "plank",
      rect: {x:380, y:860, w:280, h:300},
      furniture: [
        {id:"closet",  label:"Closet",  emoji:"🚪", x:198, y:6, w:66, h:150, wall:true},
        {id:"dresser", label:"Dresser", emoji:"🗄️", x:16,  y:6, w:70, h:58,  wall:true},
        {id:"bed",     label:"Bed",     emoji:"🛏️", x:70,  y:150, w:150, h:130, wall:false, passthrough:true},
      ]
    },
    garage: {
      name: "Garage", emoji: "🚗",
      wall: "var(--garage-wall)", floorA: "var(--garage-floor-a)", floorB: "var(--garage-floor-b)",
      floorPattern: "concrete",
      rect: {x:20, y:520, w:340, h:420},
      furniture: [
        {id:"shelf", label:"Shelf", emoji:"🧰", x:250, y:6,   w:68, h:114, wall:true},
        {id:"boxes", label:"Boxes", emoji:"📦", x:244, y:200, w:74, h:72, wall:false},
        {id:"car",   label:"Car",   emoji:"🚗", x:22,  y:150, w:196, h:120, wall:false},
      ]
    },
    bathroom: {
      name: "Bathroom", emoji: "🛁",
      wall: "var(--bathroom-wall)", floorA: "var(--bathroom-floor-a)", floorB: "var(--bathroom-floor-b)",
      floorPattern: "tile",
      rect: {x:680, y:860, w:280, h:300},
      furniture: [
        {id:"tub",      label:"Bathtub", emoji:"🛁", x:16,  y:6,   w:106, h:86, wall:true},
        {id:"cabinet2", label:"Cabinet", emoji:"🧴", x:182, y:6,   w:75,  h:77, wall:true},
        {id:"basket",   label:"Laundry", emoji:"🧺", x:182, y:180, w:62,  h:62, wall:false},
      ]
    },
    livingroom: {
      name: "Living Room", emoji: "🛋️",
      wall: "var(--livingroom-wall)", floorA: "var(--livingroom-floor-a)", floorB: "var(--livingroom-floor-b)",
      floorPattern: "plank",
      rect: {x:960, y:520, w:320, h:380},
      furniture: [
        {id:"tvstand",   label:"TV Stand",  emoji:"📺", x:228, y:6,   w:76, h:100, wall:true},
        {id:"bookshelf", label:"Bookshelf", emoji:"📚", x:228, y:118, w:76, h:112, wall:true},
        {id:"couch",     label:"Couch",     emoji:"🛋️", x:28,  y:210, w:172, h:112, wall:false},
      ]
    }
  };

  // Doorway bridges connecting adjacent rooms — no walls, just open floor.
  const CONNECTORS = [
    {rect:{x:100, y:476, w:90,  h:48}, color:"#B98F65"},   // attic <-> garage (stairs)
    {rect:{x:110, y:936, w:170, h:248}, color:"#B9BEC4"},  // garage <-> front yard (driveway)
    {rect:{x:470, y:1156, w:100, h:28}},                   // bedroom <-> front yard
    {rect:{x:1080, y:896, w:90,  h:288}, color:"#D8C9B0"},  // living room <-> front yard (front walk)
    {rect:{x:600, y:470, w:110, h:60}},   // backyard <-> kitchen
    {rect:{x:1030, y:470, w:100, h:60}},   // backyard <-> living room
    {rect:{x:356, y:620, w:28,  h:110}},  // garage <-> kitchen
    {rect:{x:470, y:836, w:100, h:48}},   // kitchen <-> bedroom
    {rect:{x:760, y:836, w:100, h:48}},   // kitchen <-> bathroom
    {rect:{x:656, y:960, w:28,  h:80}},   // bedroom <-> bathroom
    {rect:{x:936, y:630, w:28,  h:100}},  // kitchen <-> living room
  ];


  const WALKABLE_ZONES = Object.values(ROOMS).map(r => r.rect).concat(CONNECTORS.map(c => c.rect));
  let SOLID_RECTS = [];

  function isWalkable(x, y){
    let inZone = false;
    for(let i=0;i<WALKABLE_ZONES.length;i++){
      const r = WALKABLE_ZONES[i];
      if(x >= r.x && x <= r.x+r.w && y >= r.y && y <= r.y+r.h){ inZone = true; break; }
    }
    if(!inZone) return false;
    for(let i=0;i<SOLID_RECTS.length;i++){
      const r = SOLID_RECTS[i];
      if(x >= r.x && x <= r.x+r.w && y >= r.y && y <= r.y+r.h) return false;
    }
    return true;
  }

  function floorCss(room){
    switch(room.floorPattern){
      case "check":
        return `repeating-conic-gradient(${room.floorA} 0% 25%, ${room.floorB} 0% 50%) 0 0 / 13% 22%`;
      case "plank":
        return `repeating-linear-gradient(90deg, ${room.floorA} 0 10%, ${room.floorB} 10% 20%)`;
      case "concrete":
        return `repeating-linear-gradient(135deg, ${room.floorA} 0 6%, ${room.floorB} 6% 12%)`;
      case "grass":
        return `radial-gradient(circle at 30% 40%, rgba(255,255,255,0.18) 0 2px, transparent 3px) 0 0 / 36px 30px, repeating-linear-gradient(90deg, ${room.floorA} 0 60px, ${room.floorB} 60px 120px)`;
      case "tile":
        return `linear-gradient(${room.floorA}, ${room.floorA}), repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0 3px, transparent 3px 16%), repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0 3px, transparent 3px 16%)`;
      default:
        return room.floorA;
    }
  }

  /* ---------------- State ---------------- */
  let state = {
    phase: "title",
    hidingRoom: null,
    hidingSpot: null,
    pendingSpot: null,
    checkedSpots: 0,
    checkedIds: new Set(),
    startTime: null,
    busy: false,
    pos: {x:450, y:230},
    target: {x:450, y:230},
    onArrive: null,
    walkingClassApplied: false,
    camX: 0, camY: 0,
  };

  /* ---------------- DOM refs ---------------- */
  const titleScreen = document.getElementById("title-screen");
  const gameScreen = document.getElementById("game-screen");
  const winScreen = document.getElementById("win-screen");
  const stage = document.getElementById("stage");
  const worldEl = document.getElementById("world");
  const phasePill = document.getElementById("phase-pill");
  const statPill = document.getElementById("stat-pill");
  const leadPill = document.getElementById("lead-pill");
  const confirmFab = document.getElementById("confirm-fab");
  const plainBtn = document.getElementById("plain-btn");
  const digBtn = document.getElementById("dig-btn");
  function blanketSVG(col){
    return `<svg viewBox="0 0 80 52" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="plaid" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" style="fill:${col}"/><rect width="12" height="4" fill="#000" opacity="0.07"/><rect width="4" height="12" fill="#000" opacity="0.07"/><rect x="6" width="1.5" height="12" fill="#fff" opacity="0.18"/></pattern></defs><path d="M 4 46 C 2 30 14 12 40 10 C 66 12 78 30 76 46 Q 58 50 40 48 Q 22 50 4 46 Z" fill="url(#plaid)" stroke="#000" stroke-opacity="0.22" stroke-width="2" stroke-linejoin="round"/><path d="M 14 22 Q 26 14 40 14" stroke="#fff" stroke-width="2" fill="none" opacity="0.18" stroke-linecap="round"/></svg>`;
  }
  function roomAt(x, y){
    for(const k in ROOMS){ const r = ROOMS[k].rect; if(x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h) return k; }
    return null;
  }
  function nearestRoom(x, y){
    let best=null, bd=Infinity;
    for(const k in ROOMS){ const r=ROOMS[k].rect;
      const d=Math.hypot(Math.max(r.x-x,0,x-(r.x+r.w)), Math.max(r.y-y,0,y-(r.y+r.h)));
      if(d<bd){bd=d;best=k;} }
    return best;
  }
  const toast = document.getElementById("toast");
  const interstitial = document.getElementById("interstitial");

  document.getElementById("title-critters").innerHTML = pugSVG({b: "pugFawn", g: false}) + platypusSVG({b: "purple"});
  document.getElementById("win-critters").innerHTML = pugSVG() + platypusSVG();

  let spriteEl = null, footEl = null, tubeEl = null;
  let freestandingEls = [];
  let FURN_LIST = [];
  let garageDoorEl = null, garagePlateEl = null, garageDoorSolid = null;
  const PLATE = {x:334, y:914};
  let ROOM_FOG = {}, curSeekRoom = null, blanketEl = null, blanketRoom = null;
  let bedWorldRect = null, bedLumpEl = null, inBedNow = false;
  let viewportW = 360, viewportH = 500;

  function measureViewport(){
    const rect = stage.getBoundingClientRect();
    if(rect.width > 0) viewportW = rect.width;
    if(rect.height > 0) viewportH = rect.height;
  }
  window.addEventListener("resize", measureViewport);

  /* ---------------- Helpers ---------------- */
  function showToast(msg, ms){
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toast.classList.remove("show"), ms || 1400);
  }

  // Coming out of a hiding spot: pop out on whichever side you pushed/tapped toward
  // (tries neighbouring directions if that side is a wall or blocked).
  const EXIT_GLIDE_SPEED = 380;   // px/s: a little quicker than walking
  function hideExitSpot(item, dir){
    const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
    const L = Math.hypot(dir.x, dir.y);
    if(!L) return null;
    const a0 = Math.atan2(dir.y / L, dir.x / L);
    const tries = [0, 0.4, -0.4, 0.8, -0.8, 1.57, -1.57, 2.2, -2.2, 3.14];
    const ok = (x, y) => isWalkable(x, y) && isWalkable(x - 10, y) && isWalkable(x + 10, y) && isWalkable(x, y - 8) &&
      roomAt(x, y) === roomAt(cx, cy);
    for(const da of tries){
      const ux = Math.cos(a0 + da), uy = Math.sin(a0 + da);
      const t = Math.min(ux ? (item.w / 2) / Math.abs(ux) : Infinity, uy ? (item.h / 2) / Math.abs(uy) : Infinity);
      for(const gap of [26, 40, 56]){
        const x = cx + ux * (t + gap), y = cy + uy * (t + gap + (uy > 0 ? 14 : 0));   // feet sit low on the sprite
        if(ok(x, y)) return {x, y};
      }
    }
    return null;
  }
  /* Starting spots: dogs scatter around the backyard doghouse (clear of its doorway, the trellis
     and the pool); the platypus starts in the kitchen between the fridge and the table. */
  function spawnPoint(role){
    if(role === "plat"){
      const b = {x: 548, y: 706};
      for(let i = 0; i < 30; i++){
        const x = b.x + (Math.random() - 0.5) * 40, y = b.y + (Math.random() - 0.5) * 30;
        if(isWalkable(x, y)) return {x, y};
      }
      return b;
    }
    const dh = FURN_LIST.find(f => f.id === "doghouse");
    if(dh){
      const cx = dh.x + dh.w / 2, cy = dh.y + dh.h / 2;
      for(let i = 0; i < 60; i++){
        const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 40;
        const x = cx + Math.cos(a) * (dh.w / 2 + r), y = cy + Math.sin(a) * (dh.h / 2 + r);
        if(!isWalkable(x, y) || !isWalkable(x - 12, y) || !isWalkable(x + 12, y)) continue;
        if(inPool(x, y) || Math.hypot(x - SECRET_HOLE.x, y - SECRET_HOLE.y) < 60 || Math.hypot(x - LADDER_BOT.x, y - LADDER_BOT.y) < 60) continue;
        return {x, y};
      }
      return {x: dh.x - 40, y: dh.y + dh.h / 2};
    }
    return {x: 400, y: 760};
  }
  function setTarget(x, y, onArrive){
    if(state.mp && mp.hide && Math.hypot(x - state.pos.x, y - state.pos.y) > 8){   // moving sneaks you out
      const h = mp.hide;
      const item = h.type === "furn" ? FURN_LIST.find(f => f.id === h.id) : null;
      mpUnhide();
      if(item){
        const cx = item.x + item.w / 2, cy = item.y + item.h / 2;
        const dir = (keyboardActive && state.keyDir) ? state.keyDir : {x: x - cx, y: y - cy};
        const p = hideExitSpot(item, dir);
        if(p){                                              // run out smoothly instead of popping
          const d = Math.hypot(p.x - state.pos.x, p.y - state.pos.y);
          if(d > 2){ state.exitGlide = {sx: state.pos.x, sy: state.pos.y, ex: p.x, ey: p.y, d, t: 0}; state.camLag = performance.now(); }
        }
      }
    }
    state.target = {x, y};
    state.onArrive = onArrive || null;
  }

  function placeSpriteAt(x, y){
    state.pos = {x, y};
    state.target = {x, y};
    state.onArrive = null;
    if(spriteEl){
      spriteEl.style.left = x + "px";
      spriteEl.style.top = y + "px";
      footEl.style.left = x + "px";
      footEl.style.top = (y + 3) + "px";
    }
  }

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function attemptMove(nx, ny){
    const ok = (x, y) => isWalkable(x, y) && !slideBlocks(x, y);
    if(ok(nx, ny)) return {x:nx, y:ny};
    if(ok(nx, state.pos.y)) return {x:nx, y: state.pos.y};
    if(ok(state.pos.x, ny)) return {x: state.pos.x, y: ny};
    return null;
  }

