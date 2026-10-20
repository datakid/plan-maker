regress('v4: every unmet Prefer item and every Must violation carries a why line', ()=>{
  let bad = '', n = 0, items = 0;
  for(const seed of [2, 5, 8, 11, 14, 17]){
    Fx.use(fuzzSpec(seed));
    const r = generatePlan({iters:60, seed});
    if(!r.plan) continue;
    const v = validatePlan(r.plan);
    n++;
    for(const x of v.violations){
      if(x.cls!=='hard' && x.cls!=='soft') continue;
      items++;
      if(!x.why){ bad = 'seed '+seed+' '+x.rule+' '+x.key+' has no why'; break; }
      if(!whyText(x.why)){ bad = 'seed '+seed+' empty why text'; break; }
    }
    if(bad) break;
  }
  return verdict(!bad && n>=4, n+' plans '+items+' items', bad || 'only '+n+' plans');
});

regress('v4: the summary lists rule contributions and the visit sheet shows the rules touching a visit', ()=>{
  const keep = App.data, keepPlan = App.plan, keepTab = App.ui.tab;
  try{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    const s = S();
    s.period = Object.assign({}, s.period, {goal:'range', preset:'custom', start:Fx.W1.start, end:Fx.W1.end});
    patchDay(1, {min:3});
    const r = generatePlan();
    App.plan = r.plan;
    const block = ruleContribBlock(r.plan);
    const minLine = [...block.querySelectorAll('.rc-line')].find(l=>l.textContent.includes(t(ruleSpec('day.min').name)));
    const okBlock = !!minLine && /×/.test(minLine.textContent);
    const vis = r.plan.visits[0];
    const sec = visitContribSection(r.plan, vis);
    const okSheet = !!sec.querySelector('.section-title') && sec.textContent.includes(t('rcTitle'));
    return verdict(okBlock && okSheet, 'contributions shown', 'block '+okBlock+' sheet '+okSheet);
  } finally { App.data = keep; App.plan = keepPlan; App.ui.tab = keepTab; }
});

regress('v4: a Tuesday that cannot be staffed shows the blocking reason', ()=>{
  Fx.w1({shuffle:1, leans:{2:'contracted'}});
  patchDay(2, {lean:'contracted'});
  S().days[2].kind.howMany = 'one';
  S().days[2].kind.lv = mkLv('must', 5);
  for(const p of App.data.people) p.off = (p.off || []).concat([{from:Fx.W1.tuesday, to:Fx.W1.tuesday}]);
  const r = generatePlan({seed:1});
  const v = validatePlan(r.plan);
  const x = v.violations.find(y=>y.rule==='day.kind');
  if(!x) return verdict(false, 'unmet day.kind', 'no day.kind violation; status '+r.status);
  const w = x.why;
  const blocks = w && w.worse ? w.worse.map(y=>y.rule) : [];
  const text = whyText(w);
  return verdict(!!w && w.fixable===true && blocks.includes('struct.seats') && text.includes(t('rs_seats')), 'blocked by seats', JSON.stringify(w)+' '+text);
});
