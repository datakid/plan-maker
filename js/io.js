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
  files.push({name:'[Content_Types].xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>'});
  files.push({name:'_rels/.rels', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'});
  files.push({name:'docProps/core.xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>al-Khitta</dc:creator><dc:description>al-Khitta '+APP_VERSION+'</dc:description></cp:coreProperties>'});
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
async function readWorkbook(buf){
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
  const files = [];
  if(z.has('xl/workbook.xml')){
    const wb = parse(dec.decode(z.get('xl/workbook.xml')));
    const rels = {};
    if(z.has('xl/_rels/workbook.xml.rels')) for(const r of parse(dec.decode(z.get('xl/_rels/workbook.xml.rels'))).getElementsByTagName('Relationship')) rels[r.getAttribute('Id')] = r.getAttribute('Target');
    for(const sh of wb.getElementsByTagName('sheet')){
      const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let target = rels[rid] || '';
      target = target.replace(/^\//, '');
      if(target && !target.startsWith('xl/')) target = 'xl/'+target;
      if(z.has(target)) files.push({name:sh.getAttribute('name') || target, file:target});
    }
  }
  if(!files.length) [...z.keys()].filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a, b)=>parseInt(a.match(/\d+/)[0], 10)-parseInt(b.match(/\d+/)[0], 10)).forEach((k, i)=>files.push({name:'Sheet'+(i+1), file:k}));
  if(!files.length) throw new Error('sheet');
  return files.map(f=>{
    const doc = parse(dec.decode(z.get(f.file)));
    const rows = [...doc.getElementsByTagName('row')].map(r=>{
      const row = [];
      for(const c of r.getElementsByTagName('c')){
        const ref = c.getAttribute('r')||''; const m = ref.match(/^[A-Z]+/);
        let idx = 0; if(m) for(const ch of m[0]) idx = idx*26 + ch.charCodeAt(0)-64; idx--;
        const tp = c.getAttribute('t'), st = c.getAttribute('s');
        let v = '';
        if(tp==='inlineStr'){ const is = c.getElementsByTagName('is')[0]; v = is ? [...is.getElementsByTagName('t')].map(x=>x.textContent).join('') : ''; }
        else { const ve = c.getElementsByTagName('v')[0]; const raw = ve ? ve.textContent : ''; v = tp==='s' ? (shared[+raw]||'') : ((st!=null && dateStyles[+st] && raw) ? isoOf(Math.floor(+raw) - 25569) : raw); }
        while(row.length<idx) row.push('');
        row[idx] = v;
      }
      return row;
    });
    return {name:f.name, rows};
  });
}
async function readXlsx(buf){ return (await readWorkbook(buf))[0].rows; }
async function readSheets(file){
  if(/\.xlsx$/i.test(file.name)) return readWorkbook(await file.arrayBuffer());
  return [{name:file.name, rows:parseDelimited(await file.text())}];
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

function exportPlanRows(plan, mode){
  const H = [t('hFacility'), t('hCategory'), t('hCycle'), t('hType'), t('hDate'), t('hTeam')];
  const head = mode==='noTeam' ? H.slice(0,5) : H;
  const ph = new Map();
  const rows = plan.visits.map(v=>{
    const f = facilityById(v.facilityId) || {name:'—', category:''};
    if(!ph.has(v.facilityId)) ph.set(v.facilityId, (App.ui.lang==='ar'?'جهة ':'Facility ')+(ph.size+1));
    const r = [mode==='noFac' ? ph.get(v.facilityId) : f.name, f.category, String(plan.cycle), v.kind==='basic' ? 'أساسي' : 'متعاقد', v.date];
    if(mode!=='noTeam') r.push(visitTeamIds(v).map(id=>(personById(id)||{}).name).concat(visitGuestLabels(v)).join('-'));
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
