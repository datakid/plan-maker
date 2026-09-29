const TABS = [
  {id:'plan', label:'tabPlan', icon:ICON.cal, render:renderPlan},
  {id:'facilities', label:'tabFacilities', icon:ICON.building, render:renderFacilities},
  {id:'team', label:'tabTeam', icon:ICON.users, render:renderTeam},
  {id:'rules', label:'tabRules', icon:ICON.rules, render:renderRules},
  {id:'data', label:'tabData', icon:ICON.gear, render:renderData}
];
const tabScroll = {};

function applyTheme(){
  const th = App.ui.theme;
  if(th==='light' || th==='dark') document.documentElement.setAttribute('data-theme', th);
  else document.documentElement.removeAttribute('data-theme');
  let m = document.querySelector('meta[name="theme-color"]');
  if(!m){ m = el('meta', {name:'theme-color'}); document.head.appendChild(m); }
  m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F6F2F5';
}
function setTheme(v){ App.ui.theme = v; localStorage.setItem('alkhitta.theme', v); applyTheme(); renderTopbar(); if(App.ui.tab==='data') renderTab(); }
function setLang(v){
  App.ui.lang = v; localStorage.setItem('alkhitta.lang', v);
  document.documentElement.lang = v; document.documentElement.dir = v==='ar' ? 'rtl' : 'ltr';
  document.title = t('appName');
  closePop(); if(sheet.current) sheet.current.close(true);
  renderTopbar(); renderTab();
}

function renderTopbar(){
  const root = document.getElementById('topbar');
  clear(root);
  const tabs = el('nav', {class:'tabs', role:'tablist', 'aria-label':t('appName')});
  TABS.forEach((tb, i)=>{
    const sel = App.ui.tab===tb.id;
    let badge = null;
    if(tb.id==='data' && App.data.unresolved.length) badge = el('span', {class:'badge'}, String(App.data.unresolved.length));
    const b = el('button', {type:'button', class:'tab', role:'tab', id:'tab-'+tb.id, 'aria-selected':sel?'true':'false', tabindex:sel?'0':'-1', onclick:()=>goTab(tb.id)}, [el('span', {html:tb.icon, style:{display:'flex'}}), el('span', {class:'tl'}, t(tb.label)), badge]);
    b.addEventListener('keydown', e=>{
      if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
      e.preventDefault();
      const rtl = document.documentElement.dir==='rtl';
      const dir = (e.key==='ArrowRight') !== rtl ? 1 : -1;
      const nx = TABS[(i+dir+TABS.length)%TABS.length].id;
      goTab(nx); const nb = document.getElementById('tab-'+nx); if(nb) nb.focus();
    });
    tabs.appendChild(b);
  });
  const thIcon = App.ui.theme==='dark' ? ICON.moon : (App.ui.theme==='light' ? ICON.sun : ICON.auto);
  const nextTheme = App.ui.theme==='light' ? 'dark' : (App.ui.theme==='dark' ? 'auto' : 'light');
  root.appendChild(el('div', {class:'topbar-inner'}, [
    el('div', {class:'brand'}, [el('span', {class:'brand-mark', html:WORDMARK}), el('span', {class:'brand-name'}, t('appName'))]),
    tabs,
    el('div', {class:'top-actions'}, [
      el('button', {type:'button', class:'icon-btn', 'aria-label':t('themeToggle'), title:t('themeToggle'), html:thIcon, onclick:()=>setTheme(nextTheme)}),
      el('button', {type:'button', class:'icon-btn lang-btn', 'aria-label':t('language'), title:t('langToggle'), onclick:()=>setLang(App.ui.lang==='ar'?'en':'ar')}, [el('span', {class:'lang-long'}, t('langToggle')), el('span', {class:'lang-short'}, App.ui.lang==='ar'?'EN':'ع')])
    ])
  ]));
}

function goTab(id, jump){
  if(!TABS.some(x=>x.id===id)) id = 'plan';
  closePop(); if(sheet.current) sheet.current.close(true);
  tabScroll[App.ui.tab] = window.scrollY;
  App.ui.tab = id;
  if(jump) App.ui.jump = jump;
  history.replaceState(null, '', '#'+id);
  renderTopbar(); renderTab();
  window.scrollTo(0, jump ? 0 : (tabScroll[id]||0));
}
function renderTab(){
  const root = document.getElementById('page');
  const y = window.scrollY;
  clear(root);
  const old = document.getElementById('plan-actionbar'); if(old) old.remove();
  root.className = 'page stack';
  PlanView.strip = null; PlanView.results = null;
  const tb = TABS.find(x=>x.id===App.ui.tab) || TABS[0];
  tb.render(root);
  window.scrollTo(0, y);
}

function boot(){
  const lang = localStorage.getItem('alkhitta.lang'); App.ui.lang = lang==='en' ? 'en' : 'ar';
  const th = localStorage.getItem('alkhitta.theme'); App.ui.theme = (th==='light'||th==='dark') ? th : 'auto';
  const v = localStorage.getItem('alkhitta.view'); if(['list','calendar','matrix','summary'].includes(v)) App.ui.view = v;
  const h = (location.hash||'').slice(1); if(TABS.some(x=>x.id===h)) App.ui.tab = h;
  document.documentElement.lang = App.ui.lang; document.documentElement.dir = App.ui.lang==='ar' ? 'rtl' : 'ltr';
  document.title = t('appName');
  loadAll();
  applyTheme();
  renderTopbar();
  renderTab();
  on('plan', ()=>{ if(App.ui.tab==='plan'){ if(PlanView.strip && PlanView.strip.isConnected) PlanView.strip.update(); renderResults(); } });
  on('settings', ()=>{ if(App.ui.tab==='plan' && PlanView.strip && PlanView.strip.isConnected) PlanView.strip.update(); });
  on('data', ()=>{ renderTopbar(); });
  window.addEventListener('scroll', ()=>{ const b = document.getElementById('topbar'); if(b) b.classList.toggle('scrolled', window.scrollY>4); if(window.scrollX) window.scrollTo(0, window.scrollY); }, {passive:true});
  window.addEventListener('hashchange', ()=>{ const id = (location.hash||'').slice(1); if(id!==App.ui.tab && TABS.some(x=>x.id===id)) goTab(id); });
  window.addEventListener('storage', e=>{ if(e.key===STORE_KEY) toast(App.ui.lang==='ar' ? 'تغيّرت البيانات في نافذة أخرى' : 'Data changed in another window', {label:App.ui.lang==='ar'?'إعادة التحميل':'Reload', onClick:()=>location.reload()}); });
  window.addEventListener('beforeunload', ()=>{ clearTimeout(saveTimer); saveNow(); });
  const fav = el('link', {rel:'icon', type:'image/svg+xml', href:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#6D4461"/><g transform="translate(4.8 4.8) scale(.7)" fill="none" stroke="#FBF6F9" stroke-width="3.4" stroke-linecap="round"><path d="M16 3a13 13 0 1 0 13 13"/><path d="M8.5 21c3.4 0 5-3.2 8.5-3.2S22 14.6 25.5 14.6"/></g></svg>')});
  document.head.appendChild(fav);
  if(App.migrated) toast(t('migrated'));
}
document.addEventListener('DOMContentLoaded', boot);
