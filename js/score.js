function collectPreferences(plan, ctx, add){
  const {set, fr, vis, byDate, T} = ctx;
  const live = vis.filter(x=>x.f);
  const eligible = fr.days.filter(normalWorkday);
  const bandOf = f=>distBand(facilityKm(f));
  for(const o of eligible){
    const date = isoOf(o);
    const list = (byDate.get(date) || []).filter(x=>x.f);
    const ids = list.map(x=>x.v.id);
    const dr = dayRuleOf(o);
    if(dr.min && list.length<dr.min.n) add({src:'day', group:'cPrefs', key:'dMinDay', dates:[date], visits:ids, actual:list.length, required:dr.min.n, units:dr.min.n-list.length, args:[date, list.length, dr.min.n]});
    const dayRule = (field, key, match, what)=>{
      const e = dr[field];
      if(!e) return;
      const bad = list.filter(x=>!match(x, e));
      const units = e.howMany==='one' ? (list.some(x=>match(x, e)) ? 0 : 1) : bad.length;
      if(units>0) add({src:'day', group:'cPrefs', key, dates:[date], visits:(e.howMany==='one' ? list : bad).map(x=>x.v.id), facilities:(e.howMany==='one' ? list : bad).map(x=>x.f.id), units, args:[date, what(e), units]});
    };
    dayRule('kind', 'dDayKind', (x, e)=>x.kind===e.kind, e=>kindLabel(e.kind));
    dayRule('band', 'dDayBand', (x, e)=>bandOf(x.f)===e.band, e=>e.band);
    dayRule('category', 'dDayCategory', (x, e)=>e.ids.includes(x.f.category), e=>e.ids.join('، '));
  }
  const tg = plan.targets;
  if(tg){
    const nb = live.filter(x=>x.kind==='basic').length, nc = live.length-nb;
    if(tg.mode==='exact'){
      const units = tg.upTo ? Math.max(0, nb-tg.basic) + Math.max(0, nc-tg.contracted) : Math.abs(nb-tg.basic) + Math.abs(nc-tg.contracted);
      if(units>0) add({src:'volume', group:'cPrefs', key:'dExactOff', units, actual:nb+nc, required:tg.basic+tg.contracted, args:[nb, tg.basic, nc, tg.contracted]});
    } else if(tg.mode==='fill'){
      const want = Math.round(live.length*(tg.share==null ? set.volume.share : tg.share));
      const units = Math.abs(nb-want);
      if(units>0) add({src:'volume', group:'cPrefs', key:'dShareOff', units, actual:nb, required:want, args:[nb, want]});
    } else if(tg.mode==='quota' && tg.quota){
      let units = 0;
      for(const cid in tg.quota) units += Math.abs(live.filter(x=>x.f.category===cid).length-tg.quota[cid]);
      if(units>0) add({src:'volume', group:'cPrefs', key:'dQuotaOff', units, args:[units]});
    }
    const inPlan = new Set(live.map(x=>x.f.id));
    for(const f of App.data.facilities){
      if(!f.pinned || f.excluded || inPlan.has(f.id)) continue;
      if(!tg.pinned || !tg.pinned.includes(f.id)) continue;
      add({src:'volume', group:'cPrefs', key:'dPinnedMissing', facilities:[f.id], args:[f.name]});
    }
  }
  const dist = set.distance;
  if(dist.pickBias==='near' || dist.pickBias==='far'){
    const opp = dist.pickBias==='near' ? 'far' : 'near';
    for(const x of live) if(bandOf(x.f)===opp) add({src:'visit', group:'cPrefs', key:'dDistPick', visits:[x.v.id], dates:[x.v.date], facilities:[x.f.id], args:[x.f.name, x.v.date]});
  }
  const farBy = new Map();
  const ordsBy = new Map();
  const rotatePref = rotatePreferActive();
  const fpv = (App.data.history && App.data.history.fpv) || {};
  for(const x of live){
    for(const id of x.ids){
      const p = personById(id);
      if(!p) continue;
      const band = bandOf(x.f);
      if(!ordsBy.has(id)) ordsBy.set(id, []);
      ordsBy.get(id).push(ordOf(x.v.date));
      const pband = distBand(personTravelKm(p, x.f));
      if(p.distPref && pband!==p.distPref && (pband!=='mid' || distStrict(p))) add({src:'person', group:'cPrefs', key:'dPersonDist', people:[id], visits:[x.v.id], dates:[x.v.date], facilities:[x.f.id], args:[p.name, x.f.name]});
      const trip = distBand(personTravelKm(p, x.f));
      if(dist.shortTrips && trip==='far') add({src:'person', group:'cPrefs', key:'dShortTrip', people:[id], visits:[x.v.id], dates:[x.v.date], facilities:[x.f.id], args:[p.name, x.f.name]});
      if(trip==='far') farBy.set(id, (farBy.get(id)||0)+1);
      const gp = set.genderPrefs && set.genderPrefs[p.gender];
      if(gp && gp.on){
        let mm = 0;
        if(gp.dist && band!==gp.dist) mm++;
        if(gp.kind && x.kind!==gp.kind) mm++;
        if(gp.days && gp.days.length && !gp.days.includes(wdOf(ordOf(x.v.date)))) mm++;
        if(mm>0) add({src:'person', group:'cPrefs', key:'dGenderPref', ref:p.gender, units:mm, people:[id], visits:[x.v.id], dates:[x.v.date], facilities:[x.f.id], args:[p.name, x.f.name]});
      }
      if(rotatePref){
        const v = fpv[x.f.id+'|'+id] || 0;
        if(v>0) add({src:'person', group:'cPrefs', key:'dRotate', units:Math.min(v, 6)/3, people:[id], visits:[x.v.id], dates:[x.v.date], facilities:[x.f.id], args:[p.name, x.f.name]});
      }
    }
  }
  for(const [id, list] of ordsBy){
    list.sort((a, b)=>a-b);
    let units = 0;
    for(let i=1; i<list.length; i++) if(list[i]-list[i-1]===1) units++;
    if(units>0) add({src:'person', group:'cPrefs', key:'dSpread', units, people:[id], args:[personById(id).name, units]});
  }
  if(dist.balanceFar){
    for(const pl of set.pools){
      const members = activePeople().filter(p=>p.pool===pl.id);
      if(members.length<2) continue;
      const far = members.map(p=>farBy.get(p.id)||0);
      const lo = Math.min(...far);
      let units = 0;
      for(const n of far) units += Math.max(0, n-lo-1);
      if(units>0) add({src:'person', group:'cPrefs', key:'dBalanceFar', units, args:[pl.id, units]});
    }
  }
  if(T && live.length){
    for(const pl of set.pools){
      const members = activePeople().filter(p=>p.pool===pl.id && eligible.some(o=>personAvailable(p, o)));
      if(members.length<2) continue;
      const totalShare = sum(members, p=>p.share==null ? 1 : p.share) || 1;
      const total = sum(members, p=>T.assigned[p.id]||0);
      let units = 0;
      for(const p of members){
        const expected = total*(p.share==null ? 1 : p.share)/totalShare;
        units += Math.max(0, Math.abs((T.assigned[p.id]||0)-expected)-0.5);
      }
      units = Math.round(units*1000)/1000;
      if(units>0) add({src:'person', group:'cPrefs', key:'dFairLoad', units, args:[pl.id, units]});
    }
  }
}

function dueIndex(startOrd){
  const byKind = {basic:[], contracted:[]};
  for(const f of schedulableFacilities()){
    const overdue = f.lastVisit ? Math.max(0, startOrd-ordOf(f.lastVisit)) : NEVER_DAYS;
    byKind[visitKindOf(f)].push({id:f.id, overdue});
  }
  const out = new Map();
  for(const kind of Object.keys(byKind)){
    const list = byKind[kind];
    const sorted = list.map(x=>x.overdue).sort((a, b)=>a-b);
    const n = sorted.length;
    for(const x of list){
      let lo = 0, hi = n;
      while(lo<hi){ const m = (lo+hi)>>1; if(sorted[m]<x.overdue) lo = m+1; else hi = m; }
      out.set(x.id, n>1 ? lo/(n-1) : 0);
    }
  }
  return out;
}

function makeState(plan){
  const st = {plan, due:dueIndex(ordOf(plan.start)), eval:null, hard:0, soft:0, reward:0};
  evaluateState(st);
  return st;
}

function evaluateState(st){
  const v = validatePlan(st.plan);
  const w = lvOf('due.priority').w;
  let reward = 0;
  for(const x of st.plan.visits) reward += w*(st.due.get(x.facilityId)||0);
  st.eval = v;
  st.hard = v.hardScore;
  st.reward = Math.round(reward*1000)/1000;
  st.soft = Math.round((v.softScore-st.reward)*1000)/1000;
  return st;
}

function fastCopy(x){
  if(x===null || typeof x!=='object') return x;
  if(Array.isArray(x)){
    const n = new Array(x.length);
    for(let i=0; i<x.length; i++) n[i] = fastCopy(x[i]);
    return n;
  }
  const o = {};
  for(const k in x){
    if(!Object.prototype.hasOwnProperty.call(x, k)) continue;
    const v = x[k];
    if(v!==undefined) o[k] = fastCopy(v);
  }
  return o;
}

function stateVisit(st, id){
  const visits = st.plan.visits;
  if(st.vIdxArr!==visits || st.vIdxLen!==visits.length){
    st.vIdx = new Map();
    for(const v of visits) st.vIdx.set(v.id, v);
    st.vIdxArr = visits; st.vIdxLen = visits.length;
  }
  return st.vIdx.get(id);
}

function busyBump(m, v, d){
  if(!v || !v.date) return;
  let c = m.get(v.date);
  if(!c){ if(d<0) return; c = new Map(); m.set(v.date, c); }
  for(const id of visitTeamIds(v)){
    const n = (c.get(id) || 0)+d;
    if(n>0) c.set(id, n); else c.delete(id);
  }
}

function busyIndexBuild(plan){
  const m = new Map();
  for(const v of plan.visits) busyBump(m, v, 1);
  return m;
}

function applyMove(st, move){
  const inv = [];
  const visits = st.plan.visits;
  const bi = st.busyIdx || null;
  for(const op of move.ops){
    if(op.op==='set'){
      const v = stateVisit(st, op.id);
      const prev = {};
      if(bi) busyBump(bi, v, -1);
      for(const k of Object.keys(op.fields)){ prev[k] = fastCopy(v[k]===undefined ? null : v[k]); v[k] = fastCopy(op.fields[k]); }
      if(op.fields.facilityId!==undefined && op.fields.kind===undefined){ prev.kind = v.kind; v.kind = visitKindOf(facilityById(v.facilityId)); }
      if(bi) busyBump(bi, v, 1);
      inv.unshift({op:'set', id:op.id, fields:prev});
    } else if(op.op==='add'){
      visits.splice(op.at==null ? visits.length : op.at, 0, op.visit);
      if(st.vIdxArr===visits){ st.vIdx.set(op.visit.id, op.visit); st.vIdxLen = visits.length; }
      if(bi) busyBump(bi, op.visit, 1);
      inv.unshift({op:'remove', id:op.visit.id});
    } else if(op.op==='remove'){
      const i = visits.findIndex(x=>x.id===op.id);
      const [v] = visits.splice(i, 1);
      if(st.vIdxArr===visits){ st.vIdx.delete(v.id); st.vIdxLen = visits.length; }
      if(bi) busyBump(bi, v, -1);
      inv.unshift({op:'add', visit:v, at:i});
    }
  }
  return {ops:inv};
}

function deltaMove(st, move){
  const prev = {hard:st.hard, soft:st.soft, reward:st.reward, eval:st.eval};
  const inv = applyMove(st, move);
  evaluateState(st);
  const d = {hard:Math.round((st.hard-prev.hard)*1000)/1000, soft:Math.round((st.soft-prev.soft)*1000)/1000};
  const revert = ()=>{ applyMove(st, inv); st.hard = prev.hard; st.soft = prev.soft; st.reward = prev.reward; st.eval = prev.eval; };
  if(App.debugScore){
    const fresh = validatePlan(JSON.parse(JSON.stringify(st.plan)));
    if(fresh.hardScore!==st.hard) throw new Error('score drift hard '+fresh.hardScore+' vs '+st.hard);
  }
  return {delta:d, revert, inverse:inv};
}

function statePlanScore(plan){
  const st = makeState(plan);
  return {hard:st.hard, soft:st.soft};
}
