const TEST = {pass:0, fail:0, errors:[], failed:[], cases:[]};
function ok(name, cond, extra){
  if(cond) TEST.pass++; else { TEST.fail++; TEST.failed.push(name); }
  console.log((cond?'PASS ':'FAIL ')+name+(extra!=null?' · '+extra:''));
}
function step(name, fn){
  try{ const r = fn(); ok(name, r!==false, typeof r==='string' ? r : null); }
  catch(e){ ok(name, false, 'EXC '+e.message+' '+(e.stack||'').split('\n')[1]); }
}
const sleep = ms=>new Promise(r=>setTimeout(r, ms));
function regress(name, fn){ TEST.cases.push({name, fn}); }
function verdict(cond, passInfo, failInfo){
  return cond ? {pass:true, info:passInfo} : {pass:false, info:failInfo};
}
function runRegress(filter){
  for(const c of TEST.cases){
    if(filter && !filter.test(c.name)) continue;
    const keep = App.data, keepPlan = App.plan;
    try{
      const r = c.fn();
      if(r && typeof r==='object') ok(c.name, r.pass===true, r.info==null || r.info===false ? null : String(r.info));
      else if(r===true) ok(c.name, true);
      else ok(c.name, false, typeof r==='string' ? 'bare string result: '+r : String(r));
    }catch(e){
      ok(c.name, false, 'EXC '+e.message+' '+(e.stack||'').split('\n')[1]);
    }finally{
      App.data = keep; App.plan = keepPlan;
    }
  }
}
function expectEq(actual, expected, label){
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if(a===b) return true;
  return (label?label+': ':'')+'got '+a+' want '+b;
}
