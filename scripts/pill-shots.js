const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs', 'screens');
const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.woff2':'font/woff2', '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json'};

const server = http.createServer((q, r)=>{
  let p = decodeURIComponent(q.url.split('?')[0]);
  if(p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(root, p), (e, b)=>{
    if(e){ r.statusCode = 404; r.end('not found'); return; }
    r.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream');
    r.end(b);
  });
});

server.listen(0, '127.0.0.1', async ()=>{
  const base = 'http://127.0.0.1:'+server.address().port;
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || undefined, args:(process.env.CHROME_ARGS || '').split(' ').filter(Boolean), headless:true});
  fs.mkdirSync(out, {recursive:true});
  for(const width of [1280, 390]){
    const ctx = await browser.newContext({viewport:{width, height:800}, serviceWorkers:'block'});
    const page = await ctx.newPage();
    await page.goto(base+'/index.html');
    await page.waitForFunction(()=>typeof App!=='undefined' && App.data);
    await page.evaluate(()=>{ App.ui.tab = 'plan'; renderTab(); });
    await page.evaluate(()=>doGenerate(document.querySelector('.gen-btn')));
    for(const lang of ['ar', 'en']) for(const theme of ['light', 'dark']){
      await page.evaluate(([l, th])=>{ setLang(l); setTheme(th); App.ui.tab = 'plan'; renderTab(); }, [lang, theme]);
      await page.waitForTimeout(150);
      const bar = await page.$('#plan-actionbar');
      await bar.screenshot({path:path.join(out, 'pill-'+width+'-'+lang+'-'+theme+'.png')});
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log('screens written to docs/screens');
});
