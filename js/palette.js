const PALETTE_KEY = 'alkhitta.palette.v1';
const PAL_GROUPS = ['actions', 'goto', 'find', 'create'];

const Palette = {
  root:null, input:null, list:null, chips:null, items:[], sel:0, filter:'all', prev:null, extra:[],
  register(cmd){ Palette.extra.push(cmd); },
  isOpen(){ return !!Palette.root; }
};

function palStore(){
  try{ const s = JSON.parse(localStorage.getItem(PALETTE_KEY)); if(s && s.counts && Array.isArray(s.recent)) return s; }catch(e){}
  return {counts:{}, recent:[]};
}
function palRemember(id){
  const s = palStore();
  s.counts[id] = (s.counts[id] || 0) + 1;
  s.recent = [id].concat(s.recent.filter(x=>x!==id)).slice(0, 8);
  try{ localStorage.setItem(PALETTE_KEY, JSON.stringify(s)); }catch(e){}
}

function palText(ar, en){ return App.ui.lang==='en' ? en : ar; }

function palCollect(){
  const out = [];
  const add = c=>{ c.hay = norm([c.title, c.alt || '', (c.kw || []).join(' ')].join(' ')); c.nt = norm(c.title); out.push(c); };
  const plan = App.plan;
  const act = (id, ar, en, kw, run, when)=>{ if(!when || when()) add({id:'act:'+id, group:'actions', title:palText(ar, en), alt:palText(en, ar), kw, run}); };
  act('generate', 'توليد الخطة', 'Generate plan', ['regenerate', 'اعادة توليد', 'انشاء خطة'], ()=>{ goTab('plan'); setTimeout(()=>doGenerate(document.getElementById('generate-btn')), 30); });
  act('keep', 'متابعة البحث', 'Keep searching', ['continue', 'استمرار'], ()=>{ goTab('plan'); setTimeout(()=>doGenerate(document.getElementById('generate-btn'), {continueFrom:App.plan}), 30); }, ()=>!!plan);
  act('approve', 'اعتماد الخطة', 'Approve plan', ['approve'], ()=>{ const r = approvePlan(); if(r.ok) toast(t('approved')); else { goTab('plan'); showApprovalBlockers(r.blockers); } }, ()=>!!plan && !plan.approved);
  act('unapprove', 'إلغاء الاعتماد', 'Undo approve', ['unapprove'], ()=>unapprovePlan(), ()=>!!plan && !!plan.approved);
  act('undo', 'تراجع', 'Undo', ['undo edit'], ()=>{ goTab('plan'); stepHistory(-1); }, ()=>!!plan);
  act('redo', 'إعادة', 'Redo', ['redo'], ()=>{ goTab('plan'); stepHistory(1); }, ()=>!!plan);
  act('xlsx', 'تصدير Excel', 'Export XLSX', ['excel', 'download', 'تنزيل'], ()=>exportPlanFile('xlsx'), ()=>!!plan);
  act('csv', 'تصدير CSV', 'Export CSV', ['csv', 'download', 'تنزيل'], ()=>exportPlanFile('csv'), ()=>!!plan);
  act('print', 'طباعة', 'Print', ['print'], ()=>window.print());
  act('theme', 'تبديل المظهر', 'Toggle theme', ['dark', 'light', 'مظلم', 'فاتح'], ()=>setTheme(App.ui.theme==='light' ? 'dark' : (App.ui.theme==='dark' ? 'auto' : 'light')));
  act('lang', 'تبديل اللغة', 'Switch language', ['arabic', 'english', 'عربي', 'انجليزي'], ()=>setLang(App.ui.lang==='ar' ? 'en' : 'ar'));

  for(const tb of TABS) add({id:'go:'+tb.id, group:'goto', title:t(tb.label), alt:I18N[App.ui.lang==='ar' ? 'en' : 'ar'][tb.label] || '', kw:['go', 'open', 'افتح'], run:()=>goTab(tb.id)});
  for(const [v, key] of [['list', 'vList'], ['calendar', 'vCalendar'], ['matrix', 'vMatrix'], ['summary', 'vSummaryView']]){
    add({id:'view:'+v, group:'goto', title:t(key), alt:I18N[App.ui.lang==='ar' ? 'en' : 'ar'][key] || '', kw:['view', 'عرض'], run:()=>{ App.ui.view = v; try{ localStorage.setItem('alkhitta.view', v); }catch(e){} PlanView.swap = true; goTab('plan'); if(typeof renderResults==='function' && App.ui.tab==='plan') renderResults(); }});
  }
  for(const e of buildSettingsIndex()){
    const other = App.ui.lang==='ar' ? e.en : e.ar;
    add({id:'set:'+e.id, group:'goto', title:settingLabel(e), alt:other, kw:[].concat(e.kwAr || [], e.kwEn || []), hint:t('palSetting'), run:()=>goToSetting(e)});
  }
  for(const p of App.data.people) add({id:'person:'+p.id, group:'find', title:p.name || '—', alt:poolName(poolById(p.pool)), kw:[p.title || ''], hint:t('tTitle'), run:()=>{ goTab('team'); setTimeout(()=>{ if(renderTeam.api) renderTeam.api.openPanel(p.id); else openPerson(p.id); }, 30); }});
  for(const f of App.data.facilities) add({id:'fac:'+f.id, group:'find', title:f.name || '—', alt:f.category || '', kw:[], hint:t('tabFacilities'), run:()=>openFacility(f.id)});
  for(const g of S().goals) add({id:'goal:'+g.id, group:'find', title:goalTitle(g), alt:'', kw:['goal', 'rule', 'هدف', 'قاعدة'], hint:t('goalsTitle'), run:()=>openGoals(g.id)});
  for(const o of S().overrides){ const f = facilityById(o.facilityId); if(f) add({id:'fixed:'+o.id, group:'find', title:f.name+' · '+o.date, alt:'', kw:['fixed', 'ثابتة'], hint:t('sFixed'), run:()=>{ goTab('rules'); setTimeout(()=>{ const s = document.getElementById('rule-fixed'); if(s) highlightSetting(s); }, 60); }}); }
  if(plan) for(const v of plan.visits){ const f = facilityById(v.facilityId); if(f) add({id:'visit:'+v.id, group:'find', title:f.name+' · '+v.date, alt:'', kw:['visit', 'زيارة'], hint:t('palVisit'), run:()=>{ goTab('plan'); setTimeout(()=>openVisit(v.id), 30); }}); }

  const mk = (id, ar, en, kw, run)=>add({id:'new:'+id, group:'create', title:palText(ar, en), alt:palText(en, ar), kw, create:true, run});
  mk('special', 'إضافة زيارة خاصة…', 'Add special visit…', ['special', 'زيارة خاصة'], q=>palCreateSpecial(q));
  mk('fixed', 'إضافة زيارة ثابتة…', 'Add fixed visit…', ['fixed', 'ثابتة'], q=>palCreateFixed(q));
  mk('rule', 'إضافة قاعدة بسيطة…', 'Add simple rule…', ['rule', 'never', 'only', 'قاعدة'], q=>{ const g = simpleRuleGoal(); g.on = false; S().goals.push(g); commit('settings'); openGoals(g.id); });
  mk('person', 'إضافة فرد', 'Add person', ['person', 'staff', 'فرد', 'موظف'], ()=>{ goTab('team'); const p = freshPerson({name:'', pool:S().pools[0].id}); openPerson(null, p, ()=>{ if(renderTeam.api) renderTeam.api.paintTable(); }); });
  mk('facility', 'إضافة جهة', 'Add facility', ['facility', 'جهة'], ()=>{ goTab('facilities'); addFacility(); });
  for(const c of Palette.extra) add(Object.assign({}, c, {title:c.title[App.ui.lang] || c.title.en, alt:c.title[App.ui.lang==='ar' ? 'en' : 'ar'] || '', kw:((c.keywords || {})[App.ui.lang] || [])}));
  return out;
}

function palFacilityIn(q){
  const nq = norm(q);
  let best = null;
  for(const f of schedulableFacilities()){
    const n = norm(f.name || '');
    if(n && nq.includes(n) && (!best || n.length>norm(best.name).length)) best = f;
  }
  return best;
}
function palDateIn(q){
  const s = toAsciiDigits(q || '');
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if(m) return m[1];
  const d = s.match(/\b(\d{1,2})[\/-](\d{1,2})\b/);
  if(d){ const y = new Date(todayISO()).getFullYear(); return y+'-'+String(d[2]).padStart(2, '0')+'-'+String(d[1]).padStart(2, '0'); }
  return null;
}
function palCreateSpecial(q){
  const g = newGoal('special');
  const f = palFacilityIn(q), d = palDateIn(q);
  if(f) g.facilityId = f.id;
  if(d){ g.from = d; g.to = d; }
  g.on = false;
  S().goals.push(g);
  commit('settings');
  openGoals(g.id);
  toast(t('palReview'));
}
function palCreateFixed(q){
  const f = palFacilityIn(q), d = palDateIn(q);
  const o = newOverride({date:d || todayISO(), facilityId:f ? f.id : null});
  o.on = false;
  S().overrides.push(o);
  commit('settings');
  goTab('rules');
  setTimeout(()=>{ const s = document.getElementById('rule-fixed'); if(s) highlightSetting(s); }, 60);
  toast(t('palReview'));
}

function palMatch(items, q){
  const nq = norm(q);
  const store = palStore();
  const boost = c=>Math.min(3, store.counts[c.id] || 0)*0.15 + (store.recent.includes(c.id) ? 0.2 : 0);
  if(!nq){
    const byId = new Map(items.map(c=>[c.id, c]));
    const rec = store.recent.map(id=>byId.get(id)).filter(Boolean);
    const freq = Object.keys(store.counts).sort((a, b)=>store.counts[b]-store.counts[a]).map(id=>byId.get(id)).filter(c=>c && !rec.includes(c));
    const base = items.filter(c=>c.group==='actions' && !rec.includes(c) && !freq.includes(c));
    return rec.concat(freq, base).slice(0, 12);
  }
  const words = nq.split(' ').filter(Boolean);
  const out = [];
  for(const c of items){
    if(c.create){
      let lead = 0;
      while(lead<words.length && c.hay.includes(words[lead])) lead++;
      if(lead>=1 && lead<words.length) out.push({c, s:3.5-lead-boost(c)});
      if(lead>=1 && lead===words.length) out.push({c, s:(c.nt.startsWith(nq) ? 0.4 : 1)-boost(c)});
      continue;
    }
    if(!words.every(w=>c.hay.includes(w))) continue;
    let s = 3;
    if(c.nt===nq) s = 0;
    else if(c.nt.startsWith(nq)) s = 0.5;
    else if(words.every(w=>c.nt.split(' ').some(x=>x.startsWith(w)))) s = 1;
    else if(words.every(w=>c.nt.includes(w))) s = 2;
    out.push({c, s:s-boost(c)});
  }
  out.sort((a, b)=>a.s-b.s || a.c.title.localeCompare(b.c.title));
  return out.map(x=>x.c).slice(0, 40);
}

function palGroupLabel(g){ return t('palG_'+g); }

function palRender(){
  const q = Palette.input.value;
  const items = palCollect();
  Palette.all = items;
  let list = palMatch(items, q);
  if(Palette.filter!=='all') list = list.filter(c=>c.group===Palette.filter);
  if(Palette.filter==='create' && !list.length) list = items.filter(c=>c.group==='create');
  Palette.items = list;
  Palette.sel = Math.min(Palette.sel, Math.max(0, list.length-1));
  clear(Palette.list);
  if(!list.length) Palette.list.appendChild(el('div', {class:'pal-empty'}, t('palNone')));
  let last = null;
  list.forEach((c, i)=>{
    if(c.group!==last){ last = c.group; Palette.list.appendChild(el('div', {class:'pal-head', role:'presentation'}, palGroupLabel(c.group))); }
    const row = el('div', {class:'pal-item'+(i===Palette.sel ? ' on' : ''), role:'option', id:'pal-opt-'+i, 'aria-selected':i===Palette.sel ? 'true' : 'false', 'data-cmd':c.id, onmousemove:()=>{ if(Palette.sel!==i){ Palette.sel = i; palPaintSel(); } }, onclick:()=>palRun(c)}, [el('b', null, c.title), c.hint ? el('span', {class:'muted'}, c.hint) : (c.alt ? el('span', {class:'muted'}, c.alt) : null)]);
    Palette.list.appendChild(row);
  });
  Palette.input.setAttribute('aria-activedescendant', list.length ? 'pal-opt-'+Palette.sel : '');
  Palette.input.setAttribute('aria-expanded', list.length ? 'true' : 'false');
  for(const b of Palette.chips.children) b.classList.toggle('on', b.dataset.group===Palette.filter);
}

function palPaintSel(){
  [...Palette.list.querySelectorAll('.pal-item')].forEach((r, i)=>{ r.classList.toggle('on', i===Palette.sel); r.setAttribute('aria-selected', i===Palette.sel ? 'true' : 'false'); });
  Palette.input.setAttribute('aria-activedescendant', Palette.items.length ? 'pal-opt-'+Palette.sel : '');
  const cur = Palette.list.querySelector('.pal-item.on'); if(cur) cur.scrollIntoView({block:'nearest'});
}

function palRun(c){
  const q = Palette.input ? Palette.input.value : '';
  palRemember(c.id);
  palClose(true);
  try{ c.run(q); }catch(e){ console.error(e); toast(t('palFailed')); }
}

function palClose(skipFocus){
  if(!Palette.root) return;
  Palette.root.remove();
  Palette.root = null;
  document.body.classList.remove('pal-open');
  const back = Palette.prev;
  Palette.prev = null;
  if(!skipFocus && back && back.isConnected && back.focus) back.focus({preventScroll:true});
}

function palOpen(prefill){
  if(Palette.root){ Palette.input.focus(); return; }
  Palette.prev = document.activeElement;
  Palette.filter = 'all';
  Palette.sel = 0;
  const input = el('input', {class:'input pal-input', type:'text', role:'combobox', 'aria-expanded':'true', 'aria-controls':'pal-list', 'aria-autocomplete':'list', 'aria-activedescendant':'', 'aria-label':t('palPlaceholder'), placeholder:t('palPlaceholder'), autocomplete:'off', spellcheck:'false'});
  const list = el('div', {class:'pal-list', id:'pal-list', role:'listbox', 'aria-label':t('palTitle')});
  const chips = el('div', {class:'pal-chips'}, [['all', t('palG_all')]].concat(PAL_GROUPS.map(g=>[g, palGroupLabel(g)])).map(([g, label])=>el('button', {type:'button', class:'chip sm', 'data-group':g, tabindex:'-1', onclick:()=>{ Palette.filter = g; Palette.sel = 0; palRender(); input.focus(); }}, label)));
  const box = el('div', {class:'palette', role:'dialog', 'aria-modal':'true', 'aria-label':t('palTitle')}, [input, chips, list]);
  const back = el('div', {class:'pal-backdrop', onmousedown:e=>{ if(e.target===back) palClose(); }}, [box]);
  Palette.root = back; Palette.input = input; Palette.list = list; Palette.chips = chips;
  document.body.appendChild(back);
  document.body.classList.add('pal-open');
  input.addEventListener('input', ()=>{ Palette.sel = 0; palRender(); });
  input.addEventListener('keydown', e=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); if(Palette.items.length){ Palette.sel = (Palette.sel+1) % Palette.items.length; palPaintSel(); } }
    else if(e.key==='ArrowUp'){ e.preventDefault(); if(Palette.items.length){ Palette.sel = (Palette.sel-1+Palette.items.length) % Palette.items.length; palPaintSel(); } }
    else if(e.key==='Enter'){ e.preventDefault(); const c = Palette.items[Palette.sel]; if(c) palRun(c); }
    else if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); palClose(); }
    else if(e.key==='Tab'){ e.preventDefault(); const order = ['all'].concat(PAL_GROUPS); const i = order.indexOf(Palette.filter); Palette.filter = order[(i+(e.shiftKey ? -1 : 1)+order.length) % order.length]; Palette.sel = 0; palRender(); }
  });
  if(prefill) input.value = prefill;
  palRender();
  input.focus();
}

document.addEventListener('keydown', e=>{
  if((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase()==='k'){ e.preventDefault(); if(Palette.root) palClose(); else palOpen(); return; }
  if(Palette.root || e.key!=='/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
  if(App.ui.tab==='team') return;
  const a = document.activeElement;
  if(a && (a.tagName==='INPUT' || a.tagName==='TEXTAREA' || a.tagName==='SELECT' || a.isContentEditable)) return;
  e.preventDefault();
  palOpen();
});
