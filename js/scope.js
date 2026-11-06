const SCOPE = {depth:0, stores:[]};

function scopeBegin(){ SCOPE.depth++; }

function scopeEnd(){
  SCOPE.depth--;
  if(SCOPE.depth<=0){
    SCOPE.depth = 0;
    for(const m of SCOPE.stores) m.clear();
  }
}

function scopeRun(fn){
  scopeBegin();
  try{ return fn(); } finally { scopeEnd(); }
}

function scopeWrap(name, keyFn, post){
  const orig = globalThis[name];
  if(typeof orig!=='function') return;
  const store = new Map();
  SCOPE.stores.push(store);
  globalThis[name] = function(){
    if(SCOPE.depth===0) return orig.apply(this, arguments);
    const key = keyFn.apply(null, arguments);
    if(store.has(key)) return store.get(key);
    let r = orig.apply(this, arguments);
    if(post) r = post(r);
    store.set(key, r);
    return r;
  };
}

function scopeWrap2(name, idOf){
  const orig = globalThis[name];
  if(typeof orig!=='function') return;
  const store = new Map();
  SCOPE.stores.push(store);
  globalThis[name] = function(a, b){
    if(SCOPE.depth===0) return orig.apply(this, arguments);
    const id = idOf(a);
    let inner = store.get(id);
    if(inner===undefined){ inner = new Map(); store.set(id, inner); }
    if(inner.has(b)) return inner.get(b);
    const r = orig.apply(this, arguments);
    inner.set(b, r);
    return r;
  };
}

const scopeId = x=>x && x.id!=null ? x.id : '';

scopeWrap2('personAvailable', scopeId);
scopeWrap2('personBaseAvailable', scopeId);
scopeWrap2('patternCyclesAllow', scopeId);
scopeWrap2('isOff', scopeId);
scopeWrap('normalWorkday', o=>o);
scopeWrap('activityDayAllowed', o=>o);
scopeWrap('activitySoftDayPenalty', o=>o);
scopeWrap2('personTravelKm', scopeId);
scopeWrap('facilityKm', f=>scopeId(f));
scopeWrap('activePeople', ()=>'', r=>Object.freeze(r));
scopeWrap('dayRuleOf', o=>o);
scopeWrap('poolsLive', ()=>'');
scopeWrap('distBand', km=>km);
scopeWrap('facilityKind', f=>scopeId(f));
scopeWrap('categoryKind', n=>n);
scopeWrap('visitKindOf', f=>scopeId(f));
scopeWrap('dayCfg', o=>o);

function scopeEntry(name){
  const raw = globalThis[name];
  if(typeof raw!=='function') return;
  globalThis[name] = function(){ const a = arguments, self = this; return scopeRun(()=>raw.apply(self, a)); };
}

scopeEntry('lnsPlan');
scopeEntry('searchPlan');
scopeEntry('explainPlan');
