const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.woff2':'font/woff2', '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json'};
const failures = [];
const note = m=>console.log(m);
const fail = m=>{ failures.push(m); console.log('FAIL '+m); };

function serve(){
  return new Promise(resolve=>{
    const server = http.createServer((req, res)=>{
      let p = decodeURIComponent(req.url.split('?')[0]);
      if(p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p);
      if(!f.startsWith(root)){ res.statusCode = 403; res.end(); return; }
      fs.readFile(f, (e, b)=>{
        if(e){ res.statusCode = 404; res.end('not found'); return; }
        res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
        if(path.basename(f)==='sw.js') res.setHeader('Cache-Control', 'no-cache');
        res.end(b);
      });
    }).listen(0, '127.0.0.1', ()=>resolve(server));
  });
}

async function runSuite(browser, base, width){
  const page = await browser.newPage({viewport:{width, height:900}});
  let result = null, bad = [];
  page.on('console', m=>{ const t = m.text(); if(t.startsWith('RESULT')) result = t; if(t.startsWith('FAIL') || t.startsWith('EXC')) bad.push(t); });
  page.on('pageerror', e=>bad.push('PAGEERROR '+e.message));
  await page.goto(base+'/test.html');
  const t0 = Date.now();
  while(!result && Date.now()-t0<900000) await page.waitForTimeout(500);
  await page.close();
  note('suite '+width+'px: '+(result || 'NO RESULT'));
  if(!result || !/fail=0/.test(result) || bad.length) fail('suite '+width+'px '+(result || 'no result')+' '+bad.slice(0, 5).join(' | '));
}

async function runMatrix(browser, base){
  const page = await browser.newPage({viewport:{width:1440, height:900}});
  let line = null;
  page.on('console', m=>{ const t = m.text(); if(t.startsWith('MATRIX')) line = t; });
  await page.goto(base+'/docs/people-matrix.html');
  const t0 = Date.now();
  while(!line && Date.now()-t0<300000) await page.waitForTimeout(500);
  await page.close();
  note('people matrix: '+(line || 'NO RESULT'));
  if(!line || !/fail=0/.test(line)) fail('people matrix '+(line || 'no result'));
}

async function runApp(browser, base){
  const context = await browser.newContext({viewport:{width:1100, height:800}, serviceWorkers:'allow'});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e=>errors.push('pageerror '+e.message));
  page.on('console', m=>{ if(m.type()==='error') errors.push('console '+m.text()); });
  await page.addInitScript(()=>{ window.__csp = []; document.addEventListener('securitypolicyviolation', e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI)); });
  const external = [];
  page.on('request', r=>{ if(!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  await page.goto(base+'/index.html');
  await page.waitForSelector('#topbar .tab');
  for(const tab of ['facilities', 'team', 'rules', 'data', 'plan']){
    await page.evaluate(t=>{ location.hash = t; }, tab);
    await page.waitForTimeout(250);
  }
  await page.evaluate(async()=>{ await doGenerate(document.querySelector('.gen-btn')); });
  await page.evaluate(()=>{ confirmDialog('t', 'b'); });
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{ sheet({title:()=>'t', body:()=>[el('div', null, 'x')]}).close(true); });
  await page.evaluate(async()=>{ await document.fonts.ready; });
  const info = await page.evaluate(async()=>({
    csp:window.__csp, mode:GenRun.mode, version:APP_VERSION,
    fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.weight),
    scripts:[...document.querySelectorAll('script[src], link[rel=stylesheet], link[rel=manifest]')].map(n=>n.getAttribute('src') || n.getAttribute('href'))
  }));
  if(info.csp.length) fail('CSP violations: '+info.csp.join(' | '));
  if(info.mode!=='worker') fail('generation did not use the worker: '+info.mode);
  if(!info.fonts.some(f=>f.startsWith('IBM Plex Sans Arabic')) || !info.fonts.some(f=>f.startsWith('Fraunces'))) fail('self-hosted fonts not loaded: '+info.fonts.join(','));
  if(external.length) fail('external requests: '+external.join(' '));
  for(const s of info.scripts) if(!/\?v=/.test(s) || !s.endsWith('?v='+info.version)) fail('asset without the current version query: '+s);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForTimeout(500);
  const cache = await page.evaluate(async()=>{
    const names = await caches.keys();
    const c = await caches.open(names[0]);
    const keys = (await c.keys()).map(r=>new URL(r.url).pathname);
    const sw = await (await fetch('sw.js', {cache:'no-store'})).text();
    const list = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
    const wk = await (await fetch('js/worker.js')).text();
    const imports = (wk.match(/importScripts\(([^)]*)\)/)[1].match(/'([^']+)'/g) || []).map(x=>'js/'+x.slice(1, -1));
    const ver = sw.match(/const VERSION = '([^']+)'/)[1];
    return {names, keys, list, imports, ver};
  });
  const have = new Set(cache.keys.map(k=>k.replace(/^\//, '') || './'));
  const wantAll = cache.list.filter(a=>a!=='./');
  for(const a of wantAll) if(!have.has(a)) fail('service worker cache is missing '+a);
  for(const s of info.scripts){ const f = s.split('?')[0]; if(!cache.list.includes(f)) fail('sw ASSETS does not list '+f); }
  for(const f of cache.imports) if(!cache.list.includes(f)) fail('sw ASSETS does not list worker import '+f);
  const fontFiles = fs.readdirSync(path.join(root, 'fonts')).map(f=>'fonts/'+f);
  for(const f of fontFiles) if(!cache.list.includes(f)) fail('sw ASSETS does not list '+f);
  if(cache.ver!==info.version) fail('sw VERSION '+cache.ver+' differs from APP_VERSION '+info.version);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('#topbar .tab', {timeout:15000});
  const offline = await page.evaluate(async()=>{
    const r = await doGenerate(document.querySelector('.gen-btn'));
    return {mode:GenRun.mode, ok:!!(r && r.plan), people:App.data.people.length};
  });
  if(!offline.ok || offline.mode!=='worker') fail('offline generation failed: '+JSON.stringify(offline));
  await context.setOffline(false);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  for(const i of manifest.icons) if(!fs.existsSync(path.join(root, i.src))) fail('manifest icon missing '+i.src);
  if(errors.length) fail('page errors: '+errors.slice(0, 4).join(' | '));
  note('app e2e: '+(failures.length ? 'see failures' : 'ok (CSP clean, worker, fonts, offline, cache list)'));
  await context.close();
}

(async()=>{
  const server = await serve();
  const base = 'http://127.0.0.1:'+server.address().port;
  const launch = {};
  if(process.env.CHROME_PATH){ launch.executablePath = process.env.CHROME_PATH; launch.args = (process.env.CHROME_ARGS || '').split(' ').filter(Boolean); }
  const browser = await chromium.launch(launch);
  try{
    const only = process.env.ONLY || 'all';
    if(only==='all' || only==='app') await runApp(browser, base);
    if(only==='all' || only==='matrix') await runMatrix(browser, base);
    if(only==='all' || only==='suite') await runSuite(browser, base, 1280);
  }catch(e){ fail('runner crashed: '+e.message); }
  await browser.close();
  server.close();
  console.log(failures.length ? 'CI FAILED ('+failures.length+')' : 'CI OK');
  process.exit(failures.length ? 1 : 0);
})();
