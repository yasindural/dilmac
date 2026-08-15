import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Menu,
  X,
  Mic,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Languages,
  ShieldCheck,
  Users,
  Radio,
  LogIn,
  LogOut,
  Sun,
  Moon,
  CheckCircle2,
  AlertCircle,
  Globe2,
  Plane,
  Briefcase,
  GraduationCap,
  UserCircle,
  Crown,
  CreditCard,
  Mail,
  LockKeyhole,
  Sparkles,
  Zap,
  MessagesSquare,
  WifiOff,
  Lock,
  Gauge,
  Headphones,
  Bot,
  Heart,
  Star,
} from "lucide-react";
import { authReady, loginEmail, loginGoogle, logout, observeUser, registerEmail, resendVerification } from "./lib/auth";
import type { User } from "firebase/auth";
import { translate } from "./lib/translation";
import { useSpeech } from "./hooks/useSpeech";
import { useRoom, type RoomLanguage, type RoomMessage } from "./hooks/useRoom";
import { MessageQueue, type QueueItem } from "./lib/messageQueue";
import RoomScreen from "./components/RoomScreen";
import GoogleLogo from "./components/GoogleLogo";
import { BillingError, billingProvider, getLocalizedPlanPrices, isGmailAddress, localizedPlans, startCheckout } from "./lib/billing";
import "./membership.css";
import AccessGate from "./components/AccessGate";
import { useAccess } from "./lib/access";
import { fetchServerPlan } from "./lib/serverPlan";
import { logClientError } from "./lib/errorLogger";
import { clearSpeechQueue, isSpeechQueueBusy, queueSpeech, speakText, unlockSpeechOutput } from "./lib/speechOutput";
import { siteLanguages, useI18n, type SiteLang } from "./lib/i18n";
import HomeExpansion from "./components/HomeExpansion";
import AiPractice from "./components/AiPractice";
import HeroScene from "./components/HeroScene";
import BrandMark from "./components/BrandMark";
import LanguagePicker from "./components/LanguagePicker";
import { conversationLanguages, detectConversationLanguage, languageByCode, languageByName, speechCodeFor } from "./lib/languages";
// Premium katman en son yüklenir; tüm sayfa stillerinin üstünde kalması gerekir.
import "./premium.css";

type PlanId = "free" | "pro" | "business";
type MemberProfile = {
  firstName: string;
  lastName: string;
  plan: PlanId;
  completed: boolean;
};
const profileKey = (uid: string) => `dilmac-profile:${uid}`;
function readProfile(user: User | null): MemberProfile | null {
  if (!user) return null;
  try {
    const saved = localStorage.getItem(profileKey(user.uid));
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<MemberProfile>;
      return {
        firstName: parsed.firstName || "",
        lastName: parsed.lastName || "",
        plan: parsed.plan === "pro" || parsed.plan === "business" ? parsed.plan : "free",
        completed: Boolean(parsed.completed),
      };
    }
  } catch { /* malformed local mock data is ignored */ }
  return null;
}
function defaultProfile(user: User): MemberProfile {
  const parts = (user.displayName || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" "), plan: "free", completed: false };
}
function Brand() {
  const { t } = useI18n();
  const ariaBrand = t("a11y.brand");
  return (
    <Link className="brand" to="/" aria-label={ariaBrand}>
      <BrandMark />
      <strong>TerraSpeak</strong>
    </Link>
  );
}
function Layout({
  children,
  user,
  profile,
  dark,
  setDark,
}: {
  children: React.ReactNode;
  user: User | null;
  profile: MemberProfile | null;
  dark: boolean;
  setDark: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const langMenuRef = useRef<HTMLDetailsElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang, t } = useI18n();
  const planCatalog = localizedPlans(t);
  // Mobil menü, hangi öğeye basılırsa basılsın adres değişince kapanmalı.
  // Tek tek onClick eklemek yerine rotayı dinliyoruz; böylece "Canlı çeviriyi
  // başlat" gibi navigate() kullanan düğmelerde de menü açık kalmıyor.
  useEffect(() => {
    setOpen(false);
    if (langMenuRef.current) langMenuRef.current.open = false;
  }, [location.pathname]);
  // Menü açıkken arka plan kaymasın.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  // Sayfa kaydırıldığında başlık camlaşır; sınıfı gövdeye yazıyoruz ki
  // her sayfa aynı davranışı ücretsiz alsın.
  useEffect(() => {
    const onScroll = () => {
      document.body.classList.toggle("scrolled", window.scrollY > 12);
      setShowTop(window.scrollY > 560);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <>
      <a href="#main" className="skip">
        {t("skip")}
      </a>
      <div className="page-aura" aria-hidden="true"><i /><i /></div>
      <header className="site-header">
        <Brand />
        <button
          className="mobile-menu"
          aria-label={open ? t("a11y.menuClose") : t("menu.open")}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? "open" : ""} aria-label={t("a11y.mainNav")}>
          {[
            ["/", t("nav.home")],
            ["/nasil-calisir", t("nav.how")],
            ["/ozellikler", t("nav.features")],
            ["/deneme", t("nav.try")],
            ["/abonelik", t("nav.pricing")],
            ["/hakkinda", t("nav.about")],
            ["/iletisim", contactCopy[lang].nav],
          ].map(([p, n]) => (
            <NavLink key={p} to={p} onClick={() => setOpen(false)}>
              {n}
            </NavLink>
          ))}
          <details className="site-lang-menu" ref={langMenuRef}>
            <summary aria-label={t("lang.pick")}>
              <Languages />
              <strong>{siteLanguages.find(([code]) => code === lang)?.[1]}</strong>
              <ChevronDown />
            </summary>
            <div className="site-lang-options" role="listbox" aria-label={t("lang.pick")}>
              {siteLanguages.map(([code, name]) => (
                <button
                  key={code}
                  type="button"
                  className={code === lang ? "on" : ""}
                  aria-selected={code === lang}
                  onClick={() => {
                    setLang(code as SiteLang);
                    if (langMenuRef.current) langMenuRef.current.open = false;
                  }}
                >
                  <span>{name}</span>{code === lang && <CheckCircle2 />}
                </button>
              ))}
            </div>
          </details>
          <button
            className="icon-btn"
            onClick={() => setDark(!dark)}
            aria-label={dark ? t("theme.toLight") : t("theme.toDark")}
          >
            {dark ? <Sun /> : <Moon />}
          </button>
          {user && (() => {
            const shownName = profile?.firstName || user.displayName || t("prof.myProfile");
            const plan = profile?.plan || "free";
            const planName = planCatalog.find((candidate) => candidate.id === plan)?.name || t("plan.member");
            // Avatar: Google fotoğrafı varsa o, yoksa baş harf. Ücretli planlarda
            // halka marka gradyanına döner — rozet aramadan planı gösterir.
            return (
              <Link className={`member-chip plan-${plan}`} to="/profil" onClick={() => setOpen(false)} title={`${planName} · ${shownName}`}>
                <span className="chip-avatar">
                  {user.photoURL
                    ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                    : <b>{shownName.trim().charAt(0).toUpperCase()}</b>}
                  {plan !== "free" && <i className="chip-crown" aria-hidden="true"><Crown /></i>}
                </span>
                <span className="chip-text">
                  <small>{planName}</small>
                  <strong>{shownName}</strong>
                </span>
              </Link>
            );
          })()}
          {user ? (
            <button className="ghost auth-button" onClick={() => { setOpen(false); void logout(); }}><LogOut />{t("auth.logout")}</button>
          ) : (
            <Link className="ghost auth-button" to="/kayit" onClick={() => setOpen(false)}><LogIn />{t("auth.signup")}</Link>
          )}
          {/* Başlıktaki buton dar alanda durur; uzun dillerde (de/fr/es) tam
              cümle üç satıra kırılıp logonun üstüne biniyordu. Kısa varyant
              kullanılıyor, tam cümle sayfa içi CTA'da kalıyor. */}
          <button className="primary" onClick={() => { setOpen(false); navigate("/uygulama"); }}>
            {t("cta.headerStart")}
            <ArrowRight />
          </button>
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer>
        <div className="foot-grid">
          <div className="foot-brand">
            <Brand />
            <p>{t("foot.blurb")}</p>
          </div>
          <div className="foot-col">
            <h4>{t("foot.product")}</h4>
            <Link to="/uygulama">{t("foot.live")}</Link>
            <Link to="/deneme">{t("foot.ai")}</Link>
            <Link to="/ozellikler">{t("nav.features")}</Link>
            <Link to="/abonelik">{t("nav.pricing")}</Link>
          </div>
          <div className="foot-col">
            <h4>{t("foot.resources")}</h4>
            <Link to="/nasil-calisir">{t("nav.how")}</Link>
            <Link to="/hakkinda">{t("nav.about")}</Link>
            <Link to="/kayit">{t("auth.signup")}</Link>
            <Link to="/profil">{t("foot.account")}</Link>
            <Link to="/iletisim">{contactCopy[lang].nav}</Link>
          </div>
          <div className="foot-col">
            <h4>{t("foot.legal")}</h4>
            <Link to="/gizlilik">{t("footer.privacy")}</Link>
            <Link to="/kullanim-sartlari">{t("footer.terms")}</Link>
            <Link to="/iade-politikasi">{t("foot.refund")}</Link>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} TerraSpeak</span>
          <em>{t("foot.tagline")}</em>
        </div>
      </footer>
      <button
        className={`scroll-top ${showTop ? "show" : ""}`}
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label={`${t("nav.home")} · ↑`}
        title={t("nav.home")}
      >
        <ArrowUp />
      </button>
    </>
  );
}
function AuthPage({ onRegistered }: { onRegistered: (user: User, profile: MemberProfile) => void }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // E-posta/şifre hesabı adresini doğrulamadan içeri alınmaz; doğrulama
  // e-postası kayıt ve girişte otomatik gönderilir (auth.ts).
  const [verifyPending, setVerifyPending] = useState<User | null>(null);
  const [verifyNotice, setVerifyNotice] = useState<"" | "sent" | "still" | "error">("");
  const resendVerifyEmail = async () => {
    setBusy(true);
    try { await resendVerification(); setVerifyNotice("sent"); }
    catch { setVerifyNotice("error"); }
    finally { setBusy(false); }
  };
  const confirmVerified = async () => {
    if (!verifyPending) return;
    setBusy(true);
    try {
      await verifyPending.reload();
      if (verifyPending.emailVerified) { navigate("/uygulama"); return; }
      setVerifyNotice("still");
    } catch { setVerifyNotice("still"); }
    finally { setBusy(false); }
  };
  const google = async () => {
    setBusy(true); setError("");
    try {
      const result = await loginGoogle();
      const existing = readProfile(result.user);
      if (!existing) onRegistered(result.user, defaultProfile(result.user));
      navigate(existing?.completed ? "/uygulama" : "/profil?welcome=1");
    } catch { setError(t("auth.error")); }
    finally { setBusy(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "register") {
        const result = await registerEmail(email.trim(), password, `${firstName.trim()} ${lastName.trim()}`.trim());
        onRegistered(result.user, { firstName: firstName.trim(), lastName: lastName.trim(), plan: "free", completed: true });
        setVerifyNotice("");
        setVerifyPending(result.user);
        return;
      }
      const result = await loginEmail(email.trim(), password);
      if (!result.user.emailVerified) {
        setVerifyNotice("");
        setVerifyPending(result.user);
        return;
      }
      navigate("/uygulama");
    } catch { setError(t("auth.error")); }
    finally { setBusy(false); }
  };
  return <section className="auth-split">
    <div className="auth-pitch">
      <span className="eyebrow"><Sparkles /> {t("auth.eyebrow")}</span>
      <h1>{t("auth.h1")}</h1>
      <p>{t("auth.sub")}</p>
      <div className="auth-benefits">
        <span><CheckCircle2 />{t("auth.b1")}</span>
        <span><CheckCircle2 />{t("auth.b2", { count: conversationLanguages.length })}</span>
        <span><CheckCircle2 />{t("auth.b3")}</span>
        <span><CheckCircle2 />{t("auth.b4")}</span>
      </div>
      <div className="auth-mini" aria-hidden="true">
        <div className="row"><span className="scene-dot" />{t("auth.miniRow")} · DLM-482</div>
        <div className="bubble"><b>Yarınki toplantı saat kaçta?</b><small>What time is tomorrow&apos;s meeting?</small></div>
        <div className="bubble"><b>It starts at ten.</b><small>Saat onda başlıyor.</small></div>
      </div>
    </div>
    <div className="auth-card">
      {verifyPending ? (<>
      <h2>{t("sub.verifyTitle")}</h2>
      <p>{t("sub.verifyText", { email: verifyPending.email || "" })}</p>
      {verifyNotice === "sent" && <p>{t("sub.verifySent")}</p>}
      {verifyNotice === "still" && <div className="auth-error"><AlertCircle />{t("sub.verifyStill")}</div>}
      {verifyNotice === "error" && <div className="auth-error"><AlertCircle />{t("sub.verifyError")}</div>}
      <button className="primary" type="button" disabled={busy} onClick={confirmVerified}>{busy ? t("auth.busy") : t("sub.verifyCheck")}<ArrowRight /></button>
      <button className="ghost" type="button" disabled={busy} onClick={resendVerifyEmail}>{t("sub.verifyResend")}</button>
      </>) : (<>
      <h2>{mode === "register" ? t("auth.createTitle") : t("auth.welcomeTitle")}</h2>
      <p>{mode === "register" ? t("auth.createSub") : t("auth.welcomeSub")}</p>
      <div className="auth-tabs">
        <button type="button" className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>{t("auth.tabRegister")}</button>
        <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>{t("auth.tabLogin")}</button>
      </div>
      <button className="google-button" onClick={google} disabled={busy}><GoogleLogo />{mode === "register" ? t("auth.googleRegister") : t("auth.googleLogin")}</button>
      <div className="auth-divider"><span>{t("auth.or")}</span></div>
      <form onSubmit={submit}>
        {mode === "register" && <div className="name-row">
          <label>{t("auth.first")}<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" /></label>
          <label>{t("auth.last")}<input value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" /></label>
        </div>}
        <label><span><Mail />{t("auth.email")}</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder={t("auth.emailPh")} /></label>
        <label><span><LockKeyhole />{t("auth.password")}</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder={t("auth.passwordPh")} /></label>
        {error && <div className="auth-error"><AlertCircle />{error}</div>}
        <button className="primary" type="submit" disabled={busy}>{busy ? t("auth.busy") : mode === "register" ? t("auth.submitRegister") : t("auth.submitLogin")}<ArrowRight /></button>
      </form>
      <p className="auth-legal">{t("auth.legalBefore")}<Link to="/kullanim-sartlari">{t("footer.terms")}</Link>{t("auth.legalMiddle")}<Link to="/gizlilik">{t("footer.privacy")}</Link>{t("auth.legalAfter")}</p>
      </>)}
    </div>
  </section>;
}

function SubscriptionPage({ user, profile, onSaveForUser }: { user: User | null; profile: MemberProfile | null; onSaveForUser: (user: User, profile: MemberProfile) => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const [checkoutUser, setCheckoutUser] = useState<User | null>(null);
  const [checkoutFirstName, setCheckoutFirstName] = useState("");
  const [checkoutLastName, setCheckoutLastName] = useState("");
  const [checkoutGmail, setCheckoutGmail] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const { t, lang } = useI18n();
  const [localizedPrices, setLocalizedPrices] = useState<Partial<Record<PlanId, string>>>({});
  const planCatalog = localizedPlans(t, localizedPrices);
  const languageCount = String(conversationLanguages.length);
  useReveal();
  useEffect(() => {
    let active = true;
    void getLocalizedPlanPrices().then((prices) => { if (active) setLocalizedPrices(prices); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!checkoutPlan) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setCheckoutPlan(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [checkoutPlan, busy]);

  const requestCheckoutDetails = (plan: PlanId, activeUser: User) => {
    const saved = readProfile(activeUser) || defaultProfile(activeUser);
    setCheckoutUser(activeUser);
    setCheckoutPlan(plan);
    setCheckoutFirstName(saved.firstName);
    setCheckoutLastName(saved.lastName);
    setCheckoutGmail(activeUser.email || "");
    setCheckoutError("");
  };

  const submitCheckoutDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!checkoutPlan || !checkoutUser) return;
    const firstName = checkoutFirstName.trim();
    const lastName = checkoutLastName.trim();
    const gmail = checkoutGmail.trim().toLowerCase();
    if (!firstName || !lastName) {
      setCheckoutError(t("sub.checkoutNameRequired"));
      return;
    }
    if (!isGmailAddress(gmail)) {
      setCheckoutError(t("sub.checkoutGmailInvalid"));
      return;
    }
    setCheckoutError("");
    setBusy(checkoutPlan);
    try {
      const saved = readProfile(checkoutUser) || defaultProfile(checkoutUser);
      onSaveForUser(checkoutUser, { ...saved, firstName, lastName, completed: true });
      await startCheckout({
        planId: checkoutPlan,
        uid: checkoutUser.uid,
        email: gmail,
        firstName,
        lastName,
        locale: lang,
      });
      setCheckoutPlan(null);
    } catch (requestError) {
      setCheckoutError(requestError instanceof BillingError ? t(requestError.translationKey as never) : t("billing.failed"));
    } finally {
      setBusy(null);
    }
  };

  const choose = async (plan: PlanId) => {
    setError("");
    setBusy(plan);
    try {
      let activeUser = user;
      if (!activeUser) {
        const result = await loginGoogle();
        activeUser = result.user;
        onSaveForUser(result.user, { ...(readProfile(result.user) || defaultProfile(result.user)) });
      }
      // Ödeme sağlayıcısı bağlıysa ücretli planlar gerçek checkout'a gider;
      // plan, ödeme onaylanınca webhook üzerinden sunucuya yazılır.
      if (plan !== "free" && billingProvider() !== "none") {
        requestCheckoutDetails(plan, activeUser);
        setBusy(null);
        return;
      }
      const next = { ...(readProfile(activeUser) || defaultProfile(activeUser)), plan };
      onSaveForUser(activeUser, next);
      navigate(next.completed ? "/profil" : "/profil?welcome=1");
    } catch (requestError) {
      setError(requestError instanceof BillingError ? t(requestError.translationKey as never) : t("billing.failed"));
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="pricing">
      <div className="pricing-head reveal">
        <span className="eyebrow"><Crown /> {t("sub.eyebrow")}</span>
        <h1>{t("sub.h1a")}<em>{t("sub.h1em")}</em>{t("sub.h1b")}</h1>
        <p>{t("sub.sub")}</p>
      </div>

      <div className="pricing-assure reveal">
        <span><ShieldCheck />{t("sub.assure1")}</span>
        <span><CheckCircle2 />{t("sub.assure2")}</span>
        <span><Lock />{t("sub.assure3")}</span>
        <span><CheckCircle2 />{t("sub.assure4")}</span>
      </div>

      {checkoutPlan && checkoutUser && (
        <div className="checkout-details-backdrop" role="presentation">
          <section className="checkout-details-card" role="dialog" aria-modal="true" aria-labelledby="checkout-details-title">
            <button
              className="checkout-details-close"
              type="button"
              aria-label={t("sub.checkoutClose")}
              disabled={Boolean(busy)}
              onClick={() => setCheckoutPlan(null)}
            >
              <X />
            </button>
            <div className="checkout-details-brand"><ShieldCheck /></div>
            <span className="checkout-details-eyebrow"><Lock /> {t("sub.checkoutEyebrow")}</span>
            <h2 id="checkout-details-title">{t("sub.checkoutTitle")}</h2>
            <p className="checkout-details-intro">{t("sub.checkoutIntro", { plan: planCatalog.find((plan) => plan.id === checkoutPlan)?.name || "" })}</p>
            <div className="checkout-details-trust">
              <span><ShieldCheck />{t("sub.checkoutTrust1")}</span>
              <span><CheckCircle2 />{t("sub.checkoutTrust2")}</span>
              <span><Lock />{t("sub.checkoutTrust3")}</span>
            </div>
            <form className="checkout-details-form" onSubmit={submitCheckoutDetails}>
              <label>
                <span>{t("auth.first")}</span>
                <input value={checkoutFirstName} onChange={(event) => setCheckoutFirstName(event.target.value)} required autoComplete="given-name" />
              </label>
              <label>
                <span>{t("auth.last")}</span>
                <input value={checkoutLastName} onChange={(event) => setCheckoutLastName(event.target.value)} required autoComplete="family-name" />
              </label>
              <label className="checkout-details-email">
                <span><Mail />{t("sub.checkoutGmail")}</span>
                <input type="email" value={checkoutGmail} onChange={(event) => setCheckoutGmail(event.target.value)} required autoComplete="email" inputMode="email" placeholder="ornek@gmail.com" />
              </label>
              {checkoutError && <div className="checkout-details-error" role="alert"><AlertCircle />{checkoutError}</div>}
              <p className="checkout-details-privacy">{t("sub.checkoutPrivacy")}</p>
              <div className="checkout-details-actions">
                <button className="ghost" type="button" disabled={Boolean(busy)} onClick={() => setCheckoutPlan(null)}>{t("sub.checkoutCancel")}</button>
                <button className="primary" type="submit" disabled={Boolean(busy)}>
                  <Lock />{busy ? t("sub.processing") : t("sub.checkoutContinue")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <div className="pricing-grid">
        {planCatalog.map((plan) => {
          const current = profile?.plan === plan.id;
          return (
            <article key={plan.id} className={`pricing-card reveal ${plan.highlight ? "featured" : ""}`}>
              {plan.highlight && <b className="pricing-badge">{t("sub.popular")}</b>}
              <h2>{plan.name}</h2>
              <p className="note">{plan.note}</p>
              <div className="pricing-amount"><b>{plan.price}</b><span>{plan.period}</span></div>
              <ul>{plan.features.map((feature) => <li key={feature}><CheckCircle2 />{feature}</li>)}</ul>
              {current ? (
                <button className="pricing-cta current" type="button" disabled>{t("sub.current")}</button>
              ) : user ? (
                <button className="primary pricing-cta" type="button" disabled={busy === plan.id} onClick={() => choose(plan.id)}>
                  {busy === plan.id ? t("sub.processing") : plan.id === "free" ? t("sub.freeCta") : t("sub.switchTo", { plan: plan.name })}
                </button>
              ) : (
                <button className="google-button" type="button" disabled={busy === plan.id} onClick={() => choose(plan.id)}>
                  <GoogleLogo />{busy === plan.id ? t("sub.connecting") : t("sub.googleStart")}
                </button>
              )}
            </article>
          );
        })}
        <article className="pricing-card contact-plan reveal">
          <b className="pricing-badge custom">{contactCopy[lang].customBadge}</b>
          <h2>{contactCopy[lang].customTitle}</h2>
          <p className="note">{contactCopy[lang].customNote}</p>
          <div className="pricing-amount"><b>{contactCopy[lang].customPrice}</b></div>
          <ul>
            {contactCopy[lang].customFeatures.map((feature) => <li key={feature}><CheckCircle2 />{feature}</li>)}
          </ul>
          <Link className="primary pricing-cta" to="/iletisim"><Mail />{contactCopy[lang].customCta}</Link>
        </article>
      </div>

      <p className="localized-price-note reveal"><Globe2 /> {contactCopy[lang].localizedPrice}</p>

      {error && <p className="pricing-note" style={{ color: "var(--coral)" }}>{error}</p>}

      <div className="compare reveal">
        <h3>{t("sub.compareTitle")}</h3>
        <table>
          <thead>
            <tr>
              <th>{t("sub.colFeature")}</th>
              <th>{planCatalog[0].name}</th>
              <th className="col-pro">{planCatalog[1].name}</th>
              <th>{planCatalog[2].name}</th>
            </tr>
          </thead>
          <tbody>
            {[
              // Dil sayısı elle yazılmaz; conversationLanguages tek kaynaktır.
              [t("sub.r1"), "✓", "✓", "✓"],
              [t("sub.r2"), "✓", "✓", "✓"],
              [t("sub.r3"), languageCount, languageCount, languageCount],
              [t("sub.r4"), "3 + 3 min", "100 min", "250 min"],
              [t("sub.r5"), "✓", "✓", "✓"],
              [t("sub.r6"), "—", "✓", "✓"],
              [t("sub.r7"), "—", "—", "✓"],
              [t("sub.r8"), "—", "—", "✓"],
              [t("sub.r9"), "—", t("sub.emailSupport"), t("sub.prioritySupport")],
              [t("sub.r10"), "—", "✓", "✓"],
            ].map(([label, free, pro, team]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{free === "✓" ? <CheckCircle2 /> : free}</td>
                <td className="col-pro">{pro === "✓" ? <CheckCircle2 /> : pro}</td>
                <td>{team === "✓" ? <CheckCircle2 /> : team}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="pricing-note reveal">
        {billingProvider() === "none"
          ? <>{t("sub.noteNoneA")}<b>{t("sub.noteNoneB")}</b>{t("sub.noteNoneC")}</>
          : <>{t("sub.notePaidA")}<b>Paddle</b>{t("sub.notePaidB")}<Link to="/iade-politikasi">{t("sub.notePaidLink")}</Link>{t("sub.notePaidC")}</>}
      </p>

      <div className="pricing-faq reveal">
        <h3>{t("sub.faqTitle")}</h3>
        <details><summary>{t("sub.faq1q")}</summary><p>{t("sub.faq1a")}</p></details>
        <details><summary>{t("sub.faq2q")}</summary><p>{t("sub.faq2a")}</p></details>
        <details><summary>{t("sub.faq3q")}</summary><p>{t("sub.faq3a")}</p></details>
        <details><summary>{t("sub.faq4q")}</summary><p>{t("sub.faq4a", { count: conversationLanguages.length })}</p></details>
      </div>
    </section>
  );
}

function ProfilePage({ user, profile, onSave, onSaveForUser }: { user: User | null; profile: MemberProfile | null; onSave: (profile: MemberProfile) => void; onSaveForUser: (user: User, profile: MemberProfile) => void }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const planCatalog = localizedPlans(t);
  const initial = user ? (profile || defaultProfile(user)) : null;
  const [firstName, setFirstName] = useState(initial?.firstName || "");
  const [lastName, setLastName] = useState(initial?.lastName || "");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!user) return;
    const next = profile || defaultProfile(user);
    setFirstName(next.firstName);
    setLastName(next.lastName);
  }, [user, profile]);
  const google = async () => {
    try {
      const result = await loginGoogle();
      const next = readProfile(result.user) || defaultProfile(result.user);
      onSaveForUser(result.user, next);
      navigate(next.completed ? "/uygulama" : "/profil?welcome=1");
    } catch { alert(t("auth.error")); }
  };
  if (!user || !initial) {
    return (
      <section className="auth-split">
        <div className="auth-pitch">
          <span className="eyebrow"><UserCircle /> {t("prof.eyebrow")}</span>
          <h1>{t("prof.gateH1")}</h1>
          <p>{t("prof.gateSub")}</p>
          <div className="auth-benefits">
            <span><CheckCircle2 />{t("prof.gateB1")}</span>
            <span><CheckCircle2 />{t("prof.gateB2")}</span>
            <span><CheckCircle2 />{t("auth.b4")}</span>
          </div>
        </div>
        <div className="auth-card">
          <h2>{t("prof.gateCard")}</h2>
          <p>{t("prof.gateCardSub")}</p>
          <button className="google-button" onClick={() => void google()}><GoogleLogo />{t("prof.gateGoogle")}</button>
          <div className="auth-divider"><span>{t("prof.or")}</span></div>
          <Link className="ghost" to="/kayit" style={{ width: "100%", justifyContent: "center", height: 52 }}><LogIn />{t("prof.gateEmail")}</Link>
        </div>
      </section>
    );
  }
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const next = { ...initial, firstName: firstName.trim(), lastName: lastName.trim(), completed: true };
    if (!next.firstName || !next.lastName) return;
    onSave(next);
    setSaved(true);
    window.setTimeout(() => navigate("/uygulama"), 450);
  };
  const currentPlan = planCatalog.find((plan) => plan.id === initial.plan) || planCatalog[0];
  const initials = `${firstName || user.email || "D"}`.trim().charAt(0).toUpperCase();
  return (
    <section className="dash">
      <div className="dash-head">
        <span className="dash-avatar">{initials}</span>
        <div>
          <h1>{initial.completed ? t("prof.hello", { name: firstName || t("prof.welcome") }) : t("prof.completeTitle")}</h1>
          <p>{user.email}</p>
        </div>
        <span className={`plan-badge ${initial.plan}`}>
          {initial.plan === "free" ? <Sparkles /> : <Crown />}
          {currentPlan.name.toUpperCase()}
        </span>
      </div>

      <div className="dash-grid">
        <form className="dash-card" onSubmit={save}>
          <h2>{t("prof.accountTitle")}</h2>
          <p className="big">{t("prof.accountBig")}</p>
          <label>{t("auth.first")}<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" /></label>
          <label>{t("auth.last")}<input value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" /></label>
          <label>{t("auth.email")}<input value={user.email || ""} disabled /></label>
          <div className="dash-actions">
            <button className="primary" type="submit"><CheckCircle2 />{saved ? t("prof.saved") : t("prof.save")}</button>
          </div>
        </form>

        <div className="dash-card">
          <h2>{t("prof.subTitle")}</h2>
          <p className="big">{currentPlan.name} · {currentPlan.price}</p>
          <div className="trust-list" style={{ marginBottom: 18 }}>
            {currentPlan.features.slice(0, 4).map((feature) => (
              <span key={feature}><CheckCircle2 />{feature}</span>
            ))}
          </div>
          <div className="dash-actions">
            <Link className="primary" to="/abonelik"><CreditCard />{initial.plan === "free" ? t("prof.upgrade") : t("prof.manage")}</Link>
          </div>
        </div>

        <div className="dash-card">
          <h2>{t("prof.quickTitle")}</h2>
          <p className="big">{t("prof.quickBig")}</p>
          <div className="trust-list" style={{ marginBottom: 18 }}>
            <span><Radio />{t("prof.quick1")}</span>
            <span><Bot />{t("prof.quick2")}</span>
          </div>
          <div className="dash-actions">
            <Link className="primary" to="/uygulama"><Mic />{t("prof.openLive")}</Link>
            <Link className="ghost" to="/deneme"><Bot />{t("prof.openAi")}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function useReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.seen)"));
    if (!nodes.length) return;
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("seen"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).classList.add("seen");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    nodes.forEach((node, index) => { node.style.transitionDelay = `${Math.min(index, 5) * 60}ms`; observer.observe(node); });
    return () => observer.disconnect();
  }, []);
}
function Home() {
  useReveal();
  const { t } = useI18n();
  const marquee = conversationLanguages.map((language) => `${language.flag} ${language.display || language.name}`);
  return (
    <div className="home">
      {/* ---------- HERO ---------- */}
      <section className="hero">
        <div>
          <span className="eyebrow"><Sparkles /> {t("hero.eyebrow")}</span>
          <h1>
            {t("hero.title1")}
            <br />
            <span>{t("hero.title2")}</span>
          </h1>
          <p>{t("hero.sub")}</p>
          <div className="hero-actions">
            <Link className="primary large" to="/uygulama">
              {t("cta.start")}
              <ArrowRight />
            </Link>
            <Link className="ghost" to="/deneme">
              <Bot />
              {t("hero.tryai")}
            </Link>
          </div>
          <div className="trust">
            <span><Radio />{t("trust.1")}</span>
            <span><ShieldCheck />{t("trust.2")}</span>
            <span><Users />{t("trust.3")}</span>
            <span><WifiOff />{t("trust.4")}</span>
          </div>
        </div>
        <HeroScene />
      </section>

      {/* ---------- DİLLER ŞERİDİ ---------- */}
      <section className="langs-band reveal">
        <h2>{t("band.title", { count: conversationLanguages.length })}</h2>
        <div className="langs-track">
          {[...marquee, ...marquee].map((name, index) => (
            <span key={`${name}-${index}`}><i />{name}</span>
          ))}
        </div>
      </section>

      {/* ---------- NASIL ÇALIŞIR ---------- */}
      <section className="band reveal">
        <div className="section-head">
          <span className="eyebrow"><Zap /> {t("steps.eyebrow")}</span>
          <h2>{t("steps.title")}</h2>
          <p>{t("steps.sub")}</p>
        </div>
        <div className="steps">
          {[
            ["01", t("step.1")],
            ["02", t("step.2")],
            ["03", t("step.3")],
            ["04", t("step.4")],
          ].map(([n, text], index) => (
            <Link key={n} to={index < 3 ? "/uygulama" : "/ozellikler"}>
              <b>{n}</b>
              <h3>{text}</h3>
              <ArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- BENTO ÖZELLİKLER ---------- */}
      <section className="reveal">
        <div className="section-head">
          <span className="eyebrow"><Star /> {t("why.kicker")}</span>
          <h2>{t("why.title")}</h2>
          <p>{t("why.sub")}</p>
        </div>
        <div className="bento">
          <article className="wide">
            <Gauge className="bento-ico" />
            <h3>{t("f1.t")}</h3>
            <p>{t("b1.p")}</p>
            <div className="bento-demo">
              <div className="row"><b>Türkçe</b> Yarınki toplantı saat kaçta?</div>
              <div className="bar"><i /></div>
              <div className="row"><b>English</b> What time is tomorrow&apos;s meeting?</div>
            </div>
          </article>
          <article className="tall">
            <Headphones className="bento-ico" />
            <h3>{t("b2.t")}</h3>
            <p>{t("b2.p")}</p>
          </article>
          <article>
            <MessagesSquare className="bento-ico" />
            <h3>{t("f2.t")}</h3>
            <p>{t("b3.p")}</p>
          </article>
          <article>
            <Bot className="bento-ico" />
            <h3>{t("b4.t")}</h3>
            <p>{t("b4.p")}</p>
          </article>
          <article className="wide">
            <Lock className="bento-ico" />
            <h3>{t("b5.t")}</h3>
            <p>{t("b5.p")}</p>
          </article>
          <article>
            <Languages className="bento-ico" />
            <h3>{t("b6.t", { count: conversationLanguages.length })}</h3>
            <p>{t("b6.p", { count: conversationLanguages.length })}</p>
          </article>
        </div>
      </section>

      {/* ---------- KULLANIM ALANLARI ---------- */}
      <section className="reveal">
        <div className="section-head">
          <span className="eyebrow"><Globe2 /> {t("uc.kicker")}</span>
          <h2>{t("uc.title")}</h2>
          <p>{t("uc.p")}</p>
        </div>
        <div className="usecases">
          <article><Plane /><b>{t("uc1.t")}</b><p>{t("uc1.p")}</p></article>
          <article><Briefcase /><b>{t("uc2.t")}</b><p>{t("uc2.p")}</p></article>
          <article><GraduationCap /><b>{t("uc3.t")}</b><p>{t("uc3.p")}</p></article>
          <article><Heart /><b>{t("uc4.t")}</b><p>{t("uc4.p")}</p></article>
        </div>
      </section>

      {/* ---------- GÜVEN ---------- */}
      <section className="reveal">
        <div className="trust-panel">
          <div>
            <h2>{t("privacy.title")}</h2>
            <p>{t("privacy.text")}</p>
            <Link className="ghost" to="/gizlilik">{t("privacy.link")} <ArrowRight /></Link>
          </div>
          <div className="trust-list">
            <span><ShieldCheck />{t("tl.1")}</span>
            <span><ShieldCheck />{t("tl.2")}</span>
            <span><ShieldCheck />{t("tl.3")}</span>
            <span><ShieldCheck />{t("tl.4")}</span>
            <span><ShieldCheck />{t("tl.5")}</span>
          </div>
        </div>
      </section>

      <HomeExpansion />

      {/* ---------- KAPANIŞ ---------- */}
      <section className="final-cta reveal">
        <h2>{t("cta.title")}</h2>
        <p>{t("cta.p")}</p>
        <Link className="primary large" to="/uygulama">{t("cta.open")}<ArrowRight /></Link>
      </section>
    </div>
  );
}

// Sayaç yalnızca ekran gerçekten açıkken işlesin diye sekme görünürlüğünü izler.
function useVisible() {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return visible;
}
// Ücretsiz planda AI ve canlı oda hakları birbirinden bağımsız üçer dakikadır.
function AiPracticePage({ user, profile, authChecked }: { user: User | null; profile: MemberProfile | null; authChecked: boolean }) {
  const visible = useVisible();
  const [conversing, setConversing] = useState(false);
  const access = useAccess({
    uid: user?.uid || "anon",
    plan: profile?.plan || "free",
    feature: "ai",
    active: visible && conversing,
    ready: authChecked,
  });
  return (
    <AccessGate state={access.state} remaining={access.remaining} variant="ai" registered={Boolean(user)} paused={!conversing}>
      <AiPractice onConversingChange={setConversing} />
    </AccessGate>
  );
}
function LiveTranslation({ user, profile, authChecked }: { user: User | null; profile: MemberProfile | null; authChecked: boolean }) {
  const visible = useVisible();
  // /oda/:id ile /uygulama aynı bileşeni kullanır; key olmadan React odadan
  // çıkışta bileşeni söküp yeniden kurmaz ve oda bağlantısı ile mikrofon
  // lobide açık kalır. key, ayrılınca tam temizlik garantisi verir.
  const { roomId } = useParams();
  // Dakika yalnızca oda SAHİBİNDEN düşer: davet edilen misafir ne süre yakar
  // ne de süre duvarına takılır. Kayıt şartı (anonymous) misafir için de geçerli.
  const isGuest = Boolean(roomId) && new URLSearchParams(location.search).get("role") !== "host";
  // Sayaç yalnızca gerçekten konuşulurken işler. Odayı açıp karşı tarafı
  // beklemek, bağlantı kurulmadan durmak veya sekmeyi arka plana almak
  // kullanıcının hakkını yakmaz.
  const [conversing, setConversing] = useState(false);
  const access = useAccess({
    uid: user?.uid || null,
    plan: profile?.plan || "free",
    feature: "live",
    active: visible && conversing && !isGuest,
    ready: authChecked,
  });
  // Misafir süre duvarını hiç görmez; kayıtlı olduğu sürece sınırsız katılır.
  const gateState = isGuest && (access.state === "trial" || access.state === "expired") ? "subscribed" : access.state;
  return (
    <AccessGate state={gateState} remaining={access.remaining} paused={!conversing}>
      <Translator key={roomId || "lobby"} onConversingChange={setConversing} />
    </AccessGate>
  );
}
// Konuşma parçalarını birleştirme ayarları: tanıyıcıdan gelen parçalar
// SPEECH_BUFFER_MS boyunca beklenip tek çeviriye toplanır; konuşmacı susup
// SPEECH_MERGE_WINDOW_MS içinde devam ederse son baloncuk düzenlenir.
const SPEECH_BUFFER_MS = 1100;
const SPEECH_BUFFER_MAX_CHARS = 500;
const SPEECH_MERGE_WINDOW_MS = 7000;

function Translator({ onConversingChange }: { onConversingChange?: (value: boolean) => void } = {}) {
  const { t } = useI18n();
  // Oda geri çağrıları useCallback([]) ile sabit kimlikte tutulur; dil
  // değişince bağlantı yeniden kurulmasın diye çeviriciyi ref'ten okuyoruz.
  const tRef = useRef(t);
  tRef.current = t;
  const navigate = useNavigate();
  const { roomId } = useParams();
  // Kaynak dil ilk girişte tarayıcının dilinden gelir; kullanıcının seçimi
  // cihazda saklanır. Hedef dil karşı taraf odaya girince onunkine kilitlenir.
  const [source, setSource] = useState(() => {
    try {
      const saved = localStorage.getItem("dilmac-source-lang");
      if (saved && languageByCode(saved)) return saved;
    } catch { /* gizli mod */ }
    return detectConversationLanguage().code;
  }),
    [target, setTarget] = useState(() => {
      const mine = (() => {
        try { return localStorage.getItem("dilmac-source-lang"); } catch { return null; }
      })() || detectConversationLanguage().code;
      // Varsayılan hedef: kullanıcının dili İngilizce değilse İngilizce,
      // İngilizceyse Türkçe — kendi diline çeviri anlamsız.
      return mine.startsWith("en") ? "Turkish" : "English";
    }),
    [localMessages, setLocalMessages] = useState<QueueItem[]>([]),
    [remoteMessages, setRemoteMessages] = useState<RoomMessage[]>([]),
    [room, setRoom] = useState(""),
    [active, setActive] = useState(""),
    [key] = useState(sessionStorage.getItem("dilmac-key") || "backend"),
    [notice, setNotice] = useState(() => t("notice.ready")),
    [role, setRole] = useState<"host" | "guest" | null>(null),
    [draft, setDraft] = useState(""),
    [remoteMuted, setRemoteMuted] = useState(false),
    [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [remoteLanguage, setRemoteLanguage] = useState<RoomLanguage | null>(null);
  const [joined, setJoined] = useState(false);
  // Oto ses girişte kapalı: odaya girer girmez karşı tarafın GERÇEK sesi
  // otomatik bağlandığı için çeviri sesi ancak istenirse açılır.
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem("dilmac-autospeak") === "1");
  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;
  const speechRef = useRef<{ listening: boolean; stop: () => void; toggle: () => void } | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const keyRef = useRef(key);
  keyRef.current = key;
  const sendRef = useRef<(message: RoomMessage) => boolean>(() => false);
  const queueRef = useRef<MessageQueue | null>(null);
  if (!queueRef.current) queueRef.current = new MessageQueue((text, language) => translate(text, language, keyRef.current), (message) => sendRef.current(message));
  // Karşı mesajların bilinen son çevirisi: aynı kimlikle gelen paket yeni mi,
  // güncelleme mi, yoksa yeniden gönderim mi burada anlaşılır.
  const remoteSeenRef = useRef(new Map<string, string>());
  const lastRemoteAtRef = useRef(0);
  const receiveMessage = useCallback((message: RoomMessage) => {
    if (!message.source.trim() || !message.translated.trim()) return;
    const previousTranslated = remoteSeenRef.current.get(message.id);
    const isDuplicate = previousTranslated === message.translated;
    const isUpdate = previousTranslated !== undefined && !isDuplicate;
    remoteSeenRef.current.set(message.id, message.translated);
    // Yeniden bağlanma sonrası aynı içerikle tekrar gelen mesaj: sessiz geç.
    if (isDuplicate) return;
    lastRemoteAtRef.current = Date.now();
    // Karşı tarafın mesajı geldi. Bekletilen tanıma bu mesajın hoparlör
    // yankısı mı? İçerik karşılaştırmasıyla karar verilir: yankı, karşı
    // tarafın söyledikleriyle büyük ölçüde aynı kelimeleri içerir. Benzerlik
    // düşükse bu kullanıcının GERÇEK eş zamanlı sözüdür ve silinmez;
    // karşı taraf susunca kendiliğinden gönderilir.
    const pending = suppressedRef.current;
    if (pending && Date.now() - pending.at < 8000) {
      const tokenize = (value: string) => value.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter((word) => word.length > 2);
      const mineWords = tokenize(pending.text);
      const theirs = new Set([...tokenize(message.source), ...tokenize(message.translated)]);
      const overlap = mineWords.length ? mineWords.filter((word) => theirs.has(word)).length / mineWords.length : 1;
      if (overlap >= 0.5) suppressedRef.current = null;
    }
    setRemoteMessages((current) => {
      const index = current.findIndex((item) => item.id === message.id);
      if (index === -1) return [...current, message];
      const next = [...current];
      next[index] = message;
      return next;
    });
    setNotice(tRef.current("notice.newTranslation"));
    if (!autoSpeakRef.current) return;
    // Güncellenen mesajda yalnızca yeni eklenen parça seslendirilir; tamamını
    // tekrar okumak aynı cümleyi iki kez duyurur.
    const speechText = isUpdate ? (message.appended || "").trim() : message.translated;
    if (!speechText) return;
    const code = speechCodeFor(message.targetLanguage);
    // Seslendirme sırasında kendi mikrofonumuz açık kalırsa hoparlörden çıkan ses
    // tekrar yazıya dökülüp karşı tarafa geri gönderilir (yankı döngüsü).
    // Bu yüzden dinlemeyi duraklatıp seslendirme bitince geri açıyoruz.
    const wasListening = Boolean(speechRef.current?.listening);
    if (wasListening) speechRef.current?.stop();
    const resume = () => {
      if (!wasListening) return;
      window.setTimeout(() => {
        if (isSpeechQueueBusy()) return;
        if (!speechRef.current?.listening) speechRef.current?.toggle();
      }, 350);
    };
    // iOS mikrofon oturumunu anında bırakmaz. Dinleme kapandıktan hemen sonra
    // konuşmaya başlarsak sistem sesi sessizce yutuyor; telefonda "çeviri
    // geliyor ama ses yok" şikayetinin sebebi buydu. Mikrofon açıkken
    // seslendirmeyi oturum kapanana kadar geciktiriyoruz.
    const isAppleWebKit = /iP(?:hone|ad|od)/i.test(navigator.userAgent) && /AppleWebKit/i.test(navigator.userAgent);
    const handoverDelay = wasListening ? (isAppleWebKit ? 550 : 200) : 0;
    if (handoverDelay === 0) {
      queueSpeech(speechText, code, { onEnd: resume, onError: resume });
      return;
    }
    window.setTimeout(() => queueSpeech(speechText, code, { onEnd: resume, onError: resume }), handoverDelay);
  }, []);
  const receiveRemoteLanguage = useCallback((language: RoomLanguage) => {
    setRemoteLanguage(language);
    const known = languageByCode(language.code) || languageByName(language.name);
    setTarget(known?.api || language.name);
    setNotice(tRef.current("notice.peerLanguage", { language: known?.name || language.name }));
  }, []);
  const markDelivered = useCallback((id: string) => queueRef.current?.markDelivered(id), []);
  const roomConnection = useRoom(receiveMessage, markDelivered, receiveRemoteLanguage);
  sendRef.current = roomConnection.send;
  const sendLanguage = roomConnection.sendLanguage;
  useEffect(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    const stream = roomConnection.remoteStream;
    audio.srcObject = stream;
    setPlaybackBlocked(false);
    if (stream) {
      void audio.play().catch(() => setPlaybackBlocked(true));
    } else {
      audio.pause();
    }
    return () => {
      if (audio.srcObject === stream) {
        audio.pause();
        audio.srcObject = null;
      }
    };
  }, [roomConnection.remoteStream]);
  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.muted = remoteMuted;
  }, [remoteMuted]);
  useEffect(() => {
    if (roomConnection.voiceConnected) {
      setNotice(tRef.current("notice.voiceReady"));
    }
  }, [roomConnection.voiceConnected]);
  useEffect(() => queueRef.current!.subscribe(setLocalMessages), []);
  useEffect(() => {
    const language = languageByCode(source);
    if (language) sendLanguage({ code: language.code, name: language.api });
  }, [sendLanguage, source]);
  const changeSourceLanguage = (code: string) => {
    try { localStorage.setItem("dilmac-source-lang", code); } catch { /* yoksay */ }
    setSource(code);
    const language = languageByCode(code);
    if (language) {
      sendLanguage({ code: language.code, name: language.api });
      setNotice(t("notice.sourceChanged", { language: language.name }));
    }
  };
  const connectRoom = roomConnection.join;
  useEffect(() => {
    const legacyRoom = new URLSearchParams(location.search).get("room")?.toUpperCase();
    if (!roomId && legacyRoom && /^[A-Z0-9]{6}$/.test(legacyRoom)) {
      navigate(`/oda/${legacyRoom}`, { replace: true });
      return;
    }
    const incoming = roomId?.toUpperCase();
    if (incoming && /^[A-Z0-9]{6}$/.test(incoming)) {
      setRemoteLanguage(null);
      setRemoteMessages([]);
      setRoom(incoming);
      setActive(incoming);
      const incomingRole = new URLSearchParams(location.search).get("role") === "host" ? "host" : "guest";
      setRole(incomingRole);
      if (incomingRole === "host") {
        setJoined(true);
        connectRoom(incoming, incomingRole);
        setNotice(tRef.current("notice.connecting", { room: incoming }));
      } else {
        setJoined(false);
        setNotice(tRef.current("lobby.joinText"));
      }
    }
  }, [connectRoom, navigate, roomId]);
  // Canlı ses açıkken iki cihaz birbirini hoparlörden duyar. Karşı taraf
  // konuşurken bizim tanıyıcımız o sesi KENDİ dilimizde çözmeye çalışır ve
  // ortaya hiç söylenmemiş cümleler çıkar; her uydurma cümle karşı tarafta
  // seslendirilince döngü büyür ve bir süre sonra sohbet tamamen saçmalar.
  // Bu yüzden karşı taraf konuşurken kendi tanıyıcı çıktımızı yok sayıyoruz.
  const remoteSpeakingRef = useRef(false);
  remoteSpeakingRef.current = roomConnection.remoteSpeaking;
  const voiceEnabledRef = useRef(false);
  voiceEnabledRef.current = roomConnection.voiceEnabled;
  // Bastırılan cümle ÇÖPE ATILMAZ, bekletilir. Karşı tarafın mesajı kısa
  // sürede gelirse bekleyen metin onun yankısıdır ve sessizce silinir; mesaj
  // gelmezse kullanıcı gerçekten aynı anda konuşmuştur ve cümlesi karşı
  // taraf susunca otomatik gönderilir. Böylece yankı engellenirken gerçek
  // eş zamanlı konuşma kaybolmaz.
  const suppressedRef = useRef<{ text: string; at: number } | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const enqueueRawRef = useRef<(text: string) => void>(() => {});
  // Yankı ile gerçek eş zamanlı konuşmayı ayıran ölçüt ZAMANLAMADIR:
  // hoparlör yankısı ancak karşı taraf konuşmaya BAŞLADIKTAN SONRA mikrofona
  // girebilir. Cümlemizin ilk ön izlemesi, karşı tarafın konuşma sinyalinden
  // ÖNCE başladıysa bu bizim gerçek sözümüzdür ve asla bekletilmez.
  const remoteSpeakingSinceRef = useRef(0);
  const utteranceStartRef = useRef(0);
  const enqueue = useCallback((text: string) => {
    if (voiceEnabledRef.current && remoteSpeakingRef.current) {
      // 250 ms pay: iki taraf hemen hemen aynı anda başladıysa sıralama ağ
      // gecikmesinin rastlantısıdır; gerçek yankının ön izlemesi karşı sesin
      // ulaşması + tanıma gecikmesi yüzünden en az yarım saniye geç başlar.
      const mineStartedFirst = utteranceStartRef.current > 0
        && remoteSpeakingSinceRef.current > 0
        && utteranceStartRef.current < remoteSpeakingSinceRef.current + 250;
      if (!mineStartedFirst) {
        suppressedRef.current = { text, at: Date.now() };
        logClientError("echo_suppressed", "speech", `Karşı taraf konuşurken gelen ${text.length} karakterlik tanıma bekletildi`, "warning");
        setNotice(tRef.current("notice.peerBusy"));
        return;
      }
      // Gerçek eş zamanlı konuşma: kaybetme, normal gönder.
    }
    queueRef.current?.enqueue(
      { source: text, sourceLanguage: languageByCode(source)?.api || source, targetLanguage: target },
      { mergeWindowMs: SPEECH_MERGE_WINDOW_MS, lastRemoteAt: lastRemoteAtRef.current },
    );
    setNotice(tRef.current("notice.queuedMsg"));
  }, [source, target]);
  enqueueRawRef.current = (text: string) => {
    queueRef.current?.enqueue(
      { source: text, sourceLanguage: languageByCode(source)?.api || source, targetLanguage: target },
      { mergeWindowMs: SPEECH_MERGE_WINDOW_MS, lastRemoteAt: lastRemoteAtRef.current },
    );
  };
  // Karşı taraf susunca: mesajı geldiyse bekleyen metin yankıdır, sil.
  // Mesaj gelmediyse kullanıcının gerçek cümlesidir, gönder.
  const remoteSpeakingNow = roomConnection.remoteSpeaking;
  useEffect(() => {
    if (remoteSpeakingNow) {
      if (flushTimerRef.current !== null) window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
      return;
    }
    if (!suppressedRef.current) return;
    flushTimerRef.current = window.setTimeout(() => {
      const pending = suppressedRef.current;
      suppressedRef.current = null;
      if (!pending) return;
      enqueueRawRef.current(pending.text);
      setNotice(tRef.current("notice.heldSent"));
    }, 2500);
    return () => {
      if (flushTimerRef.current !== null) window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    };
  }, [remoteSpeakingNow]);
  // Tanıyıcı "ıı", nefes ve kısa duraksamalarda cümleyi böler; her parçayı
  // ayrı çevirmek sohbeti 2-3 baloncuğa dağıtıyordu. Parçalar önce kısa bir
  // tampon süresinde birleştirilir, tek istekte çevrilir.
  const enqueueLatestRef = useRef(enqueue);
  enqueueLatestRef.current = enqueue;
  const [pendingSpeech, setPendingSpeech] = useState("");
  const pendingSpeechRef = useRef("");
  const pendingSpeechTimerRef = useRef<number | null>(null);
  const flushPendingSpeech = useCallback(() => {
    if (pendingSpeechTimerRef.current !== null) window.clearTimeout(pendingSpeechTimerRef.current);
    pendingSpeechTimerRef.current = null;
    const text = pendingSpeechRef.current.trim();
    pendingSpeechRef.current = "";
    setPendingSpeech("");
    if (text) enqueueLatestRef.current(text);
  }, []);
  const collectSpeech = useCallback((text: string) => {
    pendingSpeechRef.current = `${pendingSpeechRef.current} ${text}`.trim();
    setPendingSpeech(pendingSpeechRef.current);
    if (pendingSpeechTimerRef.current !== null) window.clearTimeout(pendingSpeechTimerRef.current);
    // Çok uzun monologda çeviri sonsuza kadar beklemesin.
    if (pendingSpeechRef.current.length >= SPEECH_BUFFER_MAX_CHARS) { flushPendingSpeech(); return; }
    pendingSpeechTimerRef.current = window.setTimeout(flushPendingSpeech, SPEECH_BUFFER_MS);
  }, [flushPendingSpeech]);
  const speech = useSpeech(source, collectSpeech);
  // Mikrofon kapanınca bekleyen metin hemen gönderilir.
  useEffect(() => {
    if (!speech.listening) flushPendingSpeech();
  }, [speech.listening, flushPendingSpeech]);
  // Cümlenin ilk ön izleme anını kaydet (yankı/gerçek söz ayrımı için).
  const prevInterimRef = useRef("");
  useEffect(() => {
    const has = speech.interimText.trim().length > 0;
    const had = prevInterimRef.current.trim().length > 0;
    if (has && !had) utteranceStartRef.current = Date.now();
    if (!has) utteranceStartRef.current = 0;
    prevInterimRef.current = speech.interimText;
  }, [speech.interimText]);
  useEffect(() => {
    if (roomConnection.remoteSpeaking) {
      if (!remoteSpeakingSinceRef.current) remoteSpeakingSinceRef.current = Date.now();
    } else {
      remoteSpeakingSinceRef.current = 0;
    }
  }, [roomConnection.remoteSpeaking]);
  // Konuşmaya başlar başlamaz karşı tarafa haber ver; o da bizim sesimizi
  // kendi mikrofonundan yakalayıp çevirmeye çalışmasın.
  const sendSpeaking = roomConnection.sendSpeaking;
  const speakingSignalRef = useRef(false);
  useEffect(() => {
    if (!roomConnection.voiceEnabled) return;
    const speaking = speech.listening && (speech.interimText.trim().length > 0 || pendingSpeech.length > 0);
    if (speaking === speakingSignalRef.current) return;
    speakingSignalRef.current = speaking;
    sendSpeaking(speaking);
  }, [speech.listening, speech.interimText, pendingSpeech, roomConnection.voiceEnabled, sendSpeaking]);
  useEffect(() => {
    if (!speech.listening && speakingSignalRef.current) {
      speakingSignalRef.current = false;
      sendSpeaking(false);
    }
  }, [speech.listening, sendSpeaking]);
  // Bağlantı kurulur kurulmaz canlı sesi otomatik aç: iki taraf da birbirini
  // hemen duysun. iOS'ta konuşma tanımayla mikrofon çakıştığı için orada
  // kullanıcı elle açmaya devam ediyor.
  const autoVoiceTriedRef = useRef(false);
  const enableVoiceRef = useRef(roomConnection.enableVoice);
  enableVoiceRef.current = roomConnection.enableVoice;
  useEffect(() => {
    if (!roomConnection.connected || roomConnection.voiceEnabled || autoVoiceTriedRef.current) return;
    const isAppleWebKit = /iP(?:hone|ad|od)/i.test(navigator.userAgent) && /AppleWebKit/i.test(navigator.userAgent);
    if (isAppleWebKit) return;
    autoVoiceTriedRef.current = true;
    void enableVoiceRef.current();
  }, [roomConnection.connected, roomConnection.voiceEnabled]);
  // "Konuşma başladı" = karşı taraf bağlı VE ya mikrofon açık ya da en az bir
  // cümle alışverişi olmuş. Deneme sayacı yalnızca bu koşulda ilerler.
  const localTranslationActive = localMessages.some((message) => message.status === "queued" || message.status === "translating");
  const conversing = roomConnection.connected
    && (speech.interimText.trim().length > 0 || pendingSpeech.length > 0 || localTranslationActive || roomConnection.remoteSpeaking);
  useEffect(() => { onConversingChange?.(conversing); }, [conversing, onConversingChange]);
  useEffect(() => () => onConversingChange?.(false), [onConversingChange]);
  speechRef.current = { listening: speech.listening, stop: speech.stop, toggle: speech.toggle };
  // Mobil tarayıcılar seslendirmeyi ilk kullanıcı dokunuşundan sonra oynatır.
  // Karşı taraf hiçbir düğmeye basmadan mesaj alabildiği için sayfadaki ilk
  // dokunuşta kilidi açıyoruz.
  useEffect(() => {
    const unlockOnce = () => unlockSpeechOutput();
    window.addEventListener("pointerdown", unlockOnce, { once: true });
    window.addEventListener("keydown", unlockOnce, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockOnce);
      window.removeEventListener("keydown", unlockOnce);
    };
  }, []);
  const createRoom = () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    navigate(`/oda/${code}?role=host`);
  };
  const inviteLink = active
    ? `${location.origin}${import.meta.env.BASE_URL}oda/${active}`
    : "";
  const join = () => {
    if (!/^[A-Z0-9]{6}$/.test(room.toUpperCase())) {
      setNotice(t("lobby.codeError"));
      return;
    }
    navigate(`/oda/${room.toUpperCase()}`);
  };
  const enterGuestRoom = () => {
    if (!active) return;
    setJoined(true);
    connectRoom(active, "guest");
    setNotice(t("notice.connecting", { room: active }));
  };
  const speak = (text: string, languageName?: string) => {
    speakText(text, speechCodeFor(languageName || ""));
  };
  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault();
    unlockSpeechOutput();
    const text = draft.trim();
    if (!text) return;
    enqueue(text);
    setDraft("");
  };
  const toggleVoice = async () => {
    if (roomConnection.voiceEnabled) {
      roomConnection.disableVoice();
      setNotice(t("notice.voiceOff"));
      return;
    }
    const enabled = await roomConnection.enableVoice();
    if (enabled) setNotice(t("notice.voiceWaiting"));
  };
  const toggleConversation = async () => {
    unlockSpeechOutput();
    if (speech.listening) {
      speech.toggle();
      return;
    }
    const isIOSWebKit = /iP(?:hone|ad|od)/i.test(navigator.userAgent) && /AppleWebKit/i.test(navigator.userAgent);
    if (!isIOSWebKit && !roomConnection.voiceEnabled) {
      const enabled = await roomConnection.enableVoice();
      if (!enabled) return;
    }
    if (isIOSWebKit && !roomConnection.voiceEnabled) {
      setNotice(t("notice.iosMic"));
    }
    speech.toggle();
  };
  const toggleRemotePlayback = async () => {
    const audio = remoteAudioRef.current;
    if (!audio || !roomConnection.voiceConnected) return;
    if (playbackBlocked || remoteMuted) {
      audio.muted = false;
      setRemoteMuted(false);
      try {
        await audio.play();
        setPlaybackBlocked(false);
      } catch {
        setPlaybackBlocked(true);
      }
      return;
    }
    audio.muted = true;
    setRemoteMuted(true);
  };
  const statusError = speech.error
    ? t("error.mic")
    : roomConnection.voiceError
      ? t("error.voice")
      : roomConnection.error
        ? t("error.room")
        : "";
  if (!roomId) return (
    <section className="room-lobby">
      <div className="lobby-hero">
        <div className="lobby-icon"><Languages /></div>
        <h1>{t("lobby.title")}</h1>
        <p>{t("lobby.sub")}</p>
      </div>
      <div className="lobby-actions">
        <article>
          <span>{t("lobby.newBadge")}</span>
          <h2>{t("lobby.newTitle")}</h2>
          <p>{t("lobby.newText")}</p>
          <button className="primary" onClick={createRoom}>{t("lobby.create")}<ArrowRight /></button>
        </article>
        <article>
          <span>{t("lobby.joinBadge")}</span>
          <h2>{t("lobby.joinTitle")}</h2>
          <p>{t("lobby.joinText")}</p>
          <label>{t("lobby.codeLabel")}
            <input value={room} maxLength={6} onChange={(event) => setRoom(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="A1B2C3" />
          </label>
          <button className="ghost" onClick={join}>{t("lobby.join")}<ArrowRight /></button>
        </article>
      </div>
      <div className="lobby-note"><ShieldCheck /> {t("lobby.note")}</div>
    </section>
  );
  if (role === "guest" && !joined) return (
    <section className="room-lobby guest-join">
      <div className="lobby-hero">
        <div className="lobby-icon"><Languages /></div>
        <h1>{t("lobby.joinTitle")}</h1>
        <p>{t("lobby.joinText")}</p>
      </div>
      <div className="guest-language-card">
        <LanguagePicker
          value={source}
          onChange={changeSourceLanguage}
          label={t("room.you")}
        />
        <button className="primary" type="button" onClick={enterGuestRoom}>
          {t("lobby.join")}<ArrowRight />
        </button>
      </div>
    </section>
  );
  return (
    <RoomScreen
      roomCode={active}
      inviteLink={inviteLink}
      connected={roomConnection.connected}
      connecting={roomConnection.connecting}
      peerLanguage={remoteLanguage ? (languageByName(remoteLanguage.name)?.display || languageByName(remoteLanguage.name)?.name || remoteLanguage.name) : null}
      localMessages={localMessages}
      remoteMessages={remoteMessages}
      sourceCode={source}
      onSourceChange={changeSourceLanguage}
      targetName={remoteLanguage?.name || ""}
      targetLocked
      listening={speech.listening}
      interimText={`${pendingSpeech} ${speech.interimText}`.trim()}
      onToggleMic={toggleConversation}
      micSupported={speech.supported}
      autoSpeak={autoSpeak}
      onToggleAutoSpeak={() => {
        unlockSpeechOutput();
        const next = !autoSpeak;
        if (next) speakText(t("room.autoOn"), source);
        else clearSpeechQueue();
        localStorage.setItem("dilmac-autospeak", next ? "1" : "0");
        setAutoSpeak(next);
      }}
      voiceEnabled={roomConnection.voiceEnabled}
      voiceConnected={roomConnection.voiceConnected}
      voiceConnecting={roomConnection.voiceConnecting}
      onToggleVoice={toggleVoice}
      remoteMuted={remoteMuted}
      onToggleRemoteAudio={toggleRemotePlayback}
      draft={draft}
      onDraftChange={setDraft}
      onSubmitDraft={submitDraft}
      onSpeak={(text, languageName) => { unlockSpeechOutput(); speak(text, languageName); }}
      onRetry={(id) => queueRef.current?.retry(id)}
      onLeave={() => navigate("/uygulama")}
      status={statusError || notice}
      statusIsError={Boolean(statusError)}
      audioSlot={<audio ref={remoteAudioRef} autoPlay playsInline aria-hidden="true" />}
    />
  );
}
// Bilgi/yasal sayfa içeriği sözlükten gelir. Bölüm sayısı burada sabittir;
// metinler info.<sayfa>.s<N>t / s<N>b anahtarlarından okunur.
const infoPages = {
  about: { key: "about", sections: 2 },
  how: { key: "how", sections: 4 },
  features: { key: "features", sections: 5 },
  privacy: { key: "privacy", sections: 3 },
  terms: { key: "terms", sections: 8 },
  refund: { key: "refund", sections: 4 },
} as const;

const contactCopy: Record<SiteLang, {
  nav: string;
  customBadge: string;
  customTitle: string;
  customNote: string;
  customPrice: string;
  customFeatures: string[];
  customCta: string;
  localizedPrice: string;
  eyebrow: string;
  title: string;
  intro: string;
  name: string;
  email: string;
  company: string;
  minutes: string;
  message: string;
  send: string;
  direct: string;
}> = {
  tr: {
    nav: "İletişim", customBadge: "ÖZEL PLAN", customTitle: "Kurumsal", customNote: "Daha yüksek kullanım veya size özel çözüm için", customPrice: "Teklif alın",
    customFeatures: ["İhtiyaca göre dakika", "Daha fazla ekip üyesi", "Özel destek ve kurulum"], customCta: "Bizimle iletişime geç",
    localizedPrice: "Paddle kesintisi fiyata dahildir. Ücretler USD olarak gösterilir; vergi ve kesin tutar ödeme ekranında doğrulanır.",
    eyebrow: "Size özel", title: "İhtiyacınızı anlatın, teklif hazırlayalım.", intro: "Daha fazla dakika, ekip kullanımı veya özel bir entegrasyon için bilgileri doldurun. E-posta uygulamanız hazır teklif metniyle açılır.",
    name: "Adınız", email: "E-posta", company: "Şirket / ekip", minutes: "Aylık tahmini dakika", message: "İhtiyacınız", send: "Teklif isteğini hazırla", direct: "Doğrudan e-posta",
  },
  en: {
    nav: "Contact", customBadge: "CUSTOM PLAN", customTitle: "Enterprise", customNote: "For higher usage or a solution tailored to you", customPrice: "Get a quote",
    customFeatures: ["Minutes tailored to your needs", "More team members", "Dedicated support and setup"], customCta: "Contact us",
    localizedPrice: "The Paddle fee is included. Prices are shown in USD; taxes and the exact total are confirmed at checkout.",
    eyebrow: "Made for you", title: "Tell us what you need and we’ll prepare a quote.", intro: "For more minutes, team usage, or a custom integration, fill in the details. Your email app opens with a ready-to-send request.",
    name: "Your name", email: "Email", company: "Company / team", minutes: "Estimated monthly minutes", message: "What you need", send: "Prepare quote request", direct: "Email directly",
  },
  de: {
    nav: "Kontakt", customBadge: "INDIVIDUELL", customTitle: "Enterprise", customNote: "Für mehr Nutzung oder eine maßgeschneiderte Lösung", customPrice: "Angebot anfragen",
    customFeatures: ["Minuten nach Bedarf", "Mehr Teammitglieder", "Persönlicher Support und Einrichtung"], customCta: "Kontakt aufnehmen",
    localizedPrice: "Die Paddle-Gebühr ist enthalten. Preise werden in USD angezeigt; Steuern und Endbetrag werden im Checkout bestätigt.",
    eyebrow: "Für dich", title: "Beschreibe deinen Bedarf – wir erstellen ein Angebot.", intro: "Für mehr Minuten, Teams oder eine individuelle Integration: Formular ausfüllen. Dein E-Mail-Programm öffnet eine fertige Anfrage.",
    name: "Name", email: "E-Mail", company: "Unternehmen / Team", minutes: "Geschätzte Minuten pro Monat", message: "Dein Bedarf", send: "Anfrage vorbereiten", direct: "Direkt per E-Mail",
  },
  fr: {
    nav: "Contact", customBadge: "SUR MESURE", customTitle: "Entreprise", customNote: "Pour un usage plus élevé ou une solution personnalisée", customPrice: "Demander un devis",
    customFeatures: ["Minutes selon vos besoins", "Plus de membres d’équipe", "Assistance et installation dédiées"], customCta: "Nous contacter",
    localizedPrice: "Les frais Paddle sont inclus. Les prix sont affichés en USD ; les taxes et le total exact sont confirmés au paiement.",
    eyebrow: "Sur mesure", title: "Décrivez votre besoin, nous préparerons un devis.", intro: "Pour plus de minutes, un usage en équipe ou une intégration dédiée, remplissez le formulaire. Votre messagerie s’ouvre avec une demande prête à envoyer.",
    name: "Votre nom", email: "E-mail", company: "Entreprise / équipe", minutes: "Minutes mensuelles estimées", message: "Votre besoin", send: "Préparer la demande", direct: "E-mail direct",
  },
  es: {
    nav: "Contacto", customBadge: "PLAN A MEDIDA", customTitle: "Empresa", customNote: "Para más uso o una solución personalizada", customPrice: "Pedir presupuesto",
    customFeatures: ["Minutos según tus necesidades", "Más miembros del equipo", "Soporte y configuración dedicados"], customCta: "Contáctanos",
    localizedPrice: "La comisión de Paddle está incluida. Los precios se muestran en USD; los impuestos y el total exacto se confirman al pagar.",
    eyebrow: "A tu medida", title: "Cuéntanos qué necesitas y prepararemos una propuesta.", intro: "Para más minutos, uso en equipo o una integración personalizada, completa los datos. Tu aplicación de correo se abrirá con una solicitud lista para enviar.",
    name: "Tu nombre", email: "Correo", company: "Empresa / equipo", minutes: "Minutos mensuales estimados", message: "Qué necesitas", send: "Preparar solicitud", direct: "Correo directo",
  },
};

type InfoPageKey = keyof typeof infoPages;

function ContactPage() {
  const { lang } = useI18n();
  const copy = contactCopy[lang];
  const [form, setForm] = useState({ name: "", email: "", company: "", minutes: "", message: "" });
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const subject = `TerraSpeak teklif isteği · ${form.company || form.name}`;
    const body = [
      `${copy.name}: ${form.name}`,
      `${copy.email}: ${form.email}`,
      `${copy.company}: ${form.company || "-"}`,
      `${copy.minutes}: ${form.minutes || "-"}`,
      "",
      `${copy.message}:`,
      form.message,
    ].join("\n");
    window.location.href = `mailto:yasdural@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  return (
    <section className="contact-page">
      <div className="contact-copy">
        <span className="eyebrow"><Mail /> {copy.eyebrow}</span>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
        <a className="ghost" href="mailto:yasdural@gmail.com"><Mail /> {copy.direct}: yasdural@gmail.com</a>
      </div>
      <form className="contact-form" onSubmit={submit}>
        <label>{copy.name}<input value={form.name} onChange={set("name")} required autoComplete="name" /></label>
        <label>{copy.email}<input type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></label>
        <label>{copy.company}<input value={form.company} onChange={set("company")} autoComplete="organization" /></label>
        <label>{copy.minutes}<input type="number" min="1" value={form.minutes} onChange={set("minutes")} inputMode="numeric" /></label>
        <label className="wide">{copy.message}<textarea value={form.message} onChange={set("message")} required rows={6} /></label>
        <button className="primary wide" type="submit"><Mail />{copy.send}</button>
      </form>
    </section>
  );
}
function Info({ page }: { page: InfoPageKey }) {
  const { t } = useI18n();
  const { key, sections } = infoPages[page];
  return (
    <section className="info">
      <h1>{t(`info.${key}.title` as never)}</h1>
      <p className="lead">{t(`info.${key}.intro` as never)}</p>
      {Array.from({ length: sections }, (_, index) => (
        <article key={index}>
          <h2>{t(`info.${key}.s${index + 1}t` as never)}</h2>
          <p>{t(`info.${key}.s${index + 1}b` as never)}</p>
        </article>
      ))}
    </section>
  );
}
function NotFound() {
  const { t } = useI18n();
  return (
    <section className="info">
      <h1>{t("nf.title")}</h1>
      <p>{t("nf.text")}</p>
      <Link className="primary" to="/">
        {t("nf.home")}
      </Link>
    </section>
  );
}
export function App() {
  const { t } = useI18n();
  // VITE_E2E yalnızca test derlemesinde 1 olur; üretim derlemesinde bu dal
  // ölü koddur ve paketten tamamen çıkar. Testlerde giriş ekranını atlamak
  // için sahte bir kullanıcı sağlar — sunucu tarafı plan doğrulamasını
  // etkilemez.
  const [user, setUser] = useState<User | null>(
    import.meta.env.VITE_E2E === "1"
      ? ({ uid: "e2e-test", email: "e2e@test.dev", displayName: "E2E Test" } as unknown as User)
      : null,
  );
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [dark, setDark] = useState(
    localStorage.getItem("dilmac-theme") !== "light",
  );
  const [authChecked, setAuthChecked] = useState(!authReady);
  useEffect(() => observeUser((nextUser) => {
    setUser(nextUser);
    setProfile(readProfile(nextUser));
    setAuthChecked(true);
    if (!nextUser) return;
    // Ödeme sağlayıcısının webhook'u planı sunucuya yazar; giriş yapan
    // kullanıcının gerçek planı oradan doğrulanır. Sunucu kayıt yoksa
    // cihazdaki seçim geçerli kalır.
    void fetchServerPlan(nextUser.uid).then((serverPlan) => {
      if (!serverPlan) return;
      setProfile((current) => {
        const base = current || defaultProfile(nextUser);
        if (base.plan === serverPlan) return current;
        const next = { ...base, plan: serverPlan };
        localStorage.setItem(profileKey(nextUser.uid), JSON.stringify(next));
        return next;
      });
    });
  }), []);
  const saveProfile = useCallback((next: MemberProfile) => {
    if (!user) return;
    localStorage.setItem(profileKey(user.uid), JSON.stringify(next));
    setProfile(next);
  }, [user]);
  const saveRegisteredProfile = useCallback((targetUser: User, next: MemberProfile) => {
    localStorage.setItem(profileKey(targetUser.uid), JSON.stringify(next));
    setProfile(next);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("dilmac-theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <Layout user={user} profile={profile} dark={dark} setDark={setDark}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/uygulama" element={<LiveTranslation user={user} profile={profile} authChecked={authChecked} />} />
        <Route path="/deneme" element={<AiPracticePage user={user} profile={profile} authChecked={authChecked} />} />
        <Route path="/oda/:roomId" element={<LiveTranslation user={user} profile={profile} authChecked={authChecked} />} />
        <Route path="/hakkinda" element={<Info page="about" />} />
        <Route path="/iletisim" element={<ContactPage />} />
        <Route path="/nasil-calisir" element={<Info page="how" />} />
        <Route path="/ozellikler" element={<Info page="features" />} />
        <Route path="/abonelik" element={<SubscriptionPage user={user} profile={profile} onSaveForUser={saveRegisteredProfile} />} />
        <Route path="/kayit" element={<AuthPage onRegistered={saveRegisteredProfile} />} />
        <Route path="/profil" element={<ProfilePage user={user} profile={profile} onSave={saveProfile} onSaveForUser={saveRegisteredProfile} />} />
        <Route path="/gizlilik" element={<Info page="privacy" />} />
        <Route
          path="/kullanim-sartlari"
          element={<Info page="terms" />}
        />
        <Route path="/iade-politikasi" element={<Info page="refund" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!authReady && (
        <div className="auth-note">
          {t("auth.firebaseMissing")}
        </div>
      )}
    </Layout>
  );
}
