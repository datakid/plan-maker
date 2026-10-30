const WHY_STRUCT_NAME = {'struct.seats':'rs_seats', 'struct.perDay':'rs_perDay', 'struct.onePlace':'rs_onePlace', 'struct.facilityOnce':'rs_facilityOnce', 'struct.calendar':'rs_calendar', 'struct.retired':'rs_retired', 'struct.fixedVisit':'rs_fixedVisit'};

function violationSig(v){
  return [v.rule, v.key, (v.dates || []).join(','), (v.people || []).join(','), (v.visits || []).join(','), (v.facilities || []).join(',')].join('|');
}

function whyRuleName(rule){
  return WHY_STRUCT_NAME[rule] ? t(WHY_STRUCT_NAME[rule]) : (ruleSpec(rule) ? t(ruleSpec(rule).name) : rule);
}

function whyRuleTotals(list){
  const out = {};
  for(const x of list){
    if(x.cls==='exception') continue;
    out[x.rule] = (out[x.rule] || 0)+x.weight*x.units;
  }
  return out;
}

function whyCandidates(st, v, rnd, limit){
  const plan = st.plan;
  const live = plan.visits.filter(x=>!x.fixed && facilityById(x.facilityId));
  const involved = live.filter(x=>(v.visits || []).includes(x.id));
  const dates = v.dates || [];
  const days = plan.days.filter(d=>normalWorkday(ordOf(d)));
  const out = [];
  const moveDay = (x, d)=>{
    if(d===x.date) return;
    if(plan.visits.some(y=>y.id!==x.id && y.date===d && y.facilityId===x.facilityId)) return;
    out.push({name:'moveDay', ops:[{op:'set', id:x.id, fields:{date:d, team:lnsRestaff(plan, x, d, rnd, true)}}]});
  };
  const swapDays = (x, y)=>{
    if(x.id===y.id || x.date===y.date) return;
    out.push({name:'swapDays', ops:[{op:'set', id:x.id, fields:{date:y.date, team:lnsRestaff(plan, Object.assign({}, x), y.date, rnd, true)}}, {op:'set', id:y.id, fields:{date:x.date, team:lnsRestaff(plan, Object.assign({}, y), x.date, rnd, true)}}]});
  };
  for(const x of involved){
    for(const d of days) moveDay(x, d);
    for(const y of live) swapDays(x, y);
  }
  for(const d of dates){
    if(!days.includes(d)) continue;
    for(const y of live) if(y.date!==d){ moveDay(y, d); }
  }
  for(const x of involved){
    for(const pl of S().pools){
      const cur = (x.team || {})[pl.id] || [];
      cur.forEach((pid, i)=>{
        if(!(v.people || []).length || (v.people || []).includes(pid)){
          const busy = lnsBusy(plan, x.date, new Set([x.id]));
          const taken = new Set(cur);
          taken.delete(pid);
          for(const q of lnsEligible(plan, x, pl.id, x.date, busy, taken)){
            if(q.id===pid) continue;
            const next = cur.slice(); next[i] = q.id;
            out.push({name:'replacePerson', ops:[{op:'set', id:x.id, fields:{team:Object.assign({}, x.team, {[pl.id]:next})}}]});
          }
        }
      });
    }
  }
  return out.slice(0, limit);
}

function probeTier(v){ return v.cls==='hard' ? 0 : (INTENT_RULES.has(v.rule) ? 1 : 2); }
function probeOrder(violations){
  return violations.filter(v=>v.cls==='hard' || v.cls==='soft').sort((a, b)=>(probeTier(a)-probeTier(b)) || (b.weight*b.units-a.weight*a.units));
}

function explainPlan(plan, opts){
  opts = opts || {};
  const t0 = Date.now();
  const work = clonePlan(plan);
  const st = makeState(work);
  const before = st.eval.violations;
  const beforeTotals = whyRuleTotals(before);
  const rnd = lnsRng(opts.seed || 1);
  const targets = probeOrder(before);
  const why = {};
  const budget = opts.ms || 300;
  const base = lnsCost(st);
  let probed = 0;
  for(const v of targets){
    const sig = violationSig(v);
    if(why[sig]) continue;
    if(Date.now()-t0>budget || probed>=(opts.max || 14)){ why[sig] = {fixable:null}; continue; }
    probed++;
    let best = null;
    for(const move of whyCandidates(st, v, rnd, opts.limit || 60)){
      const d = deltaMove(st, move);
      const after = st.eval.violations;
      if(!after.some(x=>violationSig(x)===sig)){
        const totals = whyRuleTotals(after);
        const worse = Object.keys(totals).filter(r=>totals[r]>(beforeTotals[r] || 0)+1e-9 && r!==v.rule).map(r=>({rule:r, units:Math.round((totals[r]-(beforeTotals[r] || 0))*1000)/1000}));
        const damage = lnsCost(st)-base;
        if(!best || worse.length<best.worse.length || (worse.length===best.worse.length && damage<best.damage)) best = {fixable:true, move:move.name, worse, damage:Math.round(damage*1000)/1000};
      }
      d.revert();
    }
    why[sig] = best || {fixable:false};
  }
  return why;
}

function whyText(w){
  if(!w) return '';
  if(w.fixable===null) return t('wNotProbed');
  if(w.fixable===false) return t('wNoFix');
  if(!w.worse.length) return t('wFixFree');
  return t('wBreaks', w.worse.map(x=>whyRuleName(x.rule)).join('، '));
}
