const VERSION = '5.2.0';
const CACHE = 'alkhitta-'+VERSION;
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "css/app.css",
  "js/boot.js",
  "js/worker.js",
  "js/app.js",
  "js/core.js",
  "js/seed.js",
  "js/store.js",
  "js/i18n.js",
  "js/rules-model.js",
  "js/settings-index.js",
  "js/palette.js",
  "js/people-rules.js",
  "js/engine.js",
  "js/goals.js",
  "js/requests.js",
  "js/constraints.js",
  "js/score.js",
  "js/flow.js",
  "js/assign.js",
  "js/layout.js",
  "js/solver.js",
  "js/lns.js",
  "js/explain.js",
  "js/planner.js",
  "js/genrun.js",
  "js/ui.js",
  "js/diag.js",
  "js/io.js",
  "js/importer.js",
  "js/views/plan.js",
  "js/views/facilities.js",
  "js/views/team.js",
  "js/views/team-table.js",
  "js/views/goals.js",
  "js/views/goals-manager.js",
  "js/views/rules.js",
  "js/views/data.js",
  "fonts/fraunces-latin-500.woff2",
  "fonts/fraunces-latin-600.woff2",
  "fonts/ibm-plex-sans-arabic-arabic-400.woff2",
  "fonts/ibm-plex-sans-arabic-arabic-500.woff2",
  "fonts/ibm-plex-sans-arabic-arabic-600.woff2",
  "fonts/ibm-plex-sans-arabic-latin-400.woff2",
  "fonts/ibm-plex-sans-arabic-latin-500.woff2",
  "fonts/ibm-plex-sans-arabic-latin-600.woff2",
  "fonts/jetbrains-mono-latin-500.woff2",
  "fonts/jetbrains-mono-latin-600.woff2"
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(cache=>Promise.all(ASSETS.map(u=>fetch(u, {cache:'reload'}).then(r=>{
    if(!r.ok) throw new Error('precache '+u+' '+r.status);
    return cache.put(u, r);
  })))));
});

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('alkhitta-') && k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('message', e=>{
  if(e.data==='skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method!=='GET') return;
  const url = new URL(req.url);
  if(url.origin!==location.origin) return;
  if(req.mode==='navigate'){
    e.respondWith(caches.match('index.html').then(hit=>hit || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch:true}).then(hit=>hit || fetch(req)));
});
