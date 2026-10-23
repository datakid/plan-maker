importScripts('core.js', 'seed.js', 'store.js', 'i18n.js', 'rules-model.js', 'people-rules.js', 'engine.js', 'goals.js', 'constraints.js', 'score.js', 'flow.js', 'assign.js', 'layout.js', 'solver.js', 'lns.js', 'explain.js', 'planner.js');

let lastPost = 0;
self.onmessage = e=>{
  const m = e.data;
  if(!m || m.type!=='generate') return;
  try{
    App.ui.lang = m.lang==='en' ? 'en' : 'ar';
    App.data = normalizeData(m.data);
    const opts = Object.assign({}, m.opts, {onProgress:(stage, pct)=>{
      const now = Date.now();
      if(stage==='done' || now-lastPost>=60){ lastPost = now; self.postMessage({type:'progress', stage, pct}); }
    }});
    const res = generatePlan(opts);
    self.postMessage({type:'result', res});
  }catch(err){
    self.postMessage({type:'error', message:String(err && err.message || err)});
  }
};
