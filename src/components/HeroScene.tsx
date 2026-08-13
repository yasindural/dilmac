import { useEffect, useRef } from "react";

// Hero sahnesi: dev bir mikrofon fareyle hafifçe eğilir, sayfa aşağı
// kaydıkça küçülüp saydamlaşır ve yerini Dilmaç telefon arayüzüne bırakır;
// en sonda iki konuşmacı yanlara açılır. Tüm hareket yalnızca CSS custom
// property'leri üzerinden transform/opacity ile yapılır — layout hesabı yok,
// bu yüzden mobilde de akıcı çalışır.
export default function HeroScene() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    // jsdom ve bazı eski tarayıcılarda matchMedia yok; sahne yine de çalışsın.
    const media = (query: string) =>
      typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false;
    const reduced = media("(prefers-reduced-motion: reduce)");
    const coarse = media("(pointer: coarse)");

    let frame = 0;
    let px = 0;
    let py = 0;
    let progress = 0;

    const paint = () => {
      frame = 0;
      node.style.setProperty("--px", px.toFixed(3));
      node.style.setProperty("--py", py.toFixed(3));
      // 0 → mikrofon tam görünür, 1 → telefon + konuşmacılar sahnede.
      node.style.setProperty("--mic-scale", (1 - progress * 0.42).toFixed(3));
      node.style.setProperty("--mic-lift", `${(-progress * 26).toFixed(1)}px`);
      node.style.setProperty("--mic-opacity", Math.max(0, 1 - progress * 1.9).toFixed(3));
      node.style.setProperty("--phone-opacity", Math.min(1, Math.max(0, (progress - 0.28) * 2.1)).toFixed(3));
      node.style.setProperty("--people-opacity", Math.min(1, Math.max(0, (progress - 0.58) * 2.4)).toFixed(3));
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(paint);
    };

    // iOS Safari'de sayfa kayarken adres çubuğu açılıp kapanır ve
    // window.innerHeight değişir. Yolu her scroll'da yeniden hesaplasaydık
    // mikrofon aniden zıplardı; bu yüzden yol bir kez sabitlenir ve yalnızca
    // gerçek bir yeniden boyutlanmada (genişlik/yön değişimi) güncellenir.
    let travel = Math.max(240, window.innerHeight * 0.34);
    let lastWidth = window.innerWidth;

    const onScroll = () => {
      progress = Math.min(1, Math.max(0, window.scrollY / travel));
      schedule();
    };

    const onResize = () => {
      if (window.innerWidth === lastWidth) return; // yalnızca araç çubuğu oynadı
      lastWidth = window.innerWidth;
      travel = Math.max(240, window.innerHeight * 0.34);
      onScroll();
    };

    const onPointer = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      px = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
      py = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
      schedule();
    };

    const onLeave = () => {
      px = 0;
      py = 0;
      schedule();
    };

    if (reduced) {
      // Hareket azaltma açıkken sahne sabit dursun: telefon görünür kalsın.
      node.style.setProperty("--mic-opacity", "1");
      node.style.setProperty("--phone-opacity", "0");
      return;
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    if (!coarse) {
      node.addEventListener("pointermove", onPointer);
      node.addEventListener("pointerleave", onLeave);
    }
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      node.removeEventListener("pointermove", onPointer);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="scene" ref={rootRef} aria-hidden="true">
      <div className="scene-glow" />

      <div className="scene-speaker left">
        <span className="scene-avatar">🙋‍♀️</span>
        <b>TÜRKÇE</b>
      </div>

      <div className="scene-mic">
        <div className="scene-mic-body" />
        <div className="scene-mic-arc" />
        <div className="scene-mic-stem" />
        <div className="scene-mic-base" />
        <div className="scene-rings"><i /><i /><i /></div>
      </div>
      <div className="scene-shadow" />

      <div className="scene-phone">
        <div className="scene-phone-screen">
          <div className="scene-notch" />
          <div className="scene-bar">
            <span className="scene-dot" />
            Oda <b>DLM-482</b>
          </div>
          <div className="scene-langs">
            <span>Türkçe</span>
            <em>↔</em>
            <span>English</span>
          </div>
          <div className="scene-bubble them">
            <small>TÜRKÇE</small>
            <p>Yarınki toplantı saat kaçta?</p>
            <i>What time is tomorrow's meeting?</i>
          </div>
          <div className="scene-bubble me">
            <small>ENGLISH</small>
            <p>It starts at ten.</p>
            <i>Saat onda başlıyor.</i>
          </div>
          <div className="scene-wave"><i /><i /><i /><i /><i /><i /></div>
        </div>
      </div>

      <div className="scene-speaker right">
        <span className="scene-avatar">🧑‍💼</span>
        <b>ENGLISH</b>
      </div>
    </div>
  );
}
