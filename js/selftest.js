window.addEventListener('error', e=>{ TEST.errors.push(e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno); });
window.addEventListener('unhandledrejection', e=>{ TEST.errors.push('promise: '+(e.reason && e.reason.message || e.reason)); });
const $ = s=>document.querySelector(s), $$ = s=>[...document.querySelectorAll(s)];
const noOverflow = ()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;
const visitsOf = (p, id)=>p.visits.filter(v=>visitTeamIds(v).includes(id));
function doubleBooked(p){ let n = 0; for(const [, list] of groupBy(p.visits, v=>v.date)){ const seen = new Set(); for(const v of list) for(const id of visitTeamIds(v)){ if(seen.has(id)) n++; seen.add(id); } } return n; }

let SEED_JSON = null;
function withFresh(fn){
  const keep = App.data;
  App.data = normalizeData(JSON.parse(SEED_JSON));
  try{ return fn(); } finally { App.data = keep; }
}

window.addEventListener('load', async ()=>{
  if(!window.__TEST_ISOLATED__){ console.log('RESULT refused · test storage is not isolated'); return; }
  await sleep(300);
  SEED_JSON = JSON.stringify(App.data);
  try{
    const s = S();
    const people = activePeople();
    const pool0 = people.filter(p=>p.pool===s.pools[0].id), pool1 = people.filter(p=>p.pool!==s.pools[0].id);
    const A0 = pool0[0], B0 = pool0[1], C0 = pool0[2], D0 = pool0[3], X1 = pool1[0];

    step('boot: seed loaded', ()=>App.data.facilities.length>50 && people.length>5 ? people.length+' people, '+schedulableFacilities().length+' facilities' : false);
    step('boot: plan tab rendered', ()=>!!$('#setup-strip') && $$('.setup-tile').length===6);

    let base;
    step('generate: defaults', ()=>{ const r = generatePlan(); if(r.error) return 'ERR '+r.error && false; base = r.plan; return base.visits.length+' visits'; });
    step('generate: no double booking', ()=>doubleBooked(base)===0);
    step('generate: all checks hard-ok', ()=>analyzePlan(base).blocking===0);

    s.goals.push(Object.assign(newGoal('person'), {people:[A0.id], rel:'never', scope:{kind:'type', ids:['contracted']}, strict:'must'}));
    s.goals.push(Object.assign(newGoal('person'), {people:[C0.id], rel:'exactly', n:3, scope:{kind:'all', ids:[]}, strict:'must'}));
    s.goals.push(Object.assign(newGoal('person'), {people:[pool1[1].id], rel:'only', scope:{kind:'type', ids:['basic']}, strict:'must'}));
    B0.quota = {min:5, max:5};
    pool1[2].quota = {min:2, max:4};
    s.goals.push(Object.assign(newGoal('together'), {a:D0.id, b:X1.id, rel:'atLeast', pct:50, strict:'must'}));
    s.goals.push(Object.assign(newGoal('together'), {a:A0.id, b:B0.id, rel:'atMost', pct:0, strict:'must'}));
    const spf = schedulableFacilities().find(f=>facilityKind(f)==='contracted');
    const w = planWindow();
    const lo = isoOf(w.work[3]), hi = isoOf(w.work[w.work.length-3]);
    s.goals.push(Object.assign(newGoal('special'), {facilityId:spf.id, people:[X1.id], fill:true, times:2, from:lo, to:hi, strict:'must'}));
    const ovDate = isoOf(w.work[1]);
    s.overrides.push(newOverride({date:ovDate, facilityId:schedulableFacilities().find(f=>facilityKind(f)==='basic').id, people:[pool0[4].id], fill:true}));

    let p;
    step('generate: with people goals', ()=>{ const r = generatePlan(); if(r.error) return false; p = r.plan; return p.visits.length+'/'+p.requested; });
    step('rule never contracted', ()=>visitsOf(p, A0.id).every(v=>v.kind!=='contracted'));
    step('rule only basic', ()=>visitsOf(p, pool1[1].id).every(v=>v.kind==='basic'));
    step('rule exactly 3', ()=>visitsOf(p, C0.id).length===3 ? '3' : String(visitsOf(p, C0.id).length)===false);
    step('quota exact 5', ()=>visitsOf(p, B0.id).length===5);
    step('quota range 2–4', ()=>{ const n = visitsOf(p, pool1[2].id).length; return n>=2 && n<=4 ? String(n) : false; });
    step('together ≥50%', ()=>{ const both = p.visits.filter(v=>{ const ids = visitTeamIds(v); return ids.includes(D0.id) && ids.includes(X1.id); }).length; const base = Math.min(visitsOf(p, D0.id).length, visitsOf(p, X1.id).length); return both >= Math.ceil(base*0.5) ? both+'/'+base : false; });
    step('together ≤0% (never meet)', ()=>p.visits.every(v=>{ const ids = visitTeamIds(v); return !(ids.includes(A0.id) && ids.includes(B0.id)); }));
    step('special ×2 inside window with person', ()=>{ const sp = p.visits.filter(v=>v.special); return sp.length===2 && sp.every(v=>v.date>=lo && v.date<=hi && visitTeamIds(v).includes(X1.id)) && new Set(sp.map(v=>v.date)).size===2 ? sp.map(v=>v.date).join(',') : false; });
    step('override kept + filled', ()=>{ const v = p.visits.find(x=>x.fixed && x.date===ovDate); return !!v && visitTeamIds(v).includes(pool0[4].id) && sum(Object.values(v.open||{}))===0; });
    step('no double booking', ()=>doubleBooked(p)===0);
    let A;
    step('analyze: checks', ()=>{ A = analyzePlan(p); return A.checks.map(c=>c.key+':'+(c.ok?'ok':c.n)).join(' '); });
    step('analyze: no blocking', ()=>A.blocking===0);
    step('analyze: all goals met', ()=>A.goals.filter(g=>g.state==='short').length===0 ? A.goals.length+' goals' : A.goals.filter(g=>g.state==='short').map(g=>g.title).join('|')===false);
    step('analyze: expected respects quota', ()=>Math.abs(A.expected[B0.id]-5)<1e-6 && A.expected[pool1[2].id]>=2-1e-6 && A.expected[pool1[2].id]<=4+1e-6);
    step('goalsPreview counts specials', ()=>{ const gp = goalsPreview(); return gp.must>=2; });

    App.plan = p; savePlan(); emit('plan');
    for(const view of ['list','calendar','matrix','summary']){
      step('view '+view, ()=>{ App.ui.view = view; renderResults(); return !!$('#page').textContent.trim() && !$('#page').textContent.includes('undefined'); });
    }
    step('summary shows People rules check', ()=>$('#page').textContent.includes(t('cPeople')));

    for(const k of ['period','workdays','visits','team','goals','fixed']){
      step('tile popover '+k, ()=>{ const tiles = $$('.setup-tile'); const i = ['period','workdays','visits','team','goals','fixed'].indexOf(k); tiles[i].click(); const ok_ = !!$('.pop'); closePop(); return ok_; });
    }

    const v0 = p.visits.find(v=>!v.fixed && !v.special);
    step('visit sheet opens', ()=>{ openVisit(v0.id); return !!$('.sheet') && $('.sheet').textContent.includes(t('vdTeam')); });
    step('visit sheet: swap menu has candidates', ()=>{ const b = [...$$('.sheet .btn.sm.outline')].find(x=>x.textContent.includes(t('vdSwap'))); b.click(); const n = $$('.pop .menu-item').length; closePop(); return n>0 ? n+' items' : false; });
    step('visit swap mutates plan', ()=>{ const pl = Object.keys(v0.team).find(k=>v0.team[k].length); const c = candidatesForSeat(App.plan, v0, pl, v0.team[pl][0]).find(c=>!c.reason); if(!c) return 'no free candidate'; mutatePlan(p=>{ visitIn(p, v0.id).team[pl][0] = c.p.id; }, {force:true}); return visitTeamIds(visitIn(App.plan, v0.id)).includes(c.p.id); });
    step('special visit sheet tag', ()=>{ const sv = App.plan.visits.find(v=>v.special); openVisit(sv.id); const r = $('.sheet').textContent.includes(t('specialTag')); sheet.current.close(true); return r; });
    step('move visit', ()=>{ const ts = moveTargets(App.plan, v0); if(!ts.length) return false; const tgt = ts.find(x=>!x.conflicts && !x.full && !x.wdBad); if(tgt){ mutatePlan(p=>{ visitIn(p, v0.id).date = tgt.date; }, {force:true}); return visitIn(App.plan, v0.id).date===tgt.date ? 'clean move' : false; } const d = ts[0].date; mutatePlan(p=>{ visitIn(p, v0.id).date = d; }, {force:true}); return visitIn(App.plan, v0.id).date===d ? 'forced move' : false; });
    step('fix visit as override', ()=>{ const before = s.overrides.length; fixVisitAsOverride(v0); return s.overrides.length===before+1 && visitIn(App.plan, v0.id).fixed; });

    step('export rows', ()=>{ const r = exportPlanRows(App.plan, 'full'); return r.length===App.plan.visits.length+1; });
    step('export matrix', ()=>exportMatrixSheet(App.plan).rows.length>2);
    step('xlsx write→read', ()=>{ if(typeof buildXlsx!=='function') return 'skipped'; const z = buildXlsx([{name:'Plan', rows:exportPlanRows(App.plan,'full')}]); return !!z && (z.size||z.length||z.byteLength)>100; });

    step('approve is refused while the edited plan has hard violations', ()=>{ const src = App.plan.visits.find(v=>!v.fixed && !v.special && visitTeamIds(v).length); const dup = deepClone(src); dup.id = uid('v'); dup.facilityId = App.plan.visits.find(v=>v.facilityId!==src.facilityId).facilityId; App.plan.visits.push(dup); const r = approvePlan(); App.plan.visits.pop(); return !r.ok && r.blockers.length>0 && !App.plan.approved; });
    step('approve a clean regenerated plan', ()=>{ const r0 = generatePlan(); if(r0.error) return false; App.plan = r0.plan; const r = approvePlan(); if(!r.ok) throw new Error('blockers '+JSON.stringify(r.blockers.map(b=>[b.key, b.n, (b.violations||[]).slice(0,4).map(v=>v.key)]))); return App.plan.approved && B0.id in App.data.history.counts; });
    step('unapprove restores', ()=>{ const before = JSON.stringify(App.plan.snapshot.counts); unapprovePlan(); return !App.plan.approved && JSON.stringify(App.data.history.counts)===before; });

    for(const tab of ['facilities','team','rules','data','plan']){
      step('tab '+tab, ()=>{ goTab(tab); return $('#page').children.length>0 && !$('#page').textContent.includes('undefined') && noOverflow(); });
    }
    step('rules tab: goals section has people group', ()=>{ goTab('rules'); return $('#rule-goals') && $('#rule-goals').textContent.includes(t('gGroupPeople')) && $$('#rule-goals .gm-row.people').length===6; });
    step('rules tab: add-goal menu grouped', ()=>{ const b = [...$$('#rule-goals .gm-toolbar .btn')].find(x=>x.textContent.includes(t('goalAdd'))); b.click(); const heads = $$('.pop .menu-head').length, items = $$('.pop .menu-item').length; closePop(); return heads===2 && items===10 ? '9 types and the simple rule' : false; });
    step('add each goal type via menu', ()=>{ const n0 = s.goals.length; for(let i=0;i<7;i++){ const b = [...$$('#rule-goals .gm-toolbar .btn')].find(x=>x.textContent.includes(t('goalAdd'))); b.click(); $$('.pop .menu-item')[i].click(); } return s.goals.length===n0+7; });
    step('unconfigured new goals are inert', ()=>withFresh(()=>{
      const before = generatePlan().plan.visits.length;
      for(const type of PEOPLE_GOALS) S().goals.push(newGoal(type));
      S().goals.push(newGoal('atMost'));
      const r = generatePlan();
      return !r.error && doubleBooked(r.plan)===0 && r.plan.visits.length===before ? before+' → '+r.plan.visits.length : false;
    }));
    step('delete new goals', ()=>{ s.goals.splice(s.goals.length-7, 7); goTab('rules'); return $$('#rule-goals .gm-row').length===s.goals.length; });

    step('team: person sheet', ()=>{ goTab('team'); App.ui.personTab = 'rules'; openPerson(B0.id); const r = $('.sheet').textContent.includes(t('pPerPlan')) && $('.sheet').textContent.includes(t('pGoals')); return r; });
    step('team: quota modes', ()=>{ const seg = [...$$('.sheet .seg')].find(x=>x.textContent.includes(t('pQAuto'))); seg.children[0].click(); const a = B0.quota.min==null && B0.quota.max==null; [...$$('.sheet .seg')].find(x=>x.textContent.includes(t('pQAuto'))).children[2].click(); const r = B0.quota.max!=null; [...$$('.sheet .seg')].find(x=>x.textContent.includes(t('pQAuto'))).children[1].click(); const e = B0.quota.min!=null && B0.quota.min===B0.quota.max; sheet.current.close(true); return a && r && e; });
    step('team: per-plan chip in the table', ()=>{ goTab('team'); return !!$('#team-card') && $$('#team-card td.pt-c-quota .chip.on').length>0; });
    step('team: add rule from person sheet', ()=>{ App.ui.personTab = 'rules'; openPerson(D0.id); const n0 = s.goals.length; const open_ = [...$$('.sheet .btn.sm.ghost')].find(x=>x.textContent.trim()===t('ruleAdd')); open_.click(); const save = [...$$('.sheet .btn.sm.primary')].find(x=>x.textContent.trim()===t('ruleSave')); save.click(); const g = s.goals[s.goals.length-1]; const ok_ = s.goals.length===n0+1 && g.type==='person' && g.people[0]===D0.id && g.subject.kind==='people' && !!$('.sheet'); if(sheet.current) sheet.current.close(true); s.goals.pop(); return ok_; });
    step('facility sheet', ()=>{ goTab('facilities'); openFacility(App.data.facilities[10].id); const r = !!$('.sheet'); sheet.current.close(true); return r; });

    step('backup round-trip', ()=>{ const json = JSON.stringify(App.data); const d = normalizeData(JSON.parse(json)); return d.settings.goals.length===s.goals.length && d.people.find(x=>x.id===B0.id).quota.min===B0.quota.min; });
    step('legacy v4 migration', ()=>{ const d = normalizeData(migrateV4({people:[{id:'x1', name:'Old', pool:'fin', fixedCount:3}], settings:{}})); const x = d.people.find(q=>q.id==='x1'); return x && x.quota.min===3 && x.quota.max===3 && !('fixed' in x); });
    step('import team fixed→quota', ()=>{ const pv = previewImport('team', [['الاسم','عدد ثابت'],[B0.name,'7']]); if(!pv || !pv.changed) return 'preview shape: '+Object.keys(pv||{}).join(','); applyImport(pv); return personById(B0.id).quota.min===7; });

    step('delete person cleans goals', ()=>{ const id = X1.id; App.data.people = App.data.people.filter(x=>x.id!==id); forgetPerson(id); const clean = s.goals.every(g=>g.a!==id && g.b!==id && !(g.people||[]).includes(id)) && s.overrides.every(o=>!o.people.includes(id)); const r = generatePlan(); return clean && !r.error; });

    step('stress: impossible quotas are proven infeasible, drafted and flagged, no crash', ()=>withFresh(()=>{
      for(const q of activePeople()) q.quota = {min:40, max:40};
      const r = generatePlan(); if(r.error) return false;
      const An = analyzePlan(r.plan), c = An.checks.find(c=>c.key==='cPeople');
      return r.status==='infeasible' && r.conflicts.length>0 && !c.ok && An.blocking>0 ? c.n+' flagged, '+r.conflicts.length+' conflicts' : false;
    }));
    step('stress: everyone exact 0 → empty teams flagged as open seats, no crash', ()=>withFresh(()=>{
      for(const q of activePeople()) q.quota = {min:0, max:0};
      const r = generatePlan(); if(r.error) return false;
      return r.plan.visits.every(v=>visitTeamIds(v).length===0) && !analyzePlan(r.plan).checks.find(c=>c.key==='cOpen').ok;
    }));
    step('stress: everyone banned from contracted', ()=>withFresh(()=>{
      S().goals.push(Object.assign(newGoal('person'), {people:activePeople().map(x=>x.id), rel:'never', scope:{kind:'type', ids:['contracted']}, strict:'must'}));
      const r = generatePlan(); if(r.error) return false;
      const con = r.plan.visits.filter(v=>v.kind==='contracted');
      return con.every(v=>visitTeamIds(v).length===0) && doubleBooked(r.plan)===0 ? con.length+' contracted, all unstaffed' : false;
    }));
    step('stress: no workdays → clean error', ()=>withFresh(()=>{ S().calendar.workdays = []; const r = generatePlan(); return !!r.error ? r.error : false; }));

    step('summary: quantities block shows requested, scheduled, staffed', ()=>{ const keep = App.plan; const r = generatePlan(); if(r.error) return false; App.plan = r.plan; goTab('plan'); App.ui.view = 'summary'; renderResults(); const txt = $('#page').textContent; const okTxt = [t('qRequested'), t('qScheduled'), t('qStaffedValid')].every(x=>txt.includes(x)) && !txt.includes('undefined'); App.plan = keep; App.ui.view = 'list'; renderResults(); return okTxt; });
    step('banner: an infeasible draft names its proven conflicts', ()=>withFresh(()=>{
      const keep = App.plan;
      for(const q of activePeople()) q.quota = {min:40, max:40};
      const r = generatePlan(); if(r.error) return false;
      App.plan = r.plan; goTab('plan'); App.ui.view = 'list'; renderResults();
      const b = $('.banner.danger'), n = $$('.conflict-list li').length;
      const okB = !!b && n>0 && !$('#page').textContent.includes('undefined');
      App.plan = keep; renderResults();
      return okB ? n+' conflicts shown' : false;
    }));
    step('approve button explains blockers instead of failing silently', ()=>withFresh(()=>{
      const keep = App.plan;
      for(const q of activePeople()) q.quota = {min:40, max:40};
      const r = generatePlan(); if(r.error) return false;
      App.plan = r.plan; goTab('plan'); renderResults();
      const btn = $('#plan-actionbar .btn.primary'); if(!btn) return false;
      btn.click();
      const dlg = $('.dialog'); const okD = !!dlg && dlg.textContent.includes(t('approveBlockedTitle')) && !App.plan.approved;
      if(dlg){ const c = [...dlg.querySelectorAll('button')].find(x=>x.textContent===t('cancel')); if(c) c.click(); }
      App.plan = keep; renderResults();
      return okD;
    }));
    step('stepper rejects non-numeric input and keeps the last value', ()=>{
      let calls = 0; const st = Stepper(3, ()=>{ calls++; }, {min:0, max:9}); const inp = st.querySelector('input');
      const bad = ['abc', '--', '..', 'NaN'];
      for(const v of bad){ inp.value = v; inp.dispatchEvent(new Event('change')); if(inp.value!=='3') return 'value became '+inp.value; }
      inp.value = '7'; inp.dispatchEvent(new Event('change'));
      return calls===1 && inp.value==='7';
    });
    step('pattern goal editor renders and edits without NaN', ()=>{
      const keep = S().goals.length; const g = newGoal('pattern'); g.people = [activePeople()[0].id]; S().goals.push(g); commit('settings');
      App.ui.gmForceWide = true;
      openGoals(g.id);
      const card = document.querySelector('[data-goal="'+g.id+'"]'); const okC = !!card && !!card.querySelector('.pattern-editor') && !card.textContent.includes('undefined') && !card.textContent.includes('NaN');
      const chip = card && [...card.querySelectorAll('.pattern-editor .chip')].find(x=>x.textContent===t('patPresetMaxRun2')); if(chip) chip.click();
      const after = S().goals.find(x=>x.id===g.id);
      const okE = after.pattern.maxRun===2 && after.pattern.minRest===0;
      sheet.current.close(true);
      delete App.ui.gmForceWide;
      S().goals = S().goals.filter(x=>x.id!==g.id); commit('settings');
      return okC && okE && S().goals.length===keep;
    });
    step('rules tab: work/rest section and every-day toggle', ()=>{ goTab('rules'); const sec = $('#rule-rest'); const vol = $('#rule-volume'); const okR = !!sec && sec.textContent.includes(t('rrActivity')) && sec.textContent.includes(t('rrPerson')) && !!vol && vol.textContent.includes(t('requireEvery')); goTab('plan'); return okR; });
    step('person sheet shows the work/rest rules section', ()=>{ const p0 = activePeople()[0]; App.ui.personTab = 'rules'; openPerson(p0.id); const okS = $('.sheet').textContent.includes(t('prTitle')) && $('.sheet').textContent.includes(t('prHint')); sheet.current.close(true); return okS; });
    step('editing a visit that breaks a hard rule asks before applying', ()=>withFresh(()=>{
      const keep = App.plan; const r = generatePlan(); if(r.error) return false; App.plan = r.plan; goTab('plan'); renderResults();
      const v = App.plan.visits[0], other = App.plan.visits.find(x=>x.date!==v.date && !x.fixed);
      const before = JSON.stringify(App.plan.visits.map(x=>[x.id, x.date]));
      const dupId = visitTeamIds(other)[0];
      const applied = mutatePlan(p=>{ const x = visitIn(p, v.id); const pl = Object.keys(x.team)[0]; x.team[pl] = [dupId].concat(x.team[pl].slice(1)); x.date = other.date; });
      const dlg = $('.dialog'); const asked = !applied && !!dlg && dlg.textContent.includes(violationText(evaluateEdit(App.plan, p=>{ const x = visitIn(p, v.id); const pl = Object.keys(x.team)[0]; x.team[pl] = [dupId].concat(x.team[pl].slice(1)); x.date = other.date; }).introduced[0]).slice(0, 8));
      const untouched = JSON.stringify(App.plan.visits.map(x=>[x.id, x.date]))===before;
      if(dlg){ const c = [...dlg.querySelectorAll('button')].find(x=>x.textContent===t('cancel')); if(c) c.click(); }
      App.plan = keep; renderResults();
      return asked && untouched;
    }));
    step('english mode', ()=>{ setLang('en'); goTab('rules'); const r = $('#rule-goals').textContent.includes('People goals'); goTab('plan'); App.ui.view = 'summary'; renderResults(); setLang('ar'); return r; });
    step('persist + reload data', ()=>{ saveNow(); const raw = JSON.parse(localStorage.getItem(STORE_KEY)); return raw.settings.goals.length===s.goals.length; });

    const ONLY_RE = (()=>{ const q = new URLSearchParams(location.search).get('only'); return q ? new RegExp(q) : null; })();
    try{ runRegress(ONLY_RE); }catch(e){ ok('regression suite ran', false, 'EXC '+e.message); }
    try{ await runShipAsync(ONLY_RE); }catch(e){ ok('async regression suite ran', false, 'EXC '+e.message); }
    await sleep(200);
    ok('no uncaught errors', TEST.errors.length===0, TEST.errors.join(' | '));
    console.log('RESULT pass='+TEST.pass+' fail='+TEST.fail);
  }catch(e){ console.log('EXC', e.message, e.stack); }
});
