const EMPTY_LIST = Object.freeze([]);
const PERSON_RELS = ['between','exactly','atLeast','atMost','only','never'];

function scopeOrNull(sc){ return sc && sc.kind && sc.kind!=='all' ? sc : null; }
function inScopeOpt(f, scope){ return !scope || inScope(f, scope); }

function compilePeopleRules(){
  const deny = new Map(), counts = new Map(), tgBy = new Map(), list = [], together = [];
  const active = new Set(activePeople().map(p=>p.id));
  const push = (m, k, v)=>{ if(!m.has(k)) m.set(k, []); m.get(k).push(v); };
  const addCount = (pid, c)=>{ const r = Object.assign({pid, key:c.id+'|'+pid}, c); push(counts, pid, r); list.push(r); return r; };

  for(const p of activePeople()){
    const q = p.quota;
    if(q && (q.min!=null || q.max!=null)) addCount(p.id, {id:'quota', src:'person', scope:null, min:q.min, max:q.max, must:true});
  }
  for(const g of S().goals){
    if(!g.on) continue;
    const must = goalMust(g);
    if(g.type==='person'){
      for(const pid of g.people||[]){
        if(!active.has(pid)) continue;
        if(g.rel==='never' || g.rel==='only') push(deny, pid, {gid:g.id, scope:g.scope, invert:g.rel==='only', must});
        else addCount(pid, {id:g.id, gid:g.id, src:'goal', scope:scopeOrNull(g.scope), min:g.rel==='atMost' ? null : g.n, max:g.rel==='atLeast' ? null : (g.rel==='between' ? Math.max(g.n, g.n2==null ? g.n : g.n2) : g.n), must});
      }
    } else if(g.type==='together'){
      if(!g.a || !g.b || g.a===g.b || !active.has(g.a) || !active.has(g.b)) continue;
      const r = {id:g.id, gid:g.id, a:g.a, b:g.b, scope:scopeOrNull(g.scope), rel:g.rel, pct:g.pct, must};
      r.qa = addCount(g.a, {id:g.id+'#', src:'together', scope:r.scope, min:null, max:null, must:false}).key;
      r.qb = addCount(g.b, {id:g.id+'#', src:'together', scope:r.scope, min:null, max:null, must:false}).key;
      together.push(r); push(tgBy, r.a, r); push(tgBy, r.b, r);
    }
  }
  return {
    list, together,
    countsOf: pid=>counts.get(pid) || EMPTY_LIST,
    togetherOf: pid=>tgBy.get(pid) || EMPTY_LIST,
    denied(pid, f){
      const L = deny.get(pid); if(!L || !f) return null;
      let soft = null;
      for(const e of L) if(inScope(f, e.scope)!==e.invert){ if(e.must) return 'must'; soft = 'try'; }
      return soft;
    },
    deniedBy(pid, f, gid){
      const L = deny.get(pid); if(!L || !f) return false;
      return L.some(e=>e.gid===gid && inScope(f, e.scope)!==e.invert);
    }
  };
}

function togetherTarget(r, ctx){
  const qa = ctx.q[r.qa]||0, qb = ctx.q[r.qb]||0, both = ctx.both[r.id]||0, base = Math.min(qa, qb);
  const pct = base ? Math.round(both/base*100) : 0;
  const goal = r.pct/100;
  const gap = r.rel==='atLeast' ? Math.ceil(goal*base - 1e-9) - both : both - Math.floor(goal*base + 1e-9);
  return {both, base, pct, gap:Math.max(0, gap), met:base===0 ? r.rel==='atMost' : gap<=0};
}

function togetherSeatsPossible(r){
  const A = personById(r.a), B = personById(r.b);
  if(!A || !B) return false;
  const facs = schedulableFacilities().filter(f=>inScopeOpt(f, r.scope));
  return facs.some(f=>{
    const k = facilityKind(f);
    if(A.pool===B.pool) return seatsForF(poolById(A.pool), k, f) >= 2;
    return seatsForF(poolById(A.pool), k, f) >= 1 && seatsForF(poolById(B.pool), k, f) >= 1;
  });
}

function quotaLabel(q){
  if(!q || (q.min==null && q.max==null)) return '';
  if(q.min!=null && q.min===q.max) return '='+q.min;
  if(q.min!=null && q.max!=null) return q.min+'–'+q.max;
  return q.min!=null ? '≥'+q.min : '≤'+q.max;
}

function forgetPerson(id){
  const st = S();
  st.pairs = st.pairs.filter(r=>r.a!==id && r.b!==id);
  for(const g of st.goals){
    if(Array.isArray(g.people)) g.people = g.people.filter(x=>x!==id);
    if(g.a===id) g.a = null;
    if(g.b===id) g.b = null;
  }
  for(const o of st.overrides) o.people = o.people.filter(x=>x!==id);
}
