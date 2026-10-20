let SEED_JSON = null;
window.addEventListener('error', e=>TEST.errors.push(e.message));
window.addEventListener('unhandledrejection', e=>TEST.errors.push(String(e.reason)));
window.addEventListener('load', ()=>{
  if(!window.__TEST_ISOLATED__){ console.log('RESULT refused · test storage is not isolated'); return; }
  SEED_JSON = JSON.stringify(App.data);
  runRegress(null);
  ok('focused People tests: no uncaught errors', TEST.errors.length===0, TEST.errors.join(' | '));
  console.log('RESULT pass='+TEST.pass+' fail='+TEST.fail);
  document.body.dataset.done = 'true';
});
