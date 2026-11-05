// Service worker Штатки: офлайн-доступ к стартовой странице и документам
const CACHE='shtatka-v6';
const PRECACHE=["./", "index.html", "register.html", "register.css", "register.js", "cabinet.html", "cabinet.css", "cabinet-widgets.js", "home-store.js", "shell.js", "people.html", "people.js", "hr-core.js", "hr.js", "docs.html", "military.html", "foreign.html", "sick.html", "payroll.html", "laws.html", "archive.html", "company.html", "company.js", "tariff.html", "tariff.js", "cabinet.js", "customize.html", "customize.css", "customize.js", "offline.html", "config.js", "app.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/favicon.svg", "cookie.css", "cookie.js", "fonts.css", "fonts/unbounded-cyrillic-500-normal.woff2", "fonts/unbounded-cyrillic-600-normal.woff2", "fonts/unbounded-cyrillic-700-normal.woff2", "fonts/unbounded-latin-600-normal.woff2", "fonts/onest-cyrillic-400-normal.woff2", "fonts/onest-latin-400-normal.woff2", "fonts/onest-cyrillic-500-normal.woff2", "fonts/onest-latin-500-normal.woff2", "fonts/onest-cyrillic-600-normal.woff2", "fonts/onest-latin-600-normal.woff2", "fonts/onest-cyrillic-700-normal.woff2", "fonts/onest-latin-700-normal.woff2", "policy.html", "consent.html", "offer.html", "ads.html", "cookie.html"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PRECACHE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.hostname.endsWith('dadata.ru')||url.hostname.endsWith('yandex.ru'))return; // API и аналитику не кэшируем
  if(req.mode==='navigate'){ // страницы: сначала сеть, без сети — кэш или офлайн-страница
    e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));return r;})
      .catch(()=>caches.match(req).then(r=>r||caches.match('offline.html'))));return;}
  e.respondWith(caches.match(req).then(r=>r||fetch(req).then(res=>{ // остальное: сначала кэш
    if(res.ok&&(url.origin===location.origin||url.hostname.includes('fonts.g'))){const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp));}
    return res;})));
});
