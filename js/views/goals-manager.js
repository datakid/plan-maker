const GOAL_MAIN = {
  cover:{key:'times', min:1, max:50, label:'gfTimes'},
  atLeast:{key:'n', min:1, max:200, label:'gfN'},
  atMost:{key:'n', min:0, max:200, label:'gfN'},
  maxGap:{key:'days', min:7, max:365, step:7, label:'gfDays'},
  person:{key:'n', min:1, max:200, label:'gfN'},
  together:{key:'pct', min:10, max:100, step:10, label:'gfPct'}
};

const GOAL_FILTERS = ['all', 'fac', 'people', 'must', 'prefer', 'off', 'failing'];

function goalSummary(g){
  const st = goalStatusText(g);
  return goalTypeLabel(g.type)+(st ? ' · '+st : '');
}

function duplicateGoal(g){
  const c = normalizeGoal(Object.assign(JSON.parse(JSON.stringify(g)), {id:uid('goal')}));
  const goals = S().goals;
  goals.splice(goals.indexOf(g)+1, 0, c);
  return c;
}

function moveGoal(g, d){
  const goals = S().goals;
  const i = goals.indexOf(g);
  const j = i+d;
  if(j<0 || j>=goals.length) return;
  goals.splice(i, 1);
  goals.splice(j, 0, g);
}

function GoalsManager(opts){
  opts = opts || {};
  const st = {sel:opts.selectId || null, filter:'all', search:''};
  const root = el('div', {class:'gm'});
  const toolbar = el('div', {class:'gm-toolbar'});
  const listEl = el('div', {class:'gm-list'});
  const detail = el('div', {class:'gm-detail', hidden:true});
  const body = el('div', {class:'gm-body'}, [listEl, detail]);
  root.appendChild(toolbar);
  root.appendChild(body);
  const wide = ()=>opts.forceWide!=null ? opts.forceWide : (App.ui.gmForceWide!=null ? App.ui.gmForceWide : window.innerWidth>=980);
  let progress = [];
  const failing = g=>{ const r = progress.find(x=>x.g.id===g.id); return !!r && (r.state==='short' || r.state==='exceeded'); };

  const matches = g=>{
    const q = st.search.trim().toLowerCase();
    if(q && !(goalTitle(g)+' '+goalTypeLabel(g.type)).toLowerCase().includes(q)) return false;
    if(st.filter==='fac') return !isPeopleGoal(g);
    if(st.filter==='people') return isPeopleGoal(g);
    if(st.filter==='must') return goalMust(g);
    if(st.filter==='prefer') return !goalMust(g);
    if(st.filter==='off') return !g.on;
    if(st.filter==='failing') return failing(g);
    return true;
  };

  function changed(){
    if(typeof offerDuplicateChoice==='function') setTimeout(offerDuplicateChoice, 0);
    commit('settings');
    if(PlanView.strip && PlanView.strip.isConnected) PlanView.strip.update();
    if(opts.onChange) opts.onChange();
    if(activePop) activePop.position();
  }

  function select(id){
    st.sel = id;
    paintList();
    paintDetail();
  }

  function paintToolbar(){
    clear(toolbar);
    const add = el('button', {type:'button', class:'btn sm primary'}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('goalAdd')]);
    const item = type=>({label:goalTypeLabel(type), desc:goalTypeHint(type), onClick:()=>{ const g = newGoal(type); S().goals.push(g); changed(); st.filter = 'all'; st.search = ''; paintToolbar(); select(g.id); }});
    add.addEventListener('click', ()=>menu(add, [
      {header:true, label:t('gGroupFac'), icon:ICON.target}, ...FACILITY_GOALS.map(item),
      {sep:true},
      {header:true, label:t('gGroupPeople'), icon:ICON.users}, ...PEOPLE_GOALS.map(item)
    ], {width:380}));
    const search = el('input', {class:'input sm gm-search', type:'search', value:st.search, placeholder:t('ptSearch'), 'aria-label':t('ptSearch'), oninput:e=>{ st.search = e.target.value; paintList(); }});
    const chips = el('div', {class:'chips gm-filters'}, GOAL_FILTERS.map(f=>el('button', {type:'button', class:'chip'+(st.filter===f ? ' on' : ''), 'data-filter':f, onclick:()=>{ st.filter = f; paintToolbar(); paintList(); }}, t('gFilter_'+f))));
    appendKids(toolbar, [add, search, chips]);
  }

  function row(g){
    const main = GOAL_MAIN[g.type];
    const pr = progress.find(r=>r.g.id===g.id);
    const r = el('div', {class:'gm-row'+(g.on ? '' : ' off')+(st.sel===g.id ? ' sel' : ''), 'data-grow':g.id, tabindex:'0'});
    const menuBtn = el('button', {type:'button', class:'icon-btn sm', 'aria-label':t('ptDetails'), html:ICON.more});
    menuBtn.addEventListener('click', e=>{ e.stopPropagation(); menu(menuBtn, [
      {label:t('ptDuplicate'), onClick:()=>{ const c = duplicateGoal(g); changed(); select(c.id); }},
      {label:t('gMoveUp'), onClick:()=>{ moveGoal(g, -1); changed(); paintList(); }},
      {label:t('gMoveDown'), onClick:()=>{ moveGoal(g, 1); changed(); paintList(); }},
      {label:t('del'), danger:true, onClick:()=>{
        const goals = S().goals, i = goals.indexOf(g);
        goals.splice(i, 1);
        changed();
        if(st.sel===g.id) st.sel = null;
        paintList(); paintDetail();
        toast(t('gDeleted'), {label:t('ptUndo'), onClick:()=>{ S().goals.splice(Math.min(i, S().goals.length), 0, g); changed(); paintList(); }});
      }}
    ]); });
    const sub = el('span', {class:'gm-sub'}, goalSummary(g));
    appendKids(r, [
      Switch(g.on, v=>{ g.on = v; r.classList.toggle('off', !v); changed(); }),
      el('span', {class:'goal-ic', html:isPeopleGoal(g) ? ICON.users : ICON.target}),
      el('div', {class:'gl-main'}, [el('b', {class:'gm-title'}, goalTitle(g)), sub]),
      main ? Stepper(g[main.key], v=>{ g[main.key] = v; changed(); const tt = r.querySelector('.gm-title'); if(tt) tt.textContent = goalTitle(g); sub.textContent = goalSummary(g); if(st.sel===g.id) paintDetail(); }, {min:main.min, max:main.max, step:main.step || 1, sm:true, label:t(main.label)}) : el('span', {class:'gm-nostep'}),
      LevelChip(g.lv, goalRuleId(g), v=>{ g.lv = v; changed(); r.dataset.level = v.level; }, {sm:true}),
      pr ? goalMeter(pr) : el('span', {class:'gm-nometer'}),
      menuBtn
    ]);
    r.dataset.level = g.lv.level;
    if(isPeopleGoal(g)) r.classList.add('people');
    r.addEventListener('click', e=>{ if(e.target.closest('input,button,.switch,.stepper,.input-group,.chip')) return; select(g.id); if(!wide()) openNarrow(g); });
    r.addEventListener('keydown', e=>{
      if(e.key==='Enter' && e.target===r){ select(g.id); if(!wide()) openNarrow(g); }
      if(e.key==='ArrowDown' || e.key==='ArrowUp'){
        if(e.target!==r) return;
        const rows = [...listEl.querySelectorAll('.gm-row')];
        const n = rows[rows.indexOf(r)+(e.key==='ArrowDown' ? 1 : -1)];
        if(n){ e.preventDefault(); n.focus(); select(n.dataset.grow); const again = listEl.querySelector('[data-grow="'+n.dataset.grow+'"]'); if(again) again.focus(); }
      }
    });
    return r;
  }

  function paintList(){
    progress = App.plan && !App.plan.stale ? goalProgress(App.plan) : [];
    const keep = listEl.scrollTop;
    clear(listEl);
    const goals = S().goals;
    const groups = [{k:'gGroupFac', items:goals.filter(g=>!isPeopleGoal(g) && matches(g))}, {k:'gGroupPeople', items:goals.filter(g=>isPeopleGoal(g) && matches(g))}];
    let shown = 0;
    for(const gr of groups){
      if(!gr.items.length) continue;
      listEl.appendChild(el('div', {class:'goal-group-h'}, t(gr.k)));
      for(const g of gr.items){ listEl.appendChild(row(g)); shown++; }
    }
    if(!shown) listEl.appendChild(el('div', {class:'empty', style:{padding:'18px'}}, goals.length ? t('ptNoMatch') : t('goalsNone')));
    listEl.scrollTop = keep;
  }

  function detailBody(g){
    const upd = ()=>{ changed(); const r = listEl.querySelector('[data-grow="'+g.id+'"]'); if(r){ const tt = r.querySelector('.gm-title'); if(tt) tt.textContent = goalTitle(g); const sb = r.querySelector('.gm-sub'); if(sb) sb.textContent = goalSummary(g); } };
    const box = el('div', {class:'goal-card stack', 'data-goal':g.id, style:{gap:'12px'}});
    box.appendChild(el('div', {class:'row', style:{gap:'8px'}}, [
      el('span', {class:'goal-ic', html:isPeopleGoal(g) ? ICON.users : ICON.target}),
      el('div', {class:'gl-main'}, [el('b', {class:'goal-title'}, goalTitle(g)), el('span', {class:'goal-sub'}, goalSummary(g))]),
      LevelChip(g.lv, goalRuleId(g), v=>{ g.lv = v; upd(); paintList(); })
    ]));
    box.appendChild(el('div', {class:'hint', style:{fontSize:'12px'}}, goalTypeHint(g.type)));
    appendKids(box, goalFields(g, upd, ()=>{ paintList(); paintDetail(); }));
    return box;
  }

  function paintDetail(){
    clear(detail);
    const g = st.sel ? S().goals.find(x=>x.id===st.sel) : null;
    const show = !!g && wide();
    detail.hidden = !show;
    body.classList.toggle('with-detail', show);
    if(show) detail.appendChild(detailBody(g));
  }

  function openNarrow(g){
    sheet({title:()=>goalTitle(g), sub:()=>[goalTypeLabel(g.type)], body:()=>[detailBody(g)], foot:api=>[el('div', {class:'spacer'}), el('button', {type:'button', class:'btn primary', onclick:()=>api.close()}, t('done'))], onClose:()=>{ paintList(); }});
  }

  paintToolbar();
  paintList();
  paintDetail();
  root.api = {select, state:st, paintList, paintDetail, changed};
  if(opts.selectId && !wide()){ const g = S().goals.find(x=>x.id===opts.selectId); if(g) setTimeout(()=>openNarrow(g), 0); }
  return root;
}
