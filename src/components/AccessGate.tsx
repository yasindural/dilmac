import { Link } from "react-router-dom";
import { Lock, Sparkles, Timer, Crown } from "lucide-react";
import { formatRemaining, type AccessState } from "../lib/access";
import "../access.css";

type Props = {
  state: AccessState;
  remaining: number;
  /** "live" = canlı çeviri (kayıt zorunlu), "ai" = AI pratik (kayıtsıza 2 dk) */
  variant?: "live" | "ai";
  children: React.ReactNode;
};

/**
 * Canlı çeviri ekranının kapısı.
 *  - Giriş yapmamış kullanıcı ekranı hiç görmez.
 *  - Abone olmayan kayıtlı kullanıcı 2 dakikalık aktif kullanım hakkıyla girer.
 *  - Hak bitince ekran kapanır, yükseltme kartı gelir.
 */
export default function AccessGate({ state, remaining, variant = "live", children }: Props) {
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
    // AI pratikte duvar kayıtsız kullanıcıya çıkar: çözüm ödeme değil, kayıt.
    if (variant === "ai") {
      return (
        <section className="gate">
          <div className="gate-card">
            <div className="gate-icon warn"><Timer /></div>
            <h1>Deneme süreniz doldu</h1>
            <p>
              AI ile 2 dakikalık ücretsiz pratik hakkınızı kullandınız. Ücretsiz
              hesap açtığınızda AI ile pratik sınırsız devam eder.
            </p>
            <div className="gate-actions">
              <Link className="primary" to="/kayit">Ücretsiz kayıt ol</Link>
              <Link className="ghost" to="/abonelik">Planları gör</Link>
            </div>
            <div className="gate-perk"><Sparkles /> Kayıt olana AI pratik sınırsız + 2 dakika canlı çeviri</div>
          </div>
        </section>
      );
    }
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
          <span>{variant === "ai" ? "Ücretsiz deneme" : "Deneme süresi"} <b>{formatRemaining(remaining)}</b></span>
          <Link to={variant === "ai" ? "/kayit" : "/abonelik"}>{variant === "ai" ? "Kayıt ol" : "Yükselt"}</Link>
        </div>
      )}
      {children}
    </>
  );
}
