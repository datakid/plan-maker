const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3]);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'};
const server = http.createServer((req, res)=>{ const p = decodeURIComponent(req.url.split('?')[0]); fs.readFile(path.join(root, p), (e, b)=>{ if(e){ res.statusCode = 404; res.end(); return; } res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream'); res.end(b); }); });
server.listen(0, '127.0.0.1', async()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port+'/intent-test.html?record');
  await page.waitForFunction(()=>typeof GOLD!=='undefined' && typeof Fx!=='undefined' && typeof App!=='undefined' && App.data && typeof SEED_JSON!=='undefined' && SEED_JSON);
  const data = await page.evaluate(()=>GOLD.compute());
  fs.writeFileSync(out, 'const GOLDEN_DATA = '+JSON.stringify(data, null, 0).replace(/\},"/g, '},\n"')+';\nconst GOLDEN_ACCEPTED = {};\n');
  console.log('recorded '+Object.keys(data).length+' snapshots to '+out);
  await browser.close(); server.close();
});
