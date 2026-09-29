function impTier(v){ return v>=90 ? (App.ui.lang==='ar'?'حرجة':'Critical') : v>=70 ? (App.ui.lang==='ar'?'عالية':'High') : v>=40 ? (App.ui.lang==='ar'?'عادية':'Normal') : v>=15 ? (App.ui.lang==='ar'?'منخفضة':'Low') : (App.ui.lang==='ar'?'هامشية':'Minimal'); }
function skillTier(v){ return v>=90 ? (App.ui.lang==='ar'?'خبير':'Expert') : v>=70 ? (App.ui.lang==='ar'?'متقدم':'Senior') : v>=40 ? (App.ui.lang==='ar'?'متمكن':'Capable') : v>=15 ? (App.ui.lang==='ar'?'مبتدئ':'Junior') : (App.ui.lang==='ar'?'متدرب':'Trainee'); }

function facilityList(){
  const U = App.ui, q = norm(U.facSearch);
  let list = App.data.facilities.filter(f=>{
    const k = facilityKind(f);
    if(U.facKind==='excluded'){ if(!(k==='excluded' || f.excluded)) return false; }
    else if(U.facKind!=='all' && (k!==U.facKind || f.excluded)) return false;
    if(U.facCategory && f.category!==U.facCategory) return false;
    if(U.facLocation && f.locationId!==U.facLocation) return false;
    if(U.facKind==='review' ) return !!f.review;
    if(q && !norm(f.name).includes(q) && !norm(f.category).includes(q)) return false;
    return true;
  });
  const t0 = todayOrd();
  const od = f=>f.lastVisit ? t0-ordOf(f.lastVisit) : 99999;
  const sorters = {
    overdue:(a,b)=>od(b)*(b.freq||0)-od(a)*(a.freq||0),
    name:(a,b)=>norm(a.name)<norm(b.name)?-1:1,
    importance:(a,b)=>(b.importance||0)-(a.importance||0),
    km:(a,b)=>(facilityKm(a)||0)-(facilityKm(b)||0)
  };
  list.sort(sorters[U.facSort]||sorters.overdue);
  return list;
}

function renderFacilities(root){
  const U = App.ui;
  const card = el('section', {class:'card', id:'facilities-card'});
  const toolbar = el('div', {class:'toolbar'});
  const search = el('input', {class:'input', type:'search', placeholder:t('fSearch'), value:U.facSearch, 'aria-label':t('fSearch')});
  search.addEventListener('input', debounce(()=>{ U.facSearch = search.value; paintTable(); }, 120));
  toolbar.appendChild(el('div', {class:'search'}, [el('span', {html:ICON.search}), search]));
  toolbar.appendChild(Select([{value:'all',label:t('fAllKinds')},{value:'basic',label:t('kBasic')},{value:'contracted',label:t('kContracted')},{value:'excluded',label:t('kExcluded')}], U.facKind, v=>{ U.facKind = v; paintTable(); }));
  toolbar.appendChild(Select([{value:'',label:t('fAllCats')}].concat(App.data.categories.map(c=>({value:c.name, label:c.name}))), U.facCategory, v=>{ U.facCategory = v; paintTable(); }));
  toolbar.appendChild(Select([{value:'',label:t('fAllLocs')}].concat(App.data.locations.slice().sort((a,b)=>a.km-b.km).map(l=>({value:l.id, label:l.name}))), U.facLocation, v=>{ U.facLocation = v; paintTable(); }, {}));
  toolbar.appendChild(Select([{value:'overdue',label:t('fSortOverdue')},{value:'importance',label:t('fSortImp')},{value:'km',label:t('fSortKm')},{value:'name',label:t('fSortName')}], U.facSort, v=>{ U.facSort = v; paintTable(); }));
  toolbar.appendChild(el('button', {type:'button', class:'btn primary', onclick:addFacility}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('fAdd')]));
  card.appendChild(toolbar);
  const bulk = el('div', {class:'bulkbar', hidden:true});
  card.appendChild(bulk);
  const info = el('div', {class:'muted', style:{padding:'8px 16px', fontSize:'12.5px'}});
  card.appendChild(info);
  const tableWrap = el('div', {class:'tbl-wrap'});
  card.appendChild(tableWrap);
  root.appendChild(card);
  root.appendChild(renderCategoriesCard());
  root.appendChild(renderLocationsCard());

  function paintBulk(){
    const n = U.facSelected.size;
    bulk.hidden = !n;
    clear(bulk);
    if(!n) return;
    const sel = ()=>App.data.facilities.filter(f=>U.facSelected.has(f.id));
    const apply = fn=>{ sel().forEach(fn); commit('data'); paintTable(); };
    const impBtn = el('button', {type:'button', class:'btn sm outline'}, t('fSetImp'));
    impBtn.addEventListener('click', ()=>popover(impBtn, ()=>{ let val = 75; return [el('div', {class:'pop-title'}, t('fSetImp')), Slider(val, v=>{ val = v; }, {min:0, max:100, step:5, tiers:impTier}), el('button', {type:'button', class:'btn primary sm', style:{marginTop:'10px'}, onclick:()=>{ closePop(); apply(f=>f.importance = val); }}, t('apply'))]; }, {width:320}));
    const frBtn = el('button', {type:'button', class:'btn sm outline'}, t('fSetFreq'));
    frBtn.addEventListener('click', ()=>menu(frBtn, [0,0.25,0.35,0.5,0.75,1,1.5,2].map(x=>({label:Math.round(x*100)+'%', onClick:()=>apply(f=>f.freq = x)}))));
    appendKids(bulk, [
      el('b', null, t('fSelected', n)),
      el('button', {type:'button', class:'btn sm outline', onclick:()=>apply(f=>f.excluded = true)}, t('fExclude')),
      el('button', {type:'button', class:'btn sm outline', onclick:()=>apply(f=>f.excluded = false)}, t('fInclude')),
      el('button', {type:'button', class:'btn sm outline', onclick:()=>apply(f=>f.pinned = !f.pinned)}, t('fPin')),
      impBtn, frBtn,
      el('div', {class:'spacer'}),
      el('button', {type:'button', class:'btn sm ghost', onclick:()=>{ U.facSelected.clear(); paintTable(); }}, t('clear'))
    ]);
  }
  function paintTable(){
    const list = facilityList();
    info.textContent = t('fCount', list.length);
    clear(tableWrap);
    const allSel = list.length && list.every(f=>U.facSelected.has(f.id));
    const head = el('tr', null, [
      el('th', {class:'chk'}, el('input', {type:'checkbox', class:'cb', checked:allSel, 'aria-label':t('all'), onchange:e=>{ if(e.target.checked) list.forEach(f=>U.facSelected.add(f.id)); else list.forEach(f=>U.facSelected.delete(f.id)); paintTable(); }})),
      el('th', null, t('fName')), el('th', null, t('fCategory')), el('th', {class:'hide-sm'}, t('fLocation')), el('th', null, t('fImportance')), el('th', {class:'hide-sm'}, t('fFreq')), el('th', null, t('fLast')), el('th', {class:'hide-sm'}, t('fVisits'))
    ]);
    const tb = el('tbody');
    const t0 = todayOrd();
    for(const f of list.slice(0, 400)){
      const k = facilityKind(f), km = facilityKm(f), loc = locationById(f.locationId);
      const off = k==='excluded' || f.excluded || !f.freq;
      const tr = el('tr', {class:(U.facSelected.has(f.id)?'sel ':'')+(off?'dimrow':''), onclick:e=>{ if(e.target.closest('input')) return; openFacility(f.id); }}, [
        el('td', {class:'chk'}, el('input', {type:'checkbox', class:'cb', checked:U.facSelected.has(f.id), 'aria-label':f.name, onchange:e=>{ if(e.target.checked) U.facSelected.add(f.id); else U.facSelected.delete(f.id); paintTable(); }})),
        el('td', {class:'nm'}, el('span', {class:'row', style:{gap:'6px'}}, [el('span', {class:'dot '+(off?'info':k)}), f.name, f.pinned ? el('span', {class:'muted', html:ICON.pin, style:{display:'flex'}}) : null, f.review ? el('span', {class:'tag warn'}, t('fReview')) : null])),
        el('td', null, el('span', {class:'tag '+(f.excluded?'excluded':k)}, f.category||'—')),
        el('td', {class:'hide-sm'}, loc ? el('span', {class:'row', style:{gap:'6px'}}, [loc.name, el('span', {class:'tag '+distBand(km)}, km+' '+t('km'))]) : '—'),
        el('td', null, el('span', {class:'imp-meter', style:{'--p':(f.importance||0)+'%'}}, [el('i'), String(f.importance||0)])),
        el('td', {class:'hide-sm num'}, Math.round((f.freq||0)*100)+'%'),
        el('td', {class:'num', style:{fontSize:'12px'}}, f.lastVisit ? t('fDaysAgo', t0-ordOf(f.lastVisit)) : el('span', {class:'muted'}, t('fNever'))),
        el('td', {class:'hide-sm num'}, String(f.visitCount||0))
      ]);
      tb.appendChild(tr);
    }
    tableWrap.appendChild(el('table', {class:'tbl'}, [el('thead', null, head), tb]));
    paintBulk();
  }
  paintTable();
  PlanView.facRepaint = paintTable;
}

function addFacility(){
  const cat = App.data.categories.find(c=>c.kind==='basic');
  const f = {id:uid('f'), name:'', category:cat?cat.name:'', locationId:locIdFor('دمنهور'), kindOverride:null, freq:1, importance:50, pinned:false, excluded:false, lastVisit:null, visitCount:0, history:[], weekdays:null, review:null};
  openFacility(null, f);
}

function openFacility(id, draft){
  const isNew = !!draft;
  const f = draft || facilityById(id);
  if(!f) return;
  const saveF = ()=>{ if(isNew){ if(!f.name.trim()) return; if(!App.data.facilities.includes(f)) App.data.facilities.push(f); } commit('data'); if(PlanView.facRepaint) PlanView.facRepaint(); };
  sheet({
    title:()=>f.name || t('fAdd'),
    sub:()=>{ const k = facilityKind(f); return [el('span', {class:'tag '+k}, kindLabel(k)), f.lastVisit ? el('span', null, t('fLast')+': '+fmtDate(f.lastVisit)) : el('span', null, t('fNever'))]; },
    body:api=>{
      const k = facilityKind(f);
      const sec1 = el('section', {class:'sheet-sec stack', style:{gap:'12px'}}, [
        el('div', {class:'field'}, [el('label', null, t('fName')), el('input', {class:'input', value:f.name, placeholder:t('fNewName'), 'data-autofocus':isNew?true:null, onchange:e=>{ f.name = e.target.value.trim(); saveF(); api.render(); }})]),
        el('div', {class:'grid-2'}, [
          el('div', {class:'field'}, [el('label', null, t('fCategory')), Select(App.data.categories.map(c=>({value:c.name, label:c.name+' · '+kindLabel(c.kind)})), f.category, v=>{ f.category = v; saveF(); api.render(); })]),
          el('div', {class:'field'}, [el('label', null, t('fLocation')), Select([{value:'',label:'—'}].concat(App.data.locations.slice().sort((a,b)=>a.km-b.km).map(l=>({value:l.id, label:l.name+' · '+l.km+' '+t('km')}))), f.locationId||'', v=>{ f.locationId = v||null; saveF(); api.render(); })])
        ]),
        el('div', {class:'field'}, [el('label', null, t('fKind')), Seg([{value:'',label:t('fAutoKind')+' ('+kindLabel(categoryKind(f.category))+')'},{value:'basic',label:t('kBasic')},{value:'contracted',label:t('kContracted')},{value:'excluded',label:t('kExcluded')}], f.kindOverride||'', v=>{ f.kindOverride = v||null; saveF(); api.render(); })])
      ]);
      const sec2 = el('section', {class:'sheet-sec'}, [
        setting(t('fImportance'), t('fImportanceHint'), null, {full:Slider(f.importance||0, v=>{ f.importance = v; saveF(); }, {min:0, max:100, step:5, tiers:impTier})}),
        setting(t('fFreq'), t('fFreqHint'), null, {full:Slider(Math.round((f.freq||0)*100), v=>{ f.freq = v/100; saveF(); }, {min:0, max:200, step:5, format:v=>v+'%'})}),
        setting(t('fPinned'), null, Switch(!!f.pinned, v=>{ f.pinned = v; saveF(); })),
        setting(t('fExcluded'), null, Switch(!!f.excluded, v=>{ f.excluded = v; saveF(); api.render(); })),
        setting(t('fDays'), f.weekdays && f.weekdays.length ? null : t('fAnyDay'), DaySet(f.weekdays||[], v=>{ f.weekdays = v.length ? v : null; saveF(); }, {sm:true}))
      ]);
      const sec3 = el('section', {class:'sheet-sec'});
      sec3.appendChild(el('div', {class:'section-title'}, t('vdHistory')));
      sec3.appendChild(el('div', {class:'grid-2', style:{marginBottom:'10px'}}, [
        el('div', {class:'field'}, [el('label', null, t('fLast')), DateInput(f.lastVisit, v=>{ f.lastVisit = v; saveF(); api.render(); }, {placeholder:t('fNever')})]),
        el('div', {class:'field'}, [el('label', null, t('fVisits')), Stepper(f.visitCount||0, v=>{ f.visitCount = v; saveF(); }, {min:0, max:9999})])
      ]));
      const h = (f.history||[]).slice(0,8);
      if(!h.length) sec3.appendChild(el('div', {class:'muted', style:{fontSize:'13px'}}, t('vdNoHistory')));
      for(const x of h) sec3.appendChild(el('div', {class:'row', style:{padding:'5px 0', fontSize:'12.5px', borderBottom:'1px dashed var(--line)'}}, [el('span', {class:'num muted', style:{minWidth:'92px'}}, x.date), el('span', null, (x.team||[]).join('، '))]));
      if(f.review) sec3.appendChild(el('button', {type:'button', class:'btn sm', style:{marginTop:'10px'}, onclick:()=>{ f.review = null; saveF(); api.render(); }}, t('fReview')+' ✓'));
      return [sec1, sec2, sec3];
    },
    foot:api=>[
      isNew && !App.data.facilities.includes(f) ? null : el('button', {type:'button', class:'btn ghost', style:{color:'var(--danger)'}, onclick:()=>confirmDialog(t('fDelete'), t('fDeleteQ'), {danger:true, label:t('del'), onConfirm:()=>{ App.data.facilities = App.data.facilities.filter(x=>x!==f); commit('data'); api.close(); if(PlanView.facRepaint) PlanView.facRepaint(); }})}, t('fDelete')),
      el('div', {class:'spacer'}),
      el('button', {type:'button', class:'btn primary', onclick:()=>{ if(isNew && !f.name.trim()){ toast(t('fNewName')); return; } saveF(); api.close(); }}, t('done'))
    ]
  });
}

function renderCategoriesCard(){
  return Mount(node=>{
    const card = el('section', {class:'card', id:'categories-card'});
    card.appendChild(el('div', {class:'card-head'}, [el('h2', null, t('catTitle')), el('span', {class:'sub'}, t('catHint'))]));
    const body = el('div', {class:'card-pad', style:{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:'8px'}});
    for(const c of App.data.categories){
      const n = App.data.facilities.filter(f=>f.category===c.name).length;
      body.appendChild(el('div', {class:'row', style:{padding:'6px 10px', border:'1px solid var(--line)', borderRadius:'10px', background:'var(--raised)'}}, [
        el('span', {class:'dot '+(c.kind==='excluded'?'info':c.kind)}),
        el('span', {style:{flex:'1', fontWeight:'500', fontSize:'13px'}}, c.name),
        el('span', {class:'muted num', style:{fontSize:'11.5px'}}, String(n)),
        Seg([{value:'basic', label:App.ui.lang==='ar'?'أ':'B', title:t('kBasic')},{value:'contracted', label:App.ui.lang==='ar'?'م':'C', title:t('kContracted')},{value:'excluded', label:'—', title:t('kExcluded')}], c.kind, v=>{ c.kind = v; commit('data'); node.render(); if(PlanView.facRepaint) PlanView.facRepaint(); }, {cls:'sm'})
      ]));
    }
    card.appendChild(body);
    return card;
  });
}

function renderLocationsCard(){
  return Mount(node=>{
    const card = el('section', {class:'card', id:'locations-card'});
    const D = S().distance;
    const locs = App.data.locations.slice().sort((a,b)=>a.km-b.km);
    const bands = {near:0, mid:0, far:0};
    for(const f of schedulableFacilities()) bands[distBand(facilityKm(f))]++;
    card.appendChild(el('div', {class:'card-head'}, [el('h2', null, t('locTitle')), el('span', {class:'sub'}, t('bandCounts', bands.near, bands.mid, bands.far)), el('div', {class:'spacer'}),
      el('button', {type:'button', class:'btn sm', onclick:()=>{ const name = (App.ui.lang==='ar'?'موقع ':'Location ')+(App.data.locations.length+1); App.data.locations.push({id:uid('loc'), name, km:0}); commit('data'); node.render(); }}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('locAdd')])]));
    const body = el('div', {class:'card-pad', style:{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:'8px'}});
    for(const l of locs){
      const band = distBand(l.km);
      const n = App.data.facilities.filter(f=>f.locationId===l.id).length;
      body.appendChild(el('div', {class:'row', style:{padding:'6px 8px 6px 10px', border:'1px solid var(--line)', borderRadius:'10px', background:'var(--raised)'}}, [
        el('span', {class:'tag '+band, style:{minWidth:'46px', justifyContent:'center'}}, t(band==='near'?'bandNear':(band==='far'?'bandFar':'bandMid'))),
        el('input', {class:'input sm', value:l.name, style:{flex:'1', minWidth:'0', border:'0', background:'transparent', padding:'0 4px'}, 'aria-label':t('fLocation'), onchange:e=>{ l.name = e.target.value.trim() || l.name; commit('data'); }}),
        el('span', {class:'muted num', style:{fontSize:'11px'}}, n ? String(n) : ''),
        Stepper(l.km, v=>{ l.km = v; commit('data'); node.render(); }, {min:0, max:999, sm:true, unit:t('km')})
      ]));
    }
    card.appendChild(body);
    return card;
  });
}
