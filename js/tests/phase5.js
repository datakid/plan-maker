const P5 = {
  open(extra){
    App.data = normalizeData(JSON.parse(SEED_JSON));
    App.plan = null;
    App.ui.teamSel = new Set();
    App.ui.teamPanel = null;
    App.ui.teamSearch = '';
    App.ui.teamPoolFilter = [];
    App.ui.teamShowRetired = false;
    App.ui.teamWide = true;
    App.ui.teamCols = Object.assign({}, PT_DEFAULTS, extra || {});
    goTab('team');
    renderTab();
  },
  rows(){ return [...document.querySelectorAll('tr.pt-row')]; },
  fire(node, type){ node.dispatchEvent(new Event(type, {bubbles:true})); },
  setInput(input, value){ input.value = String(value); P5.fire(input, 'change'); },
  pick(text){
    const item = [...document.querySelectorAll('.pop .menu-item')].find(b=>b.textContent.includes(text));
    if(!item) return false;
    item.click();
    return true;
  }
};

regress('v4: People table edits name, pool, skill, per plan and max run inline for three people without a sheet', ()=>{
  const keepUi = Object.assign({}, App.ui), keepData = App.data, keepPlan = App.plan, keepTab = App.ui.tab;
  const bad = [];
  try{
    P5.open({limits:true});
    const rows = P5.rows().slice(0, 3);
    const ids = rows.map(r=>r.dataset.pid);
    const pools = S().pools;
    rows.forEach((row, i)=>{
      const p = personById(ids[i]);
      P5.setInput(row.querySelector('input.pt-name'), 'اسم '+i);
      if(p.name!=='اسم '+i) bad.push('name '+i);
      const skill = row.querySelectorAll('td.pt-c-skill input[type=text]')[0];
      P5.setInput(skill, 65);
      if(p.skill.basic!==65) bad.push('skill '+i+' '+p.skill.basic);
      const quotaChip = row.querySelector('td.pt-c-quota button.chip');
      quotaChip.click();
      const seg = document.querySelector('.pop .seg');
      const exact = [...seg.querySelectorAll('button')].find(b=>b.textContent===t('pQExact'));
      exact.click();
      const qInput = document.querySelector('.pop .input-group input[type=text]');
      P5.setInput(qInput, 3);
      if(!(p.quota.min===3 && p.quota.max===3)) bad.push('quota '+i+' '+JSON.stringify(p.quota));
      closePop();
      const run = row.querySelectorAll('td.pt-c-num')[1].querySelector('input[type=text]');
      P5.setInput(run, 2);
      if(p.maxRun!==2) bad.push('maxRun '+i);
      const chip = row.querySelectorAll('td.pt-c-num')[1].querySelector('button.chip.level');
      chip.click();
      const pop = document.querySelector('.pop');
      pop.querySelector('.seg').querySelectorAll('button')[1].click();
      closePop();
      if(personLvOf(p).maxRun.level!=='prefer') bad.push('maxRun level '+i);
    });
    const poolRow = P5.rows()[0];
    const first = personById(poolRow.dataset.pid);
    const other = pools.find(x=>x.id!==first.pool);
    poolRow.querySelector('td.pt-c-pool button.select').click();
    if(!P5.pick(poolName(other))) bad.push('pool menu');
    if(first.pool!==other.id) bad.push('pool '+first.pool);
    if(sheet.current) bad.push('a sheet opened');
  } finally { closePop(); Object.assign(App.ui, keepUi); App.data = keepData; App.plan = keepPlan; App.ui.tab = keepTab; }
  return verdict(!bad.length, 'inline edits saved', bad.join(' | '));
});

regress('v4: the docked panel stays open while switching rows by click and by keyboard', ()=>{
  const keepUi = Object.assign({}, App.ui), keepData = App.data, keepPlan = App.plan, keepTab = App.ui.tab;
  const bad = [];
  try{
    P5.open();
    const rows = P5.rows();
    const panel = ()=>document.querySelector('.pt-panel');
    rows[0].querySelector('td.pt-c-load').click();
    if(!panel() || panel().hidden || App.ui.teamPanel!==rows[0].dataset.pid) bad.push('open by click');
    P5.rows()[2].querySelector('td.pt-c-load').click();
    if(panel().hidden || App.ui.teamPanel!==rows[2].dataset.pid) bad.push('switch by click '+App.ui.teamPanel);
    if(!panel().querySelector('.pt-panel-head h2') || panel().querySelector('.pt-panel-head h2').textContent!==personById(rows[2].dataset.pid).name) bad.push('panel title');
    const r2 = P5.rows()[2];
    r2.focus();
    r2.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true}));
    if(panel().hidden || App.ui.teamPanel!==P5.rows()[3].dataset.pid) bad.push('switch by keyboard down '+App.ui.teamPanel);
    P5.rows()[3].dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowUp', bubbles:true}));
    if(panel().hidden || App.ui.teamPanel!==P5.rows()[2].dataset.pid) bad.push('switch by keyboard up');
    panel().querySelector('.pt-next').click();
    if(App.ui.teamPanel!==P5.rows()[3].dataset.pid) bad.push('next arrow');
    panel().querySelector('.pt-prev').click();
    if(App.ui.teamPanel!==P5.rows()[2].dataset.pid) bad.push('prev arrow');
    if(!panel().querySelector('.sheet-sec')) bad.push('editor body');
    if(sheet.current) bad.push('modal sheet opened');
  } finally { closePop(); Object.assign(App.ui, keepUi); App.data = keepData; App.plan = keepPlan; App.ui.tab = keepTab; }
  return verdict(!bad.length, 'panel persists', bad.join(' | '));
});

regress('v4: bulk edit of two people applies and undoes', ()=>{
  const keepUi = Object.assign({}, App.ui), keepData = App.data, keepPlan = App.plan, keepTab = App.ui.tab;
  const bad = [];
  try{
    P5.open();
    const rows = P5.rows();
    const a = personById(rows[0].dataset.pid), b = personById(rows[1].dataset.pid);
    const beforeA = a.pool, beforeB = b.pool;
    for(const r of rows.slice(0, 2)){ const cb = r.querySelector('td.pt-c-sel input'); cb.checked = true; P5.fire(cb, 'change'); }
    const bar = document.querySelector('.pt-bulk');
    if(bar.hidden || App.ui.teamSel.size!==2) bad.push('bulk bar');
    const other = S().pools.find(x=>x.id!==beforeA);
    const setPool = [...bar.querySelectorAll('button')].find(x=>x.textContent===t('ptSetPool'));
    setPool.click();
    if(!P5.pick(poolName(other))) bad.push('pool menu');
    if(a.pool!==other.id || b.pool!==other.id) bad.push('bulk applied '+a.pool+' '+b.pool);
    const undo = [...document.querySelectorAll('.toast button')].pop();
    if(!undo) bad.push('undo toast'); else undo.click();
    const a2 = personById(rows[0].dataset.pid), b2 = personById(rows[1].dataset.pid);
    if(a2.pool!==beforeA || b2.pool!==beforeB) bad.push('undo restored '+a2.pool+' '+b2.pool);
  } finally { closePop(); document.querySelectorAll('.toasts .toast').forEach(n=>n.remove()); Object.assign(App.ui, keepUi); App.data = keepData; App.plan = keepPlan; App.ui.tab = keepTab; }
  return verdict(!bad.length, 'bulk and undo', bad.join(' | '));
});

regress('v4: People table works at narrow width and in Arabic and English', ()=>{
  const keepUi = Object.assign({}, App.ui), keepData = App.data, keepPlan = App.plan, keepTab = App.ui.tab;
  const bad = [];
  try{
    for(const lang of ['ar', 'en']){
      App.ui.lang = lang;
      document.documentElement.dir = lang==='ar' ? 'rtl' : 'ltr';
      P5.open();
      const head = document.querySelector('table.pt th.pt-c-name');
      if(!head || head.textContent!==t('ptName')) bad.push(lang+' header');
      if(getComputedStyle(document.querySelector('.pt-wrap')).overflowX!=='auto') bad.push(lang+' wrap overflow');
      App.ui.teamWide = false;
      const r = P5.rows()[0];
      r.querySelector('td.pt-c-load').click();
      if(!sheet.current) bad.push(lang+' narrow sheet');
      else { const arrows = document.querySelectorAll('.sheet-head .icon-btn'); if(arrows.length<3) bad.push(lang+' sheet arrows '+arrows.length); sheet.current.close(true); }
      App.ui.teamWide = true;
    }
  } finally { if(sheet.current) sheet.current.close(true); closePop(); Object.assign(App.ui, keepUi); document.documentElement.dir = keepUi.lang==='ar' ? 'rtl' : 'ltr'; App.data = keepData; App.plan = keepPlan; App.ui.tab = keepTab; }
  return verdict(!bad.length, 'ar and en', bad.join(' | '));
});

P5.check = function(fn){
  const ui = Object.assign({}, App.ui), data = App.data, plan = App.plan;
  const dir = document.documentElement.dir;
  try{ P5.open(); fn(); return verdict(true, 'verified'); }
  finally {
    closePop();
    if(sheet.current) sheet.current.close(true);
    if(renderTeam.api) renderTeam.api.closePanel();
    Object.assign(App.ui, ui);
    App.data = data;
    App.plan = plan;
    document.documentElement.dir = dir;
  }
};
P5.assert = function(value, message){ if(!value) throw new Error(message); };
P5.button = function(scope, text){
  const b = [...document.querySelectorAll(scope+' button')].find(n=>n.textContent===text);
  P5.assert(b, 'missing button: '+text);
  return b;
};

regress('team: availability popover re-renders on mode change', ()=>P5.check(()=>{
  const row = P5.rows()[0], p = personById(row.dataset.pid);
  p.avail.mode = 'plan';
  renderTeam.api.refreshRow(p);
  const chip = P5.rows()[0].querySelector('.pt-c-avail .chip');
  chip.click();
  P5.button('.pop .seg', t('pAvailWeekdays')).click();
  P5.assert(document.querySelector('.pop .dayset'), 'weekday picker missing');
  const before = chip.textContent, days = p.avail.weekdays.slice();
  document.querySelectorAll('.pop .dayset button')[3].click();
  P5.assert(chip.textContent!==before && JSON.stringify(days)!==JSON.stringify(p.avail.weekdays), 'weekday edit not reflected');
  P5.assert(chip.isConnected, 'popover anchor was replaced');
  P5.button('.pop .seg', t('pAvailCycle')).click();
  P5.assert(document.querySelectorAll('.pop .grid-2 .input-group').length>=2, 'cycle steppers missing');
  closePop();
  const updated = P5.rows().find(r=>r.dataset.pid===p.id);
  P5.assert(updated!==row && updated.querySelector('.pt-c-avail .chip').textContent===availSummary(p), 'deferred row refresh missing');
}));

regress('team: off-days popover clear works from table', ()=>P5.check(()=>{
  const row = P5.rows()[0], p = personById(row.dataset.pid);
  p.off = [];
  renderTeam.api.refreshRow(p);
  const chip = P5.rows()[0].querySelector('.pt-c-off .chip');
  chip.click();
  const day = document.querySelector('.pop .mini-cal .mc-day.today');
  P5.assert(day, 'today missing from calendar');
  day.click();
  P5.assert(p.off.length===1 && chip.textContent==='1', 'off day not added');
  const clear = P5.button('.pop', t('pOffClear'));
  P5.assert(!clear.hidden, 'clear hidden after first addition');
  clear.click();
  P5.assert(p.off.length===0 && chip.textContent==='0', 'clear did not reset model and count');
  P5.assert(!document.querySelector('.pop .mc-day.sel, .pop .chips .chip'), 'stale selected days or chips');
}));

regress('team: panel edits repaint the row', ()=>P5.check(()=>{
  const id = P5.rows()[0].dataset.pid, p = personById(id);
  p.avail.mode = 'plan';
  renderTeam.api.openPanel(id);
  P5.button('.pt-panel .seg', t('pAvailWeekdays')).click();
  const row = P5.rows().find(r=>r.dataset.pid===id);
  P5.assert(row.querySelector('.pt-c-avail .chip').textContent===availSummary(p), 'availability cell stale');
  P5.assert(row.classList.contains('open'), 'open row marker lost');
}));

regress('team: drawer is docked to the viewport edge', ()=>P5.check(()=>{
  const id = P5.rows()[0].dataset.pid;
  renderTeam.api.openPanel(id);
  const panel = document.querySelector('.pt-panel');
  P5.assert(panel.parentElement.classList.contains('pt-layout'), 'drawer parent changed');
  for(const dir of ['ltr', 'rtl']){
    document.documentElement.dir = dir;
    const r = panel.getBoundingClientRect();
    P5.assert(getComputedStyle(panel).position==='fixed', 'drawer not fixed');
    const viewport = document.documentElement.getBoundingClientRect();
    P5.assert(Math.abs(dir==='rtl' ? r.left-viewport.left : r.right-viewport.right)<=1, 'drawer not flush in '+dir);
  }
}));

regress('team: table header is sticky inside the wrap', ()=>P5.check(()=>{
  const wrap = document.querySelector('.pt-wrap');
  wrap.style.height = '140px';
  wrap.scrollTop = 100;
  P5.assert(wrap.scrollTop>0, 'wrap did not scroll');
  const th = wrap.querySelector('th');
  P5.assert(getComputedStyle(th).position==='sticky', 'header not sticky');
  P5.assert(Math.abs(th.getBoundingClientRect().top-wrap.getBoundingClientRect().top)<=1, 'header scrolled out of wrap');
}));
