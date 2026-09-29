const DAY_MS = 86400000;
function pad2(n){ return String(n).padStart(2,'0'); }
function ordOf(iso){ const p = String(iso).split('-').map(Number); return Math.round(Date.UTC(p[0], p[1]-1, p[2]) / DAY_MS); }
function isoOf(ord){ const d = new Date(ord*DAY_MS); return d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1)+'-'+pad2(d.getUTCDate()); }
function ymdOf(ord){ const d = new Date(ord*DAY_MS); return {y:d.getUTCFullYear(), m:d.getUTCMonth(), d:d.getUTCDate()}; }
function wdOf(ord){ return ((ord+4)%7+7)%7; }
function weekKey(ord){ return ord - wdOf(ord); }
function todayISO(){ const n = new Date(); return n.getFullYear()+'-'+pad2(n.getMonth()+1)+'-'+pad2(n.getDate()); }
function todayOrd(){ return ordOf(todayISO()); }
function addMonthsOrd(ord, n){
  const {y,m,d} = ymdOf(ord);
  const last = new Date(Date.UTC(y, m+n+1, 0)).getUTCDate();
  return Math.round(Date.UTC(y, m+n, Math.min(d, last)) / DAY_MS);
}
function monthStartOrd(y, m){ return Math.round(Date.UTC(y, m, 1)/DAY_MS); }
function daysInMonth(y, m){ return new Date(Date.UTC(y, m+1, 0)).getUTCDate(); }
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function uid(prefix){ return (prefix||'x')+'_'+Math.random().toString(36).slice(2,9); }
function debounce(fn, ms){ let h=null; return function(){ const a=arguments, s=this; clearTimeout(h); h=setTimeout(()=>fn.apply(s,a), ms); }; }
function deepClone(o){ return o==null ? o : JSON.parse(JSON.stringify(o)); }
function sum(arr, fn){ let s=0; for(const x of arr) s += fn ? fn(x) : x; return s; }
function groupBy(arr, fn){ const m = new Map(); for(const x of arr){ const k = fn(x); if(!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }

function toAsciiDigits(s){
  return String(s).replace(/[\u0660-\u0669]/g, d=>String.fromCharCode(d.charCodeAt(0)-0x0660+48))
    .replace(/[\u06F0-\u06F9]/g, d=>String.fromCharCode(d.charCodeAt(0)-0x06F0+48));
}
function norm(s){
  return toAsciiDigits(s||'')
    .replace(/\u0640/g,'').replace(/[\u064B-\u0652\u0670]/g,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
    .replace(/\s+/g,' ').trim().toLowerCase();
}

const MONTH_KEYS = (()=>{
  const m = new Map();
  const ar = {'يناير':0,'فبراير':1,'مارس':2,'ابريل':3,'إبريل':3,'أبريل':3,'مايو':4,'يونيو':5,'يونيه':5,'يوليو':6,'يوليه':6,'اغسطس':7,'أغسطس':7,'سبتمبر':8,'اكتوبر':9,'أكتوبر':9,'نوفمبر':10,'ديسمبر':11};
  for(const k in ar) m.set(norm(k), ar[k]);
  ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].forEach((k,i)=>m.set(k,i));
  return m;
})();
function monthIndexFrom(key){
  const n = norm(key);
  if(MONTH_KEYS.has(n)) return MONTH_KEYS.get(n);
  const s = n.slice(0,3);
  return MONTH_KEYS.has(s) ? MONTH_KEYS.get(s) : undefined;
}
function validISO(y, mo, d){
  if(!(y>=1900 && y<=2200) || !(mo>=0 && mo<=11)) return null;
  if(d<1 || d>daysInMonth(y, mo)) return null;
  return y+'-'+pad2(mo+1)+'-'+pad2(d);
}
function parseDate(raw){
  if(raw==null) return null;
  let s = toAsciiDigits(String(raw)).trim();
  if(!s) return null;
  s = s.replace(/^(sun|mon|tue|wed|thu|fri|sat)\w*\.?[,،]?\s+/i,'')
       .replace(/^(?:يوم\s+)?(?:ال)?(?:احد|أحد|اثنين|إثنين|ثلاثاء|اربعاء|أربعاء|خميس|جمعة|جمعه|سبت)[،,]?\s+/,'').trim();
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if(m) return validISO(+m[1], +m[2]-1, +m[3]);
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if(m) return validISO(+m[3], +m[2]-1, +m[1]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z\u0600-\u06FF]+)\.?[,،]?\s+(\d{4})$/);
  if(m){ const mo = monthIndexFrom(m[2]); return mo===undefined ? null : validISO(+m[3], mo, +m[1]); }
  if(/^\d{5}$/.test(s)){ const n = +s; if(n>20000 && n<80000) return isoOf(n - 25569); }
  return null;
}
function parseDateList(text){
  const accepted = [], rejected = [];
  for(const tok of String(text||'').split(/[,،;\n]+/).map(x=>x.trim()).filter(Boolean)){
    const parts = tok.split(/\.\.|\s+(?:إلى|الى|to)\s+|\s*[–—]\s*/i);
    if(parts.length===2){
      const a = parseDate(parts[0]), b = parseDate(parts[1]);
      if(a && b){
        let lo = ordOf(a), hi = ordOf(b); if(lo>hi){ const x=lo; lo=hi; hi=x; }
        if(hi-lo>400){ rejected.push(tok); continue; }
        for(let o=lo;o<=hi;o++) accepted.push(isoOf(o));
        continue;
      }
      rejected.push(tok); continue;
    }
    const d = parseDate(tok);
    if(d) accepted.push(d); else rejected.push(tok);
  }
  return {accepted, rejected};
}

function el(tag, attrs, children){
  const e = document.createElement(tag);
  if(attrs) for(const k in attrs){
    const v = attrs[k];
    if(v==null || v===false) continue;
    if(k==='class') e.className = v;
    else if(k==='html') e.innerHTML = v;
    else if(k==='style' && typeof v==='object'){ for(const sk in v){ if(v[sk]==null) continue; if(sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
    else if(k.startsWith('on') && typeof v==='function') e.addEventListener(k.slice(2), v);
    else if(k==='value' && (tag==='input' || tag==='textarea' || tag==='select')) e.value = v;
    else if(k==='checked' || k==='disabled' || k==='hidden' || k==='selected') e[k] = !!v;
    else if(v===true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  appendKids(e, children);
  return e;
}
function appendKids(e, children){
  if(children==null) return;
  for(const c of [].concat(children)){
    if(c==null || c===false) continue;
    if(Array.isArray(c)) appendKids(e, c);
    else e.appendChild(typeof c==='string' || typeof c==='number' ? document.createTextNode(String(c)) : c);
  }
}
function clear(node){ while(node.firstChild) node.removeChild(node.firstChild); }
function svg(path, size, sw){
  const s = size||16;
  return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(sw||1.6)+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
}
const ICON = {
  down: svg('<path d="M6 9l6 6 6-6"/>', 14),
  left: svg('<path d="M15 18l-6-6 6-6"/>'),
  right: svg('<path d="M9 18l6-6-6-6"/>'),
  check: svg('<path d="M20 6L9 17l-5-5"/>', 14, 2),
  x: svg('<path d="M18 6L6 18M6 6l12 12"/>', 14),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 14),
  minus: svg('<path d="M5 12h14"/>', 14),
  cal: svg('<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M8 3v3M16 3v3M3.5 9.5h17"/>'),
  list: svg('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".8" fill="currentColor"/><circle cx="4" cy="12" r=".8" fill="currentColor"/><circle cx="4" cy="18" r=".8" fill="currentColor"/>'),
  grid: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>'),
  chart: svg('<path d="M4 4.5v15h16"/><path d="M8.5 16.5v-5M13 16.5v-9M17.5 16.5v-6.5"/>'),
  building: svg('<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8 12.5h2M14 12.5h2M8 16h2M14 16h2M4.5 9h15M12 9v11.5"/>'),
  users: svg('<circle cx="9" cy="8.2" r="3.4"/><path d="M3.2 19.5c.5-3.2 2.8-5.1 5.8-5.1s5.3 1.9 5.8 5.1"/><circle cx="17" cy="9.2" r="2.7"/><path d="M15.9 14.4c2.5.4 4.3 2.3 4.7 4.9"/>'),
  rules: svg('<path d="M4 7h8.2M18.8 7H20M4 12h3.2M13.2 12H20M4 17h10.2"/><circle cx="15.5" cy="7" r="2.1"/><circle cx="10" cy="12" r="2.1"/><circle cx="17.8" cy="17" r="2.1"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/>'),
  auto: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 010 17z" fill="currentColor" stroke="none"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 15),
  refresh: svg('<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 5v6h-6"/>', 15),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 15),
  upload: svg('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>', 15),
  alert: svg('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>', 15),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>', 15),
  ok: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 10"/>', 15),
  pin: svg('<path d="M12 21s6-5.3 6-10.2A6 6 0 106 10.8C6 15.7 12 21 12 21z"/><circle cx="12" cy="10.6" r="2.2"/>', 14),
  swap: svg('<path d="M7 7h12l-3-3M17 17H5l3 3"/>', 15),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 15),
  move: svg('<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M10 15h6M13 12l3 3-3 3"/>', 15),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 118 0v3"/>', 14),
  printer: svg('<path d="M7 9V4h10v5M7 17H5a1.5 1.5 0 01-1.5-1.5v-5A1.5 1.5 0 015 9h14a1.5 1.5 0 011.5 1.5v5A1.5 1.5 0 0119 17h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/>', 15),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>', 15),
  more: svg('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>', 16),
  filter: svg('<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>', 15),
  sparkle: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>', 18)
};
const WORDMARK = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M16 3a13 13 0 1 0 13 13"/><path d="M8.5 21c3.4 0 5-3.2 8.5-3.2S22 14.6 25.5 14.6"/><circle cx="8.5" cy="21" r="2.1" fill="currentColor" stroke="none"/><circle cx="25.5" cy="14.6" r="2.1" fill="currentColor" stroke="none"/></svg>';
