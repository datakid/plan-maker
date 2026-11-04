const ImpField = {
  num(v){
    const s = toAsciiDigits(ImpText.clean(v)).replace(/[\u066B\u060C]/g, '.').replace(/,/g, '.');
    if(s==='') return null;
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  },
  bool(v){
    const k = ImpText.key(v);
    if(k==='') return null;
    if(['نعم', 'ايوه', 'اه', 'صح', 'true', 'yes', 'y', '1', 'نشط', 'فعال', '\u2713', '\u2714', 'on'].includes(k)) return true;
    if(['لا', 'خطا', 'false', 'no', 'n', '0', 'غير نشط', 'موقوف', 'متوقف', '\u2717', '\u2718', 'off'].includes(k)) return false;
    return undefined;
  },
  gender(v){
    const k = ImpText.key(v);
    if(k==='') return null;
    if(['انثي', 'f', 'female', 'امراه', 'بنت', 'سيده', 'woman'].includes(k)) return 'f';
    if(['ذكر', 'm', 'male', 'رجل', 'ولد', 'man'].includes(k)) return 'm';
    return undefined;
  },
  status(v){
    const k = ImpText.key(v);
    if(k==='') return null;
    if(['مستبعده', 'excluded', 'مستثناه', 'مستبعد'].includes(k)) return {excluded:true, pinned:false};
    if(['مثبته', 'pinned', 'مثبت'].includes(k)) return {excluded:false, pinned:true};
    if(['مدرجه', 'included', 'عاديه', 'normal', 'مدرج'].includes(k)) return {excluded:false, pinned:false};
    return undefined;
  },
  date(v){ const s = ImpText.clean(v); return s==='' ? null : (parseDate(s) || undefined); }
};

const exN = (ar, en)=>App.ui.lang==='en' ? 'Example: '+en : 'مثال: '+ar;

const IMPORT_SPECS = {
  history:{
    label:{ar:'سجل زيارات سابق', en:'Past visits'}, sheet:{ar:'السجل', en:'Visits'},
    cols:{
      facility:['جهة المرور', 'الجهة', 'اسم الجهة', 'facility'],
      category:['المنطقة', 'التصنيف', 'category'],
      cycle:['الخطة', 'الدورة', 'cycle'],
      type:['المرور', 'الغرض من المرور', 'الغرض', 'نوع المرور', 'type'],
      date:['التاريخ', 'اليوم', 'date'],
      team:['القائم بالمرور', 'القائمين بالمرور', 'الفريق', 'team'],
      location:['الموقع', 'location']
    },
    required:['facility', 'date', 'team'],
    sheetHints:['الاصلي', 'original', 'history', 'visits', 'السجل', 'مأموريات'],
    defaultTypes:['خطة المرور'],
    fields:{
      facility:{req:true, ar:'اسم الجهة كما في التطبيق أو قريبًا منه', en:'Facility name, as in the app or close to it', ex:'ابو حمص'},
      category:{ar:'المنطقة أو التصنيف (للجهات الجديدة فقط)', en:'Region or category (new facilities only)', ex:'التانية'},
      cycle:{ar:'رقم الخطة (رقم صحيح)', en:'Plan number (whole number)', ex:'12'},
      type:{ar:'نوع المرور — يُستورد «خطة المرور» فقط ما لم تختر غيره', en:'Visit type; only "خطة المرور" is imported unless you tick others', ex:'خطة المرور'},
      date:{req:true, ar:'التاريخ بصيغة 2026-08-02 أو 2/8/2026', en:'Date as 2026-08-02 or 2/8/2026', ex:'2026-08-02'},
      team:{req:true, ar:'الأسماء مفصولة بـ - أو ، أو / أو سطر جديد', en:'Names separated by -, ، , / or a new line', ex:'أباظة - لبنى - حمودين'},
      location:{ar:'الموقع (للجهات الجديدة)', en:'Location (new facilities)', ex:'دمنهور'}
    },
    examples:()=>[['ابو حمص', 'الثانية', '12', 'خطة المرور', '2026-08-02', 'أباظة - لبنى - حمودين'], ['دمنهور الشاملة', 'مستشفي', '12', 'نيابة', '2026-08-03', 'شلتوت - ميسرة']]
  },
  facilities:{
    label:{ar:'قائمة الجهات', en:'Facility list'}, sheet:{ar:'الجهات', en:'Facilities'},
    cols:{
      name:['الاسم', 'اسم الجهة', 'الجهة', 'جهة المرور', 'name'],
      category:['التصنيف', 'المنطقة', 'category'],
      location:['الموقع', 'location'],
      km:['المسافة (كم)', 'المسافة', 'km'],
      freq:['الوتيرة', 'الوزن', 'frequency'],
      importance:['الأهمية', 'importance'],
      status:['الحالة', 'status'],
      last:['آخر زيارة', 'last visit']
    },
    required:['name', 'category'],
    sheetHints:['الجهات', 'facilities'],
    fields:{
      name:{req:true, ar:'اسم الجهة', en:'Facility name', ex:'مركز دمنهور للاشعة'},
      category:{req:true, ar:'التصنيف أو المنطقة — يجب أن يطابق تصنيفًا موجودًا وإلا ستختار ربطه أو إنشاءه', en:'Category or region; it should match an existing category, otherwise you choose a link or create one', ex:'اشعة'},
      location:{ar:'الموقع (المدينة أو القرية)', en:'Location (town or village)', ex:'دمنهور'},
      km:{ar:'المسافة بالكيلومتر من المقر (رقم)، أو ضعها في ورقة «المواقع»', en:'Distance in km from the office (number), or put it on the Locations sheet', ex:'38.2'},
      freq:{ar:'الوتيرة: 1 = عادي، 0.5 = أقل، 2 = أكثر (رقم)', en:'Frequency weight: 1 = normal, 0.5 = less, 2 = more (number)', ex:'1'},
      importance:{ar:'الأهمية من 0 إلى 100', en:'Importance from 0 to 100', ex:'50'},
      status:{ar:'مُدرجة أو مستبعدة أو مثبتة', en:'included, excluded or pinned', vals:{ar:'مُدرجة / مستبعدة / مثبتة', en:'included / excluded / pinned'}, ex:'مُدرجة'},
      last:{ar:'تاريخ آخر زيارة (لا يُرجِع تاريخًا أحدث موجودًا)', en:'Last visit date (never moves an existing later date back)', ex:'2026-08-01'}
    },
    examples:()=>{
      const cats = App.data.categories.map(c=>c.name), locs = App.data.locations;
      const c = i=>cats[i % Math.max(1, cats.length)] || '', l = i=>locs[i % Math.max(1, locs.length)] || {name:'', km:0};
      return [[exN('جهة جديدة 1', 'new facility 1'), c(0), l(0).name, l(0).km, '1', '50', 'مُدرجة', '2026-08-01'], [exN('جهة جديدة 2', 'new facility 2'), c(1), l(1).name, l(1).km, '0.5', '50', 'مستبعدة', '']];
    },
    companion:{
      sheet:{ar:'المواقع', en:'Locations'},
      header:{ar:['الموقع', 'المسافة (كم)'], en:['Location', 'km']},
      note:{ar:'اختياري: مسافة كل موقع بالكيلومتر. أي أعمدة أخرى (مثل بدل السفر والسعر) تظهر في المعاينة كأعمدة غير مستخدمة.', en:'Optional: the distance of each location in km. Any other columns (such as travel allowance or price) are listed in the preview as unused columns.'}
    }
  },
  locations:{
    label:{ar:'المواقع والمسافات', en:'Locations and distances'}, sheet:{ar:'المواقع', en:'Locations'},
    cols:{name:['الموقع', 'المدينة', 'location'], km:['المسافة', 'المسافة (كم)', 'km', 'distance']},
    required:['name', 'km'],
    sheetHints:['المواقع', 'locations'],
    fields:{}
  },
  team:{
    label:{ar:'قائمة الفريق', en:'Team list'}, sheet:{ar:'الفريق', en:'People'},
    cols:{
      name:['الاسم', 'اسم الفرد', 'الفرد', 'الموظف', 'name'],
      pool:['المجموعة', 'group', 'pool'],
      gender:['النوع', 'الجنس', 'gender'],
      active:['نشط', 'فعال', 'active'],
      skillB:['خبرة أساسية', 'خبرة اساسية', 'skill basic'],
      skillC:['خبرة متعاقدة', 'skill contracted'],
      fixed:['عدد ثابت', 'حصة ثابتة', 'fixed'],
      title:['الوظيفة', 'المسمى', 'title'],
      origin:['محل الاقامة', 'مكان الاقامة', 'الموقع الاصلي', 'origin']
    },
    required:['name'],
    sheetHints:['الافراد', 'الفريق', 'people', 'team'],
    fields:{
      name:{req:true, ar:'الاسم الكامل أو المعتاد', en:'Full or usual name', ex:'محمود عزت'},
      pool:{ar:'اسم المجموعة كما في التطبيق (مثل مالي واداري)', en:'Pool name as in the app', ex:'__pool__'},
      gender:{ar:'ذكر أو أنثى', en:'male or female', vals:{ar:'ذكر / أنثى', en:'male / female'}, ex:'ذكر'},
      active:{ar:'نعم أو لا — غير النشط لا يُجدول', en:'yes or no; inactive people are not scheduled', vals:{ar:'نعم / لا', en:'yes / no'}, ex:'نعم'},
      skillB:{ar:'خبرة الجهات الأساسية من 0 إلى 100', en:'Skill with basic facilities, 0 to 100', ex:'50'},
      skillC:{ar:'خبرة الجهات المتعاقدة من 0 إلى 100', en:'Skill with contracted facilities, 0 to 100', ex:'50'},
      fixed:{ar:'عدد زيارات ثابت في الخطة (رقم صحيح) أو فارغ', en:'Fixed number of visits per plan (whole number) or empty', ex:'6'},
      title:{ar:'الوظيفة أو المسمى', en:'Job title', ex:'محاسب'},
      origin:{ar:'محل الإقامة (يؤثر على المسافة)', en:'Home location (affects distance)', ex:'دمنهور'}
    },
    examples:()=>{
      const pl = S().pools.map(p=>poolName(p)), loc = App.data.locations[0] ? App.data.locations[0].name : '';
      return [[exN('فرد جديد 1', 'new person 1'), pl[0] || '', 'ذكر', 'نعم', '50', '50', '', 'محاسب', loc], [exN('فرد جديد 2', 'new person 2'), pl[1] || pl[0] || '', 'أنثى', 'نعم', '75', '50', '6', '', loc]];
    }
  }
};
const HISTORY_SPEC = IMPORT_SPECS.history;

const ImportTemplates = {
  header(kind){
    const spec = IMPORT_SPECS[kind], en = App.ui.lang==='en';
    return Object.keys(spec.cols).map(k=>{
      const list = spec.cols[k];
      return en ? (list.find(x=>/^[a-z ]+$/i.test(x)) || list[0]) : list[0];
    });
  },
  rows(kind){
    const spec = IMPORT_SPECS[kind];
    const pools = S().pools.map(p=>poolName(p));
    const keys = Object.keys(spec.cols);
    const ex = spec.examples ? spec.examples() : [];
    return ex.map(r=>keys.map((k, i)=>{
      const v = r[i];
      return v==null ? '' : String(v);
    }));
  },
  instructions(kind){
    const spec = IMPORT_SPECS[kind], en = App.ui.lang==='en', L = x=>en ? x.en : x.ar;
    const head = en ? ['Column', 'Required', 'What to put in it', 'Example'] : ['العمود', 'مطلوب', 'ما يوضع فيه', 'مثال'];
    const header = ImportTemplates.header(kind);
    const keys = Object.keys(spec.cols);
    const exRow = ImportTemplates.rows(kind)[0] || [];
    const rows = [head];
    keys.forEach((k, i)=>{
      const f = spec.fields[k] || {};
      rows.push([header[i], f.req ? (en ? 'yes' : 'نعم') : (en ? 'no' : 'لا'), f[en ? 'en' : 'ar'] || '', exRow[i] || (f.ex && f.ex!=='__pool__' ? f.ex : '')]);
    });
    rows.push(['', '', '', '']);
    const notes = en ? [
      'Keep the header row exactly as in the first sheet; the order of columns does not matter, and extra columns are ignored and listed in the preview.',
      'Names are matched ignoring spaces, hamza, yaa and taa marbuta. Similar names are only suggested, never linked silently.',
      'Nothing is saved until you press Apply, and every import can be undone.'
    ] : [
      'اترك صف العناوين كما في الورقة الأولى؛ ترتيب الأعمدة غير مهم، وتُتجاهل الأعمدة الإضافية وتظهر في المعاينة.',
      'تُطابَق الأسماء مع تجاهل المسافات والهمزات والياء والتاء المربوطة. الأسماء المتشابهة تُقترح فقط ولا تُربط تلقائيًا.',
      'لا يُحفظ شيء قبل الضغط على «تطبيق»، ويمكن التراجع عن أي استيراد.'
    ];
    if(kind==='history') notes.unshift(en ? 'Only rows whose type is "خطة المرور" are imported unless you tick other types in the preview.' : 'تُستورد صفوف «خطة المرور» فقط ما لم تختر أنواعًا أخرى في المعاينة.');
    if(spec.companion) notes.unshift(L(spec.companion.note));
    for(const n of notes) rows.push([n, '', '', '']);
    return rows;
  },
  sheets(kind){
    const spec = IMPORT_SPECS[kind], en = App.ui.lang==='en', L = x=>en ? x.en : x.ar;
    const header = ImportTemplates.header(kind);
    const out = [{name:L(spec.sheet), rows:[header].concat(ImportTemplates.rows(kind)), widths:header.map(()=>22)}];
    if(spec.companion){
      const rows = [L(spec.companion.header).slice()].concat(App.data.locations.slice(0, 3).map(l=>[l.name, l.km]));
      out.push({name:L(spec.companion.sheet), rows, widths:[22, 16]});
    }
    out.push({name:en ? 'Instructions' : 'تعليمات', rows:ImportTemplates.instructions(kind), widths:[26, 10, 60, 24]});
    return out;
  }
};
function downloadTemplate(kind){
  downloadBlob(buildXlsx(ImportTemplates.sheets(kind)), 'template-'+kind+'.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
function mapColumns(kind, header){ const h = ImportPipeline.findHeader([header], IMPORT_SPECS[kind]); return {map:h.map, missing:h.missing}; }

function resolvePerson(raw){
  const m = impPeopleMatcher().resolve(raw);
  return m.id ? (personById(m.id) || null) : null;
}
function resolveFacility(raw){
  const m = impFacilityMatcher().resolve(raw);
  return m.id ? (facilityById(m.id) || null) : null;
}
function impCategoryMatcher(){
  const D = App.data;
  return new EntityMatcher(D.categories.map(c=>({id:c.name, names:[c.name]})), (D.aliases && D.aliases.categories) || {});
}
function impLocationMatcher(){
  return new EntityMatcher(App.data.locations.map(l=>({id:l.id, names:[l.name]})), {});
}
function impPoolMatcher(){
  return new EntityMatcher(S().pools.map(p=>({id:p.id, names:[p.name, p.nameEn, p.id].filter(Boolean)})), {});
}

ImportPipeline.parseGeneric = function(kind, table){
  const spec = IMPORT_SPECS[kind];
  const h = ImportPipeline.findHeader(table.rows, spec);
  if(h.missing.length) return {error:t('impMissingCols', h.missing.join('، ')), header:h};
  const keys = Object.keys(spec.cols);
  const rows = [];
  let blank = 0;
  for(let i=h.index+1; i<table.rows.length; i++){
    const r = table.rows[i] || [];
    const v = {};
    let any = false;
    for(const k of keys){ v[k] = h.map[k]!=null ? ImpText.clean(r[h.map[k]]) : ''; if(v[k]!=='') any = true; }
    if(!any || (!v.name && !v.facility)){ blank++; continue; }
    rows.push({row:i+1, v});
  }
  return {rows, blank, header:h};
};

ImportPipeline.companionLocations = function(kind, pick){
  const spec = IMPORT_SPECS[kind];
  const map = new Map();
  if(!spec.companion) return {map, label:null, unused:[]};
  const others = pick.tables.filter(x=>x.id!==pick.chosen);
  const ranking = ImportPipeline.rankSheets('locations', others).filter(x=>x.complete);
  if(!ranking.length) return {map, label:null, unused:[]};
  const tbl = others.find(x=>x.id===ranking[0].name);
  const parsed = ImportPipeline.parseGeneric('locations', tbl);
  if(parsed.error) return {map, label:null, unused:[]};
  for(const r of parsed.rows){
    const k = ImpText.key(r.v.name), km = ImpField.num(r.v.km);
    if(k && km!=null && !isNaN(km) && !map.has(k)) map.set(k, {name:r.v.name, km});
  }
  return {map, label:tbl.label, unused:parsed.header.unused};
};

ImportPipeline.order = function(panels){
  const rank = (p, i)=>p.type==='map' || (p.type==='check' && p.tone==='bad') ? 1 : (p.type==='chips' ? 2 : (p.type==='changes' ? 3 : (i<2 ? 0 : 4)));
  return panels.map((p, i)=>({p, r:rank(p, i), i})).sort((a, b)=>a.r-b.r || a.i-b.i).map(x=>x.p);
};

ImportPipeline.catOptions = function(candidates, undecided){
  const D = App.data;
  const cand = (candidates || []).map(c=>c.id);
  const names = cand.concat(D.categories.map(c=>c.name).filter(n=>!cand.includes(n)));
  return (undecided ? [{value:'', label:t('impChoose')}] : []).concat(names.map(n=>({value:n, label:n}))).concat([{value:'new:excluded', label:t('impCatNewExcluded')}, {value:'new:basic', label:t('impCatNewBasic')}, {value:'new:contracted', label:t('impCatNewContracted')}]);
};

ImportPipeline.fieldLabels = ()=>({
  name:t('impFName'), category:t('impFCategory'), location:t('impFLocation'), km:t('impFKm'), freq:t('impFFreq'), importance:t('impFImportance'), status:t('impFStatus'), last:t('impFLast'),
  pool:t('impFPool'), gender:t('impFGender'), active:t('impFActive'), skillB:t('impFSkillB'), skillC:t('impFSkillC'), fixed:t('impFFixed'), title:t('impFTitle'), origin:t('impFOrigin')
});

ImportPipeline.previewFacilities = function(sheets, opts){
  opts = opts || {};
  const D = App.data;
  const pick = ImportPipeline.pickTable('facilities', sheets, opts);
  const base = {kind:'facilities', sheets:pick.ranking, sheet:pick.chosen, opts:Object.assign({}, opts, {sheet:pick.chosen}), source:sheets};
  const parsed = ImportPipeline.parseGeneric('facilities', pick.table);
  if(parsed.error) return Object.assign(base, {error:parsed.error});
  const comp = ImportPipeline.companionLocations('facilities', pick);
  const facM = impFacilityMatcher(), catM = impCategoryMatcher(), locM = impLocationMatcher();
  const facMap = opts.facilityMap || {}, catMap = opts.categoryMap || {};
  const bad = [];
  const seen = new Set();
  let dupFile = 0;
  const recs = [];
  const num = (r, field, v, lo, hi)=>{
    const n = ImpField.num(v);
    if(n==null) return null;
    if(isNaN(n) || (lo!=null && n<lo) || (hi!=null && n>hi)){ bad.push({row:r.row, field, value:v}); return null; }
    return n;
  };
  for(const r of parsed.rows){
    const key = ImpText.key(r.v.name);
    if(seen.has(key)){ dupFile++; continue; }
    seen.add(key);
    const st = ImpField.status(r.v.status);
    if(st===undefined) bad.push({row:r.row, field:'status', value:r.v.status});
    const last = ImpField.date(r.v.last);
    if(last===undefined) bad.push({row:r.row, field:'last', value:r.v.last});
    let km = num(r, 'km', r.v.km, 0, 5000);
    const locKey = ImpText.key(r.v.location);
    if(km==null && locKey && comp.map.has(locKey)) km = comp.map.get(locKey).km;
    recs.push({row:r.row, name:r.v.name, key, category:r.v.category, location:r.v.location, locKey, km, freq:num(r, 'freq', r.v.freq, 0, 100), importance:num(r, 'importance', r.v.importance, 0, 100), status:st || null, last:last || null});
  }
  const catStat = new Map(), locStat = new Map(), facStat = new Map();
  for(const rec of recs){
    if(rec.category){
      const ck = ImpText.key(rec.category);
      let c = catStat.get(ck);
      if(!c){
        const m = catM.resolve(rec.category);
        c = {key:ck, name:rec.category, count:0, tier:m.tier, id:m.id, candidates:m.candidates, kind:null};
        const ch = catMap[ck];
        if(ch && D.categories.some(x=>x.name===ch)){ c.id = ch; c.tier = 'chosen'; }
        else if(ch && /^new:/.test(ch)) c.kind = ch.slice(4);
        catStat.set(ck, c);
      }
      c.count++;
      rec.catName = c.id || c.name;
    }
    if(rec.locKey){
      let l = locStat.get(rec.locKey);
      if(!l){ const m = locM.resolve(rec.location); l = {key:rec.locKey, name:rec.location, count:0, id:m.id, km:null}; locStat.set(rec.locKey, l); }
      l.count++;
      if(rec.km!=null && l.km==null) l.km = rec.km;
      rec.locId = l.id || 'new:'+rec.locKey;
    }
    let f = facStat.get(rec.key);
    const m = facM.resolve(rec.name);
    f = {key:rec.key, name:rec.name, tier:m.tier, id:m.id, candidates:m.candidates};
    const ch = facMap[rec.key];
    if(ch==='skip') f.skip = true;
    else if(ch && D.facilities.some(x=>x.id===ch)){ f.id = ch; f.tier = 'chosen'; }
    facStat.set(rec.key, f);
    rec.fac = f;
  }
  for(const [k, c] of comp.map){ if(!locStat.has(k)){ const m = locM.resolve(c.name); locStat.set(k, {key:k, name:c.name, count:0, id:m.id, km:c.km, companionOnly:true}); } }
  const labels = ImportPipeline.fieldLabels();
  const changes = {category:[], location:[], freq:[], importance:[], status:[], last:[], km:[]};
  const added = [], changed = [], unchanged = [];
  const locName = id=>{ const l = locationById(id); return l ? l.name : ''; };
  for(const rec of recs){
    if(rec.fac.skip) continue;
    const ex = rec.fac.id ? D.facilities.find(x=>x.id===rec.fac.id) : null;
    if(!ex){ added.push(rec); continue; }
    const ch = [];
    const push = (field, from, to)=>{ changes[field].push({name:ex.name, from, to}); ch.push(field); };
    if(rec.category && rec.catName!==ex.category) push('category', ex.category || '—', rec.catName);
    if(rec.location && rec.locId!==ex.locationId) push('location', locName(ex.locationId) || '—', rec.location);
    if(rec.freq!=null && rec.freq!==ex.freq) push('freq', ex.freq, rec.freq);
    if(rec.importance!=null && rec.importance!==ex.importance) push('importance', ex.importance, rec.importance);
    if(rec.status && (!!rec.status.excluded!==!!ex.excluded || !!rec.status.pinned!==!!ex.pinned)) push('status', ex.excluded ? t('impStExcluded') : (ex.pinned ? t('impStPinned') : t('impStIncluded')), rec.status.excluded ? t('impStExcluded') : (rec.status.pinned ? t('impStPinned') : t('impStIncluded')));
    if(rec.last && (!ex.lastVisit || rec.last>ex.lastVisit)) push('last', ex.lastVisit || '—', rec.last);
    (ch.length ? changed : unchanged).push(Object.assign(rec, {ex, changes:ch}));
  }
  const newLocs = [];
  for(const l of locStat.values()){
    if(l.id){
      const ex = locationById(l.id);
      if(ex && l.km!=null && Math.abs((ex.km||0)-l.km)>0.05) changes.km.push({name:ex.name, from:ex.km||0, to:l.km});
    } else newLocs.push(l);
  }
  const all = Object.keys(changes);
  const withChanges = all.filter(k=>changes[k].length);
  const selected = opts.fields ? opts.fields.filter(k=>all.includes(k)) : withChanges;
  const cats = [...catStat.values()];
  const unresolvedCats = cats.filter(c=>!c.id || c.tier==='chosen');
  const panels = [];
  const matched = recs.filter(r=>r.fac.id && !r.fac.skip).length;
  panels.push({type:'check', tone:'ok', text:t('impFacSummary', matched, added.length), detail:t('impHOf', parsed.rows.length)});
  if(unchanged.length) panels.push({type:'check', tone:'ok', text:t('impFacUnchanged', unchanged.length)});
  if(withChanges.length){
    panels.push({type:'chips', label:t('impFieldsToUpdate'), hint:t('impFieldsHint'), opt:'fields', items:withChanges.map(k=>({key:k, label:(k==='km' ? t('impFKm') : labels[k])+' · '+changes[k].length, on:selected.includes(k)}))});
    for(const k of withChanges.filter(x=>selected.includes(x))) panels.push({type:'changes', label:(k==='km' ? t('impFKm') : labels[k]), rows:changes[k].slice(0, 6).map(c=>c.name+': '+c.from+' → '+c.to), more:Math.max(0, changes[k].length-6)});
  }
  if(unresolvedCats.length) panels.push({type:'map', label:t('impCatsUnknown'), opt:'categoryMap', rows:unresolvedCats.map(c=>({key:c.key, name:c.name, count:c.count, value:c.tier==='chosen' ? c.id : (catMap[c.key] || ''), options:ImportPipeline.catOptions(c.candidates, !c.tier || c.tier!=='chosen' && !catMap[c.key])}))});
  const undecidedCats = unresolvedCats.filter(c=>c.tier!=='chosen' && !c.kind).length;
  if(undecidedCats) panels.push({type:'check', tone:'bad', text:t('impCatsUndecided', undecidedCats)});
  const unmatched = [...new Map(recs.filter(r=>!r.fac.id || r.fac.tier==='chosen' || r.fac.skip).map(r=>[r.key, r.fac])).values()];
  if(unmatched.length){
    const withCand = unmatched.filter(f=>f.candidates.length || f.tier==='chosen' || f.skip);
    if(withCand.length) panels.push({type:'map', label:t('impHNewFacilities'), opt:'facilityMap', rows:withCand.map(f=>({key:f.key, name:f.name, count:1, value:facMap[f.key] || '', options:[{value:'', label:t('impCreate')}, {value:'skip', label:t('impIgnore')}].concat(f.candidates.map(c=>({value:c.id, label:(facilityById(c.id) || {}).name})))}))});
    panels.push({type:'check', tone:'soft', text:t('impFacNew', added.length), detail:added.slice(0, 5).map(r=>r.name).join('، ')});
  }
  if(newLocs.length) panels.push({type:'check', tone:'soft', text:t('impLocNew', newLocs.length), detail:newLocs.slice(0, 5).map(l=>l.name).join('، ')});
  if(comp.label) panels.push({type:'check', tone:'ok', text:t('impCompanion', comp.label, comp.map.size)});
  const unused = parsed.header.unused.concat(comp.unused || []);
  if(unused.length) panels.push({type:'check', tone:'soft', text:t('impUnused', unused.join('، '))});
  if(bad.length) panels.push({type:'check', tone:'bad', text:t('impBadValues', bad.length), detail:bad.slice(0, 4).map(b=>t('impBadRow', b.row, labels[b.field] || b.field)).join('، ')});
  if(dupFile) panels.push({type:'check', tone:'soft', text:t('impHDup', dupFile)});
  return Object.assign(base, {added, changed:changed.concat(unchanged), changes, selected, withChanges, recs, categories:cats, locations:[...locStat.values()], newLocs, total:parsed.rows.length, blank:parsed.blank, bad, dupFile, unused, panels:ImportPipeline.order(panels), canApply:(added.length>0 || selected.some(k=>changes[k].length)) && undecidedCats===0, undecidedCats});
};

ImportPipeline.applyFacilities = function(pv){
  takeSnapshot('import');
  const before = JSON.stringify(App.data);
  const D = App.data, opts = pv.opts || {};
  const sel = new Set(pv.selected);
  if(!D.aliases.facilities) D.aliases.facilities = {};
  if(!D.aliases.categories) D.aliases.categories = {};
  const facMap = opts.facilityMap || {}, catMap = opts.categoryMap || {};
  for(const c of pv.categories){
    if(c.id){ if(c.tier==='chosen' && ImpText.key(c.id)!==c.key) D.aliases.categories[c.key] = c.id; }
    else if(!D.categories.some(x=>x.name===c.name)) D.categories.push({name:c.name, kind:['basic', 'contracted', 'excluded'].includes(c.kind) ? c.kind : 'excluded'});
  }
  const locId = new Map();
  for(const l of pv.locations){
    if(l.id){ const ex = D.locations.find(x=>x.id===l.id); if(ex && l.km!=null && sel.has('km')) ex.km = l.km; locId.set(l.key, l.id); }
    else { const id = locIdFor(l.name); if(!D.locations.some(x=>x.id===id)) D.locations.push({id, name:l.name, km:l.km!=null ? l.km : 0}); locId.set(l.key, id); }
  }
  const apply = (f, r, all)=>{
    if(r.category && (all || sel.has('category'))) f.category = r.catName;
    if(r.locKey && (all || sel.has('location'))) f.locationId = locId.get(r.locKey) || f.locationId;
    if(r.freq!=null && (all || sel.has('freq'))) f.freq = r.freq;
    if(r.importance!=null && (all || sel.has('importance'))) f.importance = clamp(r.importance, 0, 100);
    if(r.status && (all || sel.has('status'))){ f.excluded = !!r.status.excluded; f.pinned = !!r.status.pinned; }
    if(r.last && (all || sel.has('last')) && (!f.lastVisit || r.last>f.lastVisit)) f.lastVisit = r.last;
  };
  for(const r of pv.added){
    const f = {id:uid('f'), name:r.name, category:'', locationId:null, kindOverride:null, freq:1, importance:50, pinned:false, excluded:false, lastVisit:null, visitCount:0, history:[], weekdays:null, review:'new'};
    apply(f, r, true);
    D.facilities.push(f);
  }
  for(const r of pv.changed){
    if(r.fac.tier==='chosen' && ImpText.key(r.ex.name)!==r.key) D.aliases.facilities[r.key] = r.ex.id;
    apply(r.ex, r, false);
  }
  commit('data');
  toast(t('impDone'), {label:t('undo'), onClick:()=>{ App.data = normalizeData(JSON.parse(before)); commit('data'); }});
};

ImportPipeline.previewPeople = function(sheets, opts){
  opts = opts || {};
  const D = App.data;
  const pick = ImportPipeline.pickTable('team', sheets, opts);
  const base = {kind:'team', sheets:pick.ranking, sheet:pick.chosen, opts:Object.assign({}, opts, {sheet:pick.chosen}), source:sheets};
  const parsed = ImportPipeline.parseGeneric('team', pick.table);
  if(parsed.error) return Object.assign(base, {error:parsed.error});
  const peopleM = impPeopleMatcher(), poolM = impPoolMatcher(), locM = impLocationMatcher();
  const peopleMap = opts.peopleMap || {}, poolMap = opts.poolMap || {};
  const bad = [];
  const seen = new Set();
  let dupFile = 0;
  const recs = [];
  const parseVal = (r, field, v, fn)=>{ const x = fn(v); if(x===undefined || (typeof x==='number' && isNaN(x))){ bad.push({row:r.row, field, value:v}); return null; } return x; };
  for(const r of parsed.rows){
    const key = ImpText.key(r.v.name);
    if(seen.has(key)){ dupFile++; continue; }
    seen.add(key);
    const num100 = v=>{ const n = ImpField.num(v); return n==null ? null : (isNaN(n) || n<0 || n>100 ? undefined : n); };
    const whole = v=>{ const n = ImpField.num(v); return n==null ? null : (isNaN(n) || n<0 || n>1000 || n!==Math.floor(n) ? undefined : n); };
    recs.push({row:r.row, name:r.v.name, key, pool:r.v.pool, poolKey:ImpText.key(r.v.pool), gender:parseVal(r, 'gender', r.v.gender, ImpField.gender), active:parseVal(r, 'active', r.v.active, ImpField.bool), skillB:parseVal(r, 'skillB', r.v.skillB, num100), skillC:parseVal(r, 'skillC', r.v.skillC, num100), fixed:parseVal(r, 'fixed', r.v.fixed, whole), title:r.v.title, origin:r.v.origin, originKey:ImpText.key(r.v.origin)});
  }
  const poolStat = new Map(), locStat = new Map(), personStat = new Map();
  const firstPool = S().pools[0];
  for(const rec of recs){
    if(rec.poolKey){
      let p = poolStat.get(rec.poolKey);
      if(!p){
        const m = poolM.resolve(rec.pool);
        p = {key:rec.poolKey, name:rec.pool, count:0, id:m.id, candidates:m.candidates};
        const ch = poolMap[rec.poolKey];
        if(ch && S().pools.some(x=>x.id===ch)){ p.id = ch; p.tier = 'chosen'; }
        poolStat.set(rec.poolKey, p);
      }
      p.count++;
      rec.poolId = p.id || null;
    }
    if(rec.originKey){
      let l = locStat.get(rec.originKey);
      if(!l){ const m = locM.resolve(rec.origin); l = {key:rec.originKey, name:rec.origin, count:0, id:m.id}; locStat.set(rec.originKey, l); }
      l.count++;
      rec.originId = l.id || 'new:'+rec.originKey;
    }
    const m = peopleM.resolve(rec.name);
    const f = {key:rec.key, name:rec.name, tier:m.tier, id:m.id, candidates:m.candidates};
    const ch = peopleMap[rec.key];
    if(ch==='skip') f.skip = true;
    else if(ch==='new'){ f.id = null; }
    else if(ch && D.people.some(x=>x.id===ch)){ f.id = ch; f.tier = 'chosen'; }
    rec.person = f;
  }
  const labels = ImportPipeline.fieldLabels();
  const fieldsAll = ['pool', 'gender', 'active', 'skillB', 'skillC', 'fixed', 'title', 'origin'];
  const changes = Object.fromEntries(fieldsAll.map(k=>[k, []]));
  const added = [], changed = [], unchanged = [];
  const poolLabel = id=>{ const p = S().pools.find(x=>x.id===id); return p ? poolName(p) : '—'; };
  const genderLabel = g=>g==='f' ? t('impGF') : (g==='m' ? t('impGM') : '—');
  const quotaFixed = p=>p.quota && p.quota.min!=null && p.quota.min===p.quota.max ? p.quota.min : null;
  for(const rec of recs){
    if(rec.person.skip) continue;
    const ex = rec.person.id ? D.people.find(x=>x.id===rec.person.id) : null;
    if(!ex){ added.push(rec); continue; }
    const ch = [];
    const push = (field, from, to)=>{ changes[field].push({name:ex.name, from, to}); ch.push(field); };
    if(rec.poolId && rec.poolId!==ex.pool) push('pool', poolLabel(ex.pool), poolLabel(rec.poolId));
    if(rec.gender && rec.gender!==ex.gender) push('gender', genderLabel(ex.gender), genderLabel(rec.gender));
    if(rec.active!=null && rec.active!==(ex.active!==false)) push('active', ex.active!==false ? t('impYes') : t('impNo'), rec.active ? t('impYes') : t('impNo'));
    if(rec.skillB!=null && rec.skillB!==ex.skill.basic) push('skillB', ex.skill.basic, rec.skillB);
    if(rec.skillC!=null && rec.skillC!==ex.skill.contracted) push('skillC', ex.skill.contracted, rec.skillC);
    if(rec.fixed!=null && rec.fixed!==quotaFixed(ex)) push('fixed', quotaFixed(ex)==null ? '—' : quotaFixed(ex), rec.fixed);
    if(rec.title && rec.title!==(ex.title || '')) push('title', ex.title || '—', rec.title);
    if(rec.origin && rec.originId!==ex.origin) push('origin', (locationById(ex.origin) || {}).name || '—', rec.origin);
    (ch.length ? changed : unchanged).push(Object.assign(rec, {ex, changes:ch}));
  }
  const withChanges = fieldsAll.filter(k=>changes[k].length);
  const selected = opts.fields ? opts.fields.filter(k=>fieldsAll.includes(k)) : withChanges;
  const pools = [...poolStat.values()];
  const unresolvedPools = pools.filter(p=>!p.id || p.tier==='chosen');
  const newLocs = [...locStat.values()].filter(l=>!l.id);
  const panels = [];
  const matched = recs.filter(r=>r.person.id && !r.person.skip).length;
  panels.push({type:'check', tone:'ok', text:t('impPplSummary', matched, added.length), detail:t('impHOf', parsed.rows.length)});
  if(unchanged.length) panels.push({type:'check', tone:'ok', text:t('impPplUnchanged', unchanged.length)});
  if(withChanges.length){
    panels.push({type:'chips', label:t('impFieldsToUpdate'), hint:t('impFieldsHint'), opt:'fields', items:withChanges.map(k=>({key:k, label:labels[k]+' · '+changes[k].length, on:selected.includes(k)}))});
    for(const k of withChanges.filter(x=>selected.includes(x))) panels.push({type:'changes', label:labels[k], rows:changes[k].slice(0, 6).map(c=>c.name+': '+c.from+' → '+c.to), more:Math.max(0, changes[k].length-6)});
  }
  if(unresolvedPools.length) panels.push({type:'map', label:t('impPoolsUnknown', poolName(firstPool)), opt:'poolMap', rows:unresolvedPools.map(p=>({key:p.key, name:p.name, count:p.count, value:poolMap[p.key] || '', options:[{value:'', label:t('impPoolDefault', poolName(firstPool))}].concat(p.candidates.map(c=>({value:c.id, label:poolLabel(c.id)})), S().pools.filter(x=>!p.candidates.some(c=>c.id===x.id)).map(x=>({value:x.id, label:poolName(x)})))}))});
  const similar = recs.filter(r=>(!r.person.id && r.person.candidates.length) || r.person.tier==='chosen' || r.person.skip);
  if(similar.length) panels.push({type:'map', label:t('impPplSimilar'), opt:'peopleMap', rows:similar.map(r=>({key:r.key, name:r.name, count:1, value:r.person.skip ? 'skip' : (r.person.tier==='chosen' ? r.person.id : 'new'), options:[{value:'new', label:t('impCreate')}, {value:'skip', label:t('impIgnore')}].concat(r.person.candidates.map(c=>({value:c.id, label:(personById(c.id) || {}).name})))}))});
  if(added.length) panels.push({type:'check', tone:'soft', text:t('impPplNew', added.length), detail:added.slice(0, 6).map(r=>r.name).join('، ')});
  if(newLocs.length) panels.push({type:'check', tone:'soft', text:t('impLocNew', newLocs.length), detail:newLocs.slice(0, 5).map(l=>l.name).join('، ')});
  if(parsed.header.unused.length) panels.push({type:'check', tone:'soft', text:t('impUnused', parsed.header.unused.join('، '))});
  if(bad.length) panels.push({type:'check', tone:'bad', text:t('impBadValues', bad.length), detail:bad.slice(0, 4).map(b=>t('impBadRow', b.row, labels[b.field] || b.field)).join('، ')});
  if(dupFile) panels.push({type:'check', tone:'soft', text:t('impHDup', dupFile)});
  return Object.assign(base, {added, changed:changed.concat(unchanged), changes, selected, withChanges, recs, pools, newLocs, total:parsed.rows.length, blank:parsed.blank, bad, dupFile, unused:parsed.header.unused, panels:ImportPipeline.order(panels), canApply:added.length>0 || selected.some(k=>changes[k].length)});
};

ImportPipeline.applyPeople = function(pv){
  takeSnapshot('import');
  const before = JSON.stringify(App.data);
  const D = App.data, opts = pv.opts || {};
  const sel = new Set(pv.selected);
  const defaultPool = S().pools[0].id;
  if(!D.aliases.people) D.aliases.people = {};
  const locId = new Map();
  const originFor = r=>{
    if(!r.originKey) return null;
    if(locId.has(r.originKey)) return locId.get(r.originKey);
    let id = r.originId && !/^new:/.test(r.originId) ? r.originId : null;
    if(!id){ id = locIdFor(r.origin); if(!D.locations.some(x=>x.id===id)) D.locations.push({id, name:r.origin, km:0}); }
    locId.set(r.originKey, id);
    return id;
  };
  const apply = (p, r, all)=>{
    if(r.poolId && (all || sel.has('pool'))) p.pool = r.poolId;
    if(r.gender && (all || sel.has('gender'))) p.gender = r.gender;
    if(r.active!=null && (all || sel.has('active'))) p.active = r.active;
    if(r.skillB!=null && (all || sel.has('skillB'))) p.skill.basic = r.skillB;
    if(r.skillC!=null && (all || sel.has('skillC'))) p.skill.contracted = r.skillC;
    if(r.fixed!=null && (all || sel.has('fixed'))) p.quota = normalizeQuota(null, r.fixed);
    if(r.title && (all || sel.has('title'))) p.title = r.title;
    if(r.originKey && (all || sel.has('origin'))) p.origin = originFor(r);
  };
  for(const r of pv.added){
    const p = freshPerson({name:r.name, pool:r.poolId || defaultPool, origin:r.originKey ? originFor(r) : locIdFor('دمنهور')});
    apply(p, r, true);
    D.people.push(p);
  }
  for(const r of pv.changed){
    if(r.person.tier==='chosen' && ImpText.key(r.ex.name)!==r.key) D.aliases.people[r.key] = r.ex.id;
    apply(r.ex, r, false);
  }
  commit('data');
  toast(t('impDone'), {label:t('undo'), onClick:()=>{ App.data = normalizeData(JSON.parse(before)); commit('data'); }});
};

function previewImportSheets(kind, sheets, opts){
  if(kind==='history') return ImportPipeline.previewHistory(sheets, opts);
  if(kind==='facilities') return ImportPipeline.previewFacilities(sheets, opts);
  return ImportPipeline.previewPeople(sheets, opts);
}
function previewImport(kind, rows, opts){ return previewImportSheets(kind, [{name:'sheet', rows}], opts); }
function applyImport(pv){
  if(pv.kind==='history') return ImportPipeline.applyHistory(pv);
  if(pv.kind==='facilities') return ImportPipeline.applyFacilities(pv);
  return ImportPipeline.applyPeople(pv);
}
