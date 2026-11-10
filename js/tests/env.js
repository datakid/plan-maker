(function(){
  const store = new Map();
  const shim = {
    getItem:k=>store.has(String(k)) ? store.get(String(k)) : null,
    setItem:(k, v)=>{ store.set(String(k), String(v)); },
    removeItem:k=>{ store.delete(String(k)); },
    clear:()=>{ store.clear(); },
    key:i=>[...store.keys()][i] || null,
    get length(){ return store.size; }
  };
  let installed = false;
  try{
    Object.defineProperty(window, 'localStorage', {value:shim, configurable:true, writable:true});
    installed = window.localStorage===shim;
  }catch(e){ installed = false; }
  window.__TEST_ISOLATED__ = installed;
  window.__TEST_STORAGE__ = shim;
  if(!installed) console.log('FAIL test storage isolation · could not replace localStorage, tests refuse to run');
})();

const ENV = (function(){
  const hasDoc = typeof document!=='undefined' && !!document && !!document.body;
  const proto = typeof location!=='undefined' && location ? String(location.protocol) : '';
  const http = proto==='http:' || proto==='https:';
  const ua = typeof navigator!=='undefined' && navigator ? String(navigator.userAgent) : '';
  const kind = !hasDoc ? 'vm' : (/jsdom/i.test(ua) ? 'jsdom' : 'browser');
  const cache = {};
  const probes = {
    layout:()=>hasDoc && document.body.getBoundingClientRect().width>0,
    worker:()=>typeof Worker==='function' && http,
    fetch:()=>typeof fetch==='function' && http,
    focus:()=>{
      if(!probes.layout()) return false;
      const b = document.createElement('button');
      document.body.appendChild(b);
      b.focus();
      const ok = document.activeElement===b;
      b.remove();
      return ok;
    },
    zip:()=>typeof DecompressionStream==='function',
    'dom-render':()=>hasDoc && !!document.querySelector('#topbar')
  };
  const has = cap=>{
    if(cap==='dom-render') return !!probes['dom-render']();
    if(!(cap in cache)){
      if(!probes[cap]) throw new Error('unknown test need: '+cap);
      cache[cap] = !!probes[cap]();
    }
    return cache[cap];
  };
  return {kind, has, caps:Object.keys(probes)};
})();
