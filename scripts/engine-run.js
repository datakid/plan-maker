const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const quiet = process.env.QUIET==='1';

const ctx = {console:null, setTimeout, clearTimeout, setInterval, clearInterval, Math, Date, JSON, Map, Set, Array, Object, Number, String, Symbol, Promise, Error, RegExp, Intl, parseInt, parseFloat, isNaN, isFinite, Float64Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, Int16Array, Int8Array, BigInt, WeakMap, WeakSet, TextEncoder, TextDecoder, structuredClone, URLSearchParams, URL, performance};
ctx.console = {log:(...a)=>{ const t = a.join(' '); if(!(quiet && t.startsWith('PASS'))) console.log(t.slice(0, 400)); }, error:console.error, warn:console.warn};
ctx.self = ctx;
ctx.window = ctx;
ctx.location = {protocol:'file:', search:'', hash:'', href:'file:///engine'};
ctx.addEventListener = ()=>{};
ctx.dispatchEvent = ()=>true;
vm.createContext(ctx);

const worker = fs.readFileSync(path.join(root, 'js/worker.js'), 'utf8');
const list = /importScripts\(([^)]*)\)/.exec(worker)[1].split(',').map(s=>s.trim().replace(/['"]/g, ''));
const extra = ['io.js', 'importer.js', 'import-kinds.js', 'settings-index.js', 'diag.js', 'genrun.js'];
const html = fs.readFileSync(path.join(root, 'test.html'), 'utf8');
const tests = [...html.matchAll(/src="js\/tests\/([a-z0-9-]+\.js)"/g)].map(m=>m[1]).filter(f=>f!=='panel.js');

const run = (code, file)=>vm.runInContext(code, ctx, {filename:file});
const loadFile = (rel, strict)=>{
  const src = fs.readFileSync(path.join(root, rel), 'utf8').replace(/^const (\w+) =/mg, 'var $1 =').replace(/^let (\w+) =/mg, 'var $1 =');
  try{ run(src, rel); }catch(e){
    if(strict) throw e;
    console.log('LOADFAIL '+rel+' '+e.message.slice(0, 120));
    process.exitCode = 2;
  }
};

for(const f of list) loadFile('js/'+f, true);
for(const f of extra) if(!list.includes(f)) loadFile('js/'+f, false);
run("var SEED_JSON = JSON.stringify(seedData()); App.data = normalizeData(JSON.parse(SEED_JSON));", 'prelude');
for(const f of tests) loadFile('js/tests/'+f, false);

const code = `
(function(){
  const re = ${only ? only.toString() : 'null'};
  runRegress(re);
  return 0;
})()`;
run(code, 'engine-run');

(async()=>{
  const asyncCode = `
(async function(){
  const re = ${only ? only.toString() : 'null'};
  const keepAll = SHIP_ASYNC.slice();
  const engineSide = SHIP_ASYNC.filter(c=>/^P0 /.test(c.name));
  SHIP_ASYNC.length = 0;
  for(const c of engineSide) SHIP_ASYNC.push(c);
  await runShipAsync(re);
  SHIP_ASYNC.length = 0;
  for(const c of keepAll) SHIP_ASYNC.push(c);
  const names = TEST.cases.map(c=>c.name).concat(engineSide.map(c=>c.name));
  return suiteFinish(names, !!re);
})()`;
  const line = await run(asyncCode, 'engine-run-async');
  console.log(line);
  const failed = run('TEST.failed.join("\\n")', 'report');
  if(failed) console.log(failed);
  const m = /fail=(\d+)/.exec(line);
  process.exit(m && m[1]==='0' && !process.exitCode ? 0 : 1);
})();
