// TerraSpeak oda E2E: iki gerçek Chromium penceresi, yerel PeerJS sinyal
// sunucusu, sahte mikrofon akışı (Chromium fake media), sürülebilir konuşma
// tanıma ve zaman çizelgesi tutan sahte seslendirme motoru.
//
// Çalıştırma (repo kökünden):
//   1. npx vite build --mode e2e --outDir dist-e2e
//   2. node e2e/peer-server.mjs        (127.0.0.1:9100)
//   3. npx vite preview --outDir dist-e2e --port 4201
//   4. cd e2e && node oda-testi.mjs
//
// Sahte TTS gerçek speechSynthesis gibi SIRALI çalışır: aynı anda tek ses.
// Uygulama katmanındaki "üst üste binme" hatası bu motorda kesilme
// (interrupted) ya da hayalet konuşma (cleared sonrası start) olarak görünür.
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE || "http://localhost:4201";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  OK " : "FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const initScript = `
  localStorage.setItem('dilmac-peer-server', JSON.stringify({ host: '127.0.0.1', port: 9100, path: '/', secure: false }));
  localStorage.setItem('dilmac-tour-done', '1');
  localStorage.setItem('dilmac-site-lang', 'tr');

  // ---- sürülebilir sahte konuşma tanıma ----
  window.__sttInstances = [];
  class FakeRec {
    constructor() { this.lang=''; this.continuous=false; this.interimResults=false;
      this.onresult=null; this.onerror=null; this.onend=null; this._active=false;
      window.__sttInstances.push(this); }
    start() { if (this._active) throw new DOMException('already started', 'InvalidStateError'); this._active = true; }
    stop() { const was=this._active; this._active=false; if (was) setTimeout(()=>this.onend&&this.onend(),0); }
  }
  window.SpeechRecognition = FakeRec;
  window.webkitSpeechRecognition = FakeRec;
  window.__stt = {
    rec() { return window.__sttInstances[window.__sttInstances.length-1]; },
    active() { const r=this.rec(); return Boolean(r && r._active); },
    interim(t) { const r=this.rec(); if(r&&r._active&&r.onresult) r.onresult({resultIndex:0, results:[{0:{transcript:t,confidence:0.9}, isFinal:false}]}); },
    final(t,c=0.9) { const r=this.rec(); if(r&&r._active&&r.onresult) r.onresult({resultIndex:0, results:[{0:{transcript:t,confidence:c}, isFinal:true}]}); },
  };

  // ---- zaman çizelgeli sahte seslendirme ----
  // Gerçek motor gibi: kuyruk, tek aktif ses, cancel() -> interrupted/canceled.
  window.__ttsLog = [];
  window.__ttsOverlaps = 0;
  (function(){
    const log = window.__ttsLog;
    let queue = [];       // bekleyen utterance'lar
    let current = null;   // {u, entry, timer}
    const now = () => performance.now();
    function startNext() {
      if (current || !queue.length) return;
      const u = queue.shift();
      const entry = { text: u.text, lang: u.lang, startAt: now(), endAt: 0, how: 'speaking' };
      log.push(entry);
      current = { u, entry, timer: 0 };
      if (log.filter(e => e.how === 'speaking').length > 1) window.__ttsOverlaps += 1;
      try { u.onstart && u.onstart({}); } catch {}
      const dur = Math.max(220, Math.min(4200, u.text.length * 24));
      current.timer = setTimeout(() => {
        entry.endAt = now(); entry.how = 'end';
        const fin = current; current = null;
        try { fin.u.onend && fin.u.onend({}); } catch {}
        startNext();
      }, dur);
    }
    const synth = {
      get speaking() { return Boolean(current); },
      get pending() { return queue.length > 0; },
      paused: false,
      getVoices() { return []; },
      addEventListener() {},
      removeEventListener() {},
      onvoiceschanged: null,
      speak(u) { queue.push(u); startNext(); },
      cancel() {
        const dropped = queue; queue = [];
        for (const u of dropped) { try { u.onerror && u.onerror({ error: 'canceled' }); } catch {} }
        if (current) {
          clearTimeout(current.timer);
          current.entry.endAt = now(); current.entry.how = 'interrupted';
          const fin = current; current = null;
          try { fin.u.onerror && fin.u.onerror({ error: 'interrupted' }); } catch {}
        }
      },
      pause() { this.paused = true; },
      resume() { this.paused = false; },
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = class {
      constructor(text) { this.text = String(text ?? ''); this.lang=''; this.voice=null;
        this.volume=1; this.rate=1; this.pitch=1;
        this.onstart=null; this.onend=null; this.onerror=null; }
    };
  })();
`;

async function makeContext(browser, logs, viewport) {
  const ctx = await browser.newContext({
    viewport: viewport || { width: 1280, height: 860 },
    permissions: ["microphone"],
  });
  await ctx.addInitScript(initScript);
  await ctx.route("**/api/translate", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    const tag = /english|ingilizce/i.test(body.target || "") ? "«EN»" : "«TR»";
    await new Promise((r) => setTimeout(r, 220));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: `${tag} ${body.text}` }) });
  });
  await ctx.route("**/api/log", async (route) => {
    try { logs.push(JSON.parse(route.request().postData() || "{}")); } catch { logs.push({ raw: true }); }
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await ctx.route("**/api/plan**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"plan":"free"}' }));
  await ctx.route("**/api/auth/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true,"verified":true}' }));
  await ctx.route("**googleapis.com/**", (route) => route.abort());
  await ctx.route("**firebase**", (route) => route.abort());
  return ctx;
}

const feedText = (p) => p.evaluate(() => (document.querySelector(".room-feed")?.innerText || "").replace(/\s+/g, " ").trim());
const sttActive = (p) => p.evaluate(() => window.__stt.active());
const ttsLog = (p) => p.evaluate(() => window.__ttsLog.map((e) => ({ ...e })));
// Gerçek yatay taşma ölçümü. Dekoratif, konumlandırılmış (absolute/fixed)
// ışıma katmanları kırpıldıkları için sayfayı kaydırmaz; ölçüt sayfanın
// gerçekten kayması ve akıştaki içerik kutularının sınırı aşmasıdır.
const overflowX = (p) => p.evaluate(() => {
  const doc = document.documentElement;
  const docRight = doc.clientWidth;
  const over = [];
  document.querySelectorAll(".room *, .room-lobby *").forEach((el) => {
    const style = getComputedStyle(el);
    if (style.position === "absolute" || style.position === "fixed") return;
    if (style.pointerEvents === "none" && !el.textContent?.trim()) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > docRight + 1) {
      over.push(`${el.tagName}.${String(el.className).split(" ")[0]}:${Math.round(r.right - docRight)}px`);
    }
  });
  return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, over: over.slice(0, 6) };
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, timeout = 15000, step = 200) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await sleep(step);
  }
  return false;
};

const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const hostLogs = [], guestLogs = [];

// ---------------------------------------------------------------------------
// SENARYO A: misafir odaya EV SAHİBİNDEN ÖNCE girer → otomatik bağlanmalı
// ---------------------------------------------------------------------------
{
  const room = "AA" + Math.floor(Math.random() * 9000 + 1000);
  const guestCtx = await makeContext(browser, guestLogs);
  const guest = await guestCtx.newPage();
  guest.on("pageerror", (e) => check("A hata yok (guest page)", false, String(e)));
  await guest.goto(`${BASE}/oda/${room}`, { waitUntil: "domcontentloaded" });
  await guest.click(".guest-language-card .primary");
  await sleep(3500); // misafir bağlanmaya çalışıp 'ev sahibi çevrimdışı' durumuna düşsün

  const hostCtx = await makeContext(browser, hostLogs);
  const host = await hostCtx.newPage();
  await host.goto(`${BASE}/oda/${room}?role=host`, { waitUntil: "domcontentloaded" });

  const connected = await waitFor(async () =>
    (await host.evaluate(() => document.querySelector(".peer-chip")?.className.includes("on"))) &&
    (await guest.evaluate(() => document.querySelector(".peer-chip")?.className.includes("on"))), 25000);
  check("A misafir önce girince otomatik bağlanır", connected);

  // ---- devamı: host yenilenir, oda kendini toparlamalı ----
  if (connected) {
    await host.reload({ waitUntil: "domcontentloaded" });
    const reconnected = await waitFor(async () =>
      (await host.evaluate(() => document.querySelector(".peer-chip")?.className.includes("on"))) &&
      (await guest.evaluate(() => document.querySelector(".peer-chip")?.className.includes("on"))), 30000);
    check("A ev sahibi yenileyince oda toparlanır", reconnected);
  }
  await hostCtx.close(); await guestCtx.close();
}

// ---------------------------------------------------------------------------
// Ana oda: normal sıra (host önce), kalan senaryolar bu odada koşar
// ---------------------------------------------------------------------------
const room = "TT" + Math.floor(Math.random() * 9000 + 1000);
const hostCtx = await makeContext(browser, hostLogs);
const guestCtx = await makeContext(browser, guestLogs);
const host = await hostCtx.newPage();
const guest = await guestCtx.newPage();
host.on("pageerror", (e) => check("sayfa hatası yok (host)", false, String(e)));
guest.on("pageerror", (e) => check("sayfa hatası yok (guest)", false, String(e)));

await host.goto(`${BASE}/oda/${room}?role=host`, { waitUntil: "domcontentloaded" });
await guest.goto(`${BASE}/oda/${room}`, { waitUntil: "domcontentloaded" });
await guest.click(".guest-language-card .primary");

const connected = await waitFor(async () =>
  (await host.evaluate(() => document.querySelector(".peer-chip")?.className.includes("on"))) &&
  (await guest.evaluate(() => document.querySelector(".peer-chip")?.className.includes("on"))), 20000);
check("B host+misafir bağlantısı", connected);
if (!connected) { console.log(JSON.stringify(results)); await browser.close(); process.exit(1); }

// Mikrofonları aç (canlı ses otomatik açılır — fake mikrofon)
await host.click(".mic-button");
await guest.click(".mic-button");
await waitFor(() => sttActive(host));
await waitFor(() => sttActive(guest));
check("B iki tarafta da dinleme açık", (await sttActive(host)) && (await sttActive(guest)));
const voiceUp = await waitFor(async () =>
  host.evaluate(() => document.querySelector("[data-tour='voice']")?.className.includes("on")), 15000);
check("B canlı ses bağlantısı kuruldu", voiceUp);

// ---------------------------------------------------------------------------
// SENARYO C: hızlı konuşma — art arda finaller, hiçbir parça kaybolmamalı
// ---------------------------------------------------------------------------
{
  const parts = ["bugün hava", "çok güzel", "yarın da", "deniz kenarına", "gidelim mi"];
  for (const p of parts) {
    await host.evaluate((t) => window.__stt.interim(t), p);
    await sleep(120);
    await host.evaluate((t) => window.__stt.final(t), p);
    await sleep(260);
  }
  const allArrived = await waitFor(async () => {
    const f = await feedText(guest);
    return parts.every((p) => f.includes(p));
  }, 20000);
  const guestFeed = await feedText(guest);
  check("C hızlı konuşmada parça kaybolmaz", allArrived, allArrived ? "" : `misafir akışı: ${guestFeed.slice(0, 300)}`);
  const hostFeed = await feedText(host);
  const dupe = (hostFeed.match(/bugün hava/g) || []).length > 1;
  check("C parçalar tek balonda, çift yok", !dupe, dupe ? hostFeed.slice(0, 300) : "");
}

// ---------------------------------------------------------------------------
// SENARYO D: kısa gerçek kelimeler ("ok", "no") kaybolmamalı
// ---------------------------------------------------------------------------
{
  await guest.evaluate(() => window.__stt.final("ok"));
  await sleep(1600);
  await guest.evaluate(() => window.__stt.final("no"));
  const shortArrived = await waitFor(async () => {
    const f = await feedText(host);
    return f.includes("ok") && f.includes("no");
  }, 15000);
  check("D kısa kelimeler (ok/no) iletilir", shortArrived, shortArrived ? "" : (await feedText(host)).slice(0, 200));
}

// ---------------------------------------------------------------------------
// SENARYO E: otomatik seslendirme — 3 hızlı mesaj: sırayla, kesintisiz,
// sonda mikrofon geri açılır; hayalet ses yok.
// ---------------------------------------------------------------------------
{
  await guest.evaluate(() => { window.__ttsLog.length = 0; });
  // misafirde oto sesi aç
  await guest.click("[data-tour='auto']");
  await sleep(400);
  await guest.evaluate(() => { window.__ttsLog.length = 0; }); // açılış anonsunu sil
  for (const p of ["birinci cümle geldi", "ikinci cümle geldi", "üçüncü cümle geldi"]) {
    await host.evaluate((t) => window.__stt.final(t), p);
    await sleep(2400); // birleştirme penceresi dışında kalsın: ayrı mesajlar... (7sn merge!)
  }
  // 7sn merge penceresi yüzünden bunlar tek mesajda birleşir; appended parçalar
  // ayrı ayrı okunmalı. Kuyruk boşalana kadar bekle.
  await waitFor(async () => {
    const l = await ttsLog(guest);
    return l.length >= 3 && l.every((e) => e.how !== "speaking");
  }, 30000);
  const log = await ttsLog(guest);
  const spoken = log.map((e) => e.text).join(" | ");
  const interrupted = log.filter((e) => e.how === "interrupted").length;
  const overlaps = await guest.evaluate(() => window.__ttsOverlaps);
  check("E üç parça da seslendirildi", log.length >= 3, `çalınan: ${spoken.slice(0, 200)}`);
  check("E hiçbir ses yarıda kesilmedi", interrupted === 0, `kesilen: ${interrupted}`);
  check("E ses çakışması yok", overlaps === 0, `çakışma: ${overlaps}`);
  const micBack = await waitFor(() => sttActive(guest), 8000);
  check("E seslendirme sonrası mikrofon geri açıldı", micBack);
}

// ---------------------------------------------------------------------------
// SENARYO F: balona dokunup tekrar okutma kuyruğu bozmamalı, hayalet ses yok
// ---------------------------------------------------------------------------
{
  await guest.evaluate(() => { window.__ttsLog.length = 0; window.__ttsOverlaps = 0; });
  // İki mesaj hızlıca gelsin (kuyruk dolu olsun)
  await host.evaluate(() => window.__stt.final("uzun bir deneme cümlesi bu kuyrukta bekleyecek"));
  await sleep(150);
  // kuyruk çalışırken balona dokun + "tekrar oku"
  await waitFor(async () => (await ttsLog(guest)).length >= 1, 15000);
  await guest.locator(".turn.theirs").last().click();
  await guest.locator(".sheet-actions button").first().click();
  await sleep(5000);
  const log2 = await ttsLog(guest);
  const stillSpeaking = log2.filter((e) => e.how === "speaking").length;
  const overlaps2 = await guest.evaluate(() => window.__ttsOverlaps);
  check("F dokunarak okutma çakışma yaratmaz", overlaps2 === 0, `çakışma: ${overlaps2}`);
  check("F kuyruk temiz bitti", stillSpeaking === 0);
  // oto sesi kapat: hayalet konuşma kontrolü
  await guest.evaluate(() => { window.__ttsLog.length = 0; });
  await guest.click("[data-tour='auto']"); // kapat (clearSpeechQueue)
  await sleep(1200);
  const ghost = (await ttsLog(guest)).filter((e) => e.text.trim().length > 0).length;
  check("F kapatınca hayalet ses çalmaz", ghost === 0, `hayalet: ${ghost}`);
}

// ---------------------------------------------------------------------------
// SENARYO G: yankı bastırma — karşı taraf konuşurken gelen tanıma bekletilir,
// mesaj gelince silinir; gerçek eş zamanlı konuşma kaybolmaz.
// ---------------------------------------------------------------------------
{
  // host konuşuyor sinyali: interim ver (speaking:true gider)
  await host.evaluate(() => window.__stt.interim("ben şimdi konuşuyorum sana bir şey diyorum"));
  await sleep(700); // sinyal karşıya ulaşsın
  // misafirin tanıyıcısı hostun hoparlör yankısını "duyar":
  await guest.evaluate(() => window.__stt.final("ben şimdi konuşuyorum sana bir şey diyorum"));
  await sleep(300);
  await host.evaluate(() => window.__stt.final("ben şimdi konuşuyorum sana bir şey diyorum"));
  await sleep(4000);
  const guestFeedAfter = await feedText(guest);
  const echoCount = (guestFeedAfter.match(/ben şimdi konuşuyorum/g) || []).length;
  // misafir akışında bu cümle SADECE hosttan gelen mesaj olarak 1 kez olmalı
  // (misafirin kendi balonu olarak İKİNCİ kez görünmemeli)
  check("G yankı karşıya geri gönderilmez", echoCount <= 1, `görülme: ${echoCount}`);

  // gerçek eş zamanlı konuşma: misafir ÖNCE başlar → kaybolmamalı
  await guest.evaluate(() => window.__stt.interim("benim gerçek sözüm bu kaybolmasın"));
  await sleep(250);
  await host.evaluate(() => window.__stt.interim("aynı anda ben de konuşuyorum işte"));
  await sleep(400);
  await guest.evaluate(() => window.__stt.final("benim gerçek sözüm bu kaybolmasın"));
  await host.evaluate(() => window.__stt.final("aynı anda ben de konuşuyorum işte"));
  const realKept = await waitFor(async () => (await feedText(host)).includes("kaybolmasın"), 20000);
  check("G gerçek eş zamanlı konuşma kaybolmaz", realKept, realKept ? "" : (await feedText(host)).slice(-300));
}

// ---------------------------------------------------------------------------
// SENARYO J: canlı ses ducking — TTS çalarken karşı tarafın canlı sesi kısılır
// ve kendi mikrofon yayınımız susturulur; kuyruk bitince ikisi de geri gelir.
// ---------------------------------------------------------------------------
{
  const audioState = () => guest.evaluate(() => {
    const audio = document.querySelector("audio");
    return { volume: audio ? audio.volume : -1, speaking: window.speechSynthesis.speaking };
  });
  // F senaryosunda oto ses kapatılmıştı; ducking'i ölçmek için geri aç.
  await guest.click("[data-tour='auto']");
  await sleep(600);
  await guest.evaluate(() => { window.__ttsLog.length = 0; });
  const before = await audioState();
  await host.evaluate(() => window.__stt.final("bu cümle okunurken canlı ses kısılmalı ve sonra geri açılmalı"));
  const ducked = await waitFor(async () => (await audioState()).volume < 0.5, 20000);
  check("J seslendirme sırasında canlı ses kısılır", ducked, `önce: ${before.volume}`);
  const restored = await waitFor(async () => (await audioState()).volume > 0.9, 25000);
  check("J kuyruk bitince canlı ses geri açılır", restored);
}

// ---------------------------------------------------------------------------
// SENARYO H: bağlantı kopması — misafir sayfasını yenile, oda toparlanmalı,
// kopukluk sırasında söylenen cümle karşıya ulaşmalı (outbound kuyruk).
// ---------------------------------------------------------------------------
{
  await guest.reload({ waitUntil: "domcontentloaded" });
  await guest.click(".guest-language-card .primary").catch(() => {});
  // kopukken host konuşsun
  await host.evaluate(() => window.__stt.final("kopukken söylenen cümle kaybolmamalı"));
  const back = await waitFor(async () =>
    (await host.evaluate(() => document.querySelector(".peer-chip")?.className.includes("on"))) &&
    (await guest.evaluate(() => document.querySelector(".peer-chip")?.className.includes("on"))), 30000);
  check("H misafir yenileyince oda toparlanır", back);
  if (back) {
    const arrived = await waitFor(async () => (await feedText(guest)).includes("kopukken söylenen"), 20000);
    check("H kopukluk sırasındaki mesaj sonradan ulaşır", arrived);
  }
}

// ---------------------------------------------------------------------------
// SENARYO K: üçüncü sekme odayı ele geçiremez
// ---------------------------------------------------------------------------
{
  const intruderCtx = await makeContext(browser, []);
  const intruder = await intruderCtx.newPage();
  await intruder.goto(`${BASE}/oda/${room}`, { waitUntil: "domcontentloaded" });
  await intruder.click(".guest-language-card .primary").catch(() => {});
  await sleep(6000);
  // İlk misafir hâlâ bağlı olmalı ve mesaj alabilmeli
  await host.evaluate(() => window.__stt.final("üçüncü sekmeden sonra hâlâ buradayım"));
  const stillWorks = await waitFor(async () => (await feedText(guest)).includes("hâlâ buradayım"), 20000);
  check("K üçüncü sekme odayı bozmaz", stillWorks);
  await intruderCtx.close();
}

await hostCtx.close();
await guestCtx.close();

// ---------------------------------------------------------------------------
// SENARYO I: mobil görünüm — 320px ve 375px'te yatay taşma yok
// ---------------------------------------------------------------------------
for (const width of [320, 375]) {
  const mLogs = [];
  const mCtx = await makeContext(browser, mLogs, { width, height: 720 });
  const m = await mCtx.newPage();
  const mRoom = "MM" + Math.floor(Math.random() * 9000 + 1000);
  await m.goto(`${BASE}/oda/${mRoom}?role=host`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  const box = await overflowX(m);
  check(`I ${width}px yatay taşma yok`, box.scrollW <= box.clientW + 1 && box.over.length === 0,
    box.over.length ? `taşanlar: ${box.over.join(", ")}` : `scrollW=${box.scrollW} clientW=${box.clientW}`);
  // uzun kelimeli balon taşması
  await m.click(".round[data-tour='keyboard'], [data-tour='keyboard']").catch(() => {});
  await m.fill(".room-composer input", "Donaudampfschifffahrtsgesellschaftskapitänswitwenrente ödemesi").catch(() => {});
  await m.click(".room-composer .send").catch(() => {});
  await sleep(1200);
  const box2 = await overflowX(m);
  check(`I ${width}px uzun kelime balonu taşmaz`, box2.scrollW <= box2.clientW + 1 && box2.over.length === 0,
    box2.over.length ? `taşanlar: ${box2.over.join(", ")}` : "");
  await mCtx.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n==== SONUÇ: ${results.length - failed.length}/${results.length} geçti ====`);
if (failed.length) {
  console.log("BAŞARISIZ:");
  for (const f of failed) console.log(` - ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
  process.exit(1);
}
