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
      const handle = async file=>{ try{ const rows = await readTable(file); App.ui.impPreview = previewImport(kind, rows); }catch(e){ console.error(e); App.ui.impPreview = {error:t('impError')}; } node.render(); };
      input.addEventListener('change', ()=>{ if(input.files[0]) handle(input.files[0]); });
      const drop = el('div', {class:'drop', tabindex:'0', role:'button', onclick:()=>input.click(), onkeydown:e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); input.click(); } }}, [el('div', {html:ICON.upload, style:{display:'flex', justifyContent:'center', marginBottom:'6px'}}), t('impDrop')]);
      drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', ()=>drop.classList.remove('over'));
      drop.addEventListener('drop', e=>{ e.preventDefault(); drop.classList.remove('over'); if(e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
      const ta = el('textarea', {class:'input', rows:4, placeholder:t('impPaste'), style:{width:'100%', fontFamily:'var(--font-num)', fontSize:'12px'}});
      appendKids(body, [drop, input, ta, el('div', {class:'row'}, el('button', {type:'button', class:'btn sm', onclick:()=>{ if(!ta.value.trim()) return; App.ui.impPreview = previewImport(kind, parseDelimited(ta.value)); node.render(); }}, t('impParse')))]);
    } else if(pv.error){
      appendKids(body, [el('div', {class:'banner warn'}, pv.error), el('button', {type:'button', class:'btn sm', style:{alignSelf:'flex-start'}, onclick:()=>{ App.ui.impPreview = null; node.render(); }}, t('back'))]);
    } else {
      const lines = [];
      if(pv.kind==='history'){
        lines.push(el('div', {class:'check ok'}, [el('span', {html:ICON.ok, style:{display:'flex'}}), t('impRows', pv.recs.length, pv.total)]));
        if(pv.newFacilities.length) lines.push(el('div', {class:'check soft'}, [el('span', {html:ICON.info, style:{display:'flex'}}), t('impNew')+': '+pv.newFacilities.length+' '+t('tabFacilities'), el('span', {class:'n'}, pv.newFacilities.slice(0,4).join('، '))]));
        if(pv.unknownPeople.length) lines.push(el('div', {class:'check soft'}, [el('span', {html:ICON.alert, style:{display:'flex'}}), t('impUnknown')+': '+pv.unknownPeople.map(u=>u.name).join('، ')]));
        if(pv.bad) lines.push(el('div', {class:'check bad'}, [el('span', {html:ICON.alert, style:{display:'flex'}}), String(pv.bad)]));
      } else {
        lines.push(el('div', {class:'check ok'}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('impNew'), el('span', {class:'n'}, String(pv.added.length))]));
        lines.push(el('div', {class:'check ok'}, [el('span', {html:ICON.refresh, style:{display:'flex'}}), t('impChanged'), el('span', {class:'n'}, String(pv.changed.length))]));
        if(pv.added.length) lines.push(el('div', {class:'chips'}, pv.added.slice(0,20).map(r=>el('span', {class:'chip'}, r.name))));
      }
      appendKids(body, [el('div', {class:'stack', style:{gap:'6px'}}, lines), el('div', {class:'row'}, [
        el('button', {type:'button', class:'btn ghost', onclick:()=>{ App.ui.impPreview = null; node.render(); }}, t('cancel')),
        el('button', {type:'button', class:'btn primary', onclick:()=>{ applyImport(pv); App.ui.impPreview = null; node.render(); }}, t('impApply'))
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
        const raw = JSON.parse(await f.text());
        let next;
        if(raw && raw.version===5 && Array.isArray(raw.facilities)) next = normalizeData(raw);
        else if(raw && Array.isArray(raw.facilities) && Array.isArray(raw.people) && raw.settings) next = normalizeData(migrateV4(raw));
        else throw new Error('shape');
        const before = JSON.stringify(App.data);
        App.data = next; commit('data');
        toast(t('bkRestored'), {label:t('undo'), onClick:()=>{ App.data = normalizeData(JSON.parse(before)); commit('data'); }});
        node.render();
      }catch(e){ toast(t('bkError')); }
    });
    bk.appendChild(el('div', {class:'card-pad row wrap'}, [
      el('button', {type:'button', class:'btn outline', onclick:()=>downloadBlob(new TextEncoder().encode(JSON.stringify(Object.assign({exportedAt:todayISO()}, App.data), null, 1)), 'alkhitta-'+todayISO()+'.json', 'application/json')}, [el('span', {html:ICON.download, style:{display:'flex'}}), t('bkExport')]),
      el('button', {type:'button', class:'btn outline', onclick:()=>restoreInput.click()}, [el('span', {html:ICON.upload, style:{display:'flex'}}), t('bkRestore')]),
      restoreInput
    ]));
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
      el('button', {type:'button', class:'btn danger', onclick:()=>confirmDialog(t('rsAll'), t('rsQ'), {danger:true, label:t('rsAll'), onConfirm:()=>{ for(const k of Object.keys(localStorage)) if(k.startsWith('alkhitta.')) localStorage.removeItem(k); location.hash = ''; location.reload(); }})}, t('rsAll'))
    ]));
    out.push(rs);
    return out;
  }));
}
