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
