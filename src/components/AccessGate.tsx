import { Link } from "react-router-dom";
import { Lock, Sparkles, Timer, Crown } from "lucide-react";
import { formatRemaining, type AccessState } from "../lib/access";
import "../access.css";

type Props = {
  state: AccessState;
  remaining: number;
  children: React.ReactNode;
};

/**
 * Canlı çeviri ekranının kapısı.
 *  - Giriş yapmamış kullanıcı ekranı hiç görmez.
 *  - Abone olmayan kayıtlı kullanıcı 2 dakikalık aktif kullanım hakkıyla girer.
 *  - Hak bitince ekran kapanır, yükseltme kartı gelir.
 */
export default function AccessGate({ state, remaining, children }: Props) {
  if (state === "loading") {
    return (
      <section className="gate">
        <div className="gate-card">
          <div className="gate-spinner" aria-hidden="true" />
          <p>Hesabınız kontrol ediliyor…</p>
        </div>
      </section>
    );
  }

  if (state === "anonymous") {
    return (
      <section className="gate">
        <div className="gate-card">
          <div className="gate-icon"><Lock /></div>
          <h1>Canlı çeviri üyelere özel</h1>
          <p>
            Görüşmeler doğrudan iki cihaz arasında kurulduğu için her katılımcının
            bir hesabı olması gerekiyor. Kayıt 10 saniye sürer.
          </p>
          <div className="gate-actions">
            <Link className="primary" to="/kayit">Ücretsiz kayıt ol</Link>
            <Link className="ghost" to="/deneme">Önce AI ile dene</Link>
          </div>
          <div className="gate-perk"><Sparkles /> Kayıt olan herkese 2 dakika canlı çeviri hediye</div>
        </div>
      </section>
    );
  }

  if (state === "expired") {
    return (
      <section className="gate">
        <div className="gate-card">
          <div className="gate-icon warn"><Timer /></div>
          <h1>Deneme süreniz doldu</h1>
          <p>
            2 dakikalık ücretsiz canlı çeviri hakkınızı kullandınız. Sınırsız
            görüşme için Pro'ya geçebilirsiniz.
          </p>
          <div className="gate-actions">
            <Link className="primary" to="/abonelik"><Crown /> Pro'ya geç</Link>
            <Link className="ghost" to="/deneme">AI ile pratiğe devam et</Link>
          </div>
          <div className="gate-perk">AI ile pratik modu ücretsiz kullanıcılar için açık kalır.</div>
        </div>
      </section>
    );
  }

  return (
    <>
      {state === "trial" && (
        <div className={`trial-pill ${remaining < 30_000 ? "urgent" : ""}`} role="status">
          <Timer />
          <span>Deneme süresi <b>{formatRemaining(remaining)}</b></span>
          <Link to="/abonelik">Yükselt</Link>
        </div>
      )}
      {children}
    </>
  );
}
