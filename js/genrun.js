const GEN_WORKER_URL = 'js/worker.js?v='+APP_VERSION;
const GenRun = {active:null, mode:null, seq:0, _WorkerCtor:null};
const GEN_SAFETY_MS = 120000;

function startGeneration(opts, onProgress){
  opts = Object.assign({}, opts || {});
  const runId = ++GenRun.seq;
  let settled = false, worker = null, resolveFn = null, progressed = false, fellBack = false, lastPct = 0;
  const progress = (stage, pct)=>{
    if(settled || !onProgress) return;
    lastPct = Math.max(lastPct, pct || 0);
    onProgress(stage, lastPct);
  };
  const finish = res=>{
    if(settled) return;
    settled = true;
    if(worker){ const w = worker; worker = null; w.terminate(); }
    if(GenRun.active===handle) GenRun.active = null;
    resolveFn(res);
  };
  const inline = ()=>{
    if(settled || fellBack) return;
    fellBack = true;
    GenRun.mode = 'inline';
    setTimeout(()=>{
      if(settled) return;
      let res;
      const limit = Date.now()+(opts.safetyMs || GEN_SAFETY_MS);
      try{ res = generatePlan(Object.assign({}, opts, {abort:()=>Date.now()>limit}, onProgress ? {onProgress:progress} : {})); }catch(e){ console.error(e); res = {error:'fail'}; }
      finish(res);
    }, 0);
  };
  const dropWorker = ()=>{ if(worker){ const w = worker; worker = null; w.terminate(); } };
  const promise = new Promise(resolve=>{ resolveFn = resolve; });
  const handle = {promise, runId, cancel(){ finish({cancelled:true}); }};
  GenRun.active = handle;
  const Ctor = GenRun._WorkerCtor || (typeof Worker==='undefined' ? null : Worker);
  if(opts.inline || !Ctor){ inline(); return handle; }
  try{
    worker = new Ctor(GEN_WORKER_URL);
  }catch(e){ worker = null; inline(); return handle; }
  worker.onmessage = e=>{
    if(settled) return;
    const m = e.data || {};
    if(m.runId!==undefined && m.runId!==runId) return;
    if(m.type==='progress'){ progressed = true; progress(m.stage, m.pct); }
    else if(m.type==='result') finish(m.res);
    else if(m.type==='error'){
      console.error('generation worker error', m.message);
      if(!progressed){ dropWorker(); inline(); }
      else finish({error:'fail'});
    }
  };
  worker.onerror = e=>{
    if(e && e.preventDefault) e.preventDefault();
    if(settled) return;
    if(!progressed){ dropWorker(); inline(); }
    else finish({error:'fail'});
  };
  GenRun.mode = 'worker';
  const o = Object.assign({}, opts); delete o.onProgress; delete o.inline;
  try{ worker.postMessage({type:'generate', runId, data:App.data, lang:App.ui.lang, opts:o}); }
  catch(e){ dropWorker(); inline(); }
  return handle;
}
