// Dilmaç oda E2E: iki gerçek pencere, yerel PeerJS sinyal sunucusu, sahte
// mikrofon akışı (Chromium fake media) ve sürülebilir konuşma tanıma.
// Çeviri ucu deterministik taklitle yanıtlanır ki "uydurma" ile "boru hattı
// bozulması" birbirinden ayrılabilsin: ekranda «EN»/«TR» öneki olmayan veya
// söylenmemiş bir metin belirirse kaynağı uygulamanın kendisidir.
import { chromium } from 'playwright';

const B = 'http://localhost:4201/dilmac';
const results = [];
const say = (...a) => { console.log(...a); };

const initScript = `
  localStorage.setItem('dilmac-peer-server', JSON.stringify({ host: '127.0.0.1', port: 9100, path: '/', secure: false }));
  localStorage.setItem('dilmac-tour-done', '1');
  window.__sttInstances = [];
  class FakeRec {
    constructor() { this.lang=''; this.continuous=false; this.interimResults=false;
      this.onresult=null; this.onerror=null; this.onend=null; this._active=false;
      window.__sttInstances.push(this); }
    start() { this._active = true; }
    stop() { const wasActive=this._active; this._active=false; if(wasActive) setTimeout(()=>this.onend&&this.onend(),0); }
  }
  window.SpeechRecognition = FakeRec;
  window.webkitSpeechRecognition = FakeRec;
  window.__stt = {
    rec() { return window.__sttInstances[window.__sttInstances.length-1]; },
    interim(t) { const r=this.rec(); if(r&&r.onresult) r.onresult({resultIndex:0, results:[{0:{transcript:t,confidence:0.9}, isFinal:false}]}); },
    final(t,c=0.9) { const r=this.rec(); if(r&&r.onresult) r.onresult({resultIndex:0, results:[{0:{transcript:t,confidence:c}, isFinal:true}]}); },
  };
`;

async function makeContext(browser, logs) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ['microphone'] });
  await ctx.addInitScript(initScript);
  await ctx.route('**/api/translate', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const tag = /ingilizce|english/i.test(body.target || '') ? '«EN»' : '«TR»';
    await new Promise(r => setTimeout(r, 250));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: `${tag} ${body.text}` }) });
  });
  await ctx.route('**/api/log', async (route) => {
    try { logs.push(JSON.parse(route.request().postData() || '{}')); } catch { logs.push({ raw: true }); }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await ctx.route('**/api/plan', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"plan":"free"}' }));
  return ctx;
}

const feedText = (p) => p.evaluate(() => (document.querySelector('.room-feed')?.innerText || '').replace(/\\s+/g, ' ').trim());
const noticeText = (p) => p.evaluate(() => document.body.innerText.includes('Karşı taraf konuşuyor'));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--proxy-server=direct://', '--proxy-bypass-list=*', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

const hostLogs = [], guestLogs = [];
const hostCtx = await makeContext(browser, hostLogs);
const guestCtx = await makeContext(browser, guestLogs);
const host = await hostCtx.newPage();
const guest = await guestCtx.newPage();
host.on('pageerror', (e) => results.push(['HOST_PAGE_ERROR', String(e)]));
guest.on('pageerror', (e) => results.push(['GUEST_PAGE_ERROR', String(e)]));

const room = 'E2E' + Math.floor(Math.random() * 900 + 100);
await host.goto(`${B}/oda/${room}?role=host`, { waitUntil: 'networkidle' });
await guest.goto(`${B}/oda/${room}`, { waitUntil: 'networkidle' });

// bağlantı kurulana kadar bekle
await host.waitForFunction(() => !document.body.innerText.includes('bağlanılıyor'), null, { timeout: 20000 }).catch(() => {});
await guest.waitForTimeout(2500);
const connected = await host.evaluate(() => document.body.innerText.includes('Karşı taraf bekleniyor') === false);
say('BAGLANTI kuruldu mu:', connected);

// Konuş düğmeleri — canlı ses otomatik açılır (fake mikrofon)
await host.click('.mic-button');
await guest.click('.mic-button');
await host.waitForTimeout(1800);
const voiceState = await host.evaluate(() => document.body.innerText.includes('ses') );
say('SES katmanı açıldı (bilgi):', voiceState);

// ---------- TEST A: bozuk girdiler boru hattından bozulmadan geçiyor mu ----------
const casesA = [
  ['a', 'yarınki toplantı saat kaçta başlayacak'],
  ['b', 'şey ya ee bugün hava işte ne diyecektim'],
  ['c', 'ıııı hmm yani'],
  ['d', 'kırmızı balık gölde kıvrıla kıvrıla yüzüyor'],
  ['e', 'mmm hmh mhm'],
];
for (const [id, text] of casesA) {
  await host.evaluate((t) => window.__stt.interim(t), text);
  await host.waitForTimeout(150);
  await host.evaluate((t) => window.__stt.final(t), text);
  await host.waitForTimeout(1400);
  const g = await feedText(guest);
  const h = await feedText(host);
  results.push([`A-${id}`, { soylenen: text, hostFeedIceriyor: h.includes(text), guestCeviri: g.includes(`«EN» ${text}`) || g.includes(`«TR» ${text}`) ? 'birebir' : (g.includes(text) ? 'cevirisiz-gecti' : 'YOK') }]);
}
// Fazladan/uydurma mesaj var mı? — beklenen mesaj sayısını say
await guest.waitForTimeout(1500);
const guestFeed1 = await feedText(guest);
const phantom1 = guestFeed1.split('«').length - 1;
results.push(['A-toplam-ceviri-adedi', { beklenen: '4 (c ve e süzülebilir)', gozlenen: phantom1, feedOzet: guestFeed1.slice(0, 400) }]);

// ---------- TEST B1: karşı taraf konuşurken gelen tanıma bastırılıyor mu ----------
await host.evaluate(() => window.__stt.interim('uzun bir cümle söylüyorum ve devam ediyorum'));
await host.waitForTimeout(600); // speaking:true sinyali gitsin
await guest.evaluate(() => window.__stt.final('uzun bir cümle söylüyorum ve devam ediyorum'));
await guest.waitForTimeout(900);
const guestSuppressNotice = await noticeText(guest);
const hostFeedB1 = await feedText(host);
const echoLeaked = (hostFeedB1.match(/uzun bir cümle söylüyorum/g) || []).length > 0;
results.push(['B1-bastirma', { uyariGoruldu: guestSuppressNotice, yankiKarsiyaGectiMi: echoLeaked, echoSuppressedLog: guestLogs.filter(l => l.code === 'echo_suppressed').length }]);

// host cümlesini bitirsin
await host.evaluate(() => window.__stt.final('uzun bir cümle söylüyorum ve devam ediyorum'));
await host.waitForTimeout(1600);

// ---------- TEST B1b: geç başlayan interim de yankı sayılıyor mu ----------
await host.evaluate(() => window.__stt.interim('ikinci uzun cümlemi söylüyorum şu anda'));
await host.waitForTimeout(600); // sinyal gitsin — yankı interim'i bundan SONRA başlar
await guest.evaluate(() => window.__stt.interim('ikinci uzun cümlemi söylüyorum'));
await guest.waitForTimeout(200);
await guest.evaluate(() => window.__stt.final('ikinci uzun cümlemi söylüyorum'));
await guest.waitForTimeout(600);
const hostFeedB1b = await feedText(host);
results.push(['B1b-gec-interim-yanki', { yankiKarsiyaGectiMi: (hostFeedB1b.match(/ikinci uzun cümlemi söylüyorum/g) || []).length > 1 }]);
await host.evaluate(() => window.__stt.final('ikinci uzun cümlemi söylüyorum şu anda'));
await host.waitForTimeout(4500); // bekletilen varsa temizlensin/aksin

// ---------- TEST B2: bastırma kalıcı değil — sıra bize gelince mesaj gidiyor ----------
await guest.evaluate(() => window.__stt.interim('now it is my turn to speak'));
await guest.waitForTimeout(150);
await guest.evaluate(() => window.__stt.final('now it is my turn to speak'));
await guest.waitForTimeout(1600);
const hostFeedB2 = await feedText(host);
results.push(['B2-sira-serbest', { mesajUlasti: hostFeedB2.includes('now it is my turn to speak') }]);

// ---------- TEST B3: aynı anda konuşma ----------
await host.evaluate(() => window.__stt.interim('ben aynı anda konuşuyorum bir'));
await guest.evaluate(() => window.__stt.interim('i am also talking at the same time'));
await host.waitForTimeout(700);
await host.evaluate(() => window.__stt.final('ben aynı anda konuşuyorum bir'));
await guest.evaluate(() => window.__stt.final('i am also talking at the same time'));
await guest.waitForTimeout(2000);
const hFeed3 = await feedText(host);
const gFeed3 = await feedText(guest);
results.push(['B3-cakisma', {
  hostCumlesiKarsida: gFeed3.includes('ben aynı anda konuşuyorum bir'),
  guestCumlesiKarsida: hFeed3.includes('i am also talking at the same time'),
  toplamBastirma: hostLogs.concat(guestLogs).filter(l => l.code === 'echo_suppressed').length,
}]);

// ---------- TEST B4: çakışma sonrası akış normale dönüyor mu ----------
await host.waitForTimeout(1300);
await host.evaluate(() => window.__stt.interim('çakışmadan sonra normal mesaj'));
await host.waitForTimeout(150);
await host.evaluate(() => window.__stt.final('çakışmadan sonra normal mesaj'));
await host.waitForTimeout(1600);
const gFeed4 = await feedText(guest);
results.push(['B4-toparlanma', { mesajUlasti: gFeed4.includes('çakışmadan sonra normal mesaj') }]);

// ---------- TEST B5: 8 mesajlık karşılıklı sohbet — kayıp/çift var mı ----------
const chat = [];
for (let i = 1; i <= 4; i++) {
  const ht = `türkçe mesaj numara ${i}`;
  const gt = `english message number ${i}`;
  await host.evaluate((t) => { window.__stt.interim(t); }, ht);
  await host.waitForTimeout(120);
  await host.evaluate((t) => { window.__stt.final(t); }, ht);
  await host.waitForTimeout(1500);
  await guest.evaluate((t) => { window.__stt.interim(t); }, gt);
  await guest.waitForTimeout(120);
  await guest.evaluate((t) => { window.__stt.final(t); }, gt);
  await guest.waitForTimeout(1500);
  chat.push(ht, gt);
}
const hFeed5 = await feedText(host);
const gFeed5 = await feedText(guest);
const missing = chat.filter(t => !(hFeed5.includes(t) || gFeed5.includes(t)) || (t.startsWith('türkçe') ? !gFeed5.includes(t) : !hFeed5.includes(t)));
const dupCheck = chat.map(t => ({ t, host: hFeed5.split(t).length - 1, guest: gFeed5.split(t).length - 1 })).filter(x => x.host > 1 || x.guest > 1);
results.push(['B5-sohbet', { kayip: missing, cift: dupCheck }]);

// Yankı kopyaları sohbetin sonunda bile ortaya çıkmamış olmalı (geç gönderim sızıntısı)
const hFinal = await feedText(host);
results.push(['B6-yanki-sizintisi', {
  b1YankiKopyasi: (hFinal.match(/uzun bir cümle söylüyorum ve devam ediyorum/g) || []).length,
  beklenen: 1,
  b1bYankiKopyasi: (hFinal.match(/ikinci uzun cümlemi söylüyorum/g) || []).length,
}]);

await host.screenshot({ path: '/tmp/shots/e2e-host.png', fullPage: false });
await guest.screenshot({ path: '/tmp/shots/e2e-guest.png', fullPage: false });

say('\\n================= SONUÇLAR =================');
for (const [k, v] of results) say(k, JSON.stringify(v));
say('HOST konsol log adedi (api/log):', hostLogs.length, JSON.stringify(hostLogs.map(l => l.code)));
say('GUEST konsol log adedi (api/log):', guestLogs.length, JSON.stringify(guestLogs.map(l => l.code)));

await browser.close();
say('E2E_BITTI');
