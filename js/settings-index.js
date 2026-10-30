const SETTINGS_EXTRA = [
  {id:'cal.workdays', section:'rule-calendar', label:'sWorkdays', path:'calendar.workdays', kw:{ar:['ايام العمل', 'اجازة', 'عطلة'], en:['workdays', 'weekend', 'days off']}},
  {id:'cal.holidays', section:'rule-calendar', label:'holidays', path:'calendar.holidays', kw:{ar:['اجازات', 'اعياد'], en:['holiday', 'vacation']}},
  {id:'cal.extra', section:'rule-calendar', label:'extraDays', path:'calendar.extra', kw:{ar:['يوم اضافي'], en:['extra working day']}},
  {id:'vol.mode', section:'rule-volume', label:'sVisits', path:'volume.mode', kw:{ar:['عدد الزيارات', 'حجم'], en:['volume', 'how many visits', 'total visits']}},
  {id:'vol.fill', section:'rule-volume', label:'vFillMode', hint:'vFillModeHint', path:'volume.fill', kw:{ar:['اهدافي فقط', 'تعبئة'], en:['goals only', 'filler', 'fill']}},
  {id:'vol.perDay', section:'rule-volume', label:'vPerDay', path:'volume.perDay', kw:{ar:['في اليوم', 'سعة اليوم'], en:['per day', 'daily limit', 'cap']}},
  {id:'vol.minPerDay', section:'rule-volume', label:'vMinPerDay', hint:'vMinPerDayHint', path:'volume.minPerDay', kw:{ar:['حد ادنى'], en:['minimum per day']}},
  {id:'vol.requestsExceedCap', section:'rule-volume', label:'vRequestsOver', hint:'vRequestsOverHint', path:'volume.requestsExceedCap', kw:{ar:['ثابتة', 'خاصة', 'تتجاوز'], en:['fixed visit', 'special', 'exceed', 'over the limit']}},
  {id:'vol.useAllDays', section:'rule-volume', label:'vUseAll', hint:'vUseAllHint', path:'volume.useAllDays', kw:{ar:['كل الايام'], en:['every day', 'use all days']}},
  {id:'vol.dup', section:'rule-volume', label:'dupPolicy', hint:'dupHint', path:'duplicates', kw:{ar:['تكرار', 'دمج'], en:['duplicate', 'merge']}},
  {id:'vol.spacing', section:'rule-volume', label:'rSpacing', path:'spacing', kw:{ar:['تباعد'], en:['spacing', 'gap between visits']}},
  {id:'backup', tab:'data', section:'data', label:'bkTitle', kw:{ar:['نسخة احتياطية', 'تصدير', 'استعادة'], en:['backup', 'export', 'restore', 'import']}}
];

const SETTINGS_SYN = {
  'vol.week':{ar:['اسبوع', 'اسبوعي'], en:['weekly', 'per week']},
  'vol.exact':{ar:['عدد محدد'], en:['exact count']},
  'vol.share':{ar:['نسبة'], en:['percent', 'share']},
  'due.priority':{ar:['تاخر', 'اولوية'], en:['overdue', 'priority']},
  'fair.load':{ar:['عدالة', 'توزيع الحمل'], en:['fairness', 'load balance']},
  'rotate':{ar:['تدوير', 'تناوب'], en:['rotation', 'rotate']},
  'senior':{ar:['اقدمية', 'خبرة'], en:['seniority', 'experience']},
  'p.quota':{ar:['حصة'], en:['quota']},
  'p.avail':{ar:['توفر', 'اجازة'], en:['availability', 'days off']},
  'goal.special':{ar:['زيارة خاصة'], en:['special visit']},
  'goal.cover':{ar:['تغطية'], en:['coverage', 'cover']}
};

const SETTING_TAB_OF_GROUP = group=>group==='team' ? 'team' : 'rules';
const SETTING_PERSON_TAB = {'p.quota':'rules', 'p.spread':'rules', 'p.rest':'avail', 'p.avail':'avail', 'p.maxRun':'avail', 'p.maxWeek':'avail', 'p.blocked':'avail', 'p.dist':'profile'};

function settingText(key, lang){
  const v = I18N[lang] && I18N[lang][key];
  return typeof v==='string' ? v : '';
}

let SETTINGS_INDEX_CACHE = null;
function buildSettingsIndex(){
  if(SETTINGS_INDEX_CACHE) return SETTINGS_INDEX_CACHE;
  const out = [];
  for(const r of RULES){
    const syn = SETTINGS_SYN[r.id] || {ar:[], en:[]};
    out.push({id:r.id, kind:'rule', tab:SETTING_TAB_OF_GROUP(r.group), section:r.group, label:r.name, hint:null, ar:settingText(r.name, 'ar'), en:settingText(r.name, 'en'), kwAr:syn.ar, kwEn:syn.en});
  }
  for(const e of SETTINGS_EXTRA){
    const kw = e.kw || {ar:[], en:[]};
    out.push({id:e.id, kind:'setting', tab:e.tab || 'rules', section:e.section, label:e.label, hint:e.hint || null, path:e.path || null, ar:settingText(e.label, 'ar'), en:settingText(e.label, 'en'), hintAr:e.hint ? settingText(e.hint, 'ar') : '', hintEn:e.hint ? settingText(e.hint, 'en') : '', kwAr:kw.ar, kwEn:kw.en});
  }
  for(const e of out) e.hay = norm([e.ar, e.en, e.hintAr, e.hintEn, e.id].concat(e.kwAr || [], e.kwEn || []).filter(Boolean).join(' '));
  SETTINGS_INDEX_CACHE = out;
  return out;
}

function settingLink(id){
  const e = buildSettingsIndex().find(x=>x.id===id);
  return e ? '#'+e.tab+'/'+e.id : null;
}

function searchSettings(q, limit){
  const nq = norm(q);
  if(!nq) return [];
  const words = nq.split(' ').filter(Boolean);
  const scored = [];
  for(const e of buildSettingsIndex()){
    if(!words.every(w=>e.hay.includes(w))) continue;
    const name = norm(e.ar)+' '+norm(e.en);
    let s = 2;
    if(name.includes(nq)) s = 0;
    else if(words.every(w=>name.includes(w))) s = 1;
    scored.push({e, s});
  }
  scored.sort((a, b)=>a.s-b.s);
  return scored.slice(0, limit || 8).map(x=>x.e);
}

function settingLabel(e){ return t(e.label); }

function settingAnchor(e){
  const scope = e.kind==='rule' && e.tab==='team' ? document.querySelector('.pt-panel:not([hidden]), .sheet') : (document.getElementById(e.section) || (e.tab==='data' ? document.getElementById('view') || document.body : null));
  if(!scope) return null;
  if(e.kind==='rule'){
    const rs = ruleSpec(e.id);
    const chip = [...scope.querySelectorAll('button.chip.level')].find(c=>(c.getAttribute('aria-label') || '').endsWith(' · '+t(rs.name)));
    return chip ? (chip.closest('.setting') || chip) : (scope.querySelector('.card-head') || scope);
  }
  return [...scope.querySelectorAll('.setting, .card-head, .section-title, h2')].find(r=>{ const b = r.matches('h2, .section-title') ? r : r.querySelector('.lbl b, h2'); return b && b.textContent.trim()===t(e.label); }) || scope;
}

function highlightSetting(node){
  if(!node) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  node.scrollIntoView({block:'center', behavior:reduce ? 'auto' : 'smooth'});
  node.classList.add('setting-hl');
  setTimeout(()=>node.classList.remove('setting-hl'), 2000);
}

function goToSetting(e, opts){
  opts = opts || {};
  if(e.tab==='team'){
    goTab('team');
    setTimeout(()=>{
      const ids = renderTeam.api ? renderTeam.api.orderIds() : [];
      if(!ids.length) return;
      App.ui.personTab = SETTING_PERSON_TAB[e.id] || 'profile';
      renderTeam.api.closePanel();
      renderTeam.api.openPanel(ids[0]);
      setTimeout(()=>highlightSetting(settingAnchor(e)), 60);
    }, 30);
  } else if(e.tab==='data'){
    goTab('data');
    setTimeout(()=>highlightSetting(settingAnchor(e)), 60);
  } else {
    if(App.ui.tab!=='rules') goTab('rules');
    const sec0 = document.getElementById(e.section);
    if(sec0 && sec0.hasAttribute('data-adv') && App.ui.rulesMode==='simple'){ App.ui.rulesMode = 'advanced'; renderTab(); }
    const search = document.getElementById('rules-search');
    if(search && search.value){ search.value = ''; search.dispatchEvent(new Event('input')); }
    setTimeout(()=>highlightSetting(settingAnchor(e)), 60);
  }
  if(!opts.noHash) history.replaceState(null, '', '#'+e.tab+'/'+e.id);
}

function applyDeepLink(hash){
  const parts = (hash || '').replace(/^#/, '').split('/');
  if(parts.length<2) return false;
  const e = buildSettingsIndex().find(x=>x.tab===parts[0] && x.id===parts.slice(1).join('/'));
  if(!e) return false;
  goToSetting(e, {noHash:true});
  return true;
}

function settingChanged(e){
  if(e.kind==='rule'){
    const r = ruleSpec(e.id);
    if(!r) return false;
    const cur = lvOf(e.id);
    return cur.level!==r.def.level || cur.w!==r.def.w;
  }
  if(!e.path) return false;
  const get = (o, p)=>p.split('.').reduce((a, k)=>a==null ? a : a[k], o);
  return JSON.stringify(get(S(), e.path))!==JSON.stringify(get(defaultSettings(), e.path));
}

function changedSections(){
  const out = new Set();
  for(const e of buildSettingsIndex()) if(e.tab==='rules' && settingChanged(e)) out.add(e.section);
  return out;
}
