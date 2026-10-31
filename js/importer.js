const ImpText = {
  clean(s){
    return String(s==null ? '' : s)
      .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
      .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  },
  key(s){ return norm(ImpText.clean(s)); },
  bare(s){ return ImpText.key(s).replace(/(^|\s)ال/g, '$1').replace(/\s+/g, ''); },
  splitList(raw){
    const seen = new Set(), out = [];
    const text = String(raw==null ? '' : raw).replace(/[\r\n]+/g, ' - ');
    const parts = ImpText.clean(text).split(/\s*[\-\u2010-\u2015\u2212\u0640\u060C\u061B,;\/\\+&|]+\s*|\s+و\s+|\s+and\s+/i);
    for(const p of parts){
      const c = ImpText.clean(p);
      const k = ImpText.key(c);
      if(!k || seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
    return out;
  },
  distance(a, b, max){
    if(Math.abs(a.length-b.length)>max) return max+1;
    let prev = Array.from({length:b.length+1}, (_, i)=>i);
    for(let i=1; i<=a.length; i++){
      const cur = [i];
      let low = cur[0];
      for(let j=1; j<=b.length; j++){
        cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(a[i-1]===b[j-1] ? 0 : 1));
        if(cur[j]<low) low = cur[j];
      }
      if(low>max) return max+1;
      prev = cur;
    }
    return prev[b.length];
  }
};

class EntityMatcher {
  constructor(entities, aliases){
    this.entities = entities;
    this.aliases = aliases || {};
    this.byKey = new Map();
    this.byBare = new Map();
    this.ids = new Set(entities.map(e=>e.id));
    for(const e of entities){
      for(const n of e.names){
        const k = ImpText.key(n);
        if(k && !this.byKey.has(k)) this.byKey.set(k, e.id);
        const b = ImpText.bare(n);
        if(b){ if(!this.byBare.has(b)) this.byBare.set(b, new Set()); this.byBare.get(b).add(e.id); }
      }
    }
  }
  score(k, e){
    const kt = k.split(' ');
    let best = 0;
    for(const n of e.names){
      const nk = ImpText.key(n);
      if(!nk) continue;
      const nt = nk.split(' ');
      const inter = kt.filter(w=>nt.includes(w)).length;
      const union = new Set(kt.concat(nt)).size;
      let s = inter/union;
      const sub = kt.every(w=>nt.includes(w)) || nt.every(w=>kt.includes(w));
      if(sub) s = Math.max(s, 0.6+0.3*Math.min(kt.length, nt.length)/Math.max(kt.length, nt.length));
      const bk = ImpText.bare(k), bn = ImpText.bare(nk);
      if(bk.length>=4 && bn.length>=4){
        const d = ImpText.distance(bk, bn, bk.length<=6 ? 1 : 2);
        if(d<=(bk.length<=6 ? 1 : 2)) s = Math.max(s, 0.9-0.1*d);
      }
      best = Math.max(best, s);
    }
    return best;
  }
  resolve(raw){
    const k = ImpText.key(raw);
    if(!k) return {tier:'none', id:null, candidates:[]};
    if(this.byKey.has(k)) return {tier:'exact', id:this.byKey.get(k), candidates:[]};
    const al = this.aliases[k];
    if(al && this.ids.has(al)) return {tier:'alias', id:al, candidates:[]};
    const ids = this.byBare.get(ImpText.bare(raw));
    if(ids && ids.size===1) return {tier:'loose', id:[...ids][0], candidates:[]};
    const cands = this.entities.map(e=>({id:e.id, score:this.score(k, e)})).filter(x=>x.score>=0.5).sort((a, b)=>b.score-a.score).slice(0, 5);
    return {tier:cands.length ? 'suggest' : 'none', id:null, candidates:cands};
  }
}

function impPeopleMatcher(){
  const D = App.data;
  const aliases = Object.assign({}, (D.aliases && D.aliases.people) || {});
  for(const raw of Object.keys(typeof PERSON_ALIASES==='undefined' ? {} : PERSON_ALIASES)){
    const target = D.people.find(p=>ImpText.key(p.name)===ImpText.key(PERSON_ALIASES[raw]));
    if(target && !aliases[ImpText.key(raw)]) aliases[ImpText.key(raw)] = target.id;
  }
  return new EntityMatcher(D.people.map(p=>({id:p.id, names:[p.name]})), aliases);
}
function impFacilityMatcher(){
  const D = App.data;
  return new EntityMatcher(D.facilities.map(f=>({id:f.id, names:[f.name]})), (D.aliases && D.aliases.facilities) || {});
}

const HISTORY_SPEC = {
  cols:{
    facility:['جهة المرور', 'الجهة', 'اسم الجهة', 'facility'],
    category:['المنطقة', 'التصنيف', 'category'],
    cycle:['الخطة', 'الدورة', 'cycle'],
    type:['المرور', 'نوع المرور', 'النوع', 'type'],
    date:['التاريخ', 'date'],
    team:['القائم بالمرور', 'القائمين بالمرور', 'الفريق', 'team'],
    location:['الموقع', 'location']
  },
  required:['facility', 'date', 'team'],
  sheetHints:['الاصلي', 'original', 'history', 'visits', 'السجل'],
  defaultTypes:['خطة المرور']
};

const ImportPipeline = {
  findHeader(rows, spec){
    let best = null;
    const limit = Math.min(rows.length, 12);
    for(let i=0; i<limit; i++){
      const header = rows[i] || [];
      const map = {};
      header.forEach((h, c)=>{ const n = ImpText.key(h); if(!n) return; for(const k in spec.cols) if(map[k]==null && spec.cols[k].some(a=>norm(a)===n)) map[k] = c; });
      const hit = Object.keys(map).length;
      const missing = spec.required.filter(k=>map[k]==null);
      const score = hit*2 + (missing.length ? 0 : 10);
      if(!best || score>best.score) best = {index:i, map, missing, score};
    }
    return best || {index:0, map:{}, missing:spec.required.slice(), score:0};
  },
  rankSheets(kind, sheets){
    const spec = kind==='history' ? HISTORY_SPEC : IMPORT_SPECS[kind];
    const ranked = sheets.map((sh, order)=>{
      const h = ImportPipeline.findHeader(sh.rows, spec);
      const hint = (spec.sheetHints || []).some(x=>ImpText.key(sh.name)===norm(x)) ? 3 : 0;
      const cols = Object.keys(h.map).length;
      return {name:sh.name, order, rows:Math.max(0, sh.rows.length-h.index-1), cols, complete:!h.missing.length, score:h.score+hint+Math.min(2, Math.log10(1+sh.rows.length))};
    });
    ranked.sort((a, b)=>(b.complete-a.complete) || (b.score-a.score) || (a.order-b.order));
    return ranked;
  },
  parseRows(sheet, spec){
    const h = ImportPipeline.findHeader(sheet.rows, spec);
    if(h.missing.length) return {error:t('impMissingCols', h.missing.join('، ')), header:h};
    const get = (r, k)=>h.map[k]!=null ? r[h.map[k]] : '';
    const recs = [];
    let bad = 0, blank = 0;
    const badRows = [];
    for(let i=h.index+1; i<sheet.rows.length; i++){
      const r = sheet.rows[i];
      const fname = ImpText.clean(get(r, 'facility'));
      if(!fname){ blank++; continue; }
      const date = parseDate(get(r, 'date'));
      if(!date){ bad++; if(badRows.length<5) badRows.push(i+1); continue; }
      const type = ImpText.clean(get(r, 'type'));
      recs.push({row:i+1, fname, fkey:ImpText.key(fname), category:ImpText.clean(get(r, 'category')), location:ImpText.clean(get(r, 'location')), type, tkey:ImpText.key(type), date, names:ImpText.splitList(get(r, 'team')), cycle:parseInt(toAsciiDigits(ImpText.clean(get(r, 'cycle'))), 10)});
    }
    return {recs, bad, blank, badRows, header:h};
  },
  recKey(facilityId, date, personKeys){ return facilityId+'|'+date+'|'+personKeys.slice().sort().join('+'); },
  existingKeys(peopleM){
    const D = App.data;
    const set = new Set(D.history.keys || []);
    for(const f of D.facilities) for(const h of (f.history || [])){
      if(!h || !h.date) continue;
      const pk = (h.team || []).map(n=>{ const r = peopleM.resolve(n); return r.id || ImpText.key(n); });
      set.add(ImportPipeline.recKey(f.id, h.date, pk));
    }
    return set;
  },
  previewHistory(sheets, opts){
    opts = opts || {};
    const ranking = ImportPipeline.rankSheets('history', sheets);
    const chosen = opts.sheet && sheets.some(s=>s.name===opts.sheet) ? opts.sheet : ranking[0].name;
    const sheet = sheets.find(s=>s.name===chosen);
    const parsed = ImportPipeline.parseRows(sheet, HISTORY_SPEC);
    const base = {kind:'history', sheets:ranking, sheet:chosen, opts:Object.assign({}, opts, {sheet:chosen}), source:sheets};
    if(parsed.error) return Object.assign(base, {error:parsed.error});
    const hasType = parsed.header.map.type!=null;
    const typeCounts = new Map();
    for(const r of parsed.recs){ const k = r.tkey; const cur = typeCounts.get(k) || {key:k, label:r.type || t('impNoType'), count:0}; cur.count++; typeCounts.set(k, cur); }
    const defaults = HISTORY_SPEC.defaultTypes.map(x=>ImpText.key(x));
    const defaultPresent = defaults.some(k=>typeCounts.has(k));
    let include = opts.includeTypes ? new Set(opts.includeTypes) : null;
    if(!include) include = hasType && defaultPresent ? new Set(defaults.filter(k=>typeCounts.has(k))) : new Set(typeCounts.keys());
    const types = [...typeCounts.values()].sort((a, b)=>b.count-a.count).map(x=>Object.assign(x, {included:include.has(x.key)}));
    const kept = parsed.recs.filter(r=>include.has(r.tkey));

    const peopleM = impPeopleMatcher(), facM = impFacilityMatcher();
    const peopleMap = opts.peopleMap || {}, facMap = opts.facilityMap || {};
    const pStat = new Map(), fStat = new Map();
    const personFor = nm=>{
      const k = ImpText.key(nm);
      let st = pStat.get(k);
      if(!st){ const m = peopleM.resolve(nm); st = {key:k, name:nm, count:0, tier:m.tier, id:m.id, candidates:m.candidates}; const ch = peopleMap[k]; if(ch && ch!=='new' && ch!=='skip' && D_has(App.data.people, ch)){ st.id = ch; st.tier = 'chosen'; } pStat.set(k, st); }
      st.count++;
      return st;
    };
    const facilityFor = r=>{
      let st = fStat.get(r.fkey);
      if(!st){ const m = facM.resolve(r.fname); st = {key:r.fkey, name:r.fname, category:r.category, location:r.location, count:0, tier:m.tier, id:m.id, candidates:m.candidates}; const ch = facMap[r.fkey]; if(ch && ch!=='new' && ch!=='skip' && D_has(App.data.facilities, ch)){ st.id = ch; st.tier = 'chosen'; } fStat.set(r.fkey, st); }
      st.count++;
      return st;
    };
    const existing = ImportPipeline.existingKeys(peopleM);
    const seen = new Set();
    const recs = [];
    let dupFile = 0, dupExisting = 0, noTeam = 0, skipped = 0;
    for(const r of kept){
      const fs = facilityFor(r);
      if(facMap[r.fkey]==='skip'){ skipped++; continue; }
      const people = r.names.map(personFor);
      const pk = people.map(p=>p.id || p.key);
      const fid = fs.id || 'new:'+r.fkey;
      const key = ImportPipeline.recKey(fid, r.date, pk);
      if(existing.has(key)){ dupExisting++; continue; }
      if(seen.has(key)){ dupFile++; continue; }
      seen.add(key);
      if(!r.names.length) noTeam++;
      recs.push(Object.assign({}, r, {key, people}));
    }
    const peopleList = [...pStat.values()].sort((a, b)=>b.count-a.count);
    const facList = [...fStat.values()];
    return Object.assign(base, {
      recs, total:parsed.recs.length, bad:parsed.bad, badRows:parsed.badRows, blank:parsed.blank,
      hasType, types, typeFallback:hasType && !defaultPresent,
      ignoredByType:types.filter(x=>!x.included).reduce((a, x)=>a+x.count, 0),
      dupFile, dupExisting, noTeam, skipped,
      people:peopleList, unknownPeople:peopleList.filter(p=>!p.id && peopleMap[p.key]!=='skip' && peopleMap[p.key]!=='new').map(p=>({name:p.name, count:p.count})),
      facilities:facList, newFacilities:facList.filter(f=>!f.id && facMap[f.key]!=='skip').map(f=>f.name)
    });
  },
  applyHistory(pv){
    takeSnapshot('import');
    const before = JSON.stringify(App.data);
    const D = App.data;
    const opts = pv.opts || {};
    const peopleMap = opts.peopleMap || {}, facMap = opts.facilityMap || {};
    if(!D.aliases.facilities) D.aliases.facilities = {};
    if(!D.history.keys) D.history.keys = [];
    const keys = new Set(D.history.keys);
    const ensureCat = name=>{ if(name && !D.categories.some(c=>c.name===name)) D.categories.push({name, kind:'excluded'}); };
    const ensureLoc = name=>{
      if(!name) return null;
      let l = D.locations.find(x=>ImpText.key(x.name)===ImpText.key(name));
      if(!l){ l = {id:locIdFor(name), name, km:0}; D.locations.push(l); }
      return l.id;
    };
    const newFac = new Map();
    const facilityOf = r=>{
      const st = pv.facilities.find(x=>x.key===r.fkey);
      let f = st && st.id ? D.facilities.find(x=>x.id===st.id) : null;
      if(f){
        if(facMap[r.fkey] && facMap[r.fkey]!=='new' && ImpText.key(f.name)!==r.fkey) D.aliases.facilities[r.fkey] = f.id;
        return f;
      }
      if(newFac.has(r.fkey)) return newFac.get(r.fkey);
      ensureCat(r.category);
      f = {id:uid('f'), name:r.fname, category:r.category || '', locationId:ensureLoc(r.location), kindOverride:null, freq:1, importance:50, pinned:false, excluded:false, lastVisit:null, visitCount:0, history:[], weekdays:null, review:'new'};
      D.facilities.push(f);
      newFac.set(r.fkey, f);
      return f;
    };
    const newPeople = new Map();
    const personOf = st=>{
      if(st.id) return D.people.find(p=>p.id===st.id) || null;
      if(peopleMap[st.key]==='skip') return null;
      if(peopleMap[st.key]==='new'){
        if(newPeople.has(st.key)) return newPeople.get(st.key);
        const p = freshPerson({name:st.name, pool:S().pools[0].id, origin:locIdFor('دمنهور')});
        D.people.push(p);
        D.aliases.people[st.key] = p.id;
        newPeople.set(st.key, p);
        return p;
      }
      return null;
    };
    const unresolved = new Map();
    let applied = 0;
    for(const r of pv.recs){
      const f = facilityOf(r);
      const names = [];
      for(const st of r.people){
        const p = personOf(st);
        if(p){
          names.push(p.name);
          if(peopleMap[st.key] && peopleMap[st.key]!=='new' && peopleMap[st.key]!=='skip' && ImpText.key(p.name)!==st.key) D.aliases.people[st.key] = p.id;
          D.history.counts[p.id] = (D.history.counts[p.id] || 0)+1;
          D.history.fpv[f.id+'|'+p.id] = (D.history.fpv[f.id+'|'+p.id] || 0)+1;
        } else if(peopleMap[st.key]!=='skip'){
          names.push(st.name);
          unresolved.set(st.key, st);
        }
      }
      f.visitCount = (f.visitCount || 0)+1;
      if(!f.lastVisit || r.date>f.lastVisit) f.lastVisit = r.date;
      f.history = [{date:r.date, team:names}].concat(f.history || []).sort((a, b)=>a.date<b.date ? 1 : -1).slice(0, 20);
      if(!isNaN(r.cycle)) D.history.lastCycle = Math.max(D.history.lastCycle || 0, r.cycle);
      const pk = r.people.map(st=>{ const p = personOf(st); return p ? p.id : st.key; });
      keys.add(ImportPipeline.recKey(f.id, r.date, pk));
      applied++;
    }
    D.history.keys = [...keys];
    for(const st of unresolved.values()) if(!D.unresolved.some(x=>ImpText.key(x.name)===st.key)) D.unresolved.push({name:st.name, count:st.count});
    commit('data');
    toast(t('impHistoryDone', applied), {label:t('undo'), onClick:()=>{ App.data = normalizeData(JSON.parse(before)); commit('data'); }});
    return applied;
  }
};

function D_has(list, id){ return list.some(x=>x.id===id); }
