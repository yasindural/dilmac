import { Link } from "react-router-dom";
import { Lock, Sparkles, Timer, Crown } from "lucide-react";
import { FREE_TRIAL_MS, formatRemaining, type AccessState } from "../lib/access";
import "../access.css";
import { useI18n } from "../lib/i18n";

type Props = {
  state: AccessState;
  remaining: number;
  /** "live" = canlı çeviri (kayıt zorunlu), "ai" = AI pratik (kayıtsıza deneme) */
  variant?: "live" | "ai";
  /** Sayaç şu an ilerlemiyorsa kullanıcıya bunu açıkça söyle. */
  paused?: boolean;
  children: React.ReactNode;
};

/**
 * Canlı çeviri ekranının kapısı.
 *  - Giriş yapmamış kullanıcı ekranı hiç görmez.
 *  - Abone olmayan kayıtlı kullanıcı 2 dakikalık aktif kullanım hakkıyla girer.
 *  - Hak bitince ekran kapanır, yükseltme kartı gelir.
 */
export default function AccessGate({ state, remaining, variant = "live", paused = false, children }: Props) {
  const { t } = useI18n();
  // Deneme süresi metinlerde elle yazılmaz; tek kaynak FREE_TRIAL_MS.
  const FREE_TRIAL_MINUTES = Math.round(FREE_TRIAL_MS / 60_000);
  if (state === "loading") {
    return (
      <section className="gate">
        <div className="gate-card">
          <div className="gate-spinner" aria-hidden="true" />
          <p>{t("gate.loading")}</p>
        </div>
      </section>
    );
  }

  if (state === "anonymous") {
    return (
      <section className="gate">
        <div className="gate-card">
          <div className="gate-icon"><Lock /></div>
          <h1>{t("gate.liveTitle")}</h1>
<p>{t("gate.liveText")}</p>
          <div className="gate-actions">
            <Link className="primary" to="/kayit">{t("gate.register")}</Link>
            <Link className="ghost" to="/deneme">{t("gate.tryAi")}</Link>
          </div>
          <div className="gate-perk"><Sparkles /> {t("gate.perkLive", { minutes: FREE_TRIAL_MINUTES })}</div>
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
            <h1>{t("gate.expiredTitle")}</h1>
            <p>{t("gate.aiExpiredText", { minutes: FREE_TRIAL_MINUTES })}</p>
            <div className="gate-actions">
              <Link className="primary" to="/kayit">{t("gate.register")}</Link>
              <Link className="ghost" to="/abonelik">{t("gate.plans")}</Link>
            </div>
            <div className="gate-perk"><Sparkles /> {t("gate.perkAi", { minutes: FREE_TRIAL_MINUTES })}</div>
          </div>
        </section>
      );
    }
    return (
      <section className="gate">
        <div className="gate-card">
          <div className="gate-icon warn"><Timer /></div>
          <h1>{t("gate.expiredTitle")}</h1>
          <p>{t("gate.liveExpiredText", { minutes: FREE_TRIAL_MINUTES })}</p>
          <div className="gate-actions">
            <Link className="primary" to="/abonelik"><Crown /> {t("gate.toPro")}</Link>
            <Link className="ghost" to="/deneme">{t("gate.continueAi")}</Link>
          </div>
          <div className="gate-perk">{t("gate.aiStillFree")}</div>
        </div>
      </section>
    );
  }

  return (
    <>
      {state === "trial" && (
        <div className={`trial-pill ${paused ? "paused" : ""} ${!paused && remaining < 60_000 ? "urgent" : ""}`} role="status">
          <Timer />
          <span>{variant === "ai" ? t("gate.trialFree") : t("gate.trial")} <b>{formatRemaining(remaining)}</b>{paused && <em> · {t("gate.paused")}</em>}</span>
          <Link to={variant === "ai" ? "/kayit" : "/abonelik"}>{variant === "ai" ? t("gate.signup") : t("gate.upgrade")}</Link>
        </div>
      )}
      {children}
    </>
  );
}
