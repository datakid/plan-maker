let SEED_JSON = null;
window.addEventListener('load', async()=>{
  await sleep(300);
  SEED_JSON = JSON.stringify(App.data);
  if(location.search.includes('record')) return;
  const t0 = Date.now();
  try{ runRegress(/^(P0 (intent|golden)|R-)/); }catch(e){ ok('intent suite ran', false, 'EXC '+e.message); }
  console.log('RESULT pass='+TEST.pass+' fail='+TEST.fail+' ms='+(Date.now()-t0));
});
