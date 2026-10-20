const Ref = {
  combos(arr, k){
    const out = [];
    const rec = (start, cur)=>{
      if(cur.length===k){ out.push(cur.slice()); return; }
      for(let i=start;i<arr.length;i++){ cur.push(arr[i]); rec(i+1, cur); cur.pop(); }
    };
    rec(0, []);
    return out;
  },

  solve(oracle, opts){
    opts = opts || {};
    const set = S();
    const win = planWindow();
    if(win.error) return {error:win.error};
    const days = win.days.filter(o=>normalWorkday(o) || isOverrideDate(isoOf(o)));
    const facs = schedulableFacilities().filter(f=>!opts.only || opts.only.includes(f.id));
    const maxLeaves = opts.maxLeaves || 300000;
    const counts = opts.counts || null;
    const minV = opts.min || 0, maxV = opts.max==null ? Infinity : opts.max;
    const members = {};
    for(const pl of set.pools) members[pl.id] = activePeople().filter(p=>p.pool===pl.id);
    let leaves = 0, found = null, truncated = false, valid = 0;
    const picks = [];

    const staff = (vs, i, usedByDay, out)=>{
      if(found && !opts.all) return;
      if(leaves>=maxLeaves){ truncated = true; return; }
      if(i===vs.length){
        leaves++;
        const plan = Ref.build(vs, out, win, days);
        if(oracle(plan)){ valid++; if(!found) found = plan; }
        return;
      }
      const v = vs[i], f = v.f, ord = v.ord;
      const used = usedByDay.get(ord) || new Set();
      const seatPools = set.pools.map(pl=>({pl, n:seatsFor(pl, v.kind, f.category)}));
      const rec = (pi, team)=>{
        if(found && !opts.all) return;
        if(leaves>=maxLeaves){ truncated = true; return; }
        if(pi===seatPools.length){
          const ids = [].concat(...Object.values(team));
          const nu = new Set(used); ids.forEach(id=>nu.add(id));
          const m2 = new Map(usedByDay); m2.set(ord, nu);
          out.push({v, team});
          staff(vs, i+1, m2, out);
          out.pop();
          return;
        }
        const {pl, n} = seatPools[pi];
        const cands = members[pl.id].filter(p=>!used.has(p.id) && (opts.skipAvail || personAvailable(p, ord)) && !(p.blocked||[]).includes(f.id));
        if(cands.length<n){ if(!opts.allowOpen) return; }
        const take = Math.min(n, cands.length);
        for(let k=take; k>=(opts.allowOpen ? 0 : take); k--){
          for(const c of Ref.combos(cands, k)){
            team[pl.id] = c.map(p=>p.id);
            rec(pi+1, team);
          }
        }
        delete team[pl.id];
      };
      rec(0, {});
    };

    const place = (i, load, kindCount)=>{
      if(found && !opts.all) return;
      if(leaves>=maxLeaves){ truncated = true; return; }
      if(i===facs.length){
        const total = picks.length;
        if(total<minV || total>maxV) return;
        if(counts && (((kindCount.basic||0)!==counts.basic) || ((kindCount.contracted||0)!==counts.contracted))) return;
        const vs = picks.map(p=>({f:p.f, ord:p.ord, kind:visitKindOf(p.f)})).sort((a,b)=>a.ord-b.ord);
        staff(vs, 0, new Map(), []);
        return;
      }
      const f = facs[i];
      place(i+1, load, kindCount);
      for(const ord of days){
        if((load.get(ord)||0) >= dayCap(ord)) continue;
        if(f.weekdays && f.weekdays.length && !f.weekdays.includes(wdOf(ord))) continue;
        const c = dayCfg(ord);
        if(c.only && c.only.length && !c.only.includes(f.category)) continue;
        const k = visitKindOf(f);
        const kc = Object.assign({}, kindCount); kc[k] = (kc[k]||0)+1;
        if(counts && kc[k]>(counts[k]||0)) continue;
        load.set(ord, (load.get(ord)||0)+1);
        picks.push({f, ord});
        place(i+1, load, kc);
        picks.pop();
        load.set(ord, load.get(ord)-1);
      }
    };
    place(0, new Map(), {});
    return {found, leaves, truncated, valid};
  },

  best(opts){
    opts = Object.assign({}, opts || {}, {all:true});
    let best = null, leaves = 0;
    const r = Ref.solve(plan=>{
      leaves++;
      if(opts.targets) plan.targets = opts.targets;
      const st = makeState(plan);
      const units = {};
      for(const x of st.eval.violations) units[x.rule] = (units[x.rule] || 0)+x.units;
      if(!best || st.hard<best.hard || (st.hard===best.hard && st.soft<best.soft)) best = {hard:st.hard, soft:st.soft, units};
      return false;
    }, opts);
    return {best, leaves, truncated:r.truncated, error:r.error};
  },

  build(vs, staffed, win, days){
    const visits = vs.map((v, i)=>({id:'r'+i, date:isoOf(v.ord), facilityId:v.f.id, kind:v.kind, team:staffed[i].team, open:{}, why:{}, moved:false, fixed:false, overrideId:null, special:null, late:false}));
    return {
      id:'ref', cycle:1, createdAt:0, approved:false, stale:false, start:isoOf(win.start), end:isoOf(win.end), days:win.days.map(isoOf),
      goal:'range', requested:visits.length, carryover:[], goalReport:{}, genDiags:[], visits
    };
  }
};

Ref.days = function(oracle, opts){
  opts = opts || {};
  const set = S();
  const win = planWindow();
  if(win.error) return {error:win.error};
  const days = win.days.filter(o=>normalWorkday(o) || isOverrideDate(isoOf(o)));
  const facs = schedulableFacilities();
  const counts = opts.counts || null;
  const maxLeaves = opts.maxLeaves || 200000;
  const everyDay = !!set.volume.requireEveryEligibleDay;
  const hist = historyIndex(win.start).map;
  const people = activePeople();
  const members = {};
  for(const pl of set.pools) members[pl.id] = people.filter(p=>p.pool===pl.id);
  const taken = new Map(people.map(p=>[p.id, new Set(hist.get(p.id) || [])]));
  const cnt = new Map(people.map(p=>[p.id, 0]));
  const wk = new Map();
  const rules = new Map(people.map(p=>[p.id, personPatternRules(p).hard]));
  let leaves = 0, found = null, truncated = false;
  const chosen = [];
  const usedFac = new Set();
  const kc = {basic:0, contracted:0};

  const eligible = (p, f, ord)=>{
    if(!personAvailable(p, ord) || (p.blocked || []).includes(f.id)) return false;
    const q = p.quota || {};
    if(q.max!=null && cnt.get(p.id)>=q.max) return false;
    if(p.maxPerWeek && (wk.get(p.id+'|'+weekKey(ord)) || 0)>=p.maxPerWeek) return false;
    const ds = taken.get(p.id);
    for(const r of rules.get(p.id)) if(ruleBreaksOn(r, ds, ord)) return false;
    return true;
  };
  const mark = (ids, ord, d)=>{
    for(const id of ids){
      cnt.set(id, cnt.get(id)+d);
      const k = id+'|'+weekKey(ord);
      wk.set(k, (wk.get(k) || 0)+d);
      if(d>0) taken.get(id).add(ord); else taken.get(id).delete(ord);
    }
  };

  const rec = (i)=>{
    if(found && !opts.all) return;
    if(leaves>=maxLeaves){ truncated = true; return; }
    if(i===days.length){
      if(counts && (kc.basic!==(counts.basic || 0) || kc.contracted!==(counts.contracted || 0))) return;
      leaves++;
      const vs = chosen.map(c=>({f:c.f, ord:c.ord, kind:c.kind}));
      const plan = Ref.build(vs, chosen.map(c=>({team:c.team})), win, days);
      if(oracle(plan) && !found) found = plan;
      return;
    }
    const ord = days[i];
    const needLeft = counts ? (counts.basic || 0) + (counts.contracted || 0) - kc.basic - kc.contracted : 0;
    for(const f of facs){
      if(usedFac.has(f.id)) continue;
      if(f.weekdays && f.weekdays.length && !f.weekdays.includes(wdOf(ord))) continue;
      const c = dayCfg(ord);
      if(c.only && c.only.length && !c.only.includes(f.category)) continue;
      const kind = visitKindOf(f);
      if(counts && kc[kind]>=(counts[kind] || 0)) continue;
      const seatPools = set.pools.map(pl=>({pl, n:seatsFor(pl, kind, f.category), cands:[]}));
      let possible = true;
      for(const sp of seatPools){
        sp.cands = members[sp.pl.id].filter(p=>eligible(p, f, ord));
        if(sp.cands.length<sp.n){ possible = false; break; }
      }
      if(!possible) continue;
      const teamRec = (pi, team, ids)=>{
        if(found && !opts.all) return;
        if(leaves>=maxLeaves){ truncated = true; return; }
        if(pi===seatPools.length){
          chosen.push({f, ord, kind, team:Object.assign({}, team)});
          usedFac.add(f.id); kc[kind]++;
          mark(ids, ord, 1);
          rec(i+1);
          mark(ids, ord, -1);
          kc[kind]--; usedFac.delete(f.id);
          chosen.pop();
          return;
        }
        const sp = seatPools[pi];
        for(const combo of Ref.combos(sp.cands, sp.n)){
          const cid = combo.map(p=>p.id);
          team[sp.pl.id] = cid;
          teamRec(pi+1, team, ids.concat(cid));
        }
        delete team[sp.pl.id];
      };
      teamRec(0, {}, []);
    }
    if(!everyDay || !normalWorkday(ord)){
      if(!counts || days.length-i-1 >= needLeft) rec(i+1);
    }
  };
  rec(0);
  return {found, leaves, truncated};
};
