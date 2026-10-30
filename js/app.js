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
      el('button', {type:'button', class:'icon-btn', id:'pal-btn', 'aria-label':t('palOpen'), title:t('palOpen')+' (Ctrl+K)', html:ICON.search, onclick:()=>palOpen()}),
      el('button', {type:'button', class:'icon-btn', 'aria-label':t('themeToggle'), title:t('themeToggle'), html:thIcon, onclick:()=>setTheme(nextTheme)}),
      el('button', {type:'button', class:'icon-btn lang-btn', 'aria-label':t('language'), title:t('langToggle'), onclick:()=>setLang(App.ui.lang==='ar'?'en':'ar')}, [el('span', {class:'lang-long'}, t('langToggle')), el('span', {class:'lang-short'}, App.ui.lang==='ar'?'EN':'ع')])
    ])
  ]));
  moveTabInd(true);
}

function moveTabInd(instant){
  const nav = document.querySelector('#topbar .tabs'); if(!nav) return;
  let ind = nav.querySelector('.tab-ind');
  if(!ind){
    ind = el('span', {class:'tab-ind', 'aria-hidden':'true'}); nav.insertBefore(ind, nav.firstChild); nav.classList.add('has-ind'); instant = true;
    if(window.ResizeObserver){ const ro = new ResizeObserver(()=>{ if(!nav.isConnected) return ro.disconnect(); moveTabInd(true); }); ro.observe(nav); nav.querySelectorAll('.tab').forEach(b=>ro.observe(b)); }
  }
  const sel = nav.querySelector('.tab[aria-selected="true"]'); if(!sel) return;
  if(!instant){ nav.classList.add('anim'); clearTimeout(moveTabInd.h); moveTabInd.h = setTimeout(()=>nav.classList.remove('anim'), 450); }
  const nr = nav.getBoundingClientRect(), sr = sel.getBoundingClientRect();
  ind.style.width = sr.width+'px';
  ind.style.transform = 'translateX('+(sr.left-nr.left+nav.scrollLeft)+'px)';
  if(nav.scrollWidth > nav.clientWidth) sel.scrollIntoView({inline:'nearest', block:'nearest', behavior:instant?'auto':'smooth'});
}
function syncTabs(){
  const nav = document.querySelector('#topbar .tabs'); if(!nav) return false;
  nav.querySelectorAll('.tab').forEach(b=>{ const s = b.id==='tab-'+App.ui.tab; b.setAttribute('aria-selected', s?'true':'false'); b.tabIndex = s?0:-1; });
  moveTabInd();
  return true;
}
function pageEnter(){
  const p = document.getElementById('page');
  p.classList.remove('enter'); void p.offsetWidth; p.classList.add('enter');
}

function goTab(id, jump){
  if(!TABS.some(x=>x.id===id)) id = 'plan';
  closePop(); if(sheet.current) sheet.current.close(true);
  const same = App.ui.tab===id;
  tabScroll[App.ui.tab] = window.scrollY;
  App.ui.tab = id;
  if(jump) App.ui.jump = jump;
  history.replaceState(null, '', '#'+id);
  if(!syncTabs()) renderTopbar();
  renderTab();
  if(!same) pageEnter();
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

function registerServiceWorker(){
  if(window.__TEST_ISOLATED__ || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{
    if(reloaded || !hadController) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(reg=>{
    const announce = ()=>toast(t('newVersion'), {label:t('reloadNow'), onClick:()=>{ if(reg.waiting) reg.waiting.postMessage('skipWaiting'); }});
    if(reg.waiting && navigator.serviceWorker.controller) announce();
    reg.addEventListener('updatefound', ()=>{
      const w = reg.installing;
      if(!w) return;
      w.addEventListener('statechange', ()=>{ if(w.state==='installed' && navigator.serviceWorker.controller) announce(); });
    });
  }).catch(()=>{});
}

function showReadOnlyBanner(){
  let b = document.getElementById('ro-banner');
  if(b) return;
  b = el('div', {id:'ro-banner', class:'ro-banner', role:'alert'}, [
    el('div', {class:'ro-text'}, [el('b', null, t('roTitle')), el('span', null, t('roBody'))]),
    el('div', {class:'ro-actions'}, [
      el('button', {type:'button', class:'btn sm primary', onclick:()=>location.reload()}, t('roReload')),
      el('button', {type:'button', class:'btn sm ghost', onclick:()=>confirmDialog(t('roKeep'), t('roKeepQ'), {danger:true, label:t('roKeep'), onConfirm:takeOverWrites})}, t('roKeep'))
    ])
  ]);
  document.body.insertBefore(b, document.body.firstChild);
}
function hideReadOnlyBanner(){ const b = document.getElementById('ro-banner'); if(b) b.remove(); }

function boot(){
  const lang = localStorage.getItem('alkhitta.lang'); App.ui.lang = lang==='en' ? 'en' : 'ar';
  const th = localStorage.getItem('alkhitta.theme'); App.ui.theme = (th==='light'||th==='dark') ? th : 'auto';
  const v = localStorage.getItem('alkhitta.view'); if(['list','calendar','matrix','summary'].includes(v)) App.ui.view = v;
  const h = (location.hash||'').slice(1); const hTab = h.split('/')[0]; if(TABS.some(x=>x.id===hTab)) App.ui.tab = hTab;
  document.documentElement.lang = App.ui.lang; document.documentElement.dir = App.ui.lang==='ar' ? 'rtl' : 'ltr';
  document.title = t('appName');
  loadAll();
  applyTheme();
  renderTopbar();
  renderTab();
  pageEnter();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>moveTabInd(true));
  window.addEventListener('resize', debounce(()=>moveTabInd(true), 80));
  window.addEventListener('load', ()=>moveTabInd(true));
  requestAnimationFrame(()=>moveTabInd(true));
  on('plan', ()=>{ if(App.ui.tab==='plan'){ if(PlanView.strip && PlanView.strip.isConnected) PlanView.strip.update(); renderResults(); } });
  on('settings', ()=>{ if(App.ui.tab==='plan' && PlanView.strip && PlanView.strip.isConnected) PlanView.strip.update(); });
  on('data', ()=>{ renderTopbar(); });
  window.addEventListener('scroll', ()=>{ const b = document.getElementById('topbar'); if(b) b.classList.toggle('scrolled', window.scrollY>4); }, {passive:true});
  window.addEventListener('hashchange', ()=>{ const raw = (location.hash||'').slice(1); const id = raw.split('/')[0]; if(raw.includes('/')){ applyDeepLink(raw); return; } if(id!==App.ui.tab && TABS.some(x=>x.id===id)) goTab(id); });
  if(h.includes('/')) setTimeout(()=>applyDeepLink(h), 250);
  window.addEventListener('storage', e=>{ if(e.key===null || e.key===STORE_KEY || e.key===PLAN_KEY) markForeignWrite(e.key===null ? STORE_KEY : e.key); });
  window.addEventListener('beforeunload', ()=>{ if(App.readOnly) return; clearTimeout(saveTimer); saveNow(); });
  if(App.readOnly) showReadOnlyBanner();
  if(App.recovered) toast(t('recoveredToast'));
  if(App.corrupt) toast(t('corruptToast'));
  registerServiceWorker();
  if(App.migrated) toast(t('migrated'));
}
document.addEventListener('DOMContentLoaded', boot);
