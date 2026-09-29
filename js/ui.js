const Overlay = {stack:[]};
function pushOverlay(close){ Overlay.stack.push(close); }
function popOverlay(close){ const i = Overlay.stack.lastIndexOf(close); if(i>=0) Overlay.stack.splice(i,1); }
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && Overlay.stack.length){ e.preventDefault(); Overlay.stack[Overlay.stack.length-1](); }
});

let activePop = null;
const popStack = [];
function popover(anchor, build, opts){
  opts = opts||{};
  while(popStack.length){
    const top = popStack[popStack.length-1];
    if(top.el.contains(anchor)) break;
    const same = top.anchor===anchor;
    top.close();
    if(same) return null;
  }
  const pop = el('div', {class:'pop'+(opts.menu?' menu-pop':''), role:'dialog'});
  const prev = document.activeElement;
  function position(){
    const r = anchor.getBoundingClientRect();
    const rtl = document.documentElement.dir==='rtl';
    pop.style.visibility='hidden'; pop.style.left='0px'; pop.style.top='0px';
    if(opts.width) pop.style.width = opts.width+'px';
    const vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight;
    if(opts.width) pop.style.width = Math.min(opts.width, vw-20)+'px';
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = rtl ? r.right-pw : r.left;
    let top = r.bottom+6;
    if(top+ph > vh-10) top = Math.max(10, r.top-ph-6);
    left = clamp(left, 10, vw-pw-10);
    pop.style.left = left+'px'; pop.style.top = top+'px'; pop.style.visibility='visible';
  }
  function close(){
    const idx = popStack.indexOf(api);
    if(idx>=0){ while(popStack.length>idx+1) popStack[popStack.length-1].close(); popStack.splice(popStack.indexOf(api),1); }
    if(!pop.isConnected) return;
    popOverlay(close);
    document.removeEventListener('mousedown', outside, true);
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', onScroll, true);
    pop.remove();
    anchor.classList.remove('open');
    anchor.setAttribute('aria-expanded','false');
    activePop = popStack[popStack.length-1] || null;
    if(opts.onClose) opts.onClose();
    if(prev && prev.focus && document.contains(prev) && !opts.noRefocus) prev.focus({preventScroll:true});
  }
  function outside(e){
    const idx = popStack.indexOf(api);
    for(let i=Math.max(0,idx); i<popStack.length; i++) if(popStack[i].el.contains(e.target)) return;
    if(anchor.contains(e.target)) return;
    close();
  }
  function onScroll(e){ if(!pop.contains(e.target)) position(); }
  function refresh(){ clear(pop); appendKids(pop, build(close, refresh)); position(); }
  appendKids(pop, build(close, refresh));
  document.body.appendChild(pop);
  position();
  anchor.classList.add('open');
  anchor.setAttribute('aria-expanded','true');
  document.addEventListener('mousedown', outside, true);
  window.addEventListener('resize', position);
  window.addEventListener('scroll', onScroll, true);
  pushOverlay(close);
  const api = {anchor, close, refresh, position, el:pop};
  popStack.push(api);
  activePop = api;
  const f = pop.querySelector('[data-autofocus]') || (opts.focusFirst ? pop.querySelector('input,button') : null);
  if(f) f.focus({preventScroll:true});
  return api;
}
function closePop(){ while(popStack.length) popStack[0].close(); }

function menu(anchor, items, opts){
  return popover(anchor, close=>{
    const list = el('div', {class:'menu', role:'menu'});
    let search = null;
    function paint(q){
      clear(list);
      const nq = norm(q||'');
      const shown = items.filter(it=>!nq || norm(it.label).includes(nq) || norm(it.meta||'').includes(nq));
      if(!shown.length) list.appendChild(el('div', {class:'menu-item muted'}, (opts&&opts.empty) || '—'));
      for(const it of shown.slice(0, 200)){
        if(it.sep){ list.appendChild(el('div', {style:{height:'1px', background:'var(--line)', margin:'4px 0'}})); continue; }
        list.appendChild(el('button', {type:'button', class:'menu-item'+(it.selected?' sel':''), role:'menuitem', disabled:it.disabled, onclick:()=>{ close(); it.onClick && it.onClick(); }}, [
          it.icon ? el('span', {html:it.icon}) : null,
          el('span', null, it.label),
          it.meta ? el('span', {class:'meta'}, it.meta) : null,
          it.selected ? el('span', {class:'meta', html:ICON.check}) : null
        ]));
      }
    }
    if(opts && opts.search){
      search = el('input', {class:'input sm menu-search', placeholder:t('search'), 'data-autofocus':true, oninput:e=>paint(e.target.value), onkeydown:e=>{ if(e.key==='ArrowDown'){ e.preventDefault(); const b = list.querySelector('.menu-item:not(:disabled)'); if(b) b.focus(); } if(e.key==='Enter'){ e.preventDefault(); const b = list.querySelector('.menu-item:not(:disabled)'); if(b) b.click(); } }});
    }
    paint('');
    list.addEventListener('keydown', e=>{
      const btns = [...list.querySelectorAll('.menu-item:not(:disabled)')];
      const i = btns.indexOf(document.activeElement);
      if(e.key==='ArrowDown'){ e.preventDefault(); (btns[i+1]||btns[0]).focus(); }
      if(e.key==='ArrowUp'){ e.preventDefault(); if(i<=0 && search) search.focus(); else (btns[i-1]||btns[btns.length-1]).focus(); }
    });
    return search ? [search, el('div', {style:{maxHeight:'320px', overflowY:'auto'}}, list)] : list;
  }, Object.assign({menu:true, focusFirst:!(opts&&opts.search)}, opts||{}));
}

function sheet(opts){
  if(sheet.current) sheet.current.close(true);
  const scrim = el('div', {class:'scrim'});
  const panel = el('aside', {class:'sheet', role:'dialog', 'aria-modal':'true'});
  const head = el('header', {class:'sheet-head'});
  const body = el('div', {class:'sheet-body'});
  const foot = el('footer', {class:'sheet-foot'});
  const prev = document.activeElement;
  let closed = false;
  function render(){
    const y = body.scrollTop;
    clear(head); clear(body); clear(foot);
    const titleBox = el('div', {style:{flex:'1', minWidth:'0'}}, [el('h2', null, opts.title()), opts.sub ? el('div', {class:'sub'}, opts.sub()) : null]);
    head.appendChild(titleBox);
    if(opts.headActions) appendKids(head, opts.headActions(api));
    head.appendChild(el('button', {type:'button', class:'icon-btn', 'aria-label':t('close'), html:ICON.x, onclick:()=>close()}));
    appendKids(body, opts.body(api));
    const f = opts.foot ? opts.foot(api) : null;
    foot.hidden = !f; if(f) appendKids(foot, f);
    body.scrollTop = y;
  }
  function close(instant){
    if(closed) return; closed = true;
    popOverlay(close);
    closePop();
    scrim.classList.remove('show'); panel.classList.remove('show');
    document.body.classList.remove('locked');
    const rm = ()=>{ scrim.remove(); panel.remove(); };
    if(instant) rm(); else setTimeout(rm, 200);
    if(sheet.current===api) sheet.current = null;
    if(opts.onClose) opts.onClose();
    if(!instant && prev && prev.focus && document.contains(prev)) prev.focus({preventScroll:true});
  }
  const api = {render, close, body};
  panel.appendChild(head); panel.appendChild(body); panel.appendChild(foot);
  scrim.addEventListener('click', ()=>close());
  document.body.appendChild(scrim); document.body.appendChild(panel);
  document.body.classList.add('locked');
  render();
  requestAnimationFrame(()=>{ scrim.classList.add('show'); panel.classList.add('show'); });
  pushOverlay(close);
  sheet.current = api;
  setTimeout(()=>{ const b = head.querySelector('.icon-btn'); if(b) b.focus({preventScroll:true}); }, 30);
  return api;
}

function confirmDialog(title, message, opts){
  opts = opts||{};
  const scrim = el('div', {class:'scrim show', style:{zIndex:89}});
  const dlg = el('div', {class:'dialog', role:'alertdialog', 'aria-modal':'true'});
  function close(){ popOverlay(close); scrim.remove(); dlg.remove(); }
  const ok = el('button', {type:'button', class:'btn '+(opts.danger?'danger':'primary'), onclick:()=>{ close(); opts.onConfirm && opts.onConfirm(); }}, opts.label || t('confirm'));
  const cancel = el('button', {type:'button', class:'btn ghost', onclick:close}, t('cancel'));
  appendKids(dlg, [el('h3', null, title), message ? el('p', null, message) : null, el('div', {class:'actions'}, [cancel, ok])]);
  scrim.addEventListener('click', close);
  document.body.appendChild(scrim); document.body.appendChild(dlg);
  pushOverlay(close);
  (opts.danger ? cancel : ok).focus();
}

function toast(msg, action){
  let region = document.querySelector('.toasts');
  if(!region){ region = el('div', {class:'toasts', role:'status', 'aria-live':'polite'}); document.body.appendChild(region); }
  const node = el('div', {class:'toast'}, [el('span', null, msg), action ? el('button', {type:'button', onclick:()=>{ node.remove(); action.onClick(); }}, action.label) : null]);
  while(region.children.length>=3) region.firstChild.remove();
  region.appendChild(node);
  setTimeout(()=>node.remove(), action ? 7000 : 2600);
}

function Seg(options, value, onChange, opts){
  const seg = el('div', {class:'seg'+(opts&&opts.cls?' '+opts.cls:''), role:'group'});
  const btns = [];
  function paint(v){ btns.forEach((b,i)=>b.setAttribute('aria-pressed', options[i].value===v ? 'true':'false')); }
  options.forEach(o=>{
    const b = el('button', {type:'button', title:o.title||null, onclick:()=>{ paint(o.value); onChange(o.value); }}, o.label);
    btns.push(b); seg.appendChild(b);
  });
  paint(value);
  seg.set = paint;
  return seg;
}
function Switch(value, onChange, label){
  const b = el('button', {type:'button', class:'switch', role:'switch', 'aria-checked':value?'true':'false', 'aria-label':label||null});
  b.addEventListener('click', ()=>{ const v = b.getAttribute('aria-checked')!=='true'; b.setAttribute('aria-checked', v?'true':'false'); onChange(v); });
  return b;
}
function Stepper(value, onChange, opts){
  opts = opts||{};
  const min = opts.min==null ? 0 : opts.min, max = opts.max==null ? 999 : opts.max, step = opts.step||1;
  let cur = value;
  const input = el('input', {type:'text', inputmode:'numeric', value: cur==null ? '' : String(cur), placeholder: opts.placeholder||'', 'aria-label':opts.label||''});
  const dec = el('button', {type:'button', 'aria-label':'−', html:ICON.minus});
  const inc = el('button', {type:'button', 'aria-label':'+', html:ICON.plus});
  function set(v, fire){
    if(v==null || v===''){ if(opts.nullable){ cur = null; input.value=''; paint(); if(fire) onChange(null); } return; }
    v = clamp(Math.round(v/step)*step, min, max);
    cur = v; input.value = String(v); paint();
    if(fire) onChange(v);
  }
  function paint(){ dec.disabled = opts.nullable ? cur==null : (cur!=null && cur<=min); inc.disabled = cur!=null && cur>=max; }
  dec.addEventListener('click', ()=>{ if(cur==null) set(max<999?max:min, true); else if(opts.nullable && cur<=min) set(null, true); else set(cur-step, true); });
  inc.addEventListener('click', ()=>set(cur==null ? min : cur+step, true));
  input.addEventListener('change', ()=>{ const raw = toAsciiDigits(input.value).replace(/[^\d.-]/g,''); if(raw==='') set(null, true); else set(parseFloat(raw), true); });
  input.addEventListener('keydown', e=>{ if(e.key==='ArrowUp'){ e.preventDefault(); inc.click(); } if(e.key==='ArrowDown'){ e.preventDefault(); dec.click(); } });
  paint();
  const g = el('div', {class:'input-group'+(opts.sm?' sm':'')}, [dec, input, opts.unit ? el('span', {class:'unit'}, opts.unit) : null, inc]);
  g.set = v=>set(v, false);
  return g;
}
function Slider(value, onChange, opts){
  opts = opts||{};
  const min = opts.min==null?0:opts.min, max = opts.max==null?100:opts.max, step = opts.step||1;
  const input = el('input', {type:'range', min, max, step, value, 'aria-label':opts.label||''});
  const val = el('span', {class:'val'});
  const tier = opts.tiers ? el('span', {class:'tier'}) : null;
  function paint(v){
    input.style.setProperty('--p', ((v-min)/(max-min)*100)+'%');
    val.textContent = opts.format ? opts.format(v) : String(v);
    if(tier) tier.textContent = opts.tiers(v);
  }
  input.addEventListener('input', ()=>paint(+input.value));
  input.addEventListener('change', ()=>onChange(+input.value));
  paint(value);
  return el('div', {class:'slider'}, [input, val, tier]);
}
function Select(options, value, onChange, opts){
  const s = el('select', {class:'select'+(opts&&opts.sm?' sm':''), 'aria-label':(opts&&opts.label)||null, onchange:e=>onChange(e.target.value)});
  for(const o of options){ const op = el('option', {value:o.value}, o.label); if(o.value===value) op.selected = true; s.appendChild(op); }
  if(opts && opts.width) s.style.width = opts.width;
  return s;
}
function DaySet(selected, onChange, opts){
  const set = new Set(selected||[]);
  const wrap = el('div', {class:'dayset'+(opts&&opts.sm?' sm':''), role:'group'});
  const order = [6,0,1,2,3,4,5];
  for(const d of order){
    const b = el('button', {type:'button', title:wdName(d), 'aria-pressed':set.has(d)?'true':'false'}, wdName(d,'min'));
    b.addEventListener('click', ()=>{
      if(set.has(d)) set.delete(d); else set.add(d);
      b.setAttribute('aria-pressed', set.has(d)?'true':'false');
      onChange([...set].sort());
    });
    wrap.appendChild(b);
  }
  return wrap;
}
function ChipToggles(options, selected, onChange){
  const set = new Set(selected||[]);
  const wrap = el('div', {class:'chips'});
  for(const o of options){
    const b = el('button', {type:'button', class:'chip', 'aria-pressed':set.has(o.value)?'true':'false'}, o.label);
    b.addEventListener('click', ()=>{ if(set.has(o.value)) set.delete(o.value); else set.add(o.value); b.setAttribute('aria-pressed', set.has(o.value)?'true':'false'); onChange([...set]); });
    wrap.appendChild(b);
  }
  return wrap;
}

function MiniCal(opts){
  let view = opts.view != null ? opts.view : (opts.value ? ordOf(opts.value) : todayOrd());
  let {y, m} = ymdOf(view);
  let anchor = null;
  const box = el('div', {class:'mini-cal'});
  function paint(){
    clear(box);
    const rtl = document.documentElement.dir==='rtl';
    const head = el('div', {class:'mini-cal-head'}, [
      el('button', {type:'button', class:'icon-btn sm', 'aria-label':'prev', html: rtl?ICON.right:ICON.left, onclick:()=>{ m--; if(m<0){ m=11; y--; } paint(); }}),
      el('b', null, monthName(m)+' '+y),
      el('button', {type:'button', class:'icon-btn sm', 'aria-label':'next', html: rtl?ICON.left:ICON.right, onclick:()=>{ m++; if(m>11){ m=0; y++; } paint(); }})
    ]);
    box.appendChild(head);
    const grid = el('div', {class:'mini-cal-grid'});
    const order = [6,0,1,2,3,4,5];
    for(const d of order) grid.appendChild(el('div', {class:'wd'}, wdName(d,'min')));
    const first = monthStartOrd(y, m);
    const lead = (wdOf(first) - 6 + 7) % 7;
    for(let i=0;i<lead;i++) grid.appendChild(el('span', {class:'mc-day blank'}));
    const tOrd = todayOrd();
    for(let d=1; d<=daysInMonth(y,m); d++){
      const o = first+d-1, iso = isoOf(o);
      const cls = ['mc-day'];
      if(o===tOrd) cls.push('today');
      if(opts.isSelected && opts.isSelected(iso)) cls.push('sel');
      if(opts.inRange && opts.inRange(iso)) cls.push('range');
      if(opts.isMuted && opts.isMuted(iso)) cls.push('muted');
      if(opts.isWork && opts.isWork(iso)) cls.push('work');
      grid.appendChild(el('button', {type:'button', class:cls.join(' '), onclick:e=>{
        if(e.shiftKey && anchor && opts.onRange){ opts.onRange(anchor<iso?anchor:iso, anchor<iso?iso:anchor); }
        else { opts.onPick(iso); anchor = iso; }
        paint();
      }}, String(d)));
    }
    box.appendChild(grid);
  }
  paint();
  box.repaint = paint;
  return box;
}

function DateInput(value, onChange, opts){
  opts = opts||{};
  const btn = el('button', {type:'button', class:'input', style:{display:'inline-flex', alignItems:'center', gap:'8px', minWidth:'150px', textAlign:'start'}}, [
    el('span', {html:ICON.cal, class:'muted', style:{display:'flex'}}), el('span', {class:'lbl'}, value ? fmtDate(value) : (opts.placeholder||'—'))
  ]);
  btn.addEventListener('click', ()=>popover(btn, close=>[
    MiniCal({value, isSelected:iso=>iso===value, inRange:opts.rangeWith ? (iso=>{ const o = opts.rangeWith(); return o && ((iso>o && iso<value)||(iso<o && iso>value)); }) : null, isWork:iso=>isWorkday(ordOf(iso)), onPick:iso=>{ value = iso; btn.querySelector('.lbl').textContent = fmtDate(iso); close(); onChange(iso); }}),
    el('div', {class:'row', style:{marginTop:'8px'}}, [
      el('button', {type:'button', class:'btn sm ghost', onclick:()=>{ value = todayISO(); btn.querySelector('.lbl').textContent = fmtDate(value); close(); onChange(value); }}, App.ui.lang==='ar'?'اليوم':'Today')
    ])
  ]));
  return btn;
}

function MultiDates(values, onChange, opts){
  opts = opts||{};
  let list = (values||[]).slice().sort();
  const wrap = el('div', {class:'field'});
  const chips = el('div', {class:'chips'});
  const addBtn = el('button', {type:'button', class:'chip', html:ICON.plus + '<span>'+(opts.addLabel||t('add'))+'</span>'});
  function paint(){
    clear(chips);
    for(const iso of list){
      chips.appendChild(el('span', {class:'chip'}, [fmtDate(iso,'wdm'), el('button', {type:'button', class:'x', 'aria-label':t('del'), html:ICON.x, onclick:()=>{ list = list.filter(x=>x!==iso); paint(); onChange(list.slice()); }})]));
    }
    chips.appendChild(addBtn);
  }
  addBtn.addEventListener('click', ()=>popover(addBtn, (close, refresh)=>{
    const ta = el('textarea', {class:'input', rows:2, placeholder:'2026-10-06, 2026-10-12..2026-10-14', style:{width:'100%', fontSize:'12.5px'}});
    return [
      MiniCal({isSelected:iso=>list.includes(iso), isWork:opts.isWork, onPick:iso=>{ list = list.includes(iso) ? list.filter(x=>x!==iso) : list.concat([iso]).sort(); paint(); onChange(list.slice()); }, onRange:(a,b)=>{ for(let o=ordOf(a); o<=ordOf(b); o++){ const i = isoOf(o); if(!list.includes(i)) list.push(i); } list.sort(); paint(); onChange(list.slice()); }}),
      el('div', {class:'hint', style:{margin:'8px 0 4px'}}, t('pOffHint')),
      ta,
      el('div', {class:'row', style:{marginTop:'6px'}}, [el('button', {type:'button', class:'btn sm', onclick:()=>{ const r = parseDateList(ta.value); for(const i of r.accepted) if(!list.includes(i)) list.push(i); list.sort(); ta.value=''; paint(); onChange(list.slice()); refresh(); }}, t('apply'))])
    ];
  }));
  paint();
  wrap.appendChild(chips);
  return wrap;
}

function FacilityPicker(selected, onChange, opts){
  let ids = (selected||[]).slice();
  const wrap = el('div', {class:'chips'});
  const add = el('button', {type:'button', class:'chip', html:ICON.plus+'<span>'+((opts&&opts.addLabel)||t('pBlockedAdd'))+'</span>'});
  function paint(){
    clear(wrap);
    for(const id of ids){
      const f = facilityById(id); if(!f) continue;
      wrap.appendChild(el('span', {class:'chip'}, [f.name, el('button', {type:'button', class:'x', html:ICON.x, 'aria-label':t('del'), onclick:()=>{ ids = ids.filter(x=>x!==id); paint(); onChange(ids.slice()); }})]));
    }
    wrap.appendChild(add);
  }
  add.addEventListener('click', ()=>{
    const pool = (opts && opts.filter) ? App.data.facilities.filter(opts.filter) : App.data.facilities;
    menu(add, pool.filter(f=>!ids.includes(f.id)).map(f=>({label:f.name, meta:f.category, onClick:()=>{ ids.push(f.id); paint(); onChange(ids.slice()); }})), {search:true, width:320});
  });
  paint();
  return wrap;
}

function setting(label, hint, ctl, extra){
  return el('div', {class:'setting'+(extra&&extra.cls?' '+extra.cls:'')}, [
    el('div', {class:'lbl'}, [el('b', null, label), hint ? el('span', null, hint) : null]),
    el('div', {class:'ctl'}, ctl),
    extra && extra.full ? el('div', {class:'full'}, extra.full) : null
  ]);
}

function Mount(fn){
  const node = el('div');
  node.render = function(){ const y = window.scrollY; clear(node); appendKids(node, fn(node)); if(Math.abs(window.scrollY-y)>2) window.scrollTo(0, y); };
  node.render();
  return node;
}

function downloadBlob(bytes, name, mime){
  const url = URL.createObjectURL(new Blob([bytes], {type:mime}));
  const a = el('a', {href:url, download:name});
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}
function copyText(text){
  if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(()=>toast(t('copied')));
  const ta = el('textarea', {value:text, style:{position:'fixed', opacity:'0'}}); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast(t('copied'));
}
