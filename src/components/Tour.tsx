import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { GraduationCap, PartyPopper, X } from "lucide-react";
import "../tour.css";

export type TourStep = {
  /** Hedef düğmenin CSS seçicisi. Bulunamazsa adım atlanır. */
  target: string;
  title: string;
  body: string;
  emoji: string;
  /** Vurgu rengi — her adım kendi rengiyle anlatılır. */
  tone: "mic" | "voice" | "call" | "lang" | "text" | "room" | "feed";
};

type Rect = { top: number; left: number; width: number; height: number };

const storageKey = "dilmac-tour-done";

export function isTourDone() {
  try {
    return localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

function markTourDone() {
  try {
    localStorage.setItem(storageKey, "1");
  } catch { /* depolama kapalıysa yoksay */ }
}

export function resetTour() {
  try {
    localStorage.removeItem(storageKey);
  } catch { /* yoksay */ }
}

function measure(selector: string): Rect | null {
  const node = document.querySelector(selector);
  if (!node) return null;
  const box = node.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) return null;
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

type Props = {
  steps: TourStep[];
  /** "ask" = önce soralım, "run" = doğrudan başlat, "off" = kapalı */
  mode: "ask" | "run" | "off";
  onFinish: () => void;
};

export default function Tour({ steps, mode, onFinish }: Props) {
  const [asking, setAsking] = useState(mode === "ask");
  const [running, setRunning] = useState(mode === "run");
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [done, setDone] = useState(false);

  const step = steps[index];

  const sync = useCallback(() => {
    if (!step) return;
    setRect(measure(step.target));
  }, [step]);

  useLayoutEffect(() => {
    if (!running || done) return;
    sync();
    const raf = requestAnimationFrame(sync);
    const timer = window.setTimeout(sync, 120);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    // iOS'ta araç çubuğu açılıp kapandıkça görsel viewport değişir; spot ışığı
    // hedefin üstünde kalsın diye orada da yeniden ölçüyoruz.
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
    };
  }, [running, done, sync]);

  // Tur açıkken sayfa gerçekten kilitlenmeli. iOS Safari'de
  // "body { overflow: hidden }" dokunmatik kaydırmayı durdurmuyor ve düzen
  // viewport'u değiştiği için sayfa büyümüş gibi görünüyordu. Doğru yöntem
  // gövdeyi position:fixed ile sabitlemek. Ayrıca tur boyunca sayfayı en
  // üste alıyoruz; yoksa kullanıcı aşağıdayken hedef düğmeler ekran dışında
  // kalıp spot ışığı boşluğa düşüyordu.
  const locked = asking || running || done;
  useEffect(() => {
    if (!locked) return;
    const body = document.body;
    const before = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    // KRİTİK: gövdeyi sabitlemeden ÖNCE gerçekten en üste al.
    // iOS Safari'de position:fixed gövdede getBoundingClientRect eski kaydırma
    // ofsetini döndürmeye devam ediyor; ölçüm doğru çıksa da spot ışığı hedefin
    // başlık yüksekliği kadar yukarısına düşüyordu.
    window.scrollTo(0, 0);
    body.style.position = "fixed";
    body.style.top = "0px";
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.classList.add("tour-open");
    return () => {
      body.style.position = before.position;
      body.style.top = before.top;
      body.style.left = before.left;
      body.style.right = before.right;
      body.style.width = before.width;
      body.style.overflow = before.overflow;
      body.classList.remove("tour-open");
      // Tur bitince kullanıcı görüşme ekranının başında kalsın.
      window.scrollTo(0, 0);
    };
  }, [locked]);

  const close = useCallback(() => {
    markTourDone();
    setAsking(false);
    setRunning(false);
    setDone(false);
    onFinish();
  }, [onFinish]);

  const next = () => {
    if (index + 1 < steps.length) {
      setIndex(index + 1);
      return;
    }
    setRunning(false);
    setDone(true);
  };

  if (mode === "off" && !asking && !running && !done) return null;

  if (asking) {
    return (
      <div className="tour-backdrop" role="dialog" aria-modal="true" aria-label="Öğretici mod">
        <div className="tour-invite">
          <div className="tour-invite-icon"><GraduationCap /></div>
          <h2>Kısa bir tur atalım mı?</h2>
          <p>
            Mikrofon, seslendirme, canlı ses ve dil seçimi — hepsini
            <b> 40 saniyede</b> tek tek gösterelim.
          </p>
          <div className="tour-invite-actions">
            <button className="tour-yes" type="button" onClick={() => { setAsking(false); setRunning(true); }}>
              Evet, göster
            </button>
            <button className="tour-no" type="button" onClick={close}>Gerek yok</button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="tour-backdrop" role="dialog" aria-modal="true">
        <div className="tour-invite tour-complete">
          <div className="tour-confetti" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}
          </div>
          <div className="tour-invite-icon done"><PartyPopper /></div>
          <h2>Görev tamamlandı!</h2>
          <p>Artık tüm düğmeleri biliyorsun. Mikrofona bas ve konuşmaya başla.</p>
          <div className="tour-badges">
            {steps.map((item) => (
              <span key={item.target} className={`tour-badge tone-${item.tone}`}>{item.emoji} {item.title}</span>
            ))}
          </div>
          <div className="tour-invite-actions">
            <button className="tour-yes" type="button" onClick={close}>Başlayalım</button>
          </div>
        </div>
      </div>
    );
  }

  if (!running || !step) return null;

  // Hedef bulunamadıysa adımı atla, tur takılmasın.
  if (!rect) {
    return (
      <div className="tour-backdrop plain">
        <div className="tour-card floating">
          <p>Bu adım bu ekranda görünmüyor.</p>
          <button className="tour-yes" type="button" onClick={next}>Devam</button>
        </div>
      </div>
    );
  }

  const pad = 8;
  const spot = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  // Kart, ışığın altına sığmıyorsa üstüne geçer. Üstteyken "bottom" ile
  // konumlandırıyoruz; böylece kart ne kadar uzun olursa olsun ışığı örtmez.
  // Kart, ışığın altına sığmıyorsa üstüne geçer. Işık ekranın dışına taşmışsa
  // (beklenmedik bir yerleşimde) kartı ekranın altına sabitleyip turu
  // okunur tutuyoruz.
  const viewportH = window.visualViewport?.height || window.innerHeight;
  const spotVisible = spot.top > -spot.height && spot.top < viewportH;
  const below = spotVisible && spot.top + spot.height + 230 < viewportH;
  const cardStyle: React.CSSProperties = !spotVisible
    ? { bottom: 16 }
    : below
      ? { top: spot.top + spot.height + 14 }
      : { bottom: Math.max(12, viewportH - spot.top + 14) };

  return (
    <div className="tour-layer" role="dialog" aria-modal="true" aria-label={step.title}>
      {/* Arka plana dokunuşları yutar; tur sırasında yanlış düğmeye basılmasın. */}
      <div className="tour-block" aria-hidden="true" />
      <div
        className={`tour-spot tone-${step.tone}`}
        style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
      />
      <div
        className={`tour-card tone-${step.tone} ${below ? "below" : "above"}`}
        style={cardStyle}
      >
        <button className="tour-skip" type="button" onClick={close} aria-label="Turu kapat"><X /></button>
        <span className="tour-step">{index + 1} / {steps.length}</span>
        <h3><span aria-hidden="true">{step.emoji}</span> {step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-card-foot">
          <div className="tour-dots" aria-hidden="true">
            {steps.map((item, i) => <i key={item.target} className={i === index ? "on" : i < index ? "past" : ""} />)}
          </div>
          <button className="tour-yes" type="button" onClick={next}>
            {index + 1 === steps.length ? "Bitir" : "Sonraki"}
          </button>
        </div>
      </div>
    </div>
  );
}
