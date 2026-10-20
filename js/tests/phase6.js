const P6 = {
  reset(){
    App.data = normalizeData(JSON.parse(SEED_JSON));
    App.plan = null;
    S().goals = [];
    const s = S();
    s.period = Object.assign({}, s.period, {goal:'range', preset:'custom', start:Fx.W1.start, end:Fx.W1.end});
  },
  mount(selectId){
    const host = el('div', {id:'p6host'});
    document.body.appendChild(host);
    const m = GoalsManager({selectId, forceWide:true});
    host.appendChild(m);
    return {host, m};
  },
  pick(text){
    const item = [...document.querySelectorAll('.pop .menu-item')].find(b=>b.textContent.includes(text));
    if(item) item.click();
    return !!item;
  },
  fire(n, type){ n.dispatchEvent(new Event(type, {bubbles:true})); }
};

regress('v4: Goals manager adds every type, edits the main number inline, changes level, duplicates, deletes and undoes', ()=>{
  const keep = App.data, keepPlan = App.plan, keepTab = App.ui.tab;
  const bad = [];
  let mount = null;
  try{
    P6.reset();
    const ps = activePeople();
    mount = P6.mount();
    const add = mount.host.querySelector('.gm-toolbar .btn.primary');
    for(const type of GOAL_TYPES){
      const before = S().goals.length;
      add.click();
      if(!P6.pick(goalTypeLabel(type))){ bad.push('menu '+type); closePop(); continue; }
      const g = S().goals[S().goals.length-1];
      if(S().goals.length!==before+1 || g.type!==type) bad.push('add '+type);
      const row = mount.host.querySelector('[data-grow="'+g.id+'"]');
      if(!row) { bad.push('row '+type); continue; }
      if(!row.classList.contains('sel')) bad.push('selected '+type);
      const detail = mount.host.querySelector('.gm-detail');
      if(detail.hidden || !detail.querySelector('[data-goal="'+g.id+'"]')) bad.push('detail '+type);
      const main = GOAL_MAIN[type];
      if(main){
        const input = row.querySelector('.input-group input');
        const val = Math.min(main.max, main.min+(main.step || 1)*2);
        input.value = String(val); P6.fire(input, 'change');
        if(g[main.key]!==val) bad.push('main '+type+' '+g[main.key]+' vs '+val);
      }
      const chip = row.querySelector('button.chip.level');
      chip.click();
      const seg = document.querySelector('.pop .seg');
      const want = goalMust(g) ? 'prefer' : 'must';
      [...seg.querySelectorAll('button')].find(b=>b.textContent===t(want==='must' ? 'lvMust' : 'lvPrefer')).click();
      closePop();
      if(g.lv.level!==want) bad.push('level '+type+' '+g.lv.level);
    }
    const first = S().goals[0], second = S().goals[1];
    mount.host.querySelector('[data-grow="'+first.id+'"]').click();
    if(!mount.host.querySelector('.gm-detail [data-goal="'+first.id+'"]')) bad.push('detail first');
    mount.host.querySelector('[data-grow="'+second.id+'"]').click();
    const detail = mount.host.querySelector('.gm-detail');
    if(detail.hidden || !detail.querySelector('[data-goal="'+second.id+'"]') || detail.querySelector('[data-goal="'+first.id+'"]')) bad.push('detail persists across rows');
    const n0 = S().goals.length;
    const menuBtn = mount.host.querySelector('[data-grow="'+first.id+'"] .icon-btn');
    menuBtn.click(); P6.pick(t('ptDuplicate'));
    if(S().goals.length!==n0+1) bad.push('duplicate');
    const dup = S().goals[S().goals.indexOf(first)+1];
    if(!dup || dup.id===first.id || dup.type!==first.type) bad.push('duplicate content');
    mount.host.querySelector('[data-grow="'+dup.id+'"] .icon-btn').click(); P6.pick(t('del'));
    if(S().goals.length!==n0) bad.push('delete '+S().goals.length);
    const undo = [...document.querySelectorAll('.toast button')].pop();
    if(!undo) bad.push('undo toast'); else undo.click();
    if(S().goals.length!==n0+1 || !S().goals.some(x=>x.id===dup.id)) bad.push('undo delete');
    if(ps.length<2) bad.push('people');
  } finally { closePop(); document.querySelectorAll('.toasts .toast').forEach(n=>n.remove()); if(mount) mount.host.remove(); App.data = keep; App.plan = keepPlan; App.ui.tab = keepTab; }
  return verdict(!bad.length, GOAL_TYPES.length+' types', bad.join(' | '));
});

regress('v4: Goals manager filters by level, off and Failing', ()=>{
  const keep = App.data, keepPlan = App.plan, keepTab = App.ui.tab;
  const bad = [];
  let mount = null;
  try{
    P6.reset();
    const a = newGoal('atLeast'); a.n = 200; a.lv = mkLv('prefer', 5);
    const b = newGoal('cover'); b.lv = mkLv('must', 5);
    const c = newGoal('maxGap'); c.on = false;
    S().goals.push(a, b, c);
    const r = generatePlan({skipSearch:true});
    App.plan = r.plan;
    mount = P6.mount();
    const count = f=>{ mount.host.querySelector('[data-filter="'+f+'"]').click(); return mount.host.querySelectorAll('.gm-row').length; };
    if(count('all')!==3) bad.push('all');
    if(count('off')!==1) bad.push('off '+count('off'));
    if(count('must')!==2) bad.push('must '+count('must'));
    if(count('prefer')!==1) bad.push('prefer '+count('prefer'));
    if(count('fac')!==3) bad.push('fac');
    if(count('people')!==0) bad.push('people');
    const failing = count('failing');
    const failIds = [...mount.host.querySelectorAll('.gm-row')].map(x=>x.dataset.grow);
    if(failing<1 || !failIds.includes(a.id)) bad.push('failing '+failIds.join(','));
  } finally { closePop(); if(mount) mount.host.remove(); App.data = keep; App.plan = keepPlan; App.ui.tab = keepTab; }
  return verdict(!bad.length, 'filters', bad.join(' | '));
});

regress('v4: Goals manager works in the Rules tab, the wide sheet and from the person Rules popover', ()=>{
  const keep = App.data, keepPlan = App.plan, keepTab = App.ui.tab, keepUi = Object.assign({}, App.ui);
  const bad = [];
  try{
    P6.reset();
    const g = newGoal('person'); g.people = [activePeople()[0].id]; S().goals.push(g);
    const g2 = newGoal('cover'); S().goals.push(g2);
    goTab('rules');
    document.querySelectorAll('.rule-sec').forEach(s=>s.paint && s.paint());
    const sec = document.querySelector('#rule-goals');
    if(!sec || !sec.querySelector('.gm') || sec.querySelectorAll('.gm-row').length!==2) bad.push('rules tab');
    openGoals(g2.id);
    const sh = document.querySelector('.sheet.wide');
    if(!sh || !sh.querySelector('.gm-detail [data-goal="'+g2.id+'"]')) bad.push('wide sheet');
    sheet.current.close(true);
    App.ui.teamWide = true; App.ui.teamCols = Object.assign({}, PT_DEFAULTS);
    goTab('team'); renderTab();
    const row = [...document.querySelectorAll('tr.pt-row')].find(r=>r.dataset.pid===g.people[0]);
    row.querySelector('td.pt-c-rules button.chip').click();
    const link = document.querySelector('.pop .goal-row .gl-main');
    if(!link) bad.push('person popover goal row'); else link.click();
    const sh2 = document.querySelector('.sheet.wide');
    if(!sh2 || !sh2.querySelector('.gm-detail [data-goal="'+g.id+'"]')) bad.push('deep link');
  } finally { if(sheet.current) sheet.current.close(true); closePop(); Object.assign(App.ui, keepUi); App.data = keep; App.plan = keepPlan; App.ui.tab = keepTab; }
  return verdict(!bad.length, 'three entry points', bad.join(' | '));
});
