  /* ---------------- Build the whole house at once ---------------- */
  function buildWorld(){
    worldEl.innerHTML = "";
    worldEl.style.width = WORLD.w + "px";
    worldEl.style.height = WORLD.h + "px";
    const ext = document.createElement("div");           // lawn above the original top edge
    ext.className = "world-ext";
    ext.style.top = (WORLD.y0 - CAM_PAD_TOP) + "px"; ext.style.height = (CAM_PAD_TOP - WORLD.y0) + "px"; ext.style.width = WORLD.w + "px";
    worldEl.appendChild(ext);
    freestandingEls = [];
    FURN_LIST = [];
    ROOM_FOG = {}; curSeekRoom = null; blanketEl = null; blanketRoom = null;
    state.holePull = null; state.holeExited = null;
    state.tube = {x: TUBE_HOME.x, y: TUBE_HOME.y, holder: null}; state.lastSwimPos = null; state.swimming = false; state.wearingTube = false; state._wasWet = false; state._wetUntil = 0; state._pawLast = null;
    SOLID_RECTS = [];
    bedWorldRect = null;
    inBedNow = false;

    Object.keys(ROOMS).forEach(key => {
      const room = ROOMS[key];
      const rect = room.rect;

      const roomDiv = document.createElement("div");
      roomDiv.className = "room";
      roomDiv.style.left = rect.x+"px"; roomDiv.style.top = rect.y+"px";
      roomDiv.style.width = rect.w+"px"; roomDiv.style.height = rect.h+"px";

      const wallBand = document.createElement("div");
      wallBand.className = "room-wall-band";
      wallBand.style.background = room.wall;
      if(room.fence){
        roomDiv.classList.add("yard");
        wallBand.classList.add("fence-band");
        wallBand.style.background = "";
      }
      roomDiv.appendChild(wallBand);

      const floorBand = document.createElement("div");
      floorBand.className = "room-floor-band";
      floorBand.style.background = floorCss(room);
      if(room.decals === "ATTIC") roomDiv.insertAdjacentHTML("beforeend", ATTIC_DECALS);
      if(room.decals === "POOL") roomDiv.insertAdjacentHTML("beforeend", poolDecal(rect));
      if(room.noWall){ wallBand.style.display = "none"; floorBand.style.top = "0"; roomDiv.classList.add("open-yard"); }
      if(room.wallH){ wallBand.style.height = room.wallH + "px"; floorBand.style.top = room.wallH + "px"; }
      roomDiv.appendChild(floorBand);

      room.furniture.forEach((f, i) => {
        const wx = rect.x + f.x;
        const wy = rect.y + f.y;
        const ww = f.w;
        const wh = f.h;
        const worldCx = wx + ww/2;
        const worldStandY = Math.min(rect.y+rect.h-14, wy + wh + 16);

        // solid collision footprint: freestanding pieces stay walkable along their back
        // edge (near the wall) so the character can tuck in behind them; wall-mounted
        // pieces are solid all the way through since there's no room behind them anyway.
        // The bed is a special case — fully pass-through, no collision at all.
        if(f.passthrough){
          // no solid rect
        } else if(f.wall){
          SOLID_RECTS.push({x:wx, y:wy, w:ww, h:wh});
        } else {
          const openFrac = 0.4;
          SOLID_RECTS.push({x:wx, y: wy + wh*openFrac, w:ww, h: wh*(1-openFrac)});
        }

        if(!CUSTOM_ART[f.id]){
        const shadow = document.createElement("div");
        shadow.className = "f-shadow";
        shadow.style.left = (f.x + ww*0.18) + "px";
        shadow.style.top = (f.y + wh - 6) + "px";
        shadow.style.width = (ww*0.64) + "px";
        shadow.style.height = "10px";
        roomDiv.appendChild(shadow);
        }

        const el = document.createElement("div");
        const illustrated = !!CUSTOM_ART[f.id];
        el.className = "furniture" + (illustrated ? " illustrated" : "");
        el.style.left = f.x+"px"; el.style.top = f.y+"px";
        el.style.width = ww+"px"; el.style.height = wh+"px";
        el.dataset.id = f.id;
        el.dataset.room = key;
        if(f.zTop) el.style.zIndex = "6";
        if(f.id === "bed"){
          el.dataset.cx = worldCx;
          el.dataset.cy = wy + wh*0.6;
        } else {
          el.dataset.cx = worldCx;
          el.dataset.cy = worldStandY;
        }

        if(illustrated){
          el.innerHTML = `<div class="custom-svg">${CUSTOM_ART[f.id]()}</div>`;
        } else {
          el.style.background = `linear-gradient(160deg, #fff, ${f.color})`;
          el.style.setProperty("--rot", rot+"deg");
          el.style.transform = `rotate(${rot}deg)`;
          el.innerHTML = `<div class="f-emoji">${f.emoji}</div><div class="f-label">${f.label}</div>`;
        }

        

        if(!f.wall && !f.passthrough){
          el.classList.add("freestanding");
          freestandingEls.push({el: el, depthY: worldStandY});
        }

        FURN_LIST.push({id:f.id, room:key, el:el, x:wx, y:wy, w:ww, h:wh});
        if(f.id === "bed"){
          bedWorldRect = {x:wx, y:wy, w:ww, h:wh};
        }

        roomDiv.appendChild(el);
      });

      if(key === "livingroom"){
        const dark = document.createElement("div");
        dark.className = "room-dark" + (lightsAreOff() ? " on" : "");
        roomDiv.appendChild(dark);
        lights.darkEl = dark;
      }
      const fog = document.createElement("div");
      fog.className = "room-fog";
      roomDiv.appendChild(fog);
      ROOM_FOG[key] = fog;
      if(key === "attic") atticGhost.host = roomDiv;
      worldEl.appendChild(roomDiv);
    });

    // doorway bridges painted after rooms so they visually open the walls
    CONNECTORS.forEach(c => {
      const patch = document.createElement("div");
      patch.className = "connector-patch";
      if(c.color) patch.style.background = c.color;
      patch.style.left = c.rect.x+"px"; patch.style.top = c.rect.y+"px";
      patch.style.width = c.rect.w+"px"; patch.style.height = c.rect.h+"px";
      worldEl.appendChild(patch);
    });

    buildFlowers();
    buildTunnel();
    buildSecret();
    buildLadder();
    state.onLadder = false; state.ladT = 0;
    (state.digs || []).forEach(d => addDigEl(d, false));
    const DOOR = {x:104, y:910, w:182, h:30};
    const door = document.createElement("div");
    door.className = "garage-door" + (state.garageOpen ? " open" : "");
    door.style.left = DOOR.x+"px"; door.style.top = DOOR.y+"px"; door.style.width = DOOR.w+"px"; door.style.height = DOOR.h+"px";
    worldEl.appendChild(door);
    garageDoorEl = door;
    garageDoorSolid = {x:DOOR.x, y:DOOR.y-10, w:DOOR.w, h:DOOR.h+30};
    if(!state.garageOpen) SOLID_RECTS.push(garageDoorSolid);
    const plate = document.createElement("div");
    plate.className = "garage-plate" + (state.garageOpen ? " pressed" : "");
    plate.style.left = PLATE.x+"px"; plate.style.top = PLATE.y+"px";
    worldEl.appendChild(plate);
    garagePlateEl = plate;
    const sw = document.createElement("div");
    sw.className = "light-switch" + (lightsAreOff() ? " off" : "");
    sw.style.left = LIGHT_SW.x + "px"; sw.style.top = LIGHT_SW.y + "px";
    worldEl.appendChild(sw);
    lights.swEl = sw;

    footEl = document.createElement("div");
    footEl.className = "foot-shadow";
    worldEl.appendChild(footEl);

    if(state.phase === "seeking" && state.hidingSpot === "blanket" && state.blanketPos){
      const bp = state.blanketPos;
      const bel = makeBlanketEl(bp.x, bp.y);
      bel.style.display = "none";
      worldEl.appendChild(bel);
      blanketEl = bel;
      if(state.blanketTunnel){
        blanketRoom = "tunnel";
        bel.style.zIndex = "12";
        FURN_LIST.push({id:"blanket", room:"floor", el:bel, x:bp.x-40, y:bp.y-58, w:80, h:62, hidden:true});
      } else {
        blanketRoom = roomAt(bp.x, bp.y) || nearestRoom(bp.x, bp.y);
        bel.style.zIndex = blanketZ(bp.x, bp.y, false);
        FURN_LIST.push({id:"blanket", room:"floor", el:bel, x:bp.x-35, y:bp.y-38, w:70, h:46, hidden:true});
      }
    }

    buildBoard();
    state.boardPull = false; state.boardLatch = false; state.diving = false;
    tubeEl = document.createElement("div");
    tubeEl.className = "float-tube";
    tubeEl.innerHTML = tubeSVG("full");
    tubeEl.style.left = TUBE_HOME.x + "px"; tubeEl.style.top = TUBE_HOME.y + "px";
    worldEl.appendChild(tubeEl);

    spriteEl = document.createElement("div");
    spriteEl.className = "critter-sprite idle" + (state.phase === "hiding" ? " pug" : " plat");
    spriteEl.innerHTML = state.phase === "hiding" ? spriteMarkup("pug", pugSVG((state.looks || {}).pug), (state.looks || {}).pug) : spriteMarkup("plat", platypusSVG((state.looks || {}).plat), (state.looks || {}).plat);
    worldEl.appendChild(spriteEl);

    if(bedWorldRect){
      bedLumpEl = document.createElement("div");
      bedLumpEl.className = "bed-lump";
      bedLumpEl.innerHTML = `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="30" cy="22" rx="27" ry="15" fill="#FCC7DA"/>
        <ellipse cx="30" cy="16" rx="27" ry="10" fill="#FFE0EA"/>
        <path d="M6 20 Q30 8 54 20" stroke="#F2A6C4" stroke-width="2.5" fill="none" opacity="0.6"/>
      </svg>`;
      worldEl.appendChild(bedLumpEl);
    } else {
      bedLumpEl = null;
    }

    // pug stayed under the covers (blanket button in bed): leave its lump visible to the seeker
    if(state.phase === "seeking" && state.pugLumpPos){
      const pl = document.createElement("div");
      pl.className = "bed-lump show pug-lump";
      pl.style.left = state.pugLumpPos.x + "px";
      pl.style.top = state.pugLumpPos.y + "px";
      pl.innerHTML = `<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="30" cy="22" rx="27" ry="15" fill="#FCC7DA"/>
        <ellipse cx="30" cy="16" rx="27" ry="10" fill="#FFE0EA"/>
        <path d="M6 20 Q30 8 54 20" stroke="#F2A6C4" stroke-width="2.5" fill="none" opacity="0.6"/>
      </svg>`;
      worldEl.appendChild(pl);
    }
  }

