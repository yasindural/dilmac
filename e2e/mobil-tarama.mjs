// Geniş cihaz + dil taraması: her kombinasyonda yatay taşma ve
// erişilebilir dokunma hedefi (>=40px) kontrolü.
import { chromium } from 'playwright';
const sizes = [[320,568],[360,640],[375,667],[390,844],[412,915],[430,932],[768,1024]];
const langs = ['tr','en','de','fr','es'];
const browser = await chromium.launch();
let fails = 0, total = 0;
for (const [w,h] of sizes) {
  for (const lang of langs) {
    const ctx = await browser.newContext({ viewport:{width:w,height:h}, permissions:['microphone'] });
    await ctx.addInitScript(`localStorage.setItem('dilmac-tour-done','1');localStorage.setItem('dilmac-site-lang','${lang}');localStorage.setItem('dilmac-peer-server',JSON.stringify({host:'127.0.0.1',port:9100,path:'/',secure:false}));`);
    const p = await ctx.newPage();
    await p.goto(`http://localhost:4201/oda/QQ${w}?role=host`, { waitUntil:'domcontentloaded' });
    await new Promise(r=>setTimeout(r,1200));
    const res = await p.evaluate(() => {
      const doc = document.documentElement, docRight = doc.clientWidth, over = [];
      document.querySelectorAll('.room *').forEach(el => {
        const s = getComputedStyle(el);
        if (s.position === 'absolute' || s.position === 'fixed') return;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > docRight + 1) over.push(el.tagName+'.'+String(el.className).split(' ')[0]);
      });
      const small = [];
      document.querySelectorAll('.room button').forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.width > 0 && (r.width < 40 || r.height < 40)) small.push(`${b.className.split(' ')[0]}:${Math.round(r.width)}x${Math.round(r.height)}`);
      });
      // dikey taşma: kontroller ekranın dışına taşmasın
      const controls = document.querySelector('.room-controls');
      const cr = controls ? controls.getBoundingClientRect() : null;
      return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, over: [...new Set(over)], small: [...new Set(small)],
               controlsBottom: cr ? Math.round(cr.bottom) : -1, viewH: doc.clientHeight };
    });
    total++;
    const ok = res.scrollW <= res.clientW+1 && res.over.length===0 && res.small.length===0 && res.controlsBottom <= res.viewH+1;
    if (!ok) { fails++; console.log(`FAIL ${w}x${h} ${lang}:`, JSON.stringify(res)); }
    await ctx.close();
  }
}
console.log(`\nMOBIL TARAMA: ${total-fails}/${total} kombinasyon temiz`);
await browser.close();
process.exit(fails ? 1 : 0);
