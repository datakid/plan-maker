const GEN_WORKER_URL = 'js/worker.js?v='+APP_VERSION;
const GenRun = {active:null, mode:null};

function startGeneration(opts, onProgress){
  opts = Object.assign({}, opts || {});
  let settled = false, worker = null, resolveFn = null;
  const finish = res=>{
    if(settled) return;
    settled = true;
    if(worker){ worker.terminate(); worker = null; }
    if(GenRun.active===handle) GenRun.active = null;
    resolveFn(res);
  };
  const inline = ()=>{
    if(settled) return;
    GenRun.mode = 'inline';
    setTimeout(()=>{
      if(settled) return;
      let res;
      try{ res = generatePlan(Object.assign({}, opts, onProgress ? {onProgress} : {})); }catch(e){ console.error(e); res = {error:'fail'}; }
      finish(res);
    }, 0);
  };
  const promise = new Promise(resolve=>{ resolveFn = resolve; });
  const handle = {promise, cancel(){ finish({cancelled:true}); }};
  GenRun.active = handle;
  if(opts.inline || typeof Worker==='undefined'){ inline(); return handle; }
  let started = false;
  try{
    worker = new Worker(GEN_WORKER_URL);
  }catch(e){ worker = null; inline(); return handle; }
  worker.onmessage = e=>{
    const m = e.data || {};
    started = true;
    if(m.type==='progress'){ if(onProgress) onProgress(m.stage, m.pct); }
    else if(m.type==='result') finish(m.res);
    else if(m.type==='error'){ console.error('generation worker error', m.message); finish({error:'fail'}); }
  };
  worker.onerror = e=>{
    if(e && e.preventDefault) e.preventDefault();
    if(settled) return;
    if(!started){ if(worker){ worker.terminate(); worker = null; } inline(); }
    else finish({error:'fail'});
  };
  GenRun.mode = 'worker';
  const o = Object.assign({}, opts); delete o.onProgress; delete o.inline;
  try{ worker.postMessage({type:'generate', data:App.data, lang:App.ui.lang, opts:o}); }
  catch(e){ if(worker){ worker.terminate(); worker = null; } inline(); }
  return handle;
}
