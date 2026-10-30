function resolveRequestSeats(override, kind, f, auto, people, guests){
  const have = {};
  for(const id of people){ const p = personById(id); if(p) have[p.pool] = (have[p.pool]||0)+1; }
  const out = {};
  for(const pl of S().pools) out[pl.id] = Math.max(0, plannedSeats(override, pl, kind, f, auto, have[pl.id]) - visitGuestsIn({guests:guests||[]}, pl.id));
  return out;
}

function makeRequest(r){
  return Object.assign({id:null, source:'volume', refId:null, facilityId:null, kind:'basic', window:{lo:0, hi:0}, copies:1,
    level:{level:'prefer', w:null}, seats:{}, people:[], guests:[], fill:true, only:[], never:[], rules:{}, mergedFrom:[]}, r);
}

function compileRequestsRaw(win){
  const list = [], diags = [];
  for(const o of overridesIn(win.start, win.end)){
    const f = facilityById(o.facilityId);
    const people = o.people.filter(id=>{ const p = personById(id); return p && !p.retired; });
    const kind = visitKindOf(f), auto = !!o.fill || !people.length, ord = ordOf(o.date);
    list.push(makeRequest({id:'rq_'+o.id, source:'fixed', refId:o.id, facilityId:f.id, kind, window:{lo:ord, hi:ord}, copies:1,
      level:{level:'must', w:null}, seats:resolveRequestSeats(o.seats, kind, f, auto, people, o.guests), people, guests:o.guests||[], rules:o.rules||{}, fill:!!o.fill, only:o.only||[], never:o.never||[],
      ref:o, f, auto, tier:-1}));
  }
  for(const g of S().goals.filter(g=>g.on && g.type==='special')){
    const f = facilityById(g.facilityId);
    const tier = goalMust(g) ? 0 : 1;
    if(!f){ diags.push({sev:'info', key:'dSpecialNoFacility', args:[goalTitle(g)]}); continue; }
    const w = specialWindow(g, win);
    if(!w) continue;
    const people = liveIds(g.people);
    if(people.length < (g.people||[]).length) diags.push({sev:'warn', key:'dSpecialPeopleGone', args:[goalTitle(g)]});
    const kind = visitKindOf(f), auto = !!g.fill || !people.length;
    list.push(makeRequest({id:'rq_'+g.id, source:'special', refId:g.id, facilityId:f.id, kind, window:{lo:w.lo, hi:w.hi}, copies:g.times,
      level:{level:tier===0 ? 'must' : 'prefer', w:g.lv ? g.lv.w : null}, seats:resolveRequestSeats(g.seats, kind, f, auto, people, g.guests), people, guests:g.guests||[], rules:g.rules||{}, fill:!!g.fill,
      only:g.only||[], never:g.never||[], ref:g, f, auto, tier}));
  }
  return {list, diags};
}

function requestCopies(list){
  const out = [];
  for(const r of list) for(let k=0;k<r.copies;k++) out.push({r, copy:k});
  return out;
}

function requestsOverlap(a, b){ return a.facilityId===b.facilityId && a.window.lo<=b.window.hi && b.window.lo<=a.window.hi; }

function duplicateGroupsOf(list){
  const byFac = new Map();
  list.forEach((r, i)=>{ if(!byFac.has(r.facilityId)) byFac.set(r.facilityId, []); byFac.get(r.facilityId).push({r, i}); });
  const groups = [];
  for(const items of byFac.values()){
    if(items.length<2) continue;
    const parent = items.map((_, k)=>k);
    const find = k=>{ while(parent[k]!==k){ parent[k] = parent[parent[k]]; k = parent[k]; } return k; };
    for(let a=0;a<items.length;a++) for(let b=a+1;b<items.length;b++) if(requestsOverlap(items[a].r, items[b].r)) parent[find(a)] = find(b);
    const comps = new Map();
    items.forEach((it, k)=>{ const root = find(k); if(!comps.has(root)) comps.set(root, []); comps.get(root).push(it); });
    for(const c of comps.values()) if(c.length>1) groups.push(c);
  }
  return groups;
}

function duplicatePolicyFor(members){
  const own = members.map(m=>m.r.ref && m.r.ref.dupChoice).find(Boolean);
  return own || S().duplicates || 'ask';
}

function mergeRequests(members){
  const rs = members.map(m=>m.r);
  const base = rs.find(r=>r.source==='fixed') || rs[0];
  let lo = Math.max(...rs.map(r=>r.window.lo)), hi = Math.min(...rs.map(r=>r.window.hi));
  if(lo>hi){ lo = base.window.lo; hi = base.window.hi; }
  const uniq = key=>[...new Set([].concat(...rs.map(r=>r[key]||[])))];
  const people = uniq('people'), guests = uniq('guests');
  const seatOverride = {};
  for(const r of rs) for(const [pid, n] of Object.entries(r.ref.seats||{})) seatOverride[pid] = Math.max(seatOverride[pid]||0, n);
  const seatsOverride = Object.keys(seatOverride).length ? seatOverride : null;
  const fill = rs.some(r=>r.fill), auto = fill || !people.length;
  const tier = Math.min(...rs.map(r=>r.tier));
  const lvSrc = rs.filter(r=>r.tier===tier).sort((a,b)=>(b.level.w||0)-(a.level.w||0))[0];
  const ref = Object.assign({}, base.ref, {people, guests, seats:seatsOverride, fill, only:uniq('only'), never:uniq('never')});
  if(base.source==='special'){ ref.from = isoOf(lo); ref.to = isoOf(hi); }
  const merged = makeRequest({id:base.id, source:base.source, refId:base.refId, facilityId:base.facilityId, kind:base.kind, window:{lo, hi}, copies:Math.max(...rs.map(r=>r.copies)),
    level:{level:lvSrc.level.level, w:lvSrc.level.w}, seats:resolveRequestSeats(seatsOverride, base.kind, base.f, auto, people, guests), people, guests, rules:base.rules, fill,
    only:ref.only, never:ref.never, ref, f:base.f, auto, tier, mergedFrom:rs.map(r=>r.refId)});
  return merged;
}

function requestTitle(r){ return r.source==='special' ? goalTitle(r.ref) : r.ref.date; }

function compileRequests(win){
  const raw = compileRequestsRaw(win);
  const diags = raw.diags.slice();
  const drop = new Set(), replace = new Map();
  for(const members of duplicateGroupsOf(raw.list)){
    const f = members[0].r.f;
    if(Math.max(...members.map(m=>m.r.window.lo)) > Math.min(...members.map(m=>m.r.window.hi))){
      diags.push({sev:'info', key:'dDupWindowsApart', args:[f.name, members.length]});
      continue;
    }
    const policy = duplicatePolicyFor(members);
    if(policy==='merge'){
      replace.set(members[0].i, mergeRequests(members));
      for(const m of members.slice(1)) drop.add(m.i);
      diags.push({sev:'info', key:'dDupMerged', args:[f.name, members.length]});
    } else if(policy==='reject'){
      const order = members.slice().sort((a,b)=>(a.r.source==='fixed' ? 0 : 1)-(b.r.source==='fixed' ? 0 : 1) || a.i-b.i);
      for(const m of order.slice(1)){ drop.add(m.i); diags.push({sev:'info', key:'dDupRejected', args:[requestTitle(m.r), f.name]}); }
    } else if(policy==='ask'){
      diags.push({sev:'warn', key:'dDupAsk', args:[f.name, members.length]});
    }
  }
  const list = [];
  raw.list.forEach((r, i)=>{ if(drop.has(i)) return; list.push(replace.get(i) || r); });
  return {list, diags};
}
