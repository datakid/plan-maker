const CRC_TABLE = (()=>{ const tb = new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1); tb[n]=c>>>0; } return tb; })();
function crc32(b){ let c = 0xFFFFFFFF; for(let i=0;i<b.length;i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c>>>8); return (c ^ 0xFFFFFFFF)>>>0; }
function buildZip(files){
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  const d = new Date();
  const time = (d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1), date = ((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  for(const f of files){
    const name = enc.encode(f.name), data = typeof f.data==='string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const lh = new Uint8Array(30+name.length), dv = new DataView(lh.buffer);
    dv.setUint32(0,0x04034b50,true); dv.setUint16(4,20,true); dv.setUint16(10,time,true); dv.setUint16(12,date,true);
    dv.setUint32(14,crc,true); dv.setUint32(18,data.length,true); dv.setUint32(22,data.length,true); dv.setUint16(26,name.length,true);
    lh.set(name,30); parts.push(lh, data);
    const ch = new Uint8Array(46+name.length), cv = new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true); cv.setUint16(12,time,true); cv.setUint16(14,date,true);
    cv.setUint32(16,crc,true); cv.setUint32(20,data.length,true); cv.setUint32(24,data.length,true); cv.setUint16(28,name.length,true); cv.setUint32(42,offset,true);
    ch.set(name,46); central.push(ch);
    offset += lh.length + data.length;
  }
  const csize = sum(central, c=>c.length);
  const eo = new Uint8Array(22), ev = new DataView(eo.buffer);
  ev.setUint32(0,0x06054b50,true); ev.setUint16(8,files.length,true); ev.setUint16(10,files.length,true); ev.setUint32(12,csize,true); ev.setUint32(16,offset,true);
  const all = [...parts, ...central, eo];
  const out = new Uint8Array(sum(all, p=>p.length));
  let pos = 0; for(const p of all){ out.set(p,pos); pos += p.length; }
  return out;
}
function xmlEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function colLetter(i){ let s=''; i++; while(i>0){ const r=(i-1)%26; s = String.fromCharCode(65+r)+s; i = Math.floor((i-1)/26); } return s; }
function buildXlsx(sheets){
  const rtl = App.ui.lang==='ar' ? '1' : '0';
  const files = [];
  const wsXml = sheets.map((sh,si)=>{
    const rows = sh.rows.map((row,ri)=>'<row r="'+(ri+1)+'">'+row.map((v,ci)=>{
      const ref = colLetter(ci)+(ri+1);
      const st = ri===0 ? ' s="1"' : (sh.styles && sh.styles[ri] && sh.styles[ri][ci] ? ' s="'+sh.styles[ri][ci]+'"' : '');
      if(typeof v==='number') return '<c r="'+ref+'"'+st+'><v>'+v+'</v></c>';
      return '<c r="'+ref+'" t="inlineStr"'+st+'><is><t xml:space="preserve">'+xmlEsc(v)+'</t></is></c>';
    }).join('')+'</row>').join('');
    const cols = (sh.widths||[]).map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="'+rtl+'" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'+(cols?'<cols>'+cols+'</cols>':'')+'<sheetData>'+rows+'</sheetData></worksheet>';
  });
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFE3EC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3EDE1"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEEEEE"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf/><xf fontId="1" fillId="4" applyFont="1" applyFill="1"/><xf fillId="2" applyFill="1"/><xf fillId="3" applyFill="1"/><xf fillId="4" applyFill="1"/></cellXfs></styleSheet>';
  files.push({name:'[Content_Types].xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>'});
  files.push({name:'_rels/.rels', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});
  files.push({name:'xl/workbook.xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>'<sheet name="'+xmlEsc(s.name).slice(0,31)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>'});
  files.push({name:'xl/_rels/workbook.xml.rels', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'});
  files.push({name:'xl/styles.xml', data:styles});
  wsXml.forEach((x,i)=>files.push({name:'xl/worksheets/sheet'+(i+1)+'.xml', data:x}));
  return buildZip(files);
}

async function readZip(buf){
  const bytes = new Uint8Array(buf), dv = new DataView(buf);
  let eo = -1;
  for(let i=bytes.length-22; i>=Math.max(0, bytes.length-65600); i--) if(dv.getUint32(i,true)===0x06054b50){ eo = i; break; }
  if(eo<0) throw new Error('zip');
  const count = dv.getUint16(eo+10,true);
  let p = dv.getUint32(eo+16,true);
  const out = new Map();
  for(let i=0;i<count;i++){
    const method = dv.getUint16(p+10,true), csize = dv.getUint32(p+20,true), nlen = dv.getUint16(p+28,true), xlen = dv.getUint16(p+30,true), clen = dv.getUint16(p+32,true), lo = dv.getUint32(p+42,true);
    const name = new TextDecoder().decode(bytes.subarray(p+46, p+46+nlen));
    const start = lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true);
    const data = bytes.subarray(start, start+csize);
    if(method===0) out.set(name, data.slice());
    else if(method===8 && typeof DecompressionStream!=='undefined'){
      const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      out.set(name, new Uint8Array(await new Response(s).arrayBuffer()));
    }
    p += 46+nlen+xlen+clen;
  }
  return out;
}
async function readXlsx(buf){
  const z = await readZip(buf), dec = new TextDecoder();
  const parse = s=>new DOMParser().parseFromString(s, 'application/xml');
  const shared = z.has('xl/sharedStrings.xml') ? [...parse(dec.decode(z.get('xl/sharedStrings.xml'))).getElementsByTagName('si')].map(si=>[...si.getElementsByTagName('t')].map(x=>x.textContent).join('')) : [];
  let dateStyles = [];
  if(z.has('xl/styles.xml')){
    const doc = parse(dec.decode(z.get('xl/styles.xml')));
    const custom = {}; for(const nf of doc.getElementsByTagName('numFmt')) custom[+nf.getAttribute('numFmtId')] = nf.getAttribute('formatCode')||'';
    const xfs = doc.getElementsByTagName('cellXfs')[0];
    dateStyles = xfs ? [...xfs.getElementsByTagName('xf')].map(x=>{ const id = +x.getAttribute('numFmtId'); return (id>=14 && id<=22) || (id>=45 && id<=47) || (custom[id] && /[ydYD]/.test(custom[id].replace(/"[^"]*"|\[[^\]]*\]/g,''))); }) : [];
  }
  const sheetName = [...z.keys()].filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  if(!sheetName) throw new Error('sheet');
  const doc = parse(dec.decode(z.get(sheetName)));
  return [...doc.getElementsByTagName('row')].map(r=>{
    const row = [];
    for(const c of r.getElementsByTagName('c')){
      const ref = c.getAttribute('r')||''; const m = ref.match(/^[A-Z]+/);
      let idx = 0; if(m) for(const ch of m[0]) idx = idx*26 + ch.charCodeAt(0)-64; idx--;
      const tp = c.getAttribute('t'), s = c.getAttribute('s');
      let v = '';
      if(tp==='inlineStr'){ const is = c.getElementsByTagName('is')[0]; v = is ? [...is.getElementsByTagName('t')].map(x=>x.textContent).join('') : ''; }
      else { const ve = c.getElementsByTagName('v')[0]; const raw = ve ? ve.textContent : ''; v = tp==='s' ? (shared[+raw]||'') : ((s!=null && dateStyles[+s] && raw) ? isoOf(Math.floor(+raw) - 25569) : raw); }
      while(row.length<idx) row.push('');
      row[idx] = v;
    }
    return row;
  });
}
function parseDelimited(text){
  text = text.replace(/^\uFEFF/,'');
  const first = text.split(/\r?\n/)[0]||'';
  const delim = ['\t',';',','].map(d=>[d, first.split(d).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows = []; let row = [], f = '', q = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){ f+='"'; i++; } else q = false; } else f += c; }
    else if(c==='"') q = true;
    else if(c===delim){ row.push(f); f=''; }
    else if(c==='\n'){ row.push(f); rows.push(row); row=[]; f=''; }
    else if(c!=='\r') f += c;
  }
  if(f.length || row.length){ row.push(f); rows.push(row); }
  return rows.filter(r=>r.some(x=>String(x).trim()!==''));
}
async function readTable(file){
  if(/\.xlsx$/i.test(file.name)) return readXlsx(await file.arrayBuffer());
  return parseDelimited(await file.text());
}
function csvSafe(v){ const s = String(v==null?'':v); return /^[=+@\-]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? "'"+s : s; }
function toCSV(rows){ return '\uFEFF'+rows.map(r=>r.map(v=>{ const s = csvSafe(v); return /[",\r\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }).join(',')).join('\r\n'); }

const IMPORT_SPECS = {
  history: {cols:{facility:['جهة المرور','الجهة','facility'], category:['المنطقة','التصنيف','category'], cycle:['الخطة','الدورة','cycle'], type:['المرور','النوع','type'], date:['التاريخ','date'], team:['القائم بالمرور','الفريق','team']}, required:['facility','date','team'],
    template:[['جهة المرور','المنطقة','الخطة','المرور','التاريخ','القائم بالمرور'],['ابو حمص','الثانية','12','أساسي','2026-08-02','أباظة-أماني-حمودين-شرنوبي'],['مركز دمنهور للاشعة','اشعة','12','متعاقد','2026-08-03','شلتوت-ميسرة-شوقي']]},
  facilities: {cols:{name:['الاسم','اسم الجهة','name'], category:['التصنيف','المنطقة','category'], location:['الموقع','location'], km:['المسافة (كم)','المسافة','km'], freq:['الوتيرة','الوزن','frequency'], importance:['الأهمية','importance'], status:['الحالة','status'], last:['آخر زيارة','last visit']}, required:['name','category'],
    template:[['الاسم','التصنيف','الموقع','المسافة (كم)','الوتيرة','الأهمية','الحالة','آخر زيارة'],['مركز دمنهور للاشعة','اشعة','دمنهور','0','1','50','مُدرجة','2026-08-01'],['صيدلية النصر','صيدلية','كفر الدوار','37','0.5','50','مستبعدة','']]},
  team: {cols:{name:['الاسم','name'], pool:['المجموعة','group','pool'], gender:['النوع','gender'], active:['نشط','active'], skillB:['خبرة أساسية','skill basic'], skillC:['خبرة متعاقدة','skill contracted'], fixed:['عدد ثابت','حصة ثابتة','fixed']}, required:['name'],
    template:[['الاسم','المجموعة','النوع','نشط','خبرة أساسية','خبرة متعاقدة','عدد ثابت'],['محمود عزت','مالي واداري','ذكر','نعم','50','50',''],['هبة السيد','فني','أنثى','نعم','75','50','6']]}
};
function mapColumns(kind, header){
  const spec = IMPORT_SPECS[kind], map = {};
  header.forEach((h,i)=>{ const n = norm(h); for(const k in spec.cols) if(map[k]==null && spec.cols[k].some(a=>norm(a)===n)) map[k] = i; });
  return {map, missing: spec.required.filter(k=>map[k]==null)};
}
function downloadTemplate(kind){
  const tpl = IMPORT_SPECS[kind].template;
  downloadBlob(buildXlsx([{name:kind, rows:tpl, widths:tpl[0].map(()=>20)}]), 'template-'+kind+'.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function resolvePerson(raw){
  const n = norm(raw);
  const alias = App.data.aliases.people[n];
  if(alias){ const p = personById(alias); if(p) return p; }
  const target = PERSON_ALIASES[raw.trim()] ? norm(PERSON_ALIASES[raw.trim()]) : n;
  return App.data.people.find(p=>norm(p.name)===target || norm(p.name)===n) || null;
}
function resolveFacility(raw){
  const n = norm(raw);
  return App.data.facilities.find(f=>norm(f.name)===n) || null;
}

function previewImport(kind, rows){
  const header = rows[0]||[], body = rows.slice(1);
  const {map, missing} = mapColumns(kind, header);
  if(missing.length) return {error: t('impMissingCols', missing.join('، '))};
  const get = (r,k)=>map[k]!=null ? String(r[map[k]]==null?'':r[map[k]]).trim() : '';
  if(kind==='history'){
    const recs = [], unknownPeople = new Map(), newFacilities = new Set();
    let bad = 0;
    for(const r of body){
      const date = parseDate(get(r,'date')); const fname = get(r,'facility');
      if(!fname) continue;
      if(!date){ bad++; continue; }
      if(!resolveFacility(fname)) newFacilities.add(fname);
      const names = get(r,'team').split(/[-–،,]/).map(s=>s.trim()).filter(Boolean);
      for(const nm of names) if(!resolvePerson(nm)){ const k = norm(nm); unknownPeople.set(k, {name:nm, count:(unknownPeople.get(k)||{count:0}).count+1}); }
      recs.push({fname, cat:get(r,'category'), date, names, cycle:parseInt(toAsciiDigits(get(r,'cycle')),10)});
    }
    return {kind, recs, total:body.length, bad, newFacilities:[...newFacilities], unknownPeople:[...unknownPeople.values()]};
  }
  if(kind==='facilities'){
    const added = [], changed = [];
    for(const r of body){
      const name = get(r,'name'); if(!name) continue;
      const rec = {name, category:get(r,'category'), location:get(r,'location'), km:get(r,'km'), freq:get(r,'freq'), importance:get(r,'importance'), status:get(r,'status'), last:get(r,'last')};
      const ex = resolveFacility(name);
      if(ex) changed.push(Object.assign(rec, {ex})); else added.push(rec);
    }
    return {kind, added, changed, total:body.length};
  }
  const added = [], changed = [];
  for(const r of body){
    const name = get(r,'name'); if(!name) continue;
    const rec = {name, pool:get(r,'pool'), gender:get(r,'gender'), active:get(r,'active'), skillB:get(r,'skillB'), skillC:get(r,'skillC'), fixed:get(r,'fixed')};
    const ex = resolvePerson(name);
    if(ex) changed.push(Object.assign(rec, {ex})); else added.push(rec);
  }
  return {kind, added, changed, total:body.length};
}

function applyImport(pv){
  const before = JSON.stringify(App.data);
  const D = App.data;
  const ensureLoc = (name, km)=>{
    if(!name) return null;
    let l = D.locations.find(x=>norm(x.name)===norm(name));
    if(!l){ l = {id:locIdFor(name), name, km: km!=='' && !isNaN(+km) ? +km : 0}; D.locations.push(l); }
    else if(km!=='' && km!=null && !isNaN(+km)) l.km = +km;
    return l.id;
  };
  const ensureCat = name=>{ if(name && !D.categories.some(c=>c.name===name)) D.categories.push({name, kind:'excluded'}); };
  if(pv.kind==='history'){
    for(const r of pv.recs){
      let f = resolveFacility(r.fname);
      if(!f){ ensureCat(r.cat); f = {id:uid('f'), name:r.fname, category:r.cat||'', locationId:null, kindOverride:null, freq:1, importance:50, pinned:false, excluded:false, lastVisit:null, visitCount:0, history:[], weekdays:null, review:'new'}; D.facilities.push(f); }
      f.visitCount = (f.visitCount||0)+1;
      if(!f.lastVisit || r.date>f.lastVisit) f.lastVisit = r.date;
      f.history = [{date:r.date, team:r.names}].concat(f.history||[]).sort((a,b)=>a.date<b.date?1:-1).slice(0,20);
      for(const nm of r.names){
        const p = resolvePerson(nm);
        if(!p) continue;
        D.history.counts[p.id] = (D.history.counts[p.id]||0)+1;
        D.history.fpv[f.id+'|'+p.id] = (D.history.fpv[f.id+'|'+p.id]||0)+1;
      }
      if(!isNaN(r.cycle)) D.history.lastCycle = Math.max(D.history.lastCycle||0, r.cycle);
    }
    for(const u of pv.unknownPeople) if(!D.unresolved.some(x=>norm(x.name)===norm(u.name))) D.unresolved.push(u);
  } else if(pv.kind==='facilities'){
    const apply = (f, r)=>{
      if(r.category){ ensureCat(r.category); f.category = r.category; }
      if(r.location) f.locationId = ensureLoc(r.location, r.km);
      if(r.freq!=='' && !isNaN(+r.freq)) f.freq = +r.freq;
      if(r.importance!=='' && !isNaN(+r.importance)) f.importance = clamp(+r.importance, 0, 100);
      if(r.status){ const s = norm(r.status); f.excluded = s===norm('مستبعدة') || s==='excluded'; f.pinned = s===norm('مثبتة') || s==='pinned'; }
      if(r.last){ const d = parseDate(r.last); if(d) f.lastVisit = d; }
    };
    for(const r of pv.added){ const f = {id:uid('f'), name:r.name, category:'', locationId:null, kindOverride:null, freq:1, importance:50, pinned:false, excluded:false, lastVisit:null, visitCount:0, history:[], weekdays:null, review:null}; apply(f, r); D.facilities.push(f); }
    for(const r of pv.changed) apply(r.ex, r);
  } else {
    const poolFor = raw=>{ if(!raw) return S().pools[0].id; const n = norm(raw); const p = S().pools.find(x=>norm(x.name)===n || norm(x.nameEn||'')===n || x.id===raw); return p ? p.id : S().pools[0].id; };
    const apply = (p, r)=>{
      if(r.pool) p.pool = poolFor(r.pool);
      if(r.gender){ const g = norm(r.gender); p.gender = (g===norm('أنثى') || g==='f' || g==='female') ? 'f' : ((g===norm('ذكر') || g==='m' || g==='male') ? 'm' : p.gender); }
      if(r.active){ const a = norm(r.active); p.active = !(a===norm('لا') || a==='0' || a==='no' || a==='false'); }
      if(r.skillB!=='' && !isNaN(+r.skillB)) p.skill.basic = clamp(+r.skillB, 0, 100);
      if(r.skillC!=='' && !isNaN(+r.skillC)) p.skill.contracted = clamp(+r.skillC, 0, 100);
      if(r.fixed!=='' && !isNaN(+r.fixed)) p.fixed = +r.fixed;
    };
    for(const r of pv.added){ const p = freshPerson({name:r.name, pool:poolFor(r.pool), origin:locIdFor('دمنهور')}); apply(p, r); D.people.push(p); }
    for(const r of pv.changed) apply(r.ex, r);
  }
  commit('data');
  toast(t('impDone'), {label:t('undo'), onClick:()=>{ App.data = normalizeData(JSON.parse(before)); commit('data'); }});
}

function exportPlanRows(plan, mode){
  const H = [t('hFacility'), t('hCategory'), t('hCycle'), t('hType'), t('hDate'), t('hTeam')];
  const head = mode==='noTeam' ? H.slice(0,5) : H;
  const ph = new Map();
  const rows = plan.visits.map(v=>{
    const f = facilityById(v.facilityId) || {name:'—', category:''};
    if(!ph.has(v.facilityId)) ph.set(v.facilityId, (App.ui.lang==='ar'?'جهة ':'Facility ')+(ph.size+1));
    const r = [mode==='noFac' ? ph.get(v.facilityId) : f.name, f.category, String(plan.cycle), v.kind==='basic' ? 'أساسي' : 'متعاقد', v.date];
    if(mode!=='noTeam') r.push(visitTeamIds(v).map(id=>(personById(id)||{}).name).join('-'));
    return r;
  });
  return [head, ...rows];
}
function exportMatrixSheet(plan){
  const head = [t('pName')].concat(plan.days.map(d=>fmtDate(d,'short'))).concat([t('matrixTotal')]);
  const rows = [head], styles = {};
  for(const {pool, members} of poolsLive()){
    rows.push([poolName(pool)].concat(plan.days.map(()=>'')).concat(['']));
    styles[rows.length-1] = [4];
    for(const p of members){
      const r = [p.name]; const st = [0]; let tot = 0;
      for(const d of plan.days){
        const v = plan.visits.find(x=>x.date===d && visitTeamIds(x).includes(p.id));
        if(v){ const f = facilityById(v.facilityId); r.push(f ? f.name : '•'); st.push(v.kind==='basic'?2:3); tot++; }
        else { r.push(personAvailable(p, ordOf(d)) ? '' : '—'); st.push(0); }
      }
      r.push(tot); rows.push(r); styles[rows.length-1] = st;
    }
  }
  return {name: App.ui.lang==='ar'?'المصفوفة':'Matrix', rows, styles, widths:[16].concat(plan.days.map(()=>14)).concat([8])};
}
