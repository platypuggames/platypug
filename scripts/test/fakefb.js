// DEV ONLY (never loaded by the game): in-browser fake of the Firebase Realtime Database for multi-tab Platytag tests.
// Tabs in the SAME browser context share state via BroadcastChannel, with 40-160ms ordered fake latency.
(function(){
  const bc = new BroadcastChannel("fakefb"); const store = {}; const subs = [];
  const J = v => v == null ? null : JSON.parse(JSON.stringify(v));
  function get(path){ return path.split("/").reduce((o,k)=>o&&o[k], store); }
  function setLocal(path, val){ const ks=path.split("/"); let o=store; for(let i=0;i<ks.length-1;i++){ o[ks[i]]=o[ks[i]]||{}; o=o[ks[i]]; } if(val==null) delete o[ks[ks.length-1]]; else o[ks[ks.length-1]]=J(val); notify(); }
  function notify(){ subs.forEach(s=>{
    const v = get(s.path);
    if(s.ev === "value"){ s.fn({val:()=>J(v)}); return; }
    const cur = v || {}, prev = s.prev || {};
    for(const k in cur){ const a = JSON.stringify(cur[k]); if(!(k in prev)){ if(s.ev==="child_added") s.fn({key:k, val:()=>J(cur[k])}); } else if(prev[k] !== a && s.ev==="child_changed") s.fn({key:k, val:()=>J(cur[k])}); }
    for(const k in prev) if(!(k in cur) && s.ev==="child_removed") s.fn({key:k, val:()=>null});
    s.prev = {}; for(const k in cur) s.prev[k] = JSON.stringify(cur[k]);
  }); }
  const JIT = window.FAKE_JITTER || [40, 160];
  let nextAt = 0;
  bc.onmessage = e => { const m=e.data; const at = Math.max(nextAt, performance.now() + JIT[0] + Math.random()*(JIT[1]-JIT[0])); nextAt = at; const d = at - performance.now();
    setTimeout(() => { if(m.t==="set") setLocal(m.path,m.val); if(m.t==="hello") bc.postMessage({t:"sync",store}); if(m.t==="sync"){ Object.assign(store, J(m.store)); notify(); } }, m.t==="set" ? d : 0); };
  function write(path,val){ setLocal(path,val); bc.postMessage({t:"set",path,val}); }
  function ref(path){ return {
    on(ev, fn){ if(path===".info/connected"){ setTimeout(()=>fn({val:()=>true}),10); return; } if(path===".info/serverTimeOffset"){ setTimeout(()=>fn({val:()=>0}),10); return; }
      const s={path,fn,ev,prev:null}; subs.push(s); setTimeout(()=>{ if(ev==="value") fn({val:()=>J(get(path))}); else if(ev==="child_added"){ const cur=get(path)||{}; s.prev={}; for(const k in cur){ s.prev[k]=JSON.stringify(cur[k]); fn({key:k,val:()=>J(cur[k])}); } } else { const cur=get(path)||{}; s.prev={}; for(const k in cur) s.prev[k]=JSON.stringify(cur[k]); } },5); },
    off(){ for(let i=subs.length-1;i>=0;i--) if(subs[i].path===path) subs.splice(i,1); },
    set(v){ write(path,v); return Promise.resolve(); },
    update(p){ const cur=Object.assign({}, get(path)||{}); for(const k in p){ if(p[k]==null) delete cur[k]; else cur[k]=p[k]; } write(path,cur); return Promise.resolve(); },
    remove(){ write(path,null); return Promise.resolve(); },
    onDisconnect(){ return {remove:()=>Promise.resolve(), cancel:()=>Promise.resolve()}; }
  }; }
  bc.postMessage({t:"hello"});
  window.firebase = { apps: [], app(){ return this._a; }, initializeApp(){ this.apps.push(1); this._a = {database: ()=>({ref})}; return this._a; } };
})();
