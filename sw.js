// يعمل بدون إنترنت: يجرب الشبكة أولاً (عشان التحديثات توصل فوراً) لكن بمهلة قصيرة،
// ولو ما في نت أو النت ضعيف يفتح من النسخة المحفوظة. لا يحفظ أبداً صفحة خطأ مكان النسخة السليمة.
const CACHE = 'inventory-v2';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const TIMEOUT = 3000; // بعد 3 ثوانٍ بدون رد من الشبكة نفتح النسخة المحفوظة

self.addEventListener('install', e => {
  // cache:'reload' يجلب الملفات من الخادم مباشرة، لا من ذاكرة المتصفح المؤقتة
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    // الرد السليم فقط (200) يُحفظ؛ أخطاء الخادم (404/500) لا تستبدل النسخة المحفوظة
    const net = fetch(req).then(res => { if (res.ok && res.type === 'basic') e.waitUntil(cache.put(req, res.clone()).catch(() => {})); return res; });
    e.waitUntil(net.then(() => {}, () => {})); // يبقى العامل حياً حتى يكتمل حفظ النسخة الجديدة
    if (!cached) {
      try { return await net; }
      catch (err) { return (req.mode === 'navigate' && await cache.match('./index.html')) || Response.error(); }
    }
    try {
      const res = await Promise.race([net, new Promise(r => setTimeout(r, TIMEOUT, null))]);
      if (res && res.ok) return res;
    } catch (err) { /* لا يوجد إنترنت */ }
    return cached; // إن وصل رد الشبكة متأخراً يُحدِّث النسخة المحفوظة للمرة القادمة
  })());
});
