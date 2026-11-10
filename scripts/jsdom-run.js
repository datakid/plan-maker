const path = require('path');
const http = require('http');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const page = process.argv[2] || 'test.html';
const verbose = process.argv.includes('-v');
const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/json', '.svg':'image/svg+xml'};

let result = null;
const vc = new VirtualConsole();
vc.on('log', (...a)=>{
  const t = a.join(' ');
  if(/^(RESULT|MATRIX)/.test(t)) result = t;
  if(verbose || /^(RESULT|FAIL|EXC|SKIP|MATRIX)/.test(t)) console.log(t.slice(0, 400));
});
vc.on('jsdomError', e=>{ if(verbose) console.log('JSDOMERR', e.message.slice(0, 300)); });

const server = http.createServer((q, r)=>{
  const p = decodeURIComponent(q.url.split('?')[0]);
  const f = path.join(root, p);
  fs.readFile(f, (e, b)=>{
    if(e){ r.statusCode = 404; r.end('not found'); return; }
    r.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
    r.end(b);
  });
});

server.listen(0, '127.0.0.1', ()=>{
  const port = server.address().port;
  JSDOM.fromURL('http://127.0.0.1:'+port+'/'+page, {
    runScripts:'dangerously', resources:'usable', pretendToBeVisual:true, virtualConsole:vc,
    beforeParse(w){
      w.matchMedia = w.matchMedia || (q=>({matches:false, media:q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}}));
      w.scrollTo = ()=>{};
      w.ResizeObserver = class{observe(){}unobserve(){}disconnect(){}};
      w.IntersectionObserver = class{observe(){}unobserve(){}disconnect(){}};
      w.HTMLElement.prototype.scrollIntoView = function(){};
      w.HTMLElement.prototype.animate = function(){ return {finished:Promise.resolve(), cancel(){}, onfinish:null, addEventListener(){}}; };
      w.URL.createObjectURL = ()=>'blob:x';
      w.URL.revokeObjectURL = ()=>{};
    }
  }).then(()=>{
    const t0 = Date.now();
    const iv = setInterval(()=>{
      if(result || Date.now()-t0>(+process.env.TMO || 1800000)){
        clearInterval(iv);
        console.log(result || 'NO RESULT');
        process.exit(result && /fail=0/.test(result) ? 0 : 1);
      }
    }, 500);
  });
});
