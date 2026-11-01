function renderData(root){
  root.appendChild(Mount(node=>{
    const out = [];
    const D = App.data;
    out.push(el('section', {class:'kpis', id:'data-stats'}, [
      el('div', {class:'kpi'}, [el('div', {class:'n num'}, String(schedulableFacilities().length)), el('div', {class:'l'}, t('statsFac'))]),
      el('div', {class:'kpi'}, [el('div', {class:'n num'}, String(activePeople().length)), el('div', {class:'l'}, t('statsPeople'))]),
      el('div', {class:'kpi'}, [el('div', {class:'n num'}, String(D.history.lastCycle||0)), el('div', {class:'l'}, t('statsCycle'))]),
      el('div', {class:'kpi'}, [el('div', {class:'n num'}, String(sum(D.facilities, f=>f.visitCount||0))), el('div', {class:'l'}, t('fVisits'))])
    ]));

    const imp = el('section', {class:'card', id:'import-card'});
    imp.appendChild(el('div', {class:'card-head'}, [el('h2', null, t('impTitle'))]));
    let kind = App.ui.impKind || 'history';
    const body = el('div', {class:'card-pad stack'});
    body.appendChild(el('div', {class:'row wrap'}, [Seg([{value:'history',label:t('impHistory')},{value:'facilities',label:t('impFacilities')},{value:'team',label:t('impTeam')}], kind, v=>{ App.ui.impKind = v; App.ui.impPreview = null; node.render(); }), el('div', {class:'spacer'}), el('button', {type:'button', class:'btn sm ghost', onclick:()=>downloadTemplate(kind)}, [el('span', {html:ICON.download, style:{display:'flex'}}), t('impTemplate')])]));
    const pv = App.ui.impPreview;
    if(!pv){
      const input = el('input', {type:'file', accept:'.xlsx,.csv,.tsv,.txt', hidden:true});
      const handle = async file=>{ try{ const sheets = await readSheets(file); App.ui.impOpts = {}; App.ui.impPreview = previewImportSheets(kind, sheets, App.ui.impOpts); }catch(e){ console.error(e); App.ui.impPreview = {error:t('impError')}; } node.render(); };
      input.addEventListener('change', ()=>{ if(input.files[0]) handle(input.files[0]); });
      const drop = el('div', {class:'drop', tabindex:'0', role:'button', onclick:()=>input.click(), onkeydown:e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); input.click(); } }}, [el('div', {html:ICON.upload, style:{display:'flex', justifyContent:'center', marginBottom:'6px'}}), t('impDrop')]);
      drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', ()=>drop.classList.remove('over'));
      drop.addEventListener('drop', e=>{ e.preventDefault(); drop.classList.remove('over'); if(e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
      const ta = el('textarea', {class:'input', rows:4, placeholder:t('impPaste'), style:{width:'100%', fontFamily:'var(--font-num)', fontSize:'12px'}});
      appendKids(body, [drop, input, ta, el('div', {class:'row'}, el('button', {type:'button', class:'btn sm', onclick:()=>{ if(!ta.value.trim()) return; App.ui.impOpts = {}; App.ui.impPreview = previewImportSheets(kind, [{name:'paste', rows:parseDelimited(ta.value)}], App.ui.impOpts); node.render(); }}, t('impParse')))]);
    } else if(pv.error){
      appendKids(body, [el('div', {class:'banner warn'}, pv.error), el('button', {type:'button', class:'btn sm', style:{alignSelf:'flex-start'}, onclick:()=>{ App.ui.impPreview = null; node.render(); }}, t('back'))]);
    } else {
      const lines = [];
      const rePreview = patch=>{ App.ui.impOpts = Object.assign({}, App.ui.impOpts || pv.opts || {}, patch); App.ui.impPreview = previewImportSheets(kind, pv.source, App.ui.impOpts); node.render(); };
      const curMap = opt=>Object.assign({}, (App.ui.impOpts && App.ui.impOpts[opt]) || {});
      if(pv.sheets && pv.sheets.length>1){
        lines.push(el('div', {class:'field'}, [el('label', null, t('impSheet')), Select(pv.sheets.map(x=>({value:x.name, label:(x.label || x.name)+' · '+x.rows})), pv.sheet, v=>rePreview({sheet:v, includeTypes:null, fields:null, peopleMap:{}, facilityMap:{}, categoryMap:{}, poolMap:{}}), {sm:true})]));
      }
      const tone = {ok:ICON.ok, soft:ICON.info, bad:ICON.alert};
      for(const pn of pv.panels || []){
        if(pn.type==='check') lines.push(el('div', {class:'check '+pn.tone}, [el('span', {html:tone[pn.tone] || ICON.info, style:{display:'flex'}}), pn.text, pn.detail ? el('span', {class:'n'}, pn.detail) : null]));
        else if(pn.type==='chips') lines.push(el('div', {class:'field'}, [el('label', null, pn.label), el('div', {class:'chips'}, pn.items.map(x=>el('button', {type:'button', class:'chip'+(x.on ? ' on' : ''), 'aria-pressed':x.on ? 'true' : 'false', 'data-key':x.key, onclick:()=>{ const on = pn.items.filter(y=>y.on && y.key!==x.key).map(y=>y.key); if(!x.on) on.push(x.key); rePreview({[pn.opt]:on}); }}, x.label))), pn.hint ? el('div', {class:'hint'}, pn.hint) : null]));
        else if(pn.type==='changes') lines.push(el('div', {class:'field'}, [el('label', null, pn.label), el('div', {class:'stack', style:{gap:'2px', fontSize:'12.5px'}}, pn.rows.map(r=>el('div', {class:'muted'}, r)).concat(pn.more ? [el('div', {class:'muted'}, t('impMore', pn.more))] : []))]));
        else if(pn.type==='map') lines.push(el('div', {class:'field'}, [el('label', null, pn.label), ...pn.rows.map(r=>el('div', {class:'row wrap', style:{gap:'8px', alignItems:'center'}, 'data-row':r.key}, [el('b', null, r.name), r.count>1 ? el('span', {class:'muted'}, '× '+r.count) : null, Select(r.options, r.value, v=>{ const m = curMap(pn.opt); if(v) m[r.key] = v; else delete m[r.key]; rePreview({[pn.opt]:m}); }, {sm:true})]))]));
      }
      if(!pv.panels) lines.push(el('div', {class:'banner warn'}, t('impError')));
      appendKids(body, [el('div', {class:'stack', style:{gap:'6px'}}, lines), el('div', {class:'row'}, [
        el('button', {type:'button', class:'btn ghost', onclick:()=>{ App.ui.impPreview = null; node.render(); }}, t('cancel')),
        el('button', {type:'button', class:'btn primary', disabled:!pv.canApply, onclick:()=>{ applyImport(pv); App.ui.impPreview = null; node.render(); }}, t('impApply'))
      ])]);
    }
    imp.appendChild(body);
    out.push(imp);

    if(D.unresolved.length){
      const un = el('section', {class:'card', id:'unresolved-card'});
      un.appendChild(el('div', {class:'card-head'}, [el('h2', null, t('unTitle')), el('span', {class:'tag warn'}, String(D.unresolved.length))]));
      const ub = el('div', {class:'card-pad stack', style:{gap:'6px'}});
      for(const u of D.unresolved.slice()){
        const link = el('button', {type:'button', class:'btn sm outline'}, t('unLink'));
        link.addEventListener('click', ()=>menu(link, teamPeople().map(p=>({label:p.name, meta:poolName(poolById(p.pool)), onClick:()=>{ D.aliases.people[norm(u.name)] = p.id; D.unresolved = D.unresolved.filter(x=>x!==u); commit('data', {keepPlan:true}); node.render(); }})), {search:true}));
        ub.appendChild(el('div', {class:'row', style:{padding:'6px 0', borderBottom:'1px dashed var(--line)'}}, [
          el('b', {style:{fontWeight:'500'}}, u.name), el('span', {class:'muted num', style:{fontSize:'12px'}}, '×'+u.count), el('div', {class:'spacer'}),
          link,
          el('button', {type:'button', class:'btn sm outline', onclick:()=>{ const p = freshPerson({name:u.name, pool:S().pools[0].id, origin:locIdFor('دمنهور')}); D.people.push(p); D.aliases.people[norm(u.name)] = p.id; D.unresolved = D.unresolved.filter(x=>x!==u); commit('data'); node.render(); }}, t('unAdd')),
          el('button', {type:'button', class:'btn sm ghost', onclick:()=>{ D.unresolved = D.unresolved.filter(x=>x!==u); commit('data', {keepPlan:true}); node.render(); }}, t('unIgnore'))
        ]));
      }
      un.appendChild(ub);
      out.push(un);
    }

    const bk = el('section', {class:'card', id:'backup-card'});
    bk.appendChild(el('div', {class:'card-head'}, [el('h2', null, t('bkTitle'))]));
    const restoreInput = el('input', {type:'file', accept:'.json', hidden:true});
    restoreInput.addEventListener('change', async ()=>{
      const f = restoreInput.files[0]; if(!f) return;
      try{
        const r = restoreBackupObject(JSON.parse(await f.text()));
        if(!r.ok) throw new Error(r.error);
        takeSnapshot('restore');
        const before = JSON.stringify(App.data);
        App.data = r.data; commit('data');
        toast(t('bkRestored'), {label:t('undo'), onClick:()=>{ App.data = normalizeData(sanitizeBackup(JSON.parse(before))); commit('data'); node.render(); }});
        node.render();
      }catch(e){ toast(t('bkError')); }
      restoreInput.value = '';
    });
    bk.appendChild(el('div', {class:'card-pad row wrap'}, [
      el('button', {type:'button', class:'btn outline', onclick:downloadBackupNow}, [el('span', {html:ICON.download, style:{display:'flex'}}), t('bkExport')]),
      el('button', {type:'button', class:'btn outline', onclick:()=>restoreInput.click()}, [el('span', {html:ICON.upload, style:{display:'flex'}}), t('bkRestore')]),
      restoreInput
    ]));
    const snaps = readSnapshots();
    const snapBox = el('div', {class:'card-pad stack', id:'snapshot-list', style:{gap:'6px', paddingTop:'0'}}, [el('h3', {class:'sub'}, t('snapTitle'))]);
    if(!snaps.length) snapBox.appendChild(el('div', {class:'muted'}, t('snapEmpty')));
    snaps.map((sn, i)=>({sn, i})).reverse().forEach(({sn, i})=>{
      snapBox.appendChild(el('div', {class:'row', style:{padding:'4px 0', borderBottom:'1px dashed var(--line)'}}, [
        el('span', {class:'num'}, new Date(sn.at).toLocaleString(App.ui.lang==='ar' ? 'ar-EG' : 'en-GB')),
        el('span', {class:'muted'}, t('snapR_'+sn.reason)),
        el('div', {class:'spacer'}),
        el('button', {type:'button', class:'btn sm outline', onclick:()=>{ if(restoreSnapshot(i)){ toast(t('bkRestored')); node.render(); } else toast(t('bkError')); }}, t('snapRestore'))
      ]));
    });
    bk.appendChild(snapBox);
    bk.appendChild(el('div', {class:'card-pad muted num', id:'storage-size', style:{paddingTop:'0'}}, t('storageLabel')+' '+Math.round(storageSize()/1024)+' KB · '+t('appVersion')+' '+APP_VERSION));
    out.push(bk);

    const ap = el('section', {class:'card', id:'appearance-card'});
    ap.appendChild(el('div', {class:'card-head'}, [el('h2', null, t('appearance'))]));
    ap.appendChild(el('div', {class:'card-pad', style:{paddingTop:'6px'}}, [
      setting(t('themeToggle'), null, Seg([{value:'light',label:t('thLight')},{value:'dark',label:t('thDark')},{value:'auto',label:t('thAuto')}], App.ui.theme, v=>setTheme(v))),
      setting(t('language'), null, Seg([{value:'ar',label:'العربية'},{value:'en',label:'English'}], App.ui.lang, v=>setLang(v)))
    ]));
    out.push(ap);

    const rs = el('section', {class:'card', id:'reset-card'});
    rs.appendChild(el('div', {class:'card-head'}, [el('h2', null, t('rsTitle'))]));
    rs.appendChild(el('div', {class:'card-pad row wrap'}, [
      el('button', {type:'button', class:'btn danger', onclick:()=>confirmDialog(t('rsAll'), t('rsQ'), {danger:true, label:t('rsAll'), onConfirm:()=>{ eraseAllData(); }})}, t('rsAll'))
    ]));
    out.push(rs);
    return out;
  }));
}
