// Alza la versione a ogni rilascio: le icone, il manifest e i caratteri vengono riscaricati
const CACHE="allenati-sharon-v3";
const CORE=["index.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","icons/icon-maskable-512.png",
  "fonts/fraunces.woff2","fonts/fraunces-italic.woff2","fonts/nunito.woff2","fonts/bodoni-moda.woff2","fonts/big-shoulders.woff2","fonts/manrope.woff2","fonts/syne.woff2"];
// Se cambia anche questo file la pagina nuova arriva qui: dopo l'attivazione si avvisano le pagine aperte (banner "Aggiorna")
let pageChanged=false;
self.addEventListener("install",e=>{e.waitUntil((async()=>{const c=await caches.open(CACHE),o=await c.match("index.html"),ot=o?await o.text():null;
  await c.addAll(CORE.map(u=>new Request(u,{cache:"no-cache"})));
  if(ot!=null){const n=await c.match("index.html");pageChanged=!!n&&(await n.text())!==ot}
  await self.skipWaiting()})())});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  .then(async()=>{if(pageChanged){const cs=await self.clients.matchAll({type:"window"});cs.forEach(x=>x.postMessage({type:"nuova-versione"}))}}))});

// Scarica la pagina e, se è cambiata, la salva e avvisa l'app (che propone "Aggiorna")
async function refreshPage(req){
  // no-cache: chiede al server se è cambiata (ETag); se no arriva un 304 e il corpo viene dalla cache del browser
  const r=await fetch(req,{cache:"no-cache"});
  if(!r.ok)return r;
  const c=await caches.open(CACHE);
  const old=await c.match("index.html");
  const body=await r.clone().text();
  const changed=!old||(await old.text())!==body;
  if(changed){
    await c.put("index.html",new Response(body,{headers:{"Content-Type":"text/html; charset=utf-8"}}));
    if(old){const cs=await self.clients.matchAll({type:"window"});cs.forEach(x=>x.postMessage({type:"nuova-versione"}))}
  }
  return r;
}

// L'app ripresa dallo sfondo chiede un controllo della versione
self.addEventListener("message",e=>{if(e.data&&e.data.type==="controlla")e.waitUntil(refreshPage(new Request(self.registration.scope,{mode:"same-origin"})).catch(()=>{}))});

self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  // Pagina: subito la copia salvata (si apre anche con rete lenta o assente in palestra),
  // intanto controlla la versione nuova in background. Senza copia (primissima apertura) va in rete.
  if(req.mode==="navigate"){
    const net=refreshPage(req).catch(()=>null);
    e.waitUntil(net);
    e.respondWith(caches.match("index.html").then(hit=>hit||net.then(r=>r||Response.error())));
    return}
  // File dell'app: dalla cache, altrimenti rete (salvando solo risposte valide)
  if(url.origin===location.origin){
    e.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>hit||fetch(req).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c))}return r})));
  }
});
