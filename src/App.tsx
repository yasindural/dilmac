import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Menu,
  X,
  Mic,
  ArrowRight,
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
import { authReady, loginEmail, loginGoogle, logout, observeUser, registerEmail } from "./lib/auth";
import type { User } from "firebase/auth";
import { translate } from "./lib/translation";
import { useSpeech } from "./hooks/useSpeech";
import { useRoom, type RoomLanguage, type RoomMessage } from "./hooks/useRoom";
import { MessageQueue, type QueueItem } from "./lib/messageQueue";
import RoomScreen from "./components/RoomScreen";
import GoogleLogo from "./components/GoogleLogo";
import { BillingError, billingProvider, localizedPlans, startCheckout } from "./lib/billing";
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
import { conversationLanguages, detectConversationLanguage, languageByCode, languageByName, speechCodeFor } from "./lib/languages";
// Premium katman en son yÃ¼klenir; tÃ¼m sayfa stillerinin Ã¼stÃ¼nde kalmasÄ± gerekir.
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
      <strong>DilmaÃ§</strong>
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
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, setLang, t } = useI18n();
  const planCatalog = localizedPlans(t);
  // Mobil menÃ¼, hangi Ã¶ÄŸeye basÄ±lÄ±rsa basÄ±lsÄ±n adres deÄŸiÅŸince kapanmalÄ±.
  // Tek tek onClick eklemek yerine rotayÄ± dinliyoruz; bÃ¶ylece "CanlÄ± Ã§eviriyi
  // baÅŸlat" gibi navigate() kullanan dÃ¼ÄŸmelerde de menÃ¼ aÃ§Ä±k kalmÄ±yor.
  useEffect(() => { setOpen(false); }, [location.pathname]);
  // MenÃ¼ aÃ§Ä±kken arka plan kaymasÄ±n.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  // Sayfa kaydÄ±rÄ±ldÄ±ÄŸÄ±nda baÅŸlÄ±k camlaÅŸÄ±r; sÄ±nÄ±fÄ± gÃ¶vdeye yazÄ±yoruz ki
  // her sayfa aynÄ± davranÄ±ÅŸÄ± Ã¼cretsiz alsÄ±n.
  useEffect(() => {
    const onScroll = () => document.body.classList.toggle("scrolled", window.scrollY > 12);
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
      <header>
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
          ].map(([p, n]) => (
            <NavLink key={p} to={p} onClick={() => setOpen(false)}>
              {n}
            </NavLink>
          ))}
          <label className="lang-select">
            <Languages />
            <select value={lang} onChange={(event) => setLang(event.target.value as SiteLang)} aria-label={t("lang.pick")}>
              {siteLanguages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </label>
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
            // Avatar: Google fotoÄŸrafÄ± varsa o, yoksa baÅŸ harf. Ãœcretli planlarda
            // halka marka gradyanÄ±na dÃ¶ner â€” rozet aramadan planÄ± gÃ¶sterir.
            return (
              <Link className={`member-chip plan-${plan}`} to="/profil" onClick={() => setOpen(false)} title={`${planName} Â· ${shownName}`}>
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
          {/* BaÅŸlÄ±ktaki buton dar alanda durur; uzun dillerde (de/fr/es) tam
              cÃ¼mle Ã¼Ã§ satÄ±ra kÄ±rÄ±lÄ±p logonun Ã¼stÃ¼ne biniyordu. KÄ±sa varyant
              kullanÄ±lÄ±yor, tam cÃ¼mle sayfa iÃ§i CTA'da kalÄ±yor. */}
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
          </div>
          <div className="foot-col">
            <h4>{t("foot.legal")}</h4>
            <Link to="/gizlilik">{t("footer.privacy")}</Link>
            <Link to="/kullanim-sartlari">{t("footer.terms")}</Link>
            <Link to="/iade-politikasi">{t("foot.refund")}</Link>
          </div>
        </div>
        <div className="foot-bottom">
          <span>Â© {new Date().getFullYear()} DilmaÃ§</span>
          <em>{t("foot.tagline")}</em>
        </div>
      </footer>
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
      } else await loginEmail(email.trim(), password);
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
        <div className="row"><span className="scene-dot" />{t("auth.miniRow")} Â· DLM-482</div>
        <div className="bubble"><b>YarÄ±nki toplantÄ± saat kaÃ§ta?</b><small>What time is tomorrow&apos;s meeting?</small></div>
        <div className="bubble"><b>It starts at ten.</b><small>Saat onda baÅŸlÄ±yor.</small></div>
      </div>
    </div>
    <div className="auth-card">
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
    </div>
  </section>;
}

function SubscriptionPage({ user, profile, onSaveForUser }: { user: User | null; profile: MemberProfile | null; onSaveForUser: (user: User, profile: MemberProfile) => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
  const { t, lang } = useI18n();
  const planCatalog = localizedPlans(t);
  const languageCount = String(conversationLanguages.length);
  useReveal();
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
      // Ã–deme saÄŸlayÄ±cÄ±sÄ± baÄŸlÄ±ysa Ã¼cretli planlar gerÃ§ek checkout'a gider;
      // plan, Ã¶deme onaylanÄ±nca webhook Ã¼zerinden sunucuya yazÄ±lÄ±r.
      if (plan !== "free" && billingProvider() !== "none") {
        await s÷4¶‰žËkºwµç@(€€€€€€€€˜˜É•µ½Ñ•MÁ•…­¥¹M¥¹•I•˜¹ÕÉÉ•¹Ð€ø€À(€€€€€€€€˜˜ÕÑÑ•É…¹•MÑ…ÉÑI•˜¹ÕÉÉ•¹Ð€ðÉ•µ½Ñ•MÁ•…­¥¹M¥¹•I•˜¹ÕÉÉ•¹Ð€¬€ÈÔÀì(€€€€€¥˜€ …µ¥¹•MÑ…ÉÑ•‘¥ÉÍÐ¤ì(€€€€€€€ÍÕÁÁÉ•ÍÍ•‘I•˜¹ÕÉÉ•¹Ð€ôìÑ•áÐ°…Ðè…Ñ”¹¹½Ü ¤ôì(€€€€€€€±½±¥•¹ÑÉÉ½È ‰•¡½}ÍÕÁÁÉ•ÍÍ•ˆ°€‰ÍÁ•• ˆ°-…ËÄÑ…É…˜­½¹×}ÕÉ­•¸•±•¸€‘íÑ•áÐ¹±•¹Ñ¡ô­…É…­Ñ•É±¥¬Ñ…»Åµ„‰•­±•Ñ¥±‘¥€°€‰Ý…É¹¥¹œˆ¤ì(€€€€€€€Í•Ñ9½Ñ¥”¡ÑI•˜¹ÕÉÉ•¹Ð ‰¹½Ñ¥”¹Á••É	ÕÍäˆ¤¤ì(€€€€€€€É•ÑÕÉ¸ì(€€€€€ô(€€€€€€¼¼•Ë•¬—|é…µ…¹³Ä­½¹×}µ„è­…å‰•Ñµ”°¹½Éµ…°ŸÙ¹‘•È¸(€€€ô(€€€ÅÕ•Õ•I•˜¹ÕÉÉ•¹Ðü¹•¹ÅÕ•Õ”¡ìÍ½ÕÉ”èÑ•áÐ°Í½ÕÉ•1…¹Õ…”è±…¹Õ…•	å½‘”¡Í½ÕÉ”¤ü¹…Á¤ñðÍ½ÕÉ”°Ñ…É•Ñ1…¹Õ…”èÑ…É•Ðô¤ì(€€€Í•Ñ9½Ñ¥”¡ÑI•˜¹ÕÉÉ•¹Ð ‰¹½Ñ¥”¹ÅÕ•Õ•‘5Íœˆ¤¤ì(€ô°mÍ½ÕÉ”°Ñ…É•Ñt¤ì(€•¹ÅÕ•Õ•I…ÝI•˜¹ÕÉÉ•¹Ð€ô€¡Ñ•áÐèÍÑÉ¥¹œ¤€ôøì(€€€ÅÕ•Õ•I•˜¹ÕÉÉ•¹Ðü¹•¹ÅÕ•Õ”¡ìÍ½ÕÉ”èÑ•áÐ°Í½ÕÉ•1…¹Õ…”è±…¹Õ…•	å½‘”¡Í½ÕÉ”¤ü¹…Á¤ñðÍ½ÕÉ”°Ñ…É•Ñ1…¹Õ…”èÑ…É•Ðô¤ì(€ôì(€€¼¼-…ËÄÑ…É…˜ÍÕÍÕ¹„èµ•Í…«Ä•±‘¥åÍ”‰•­±•å•¸µ•Ñ¥¸å…¹¯Å“ÅÈ°Í¥°¸(€€¼¼5•Í…¨•±µ•‘¥åÍ”­Õ±±…»ÅÅ»Å¸•Ë•¬ñµ±•Í¥‘¥È°ŸÙ¹‘•È¸(€½¹ÍÐÉ•µ½Ñ•MÁ•…­¥¹9½Ü€ôÉ½½µ½¹¹•Ñ¥½¸¹É•µ½Ñ•MÁ•…­¥¹œì(€ÕÍ•™™•Ð  ¤€ôøì(€€€¥˜€¡É•µ½Ñ•MÁ•…­¥¹9½Ü¤ì(€€€€€¥˜€¡™±ÕÍ¡Q¥µ•ÉI•˜¹ÕÉÉ•¹Ð€„ôô¹Õ±°¤Ý¥¹‘½Ü¹±•…ÉQ¥µ•½ÕÐ¡™±ÕÍ¡Q¥µ•ÉI•˜¹ÕÉÉ•¹Ð¤ì(€€€€€™±ÕÍ¡Q¥µ•ÉI•˜¹ÕÉÉ•¹Ð€ô¹Õ±°ì(€€€€€É•ÑÕÉ¸ì(€€€ô(€€€¥˜€ …ÍÕÁÁÉ•ÍÍ•‘I•˜¹ÕÉÉ•¹Ð¤É•ÑÕÉ¸ì(€€€™±ÕÍ¡Q¥µ•ÉI•˜¹ÕÉÉ•¹Ð€ôÝ¥¹‘½Ü¹Í•ÑQ¥µ•½ÕÐ  ¤€ôøì(€€€€€½¹ÍÐÁ•¹‘¥¹œ€ôÍÕÁÁÉ•ÍÍ•‘I•˜¹ÕÉÉ•¹Ðì(€€€€€ÍÕÁÁÉ•ÍÍ•‘I•˜¹ÕÉÉ•¹Ð€ô¹Õ±°ì(€€€€€¥˜€ …Á•¹‘¥¹œ¤É•ÑÕÉ¸ì(€€€€€•¹ÅÕ•Õ•I…ÝI•˜¹ÕÉÉ•¹Ð¡Á•¹‘¥¹œ¹Ñ•áÐ¤ì(€€€€€Í•Ñ9½Ñ¥”¡ÑI•˜¹ÕÉÉ•¹Ð ‰¹½Ñ¥”¹¡•±‘M•¹Ðˆ¤¤ì(€€€ô°€ÈÔÀÀ¤ì(€€€É•ÑÕÉ¸€ ¤€ôøì(€€€€€¥˜€¡™±ÕÍ¡Q¥µ•ÉI•˜¹ÕÉÉ•¹Ð€„ôô¹Õ±°¤Ý¥¹‘½Ü¹±•…ÉQ¥µ•½ÕÐ¡™±ÕÍ¡Q¥µ•ÉI•˜¹ÕÉÉ•¹Ð¤ì(€€€€€™±ÕÍ¡Q¥µ•ÉI•˜¹ÕÉÉ•¹Ð€ô¹Õ±°ì(€€€ôì(€ô°mÉ•µ½Ñ•MÁ•…­¥¹9½Ýt¤ì(€½¹ÍÐÍÁ•• €ôÕÍ•MÁ•• ¡Í½ÕÉ”°•¹ÅÕ•Õ”¤ì(€€¼¼ñµ±•¹¥¸¥±¬ƒÙ¸¥é±•µ”…»Å»Ä­…å‘•Ð€¡å…¹¯Ä½•Ë•¬ÏÙè…åËÅ·Ä§¥¸¤¸(€½¹ÍÐÁÉ•Ù%¹Ñ•É¥µI•˜€ôÕÍ•I•˜ ˆˆ¤ì(€ÕÍ•™™•Ð  ¤€ôøì(€€€½¹ÍÐ¡…Ì€ôÍÁ•• ¹¥¹Ñ•É¥µQ•áÐ¹ÑÉ¥´ ¤¹±•¹Ñ €ø€Àì(€€€½¹ÍÐ¡…€ôÁÉ•Ù%¹Ñ•É¥µI•˜¹ÕÉÉ•¹Ð¹ÑÉ¥´ ¤¹±•¹Ñ €ø€Àì(€€€¥˜€¡¡…Ì€˜˜€…¡…¤ÕÑÑ•É…¹•MÑ…ÉÑI•˜¹ÕÉÉ•¹Ð€ô…Ñ”¹¹½Ü ¤ì(€€€¥˜€ …¡…Ì¤ÕÑÑ•É…¹•MÑ…ÉÑI•˜¹ÕÉÉ•¹Ð€ô€Àì(€€€ÁÉ•Ù%¹Ñ•É¥µI•˜¹ÕÉÉ•¹Ð€ôÍÁ•• ¹¥¹Ñ•É¥µQ•áÐì(€ô°mÍÁ•• ¹¥¹Ñ•É¥µQ•áÑt¤ì(€ÕÍ•™™•Ð  ¤€ôøì(€€€¥˜€¡É½½µ½¹¹•Ñ¥½¸¹É•µ½Ñ•MÁ•…­¥¹œ¤ì(€€€€€¥˜€ …É•µ½Ñ•MÁ•…­¥¹M¥¹•I•˜¹ÕÉÉ•¹Ð¤É•µ½Ñ•MÁ•…­¥¹M¥¹•I•˜¹ÕÉÉ•¹Ð€ô…Ñ”¹¹½Ü ¤ì(€€€ô•±Í”ì(€€€€€É•µ½Ñ•MÁ•…­¥¹M¥¹•I•˜¹ÕÉÉ•¹Ð€ô€Àì(€€€ô(€ô°mÉ½½µ½¹¹•Ñ¥½¸¹É•µ½Ñ•MÁ•…­¥¹t¤ì(€€¼¼-½¹×}µ…å„‰‡}±…È‰‡}±…µ…è­…ËÄÑ…É…™„¡…‰•ÈÙ•Èì¼‘„‰¥é¥´Í•Í¥µ¥é¤(€€¼¼­•¹‘¤µ¥­É½™½¹Õ¹‘…¸å…­…±…çÅÀƒ•Ù¥Éµ•å”ƒ…³Ç}µ…ÏÅ¸¸(€½¹ÍÐÍ•¹‘MÁ•…­¥¹œ€ôÉ½½µ½¹¹•Ñ¥½¸¹Í•¹‘MÁ•…­¥¹œì(€½¹ÍÐÍÁ•…­¥¹M¥¹…±I•˜€ôÕÍ•I•˜¡™…±Í”¤ì(€ÕÍ•™™•Ð  ¤€ôøì(€€€¥˜€ …É½½µ½¹¹•Ñ¥½¸¹Ù½¥•¹…‰±•¤É•ÑÕÉ¸ì(€€€½¹ÍÐÍÁ•…­¥¹œ€ôÍÁ•• ¹±¥ÍÑ•¹¥¹œ€˜˜ÍÁ•• ¹¥¹Ñ•É¥µQ•áÐ¹ÑÉ¥´ ¤¹±•¹Ñ €ø€Àì(€€€¥˜€¡ÍÁ•…­¥¹œ€ôôôÍÁ•…­¥¹M¥¹…±I•˜¹ÕÉÉ•¹Ð¤É•ÑÕÉ¸ì(€€€ÍÁ•…­¥¹M¥¹…±I•˜¹ÕÉÉ•¹Ð€ôÍÁ•…­¥¹œì(€€€Í•¹‘MÁ•…­¥¹œ¡ÍÁ•…­¥¹œ¤ì(€ô°mÍÁ•• ¹±¥ÍÑ•¹¥¹œ°ÍÁ•• ¹¥¹Ñ•É¥µQ•áÐ°É½½µ½¹¹•Ñ¥½¸¹Ù½¥•¹…‰±•°Í•¹‘MÁ•…­¥¹t¤ì(€ÕÍ•™™•Ð  ¤€ôøì(€€€¥˜€ …ÍÁ•• ¹±¥ÍÑ•¹¥¹œ€˜˜ÍÁ•…­¥¹M¥¹…±I•˜¹ÕÉÉ•¹Ð¤ì(€€€€€ÍÁ•…­¥¹M¥¹…±I•˜¹ÕÉÉ•¹Ð€ô™…±Í”ì(€€€€€Í•¹‘MÁ•…­¥¹œ¡™…±Í”¤ì(€€€ô(€ô°mÍÁ•• ¹±¥ÍÑ•¹¥¹œ°Í•¹‘MÁ•…­¥¹t¤ì(€€¼¼	‡}±…¹ÓÄ­ÕÉÕ±ÕÈ­ÕÉÕ±µ…è…¹³ÄÍ•Í¤½Ñ½µ…Ñ¥¬‡œè¥­¤Ñ…É…˜‘„‰¥É‰¥É¥¹¤(€€¼¼¡•µ•¸‘ÕåÍÕ¸¸¥=LÑ„­½¹×}µ„Ñ…»Åµ…å±„µ¥­É½™½¸ƒ…¯Ç}ÓÇÄ§¥¸½É…‘„(€€¼¼­Õ±±…»ÅÄ•±±”‡µ…å„‘•Ù…´•‘¥å½È¸(€½¹ÍÐ…ÕÑ½Y½¥•QÉ¥•‘I•˜€ôÕÍ•I•˜¡™…±Í”¤ì(€½¹ÍÐ•¹…‰±•Y½¥•I•˜€ôÕÍ•I•˜¡É½½µ½¹¹•Ñ¥½¸¹•¹…‰±•Y½¥”¤ì(€•¹…‰±•Y½¥•I•˜¹ÕÉÉ•¹Ð€ôÉ½½µ½¹¹•Ñ¥½¸¹•¹…‰±•Y½¥”ì(€ÕÍ•™™•Ð  ¤€ôøì(€€€¥˜€ …É½½µ½¹¹•Ñ¥½¸¹½¹¹•Ñ•ñðÉ½½µ½¹¹•Ñ¥½¸¹Ù½¥•¹…‰±•ñð…ÕÑ½Y½¥•QÉ¥•‘I•˜¹ÕÉÉ•¹Ð¤É•ÑÕÉ¸ì(€€€½¹ÍÐ¥ÍÁÁ±•]•‰-¥Ð€ô€½¥@ üé¡½¹•ñ…‘ñ½¤½¤¹Ñ•ÍÐ¡¹…Ù¥…Ñ½È¹ÕÍ•É•¹Ð¤€˜˜€½ÁÁ±•]•‰-¥Ð½¤¹Ñ•ÍÐ¡¹…Ù¥…Ñ½È¹ÕÍ•É•¹Ð¤ì(€€€¥˜€¡¥ÍÁÁ±•]•‰-¥Ð¤É•ÑÕÉ¸ì(€€€…ÕÑ½Y½¥•QÉ¥•‘I•˜¹ÕÉÉ•¹Ð€ôÑÉÕ”ì(€€€Ù½¥•¹…‰±•Y½¥•I•˜¹ÕÉÉ•¹Ð ¤ì(€ô°mÉ½½µ½¹¹•Ñ¥½¸¹½¹¹•Ñ•°É½½µ½¹¹•Ñ¥½¸¹Ù½¥•¹…‰±•‘t¤ì(€€¼¼€‰-½¹×}µ„‰‡}±…“Äˆ€ô­…ËÄÑ…É…˜‰‡}³ÄYå„µ¥­É½™½¸‡ŸÅ¬å„‘„•¸…è‰¥È(€€¼¼ñµ±”…³Ç}Ù•É§}¤½±µ×|¸•¹•µ”Í…å…Äå…±»Åé„‰Ô­¿}Õ±‘„¥±•É±•È¸(€½¹ÍÐ½¹Ù•ÉÍ¥¹œ€ôÉ½½µ½¹¹•Ñ¥½¸¹½¹¹•Ñ•(€€€€˜˜€¡ÍÁ•• ¹±¥ÍÑ•¹¥¹œñð±½…±5•ÍÍ…•Ì¹±•¹Ñ €ø€ÀñðÉ•µ½Ñ•5•ÍÍ…•Ì¹±•¹Ñ €ø€À¤ì(€ÕÍ•™™•Ð  ¤€ôøì½¹½¹Ù•ÉÍ¥¹¡…¹”ü¸¡½¹Ù•ÉÍ¥¹œ¤ìô°m½¹Ù•ÉÍ¥¹œ°½¹½¹Ù•ÉÍ¥¹¡…¹•t¤ì(€ÕÍ•™™•Ð  ¤€ôø€ ¤€ôø½¹½¹Ù•ÉÍ¥¹¡…¹”ü¸¡™…±Í”¤°m½¹½¹Ù•ÉÍ¥¹¡…¹•t¤ì(€ÍÁ••¡I•˜¹ÕÉÉ•¹Ð€ôì±¥ÍÑ•¹¥¹œèÍÁ•• ¹±¥ÍÑ•¹¥¹œ°ÍÑ½ÀèÍÁ•• ¹ÍÑ½À°Ñ½±”èÍÁ•• ¹Ñ½±”ôì(€€¼¼5½‰¥°Ñ…É…çÅÅ±…ÈÍ•Í±•¹‘¥Éµ•å¤¥±¬­Õ±±…»ÅÄ‘½­Õ¹×}Õ¹‘…¸Í½¹É„½å¹…ÓÅÈ¸(€€¼¼-…ËÄÑ…É…˜¡§‰¥È“ó}µ•å”‰…Íµ…‘…¸µ•Í…¨…±…‰¥±‘§}¤§¥¸Í…å™…‘…­¤¥±¬(€€¼¼‘½­Õ¹×}Ñ„­¥±¥‘¤‡ŸÅå½ÉÕè¸(€ÕÍ•™™•Ð  ¤€ôøì(€€€½¹ÍÐÕ¹±½­=¹”€ô€ ¤€ôøÕ¹±½­MÁ••¡=ÕÑÁÕÐ ¤ì(€€€Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•É‘½Ý¸ˆ°Õ¹±½­=¹”°ì½¹”èÑÉÕ”ô¤ì(€€€Ý¥¹‘½Ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ‰­•å‘½Ý¸ˆ°Õ¹±½­=¹”°ì½¹”èÑÉÕ”ô¤ì(€€€É•ÑÕÉ¸€ ¤€ôøì(€€€€€Ý¥¹‘½Ü¹É•µ½Ù•Ù•¹Ñ1¥ÍÑ•¹•È ‰Á½¥¹Ñ•É‘½Ý¸ˆ°Õ¹±½­=¹”¤ì(€€€€€Ý¥¹‘½Ü¹É•µ½Ù•Ù•¹Ñ1¥ÍÑ•¹•È ‰­•å‘½Ý¸ˆ°Õ¹±½­=¹”¤ì(€€€ôì(€ô°mt¤ì(€½¹ÍÐÉ•…Ñ•I½½´€ô€ ¤€ôøì(€€€½¹ÍÐ½‘”€ô5…Ñ ¹É…¹‘½´ ¤¹Ñ½MÑÉ¥¹œ ÌØ¤¹Í±¥” È°€à¤¹Ñ½UÁÁ•É…Í” ¤ì(€€€¹…Ù¥…Ñ”¡€½½‘„¼‘í½‘•ôýÉ½±”õ¡½ÍÑ€¤ì(€ôì(€½¹ÍÐ¥¹Ù¥Ñ•1¥¹¬€ô…Ñ¥Ù”(€€€€ü€‘í±½…Ñ¥½¸¹½É¥¥¹ô‘í¥µÁ½ÉÐ¹µ•Ñ„¹•¹Ø¹	M}UI1õ½‘„¼‘í…Ñ¥Ù•õ€(€€€€è€ˆˆì(€½¹ÍÐ©½¥¸€ô€ ¤€ôøì(€€€¥˜€ „½ymµhÀ´åuìÙô¼¹Ñ•ÍÐ¡É½½´¹Ñ½UÁÁ•É…Í” ¤¤¤ì(€€€€€Í•Ñ9½Ñ¥”¡Ð ‰±½‰‰ä¹½‘•ÉÉ½Èˆ¤¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô(€€€¹…Ù¥…Ñ”¡€½½‘„¼‘íÉ½½´¹Ñ½UÁÁ•É…Í” ¥õ€¤ì(€ôì(€½¹ÍÐÍÁ•…¬€ô€¡Ñ•áÐèÍÑÉ¥¹œ°±…¹Õ…•9…µ”üèÍÑÉ¥¹œ¤€ôøì(€€€ÍÁ•…­Q•áÐ¡Ñ•áÐ°ÍÁ••¡½‘•½È¡±…¹Õ…•9…µ”ñð€ˆˆ¤¤ì(€ôì(€½¹ÍÐÍÕ‰µ¥ÑÉ…™Ð€ô€¡•Ù•¹ÐèI•…Ð¹½ÉµÙ•¹Ð¤€ôøì(€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€Õ¹±½­MÁ••¡=ÕÑÁÕÐ ¤ì(€€€½¹ÍÐÑ•áÐ€ô‘É…™Ð¹ÑÉ¥´ ¤ì(€€€¥˜€ …Ñ•áÐ¤É•ÑÕÉ¸ì(€€€•¹ÅÕ•Õ”¡Ñ•áÐ¤ì(€€€Í•ÑÉ…™Ð ˆˆ¤ì(€ôì(€½¹ÍÐÑ½±•Y½¥”€ô…Íå¹Œ€ ¤€ôøì(€€€¥˜€¡É½½µ½¹¹•Ñ¥½¸¹Ù½¥•¹…‰±•¤ì(€€€€€É½½µ½¹¹•Ñ¥½¸¹‘¥Í…‰±•Y½¥” ¤ì(€€€€€Í•Ñ9½Ñ¥”¡Ð ‰¹½Ñ¥”¹Ù½¥•=™˜ˆ¤¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô(€€€½¹ÍÐ•¹…‰±•€ô…Ý…¥ÐÉ½½µ½¹¹•Ñ¥½¸¹•¹…‰±•Y½¥” ¤ì(€€€¥˜€¡•¹…‰±•¤Í•Ñ9½Ñ¥”¡Ð ‰¹½Ñ¥”¹Ù½¥•]…¥Ñ¥¹œˆ¤¤ì(€ôì(€½¹ÍÐÑ½±•½¹Ù•ÉÍ…Ñ¥½¸€ô…Íå¹Œ€ ¤€ôøì(€€€Õ¹±½­MÁ••¡=ÕÑÁÕÐ ¤ì(€€€¥˜€¡ÍÁ•• ¹±¥ÍÑ•¹¥¹œ¤ì(€€€€€ÍÁ•• ¹Ñ½±” ¤ì(€€€€€É•ÑÕÉ¸ì(€€€ô(€€€½¹ÍÐ¥Í%=M]•‰-¥Ð€ô€½¥@ üé¡½¹•ñ…‘ñ½¤½¤¹Ñ•ÍÐ¡¹…Ù¥…Ñ½È¹ÕÍ•É•¹Ð¤€˜˜€½ÁÁ±•]•‰-¥Ð½¤¹Ñ•ÍÐ¡¹…Ù¥…Ñ½È¹ÕÍ•É•¹Ð¤ì(€€€¥˜€ …¥Í%=M]•‰-¥Ð€˜˜€…É½½µ½¹¹•Ñ¥½¸¹Ù½¥•¹…‰±•¤ì(€€€€€½¹ÍÐ•¹…‰±•€ô…Ý…¥ÐÉ½½µ½¹¹•Ñ¥½¸¹•¹…‰±•Y½¥” ¤ì(€€€€€¥˜€ …•¹…‰±•¤É•ÑÕÉ¸ì(€€€ô(€€€¥˜€¡¥Í%=M]•‰-¥Ð€˜˜€…É½½µ½¹¹•Ñ¥½¸¹Ù½¥•¹…‰±•¤ì(€€€€€Í•Ñ9½Ñ¥”¡Ð ‰¹½Ñ¥”¹¥½Í5¥Œˆ¤¤ì(€€€ô(€€€ÍÁ•• ¹Ñ½±” ¤ì(€ôì(€½¹ÍÐÑ½±•I•µ½Ñ•A±…å‰…¬€ô…Íå¹Œ€ ¤€ôøì(€€€½¹ÍÐ…Õ‘¥¼€ôÉ•µ½Ñ•Õ‘¥½I•˜¹ÕÉÉ•¹Ðì(€€€¥˜€ ……Õ‘¥¼ñð€…É½½µ½¹¹•Ñ¥½¸¹Ù½¥•½¹¹•Ñ•¤É•ÑÕÉ¸ì(€€€¥˜€¡Á±…å‰…­	±½­•ñðÉ•µ½Ñ•5ÕÑ•¤ì(€€€€€…Õ‘¥¼¹µÕÑ•€ô™…±Í”ì(€€€€€Í•ÑI•µ½Ñ•5ÕÑ•¡™…±Í”¤ì(€€€€€ÑÉäì(€€€€€€€…Ý…¥Ð…Õ‘¥¼¹Á±…ä ¤ì(€€€€€€€Í•ÑA±…å‰…­	±½­•¡™…±Í”¤ì(€€€€€ô…Ñ ì(€€€€€€€Í•ÑA±…å‰…­	±½­•¡ÑÉÕ”¤ì(€€€€€ô(€€€€€É•ÑÕÉ¸ì(€€€ô(€€€…Õ‘¥¼¹µÕÑ•€ôÑÉÕ”ì(€€€Í•ÑI•µ½Ñ•5ÕÑ•¡ÑÉÕ”¤ì(€ôì(€½¹ÍÐÍÑ…ÑÕÍÉÉ½È€ôÍÁ•• ¹•ÉÉ½È(€€€€üÐ ‰•ÉÉ½È¹µ¥Œˆ¤(€€€€èÉ½½µ½¹¹•Ñ¥½¸¹Ù½¥•ÉÉ½È(€€€€€€üÐ ‰•ÉÉ½È¹Ù½¥”ˆ¤(€€€€€€èÉ½½µ½¹¹•Ñ¥½¸¹•ÉÉ½È(€€€€€€€€üÐ ‰•ÉÉ½È¹É½½´ˆ¤(€€€€€€€€è€ˆˆì(€¥˜€ …É½½µ%¤É•ÑÕÉ¸€ (€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰É½½´µ±½‰‰äˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±½‰‰äµ¡•É¼ˆø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±½‰‰äµ¥½¸ˆøñ1…¹Õ…•Ì€¼øð½‘¥Øø(€€€€€€€€ñ ÄùíÐ ‰±½‰‰ä¹Ñ¥Ñ±”ˆ¥ôð½ Äø(€€€€€€€€ñÀùíÐ ‰±½‰‰ä¹ÍÕˆˆ¥ôð½Àø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±½‰‰äµ…Ñ¥½¹Ìˆø(€€€€€€€€ñ…ÉÑ¥±”ø(€€€€€€€€€€ñÍÁ…¸ùíÐ ‰±½‰‰ä¹¹•Ý	…‘”ˆ¥ôð½ÍÁ…¸ø(€€€€€€€€€€ñ ÈùíÐ ‰±½‰‰ä¹¹•ÝQ¥Ñ±”ˆ¥ôð½ Èø(€€€€€€€€€€ñÀùíÐ ‰±½‰‰ä¹¹•ÝQ•áÐˆ¥ôð½Àø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäˆ½¹±¥¬õíÉ•…Ñ•I½½µôùíÐ ‰±½‰‰ä¹É•…Ñ”ˆ¥ôñÉÉ½ÝI¥¡Ð€¼øð½‰ÕÑÑ½¸ø(€€€€€€€€ð½…ÉÑ¥±”ø(€€€€€€€€ñ…ÉÑ¥±”ø(€€€€€€€€€€ñÍÁ…¸ùíÐ ‰±½‰‰ä¹©½¥¹	…‘”ˆ¥ôð½ÍÁ…¸ø(€€€€€€€€€€ñ ÈùíÐ ‰±½‰‰ä¹©½¥¹Q¥Ñ±”ˆ¥ôð½ Èø(€€€€€€€€€€ñÀùíÐ ‰±½‰‰ä¹©½¥¹Q•áÐˆ¥ôð½Àø(€€€€€€€€€€ñ±…‰•°ùíÐ ‰±½‰‰ä¹½‘•1…‰•°ˆ¥ô(€€€€€€€€€€€€ñ¥¹ÁÕÐÙ…±Õ”õíÉ½½µôµ…á1•¹Ñ õìÙô½¹¡…¹”õì¡•Ù•¹Ð¤€ôøÍ•ÑI½½´¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¹Ñ½UÁÁ•É…Í” ¤¹É•Á±…” ½myµhÀ´åt½œ°€ˆˆ¤¥ôÁ±…•¡½±‘•Èô‰ÅÉÌˆ€¼ø(€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¡½ÍÐˆ½¹±¥¬õí©½¥¹ôùíÐ ‰±½‰‰ä¹©½¥¸ˆ¥ôñÉÉ½ÝI¥¡Ð€¼øð½‰ÕÑÑ½¸ø(€€€€€€€€ð½…ÉÑ¥±”ø(€€€€€€ð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±½‰‰äµ¹½Ñ”ˆøñM¡¥•±‘¡•¬€¼øíÐ ‰±½‰‰ä¹¹½Ñ”ˆ¥ôð½‘¥Øø(€€€€ð½Í•Ñ¥½¸ø(€€¤ì(€É•ÑÕÉ¸€ (€€€€ñI½½µMÉ••¸(€€€€€É½½µ½‘”õí…Ñ¥Ù•ô(€€€€€¥¹Ù¥Ñ•1¥¹¬õí¥¹Ù¥Ñ•1¥¹­ô(€€€€€½¹¹•Ñ•õíÉ½½µ½¹¹•Ñ¥½¸¹½¹¹•Ñ•‘ô(€€€€€½¹¹•Ñ¥¹œõíÉ½½µ½¹¹•Ñ¥½¸¹½¹¹•Ñ¥¹ô(€€€€€Á••É1…¹Õ…”õíÉ•µ½Ñ•1…¹Õ…”ü¹¹…µ”ñð¹Õ±±ô(€€€€€±½…±5•ÍÍ…•Ìõí±½…±5•ÍÍ…•Íô(€€€€€É•µ½Ñ•5•ÍÍ…•ÌõíÉ•µ½Ñ•5•ÍÍ…•Íô(€€€€€±…¹Õ…•Ìõí½¹Ù•ÉÍ…Ñ¥½¹1…¹Õ…•Íô(€€€€€Í½ÕÉ•½‘”õíÍ½ÕÉ•ô(€€€€€½¹M½ÕÉ•¡…¹”õí¡…¹•M½ÕÉ•1…¹Õ…•ô(€€€€€Ñ…É•Ñ9…µ”õíÑ…É•Ñô(€€€€€½¹Q…É•Ñ¡…¹”õíÍ•ÑQ…É•Ñô(€€€€€Ñ…É•Ñ1½­•õí	½½±•…¸¡É•µ½Ñ•1…¹Õ…”¥ô(€€€€€±¥ÍÑ•¹¥¹œõíÍÁ•• ¹±¥ÍÑ•¹¥¹ô(€€€€€¥¹Ñ•É¥µQ•áÐõíÍÁ•• ¹¥¹Ñ•É¥µQ•áÑô(€€€€€½¹Q½±•5¥ŒõíÑ½±•½¹Ù•ÉÍ…Ñ¥½¹ô(€€€€€µ¥MÕÁÁ½ÉÑ•õíÍÁ•• ¹ÍÕÁÁ½ÉÑ•‘ô(€€€€€…ÕÑ½MÁ•…¬õí…ÕÑ½MÁ•…­ô(€€€€€½¹Q½±•ÕÑ½MÁ•…¬õì ¤€ôøì(€€€€€€€Õ¹±½­MÁ••¡=ÕÑÁÕÐ ¤ì(€€€€€€€Í•ÑÕÑ½MÁ•…¬ ¡Ù…±Õ”¤€ôøì(€€€€€€€€€¥˜€¡Ù…±Õ”¤±•…ÉMÁ••¡EÕ•Õ” ¤ì(€€€€€€€€€±½…±MÑ½É…”¹Í•Ñ%Ñ•´ ‰‘¥±µ…Œµ…ÕÑ½ÍÁ•…¬ˆ°Ù…±Õ”€ü€ˆÀˆ€è€ˆÄˆ¤ì(€€€€€€€€€É•ÑÕÉ¸€…Ù…±Õ”ì(€€€€€€€ô¤ì(€€€€€õô(€€€€€Ù½¥•¹…‰±•õíÉ½½µ½¹¹•Ñ¥½¸¹Ù½¥•¹…‰±•‘ô(€€€€€Ù½¥•½¹¹•Ñ•õíÉ½½µ½¹¹•Ñ¥½¸¹Ù½¥•½¹¹•Ñ•‘ô(€€€€€Ù½¥•½¹¹•Ñ¥¹œõíÉ½½µ½¹¹•Ñ¥½¸¹Ù½¥•½¹¹•Ñ¥¹ô(€€€€€½¹Q½±•Y½¥”õíÑ½±•Y½¥•ô(€€€€€É•µ½Ñ•5ÕÑ•õíÉ•µ½Ñ•5ÕÑ•‘ô(€€€€€½¹Q½±•I•µ½Ñ•Õ‘¥¼õíÑ½±•I•µ½Ñ•A±…å‰…­ô(€€€€€‘É…™Ðõí‘É…™Ñô(€€€€€½¹É…™Ñ¡…¹”õíÍ•ÑÉ…™Ñô(€€€€€½¹MÕ‰µ¥ÑÉ…™ÐõíÍÕ‰µ¥ÑÉ…™Ñô(€€€€€½¹MÁ•…¬õì¡Ñ•áÐ°±…¹Õ…•9…µ”¤€ôøìÕ¹±½­MÁ••¡=ÕÑÁÕÐ ¤ìÍÁ•…¬¡Ñ•áÐ°±…¹Õ…•9…µ”¤ìõô(€€€€€½¹I•ÑÉäõì¡¥¤€ôøÅÕ•Õ•I•˜¹ÕÉÉ•¹Ðü¹É•ÑÉä¡¥¥ô(€€€€€ÍÑ…ÑÕÌõíÍÑ…ÑÕÍÉÉ½Èñð¹½Ñ¥•ô(€€€€€ÍÑ…ÑÕÍ%ÍÉÉ½Èõí	½½±•…¸¡ÍÑ…ÑÕÍÉÉ½È¥ô(€€€€€…Õ‘¥½M±½Ðõìñ…Õ‘¥¼É•˜õíÉ•µ½Ñ•Õ‘¥½I•™ô…ÕÑ½A±…äÁ±…åÍ%¹±¥¹”…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆ€¼ùô(€€€€¼ø(€€¤ì)ô(¼¼	¥±¤½å…Í…°Í…å™„§•É§}¤ÏÙé³ñ­Ñ•¸•±¥È¸Ù³ñ´Í…çÅÏÄ‰ÕÉ…‘„Í…‰¥ÑÑ¥Èì(¼¼µ•Ñ¥¹±•È¥¹™¼¸ñÍ…å™„ø¹Ìñ8ùÐ€¼Ìñ8ùˆ…¹…¡Ñ…É±…ËÅ¹‘…¸½­Õ¹ÕÈ¸)½¹ÍÐ¥¹™½A…•Ì€ôì(€…‰½ÕÐèì­•äè€‰…‰½ÕÐˆ°Í•Ñ¥½¹Ìè€Èô°(€¡½Üèì­•äè€‰¡½Üˆ°Í•Ñ¥½¹Ìè€Ðô°(€™•…ÑÕÉ•Ìèì­•äè€‰™•…ÑÕÉ•Ìˆ°Í•Ñ¥½¹Ìè€Ôô°(€ÁÉ¥Ù…äèì­•äè€‰ÁÉ¥Ù…äˆ°Í•Ñ¥½¹Ìè€Ìô°(€Ñ•ÉµÌèì­•äè€‰Ñ•ÉµÌˆ°Í•Ñ¥½¹Ìè€àô°(€É•™Õ¹èì­•äè€‰É•™Õ¹ˆ°Í•Ñ¥½¹Ìè€Ðô°)ô…Ì½¹ÍÐì()ÑåÁ”%¹™½A…•-•ä€ô­•å½˜ÑåÁ•½˜¥¹™½A…•Ìì)™Õ¹Ñ¥½¸%¹™¼¡ìÁ…”ôèìÁ…”è%¹™½A…•-•äô¤ì(€½¹ÍÐìÐô€ôÕÍ•$Äá¸ ¤ì(€½¹ÍÐì­•ä°Í•Ñ¥½¹Ìô€ô¥¹™½A…•ÍmÁ…•tì(€É•ÑÕÉ¸€ (€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰¥¹™¼ˆø(€€€€€€ñ ÄùíÐ¡¥¹™¼¸‘í­•åô¹Ñ¥Ñ±•€…Ì¹•Ù•È¥ôð½ Äø(€€€€€€ñÀ±…ÍÍ9…µ”ô‰±•…ˆùíÐ¡¥¹™¼¸‘í­•åô¹¥¹ÑÉ½€…Ì¹•Ù•È¥ôð½Àø(€€€€€íÉÉ…ä¹™É½´¡ì±•¹Ñ èÍ•Ñ¥½¹Ìô°€¡|°¥¹‘•à¤€ôø€ (€€€€€€€€ñ…ÉÑ¥±”­•äõí¥¹‘•áôø(€€€€€€€€€€ñ ÈùíÐ¡¥¹™¼¸‘í­•åô¹Ì‘í¥¹‘•à€¬€ÅõÑ€…Ì¹•Ù•È¥ôð½ Èø(€€€€€€€€€€ñÀùíÐ¡¥¹™¼¸‘í­•åô¹Ì‘í¥¹‘•à€¬€Åõ‰€…Ì¹•Ù•È¥ôð½Àø(€€€€€€€€ð½…ÉÑ¥±”ø(€€€€€€¤¥ô(€€€€ð½Í•Ñ¥½¸ø(€€¤ì)ô)™Õ¹Ñ¥½¸9½Ñ½Õ¹ ¤ì(€½¹ÍÐìÐô€ôÕÍ•$Äá¸ ¤ì(€É•ÑÕÉ¸€ (€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰¥¹™¼ˆø(€€€€€€ñ ÄùíÐ ‰¹˜¹Ñ¥Ñ±”ˆ¥ôð½ Äø(€€€€€€ñÀùíÐ ‰¹˜¹Ñ•áÐˆ¥ôð½Àø(€€€€€€ñ1¥¹¬±…ÍÍ9…µ”ô‰ÁÉ¥µ…ÉäˆÑ¼ôˆ¼ˆø(€€€€€€€íÐ ‰¹˜¹¡½µ”ˆ¥ô(€€€€€€ð½1¥¹¬ø(€€€€ð½Í•Ñ¥½¸ø(€€¤ì)ô)•áÁ½ÉÐ™Õ¹Ñ¥½¸ÁÀ ¤ì(€½¹ÍÐìÐô€ôÕÍ•$Äá¸ ¤ì(€€¼¼Y%Q}Éå…±»Åé„Ñ•ÍÐ‘•É±•µ•Í¥¹‘”€Ä½±ÕÈìƒñÉ•Ñ¥´‘•É±•µ•Í¥¹‘”‰Ô‘…°(€€¼¼ƒÙ³ð­½‘‘ÕÈÙ”Á…­•ÑÑ•¸Ñ…µ…µ•¸ƒŸÅ­…È¸Q•ÍÑ±•É‘”¥É§|•­É…»Å»Ä…Ñ±…µ…¬(€€¼¼§¥¸Í…¡Ñ”‰¥È­Õ±±…»ÅÄÍ‡}±…ÈƒŠPÍÕ¹ÕÔÑ…É…›ÄÁ±…¸‘¿}ÉÕ±…µ…ÏÅ»Ä(€€¼¼•Ñ­¥±•µ•è¸(€½¹ÍÐmÕÍ•È°Í•ÑUÍ•Ét€ôÕÍ•MÑ…Ñ”ñUÍ•Èð¹Õ±°ø (€€€¥µÁ½ÉÐ¹µ•Ñ„¹•¹Ø¹Y%Q}É€ôôô€ˆÄˆ(€€€€€€ü€¡ìÕ¥è€‰”É”µÑ•ÍÐˆ°•µ…¥°è€‰”É•Ñ•ÍÐ¹‘•Øˆ°‘¥ÍÁ±…å9…µ”è€‰ÉQ•ÍÐˆô…ÌÕ¹­¹½Ý¸…ÌUÍ•È¤(€€€€€€è¹Õ±°°(€€¤ì(€½¹ÍÐmÁÉ½™¥±”°Í•ÑAÉ½™¥±•t€ôÕÍ•MÑ…Ñ”ñ5•µ‰•ÉAÉ½™¥±”ð¹Õ±°ø¡¹Õ±°¤ì(€½¹ÍÐm‘…É¬°Í•Ñ…É­t€ôÕÍ•MÑ…Ñ” (€€€±½…±MÑ½É…”¹•Ñ%Ñ•´ ‰‘¥±µ…ŒµÑ¡•µ”ˆ¤€„ôô€‰±¥¡Ðˆ°(€€¤ì(€½¹ÍÐm…ÕÑ¡¡•­•°Í•ÑÕÑ¡¡•­•‘t€ôÕÍ•MÑ…Ñ” ……ÕÑ¡I•…‘ä¤ì(€ÕÍ•™™•Ð  ¤€ôø½‰Í•ÉÙ•UÍ•È ¡¹•áÑUÍ•È¤€ôøì(€€€Í•ÑUÍ•È¡¹•áÑUÍ•È¤ì(€€€Í•ÑAÉ½™¥±”¡É•…‘AÉ½™¥±”¡¹•áÑUÍ•È¤¤ì(€€€Í•ÑÕÑ¡¡•­•¡ÑÉÕ”¤ì(€€€¥˜€ …¹•áÑUÍ•È¤É•ÑÕÉ¸ì(€€€€¼¼ƒY‘•µ”Í‡}±…çÅÅÏÅ»Å¸Ý•‰¡½½¬ÔÁ±…»ÄÍÕ¹ÕÕå„å…é…Èì¥É§|å…Á…¸(€€€€¼¼­Õ±±…»ÅÅ»Å¸•Ë•¬Á±…»Ä½É…‘…¸‘¿}ÉÕ±…»ÅÈ¸MÕ¹ÕÔ­…çÅÐå½­Í„(€€€€¼¼¥¡…é‘…­¤Í—¥´—•É±¤­…³ÅÈ¸(€€€Ù½¥™•Ñ¡M•ÉÙ•ÉA±…¸¡¹•áÑUÍ•È¹Õ¥¤¹Ñ¡•¸ ¡Í•ÉÙ•ÉA±…¸¤€ôøì(€€€€€¥˜€ …Í•ÉÙ•ÉA±…¸¤É•ÑÕÉ¸ì(€€€€€Í•ÑAÉ½™¥±” ¡ÕÉÉ•¹Ð¤€ôøì(€€€€€€€½¹ÍÐ‰…Í”€ôÕÉÉ•¹Ðñð‘•™…Õ±ÑAÉ½™¥±”¡¹•áÑUÍ•È¤ì(€€€€€€€¥˜€¡‰…Í”¹Á±…¸€ôôôÍ•ÉÙ•ÉA±…¸¤É•ÑÕÉ¸ÕÉÉ•¹Ðì(€€€€€€€½¹ÍÐ¹•áÐ€ôì€¸¸¹‰…Í”°Á±…¸èÍ•ÉÙ•ÉA±…¸ôì(€€€€€€€±½…±MÑ½É…”¹Í•Ñ%Ñ•´¡ÁÉ½™¥±•-•ä¡¹•áÑUÍ•È¹Õ¥¤°)M=8¹ÍÑÉ¥¹¥™ä¡¹•áÐ¤¤ì(€€€€€€€É•ÑÕÉ¸¹•áÐì(€€€€€ô¤ì(€€€ô¤ì(€ô¤°mt¤ì(€½¹ÍÐÍ…Ù•AÉ½™¥±”€ôÕÍ•…±±‰…¬ ¡¹•áÐè5•µ‰•ÉAÉ½™¥±”¤€ôøì(€€€¥˜€ …ÕÍ•È¤É•ÑÕÉ¸ì(€€€±½…±MÑ½É…”¹Í•Ñ%Ñ•´¡ÁÉ½™¥±•-•ä¡ÕÍ•È¹Õ¥¤°)M=8¹ÍÑÉ¥¹¥™ä¡¹•áÐ¤¤ì(€€€Í•ÑAÉ½™¥±”¡¹•áÐ¤ì(€ô°mÕÍ•Ét¤ì(€½¹ÍÐÍ…Ù•I•¥ÍÑ•É•‘AÉ½™¥±”€ôÕÍ•…±±‰…¬ ¡Ñ…É•ÑUÍ•ÈèUÍ•È°¹•áÐè5•µ‰•ÉAÉ½™¥±”¤€ôøì(€€€±½…±MÑ½É…”¹Í•Ñ%Ñ•´¡ÁÉ½™¥±•-•ä¡Ñ…É•ÑUÍ•È¹Õ¥¤°)M=8¹ÍÑÉ¥¹¥™ä¡¹•áÐ¤¤ì(€€€Í•ÑAÉ½™¥±”¡¹•áÐ¤ì(€ô°mt¤ì(€ÕÍ•™™•Ð  ¤€ôøì(€€€‘½Õµ•¹Ð¹‘½Õµ•¹Ñ±•µ•¹Ð¹‘…Ñ…Í•Ð¹Ñ¡•µ”€ô‘…É¬€ü€‰‘…É¬ˆ€è€‰±¥¡Ðˆì(€€€±½…±MÑ½É…”¹Í•Ñ%Ñ•´ ‰‘¥±µ…ŒµÑ¡•µ”ˆ°‘…É¬€ü€‰‘…É¬ˆ€è€‰±¥¡Ðˆ¤ì(€ô°m‘…É­t¤ì(€É•ÑÕÉ¸€ (€€€€ñ1…å½ÕÐÕÍ•ÈõíÕÍ•ÉôÁÉ½™¥±”õíÁÉ½™¥±•ô‘…É¬õí‘…É­ôÍ•Ñ…É¬õíÍ•Ñ…É­ôø(€€€€€€ñI½ÕÑ•Ìø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ¼ˆ•±•µ•¹Ðõìñ!½µ”€¼ùô€¼ø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ½ÕåÕ±…µ„ˆ•±•µ•¹Ðõìñ1¥Ù•QÉ…¹Í±…Ñ¥½¸ÕÍ•ÈõíÕÍ•ÉôÁÉ½™¥±”õíÁÉ½™¥±•ô…ÕÑ¡¡•­•õí…ÕÑ¡¡•­•‘ô€¼ùô€¼ø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ½‘•¹•µ”ˆ•±•µ•¹Ðõìñ¥AÉ…Ñ¥•A…”ÕÍ•ÈõíÕÍ•Éô…ÕÑ¡¡•­•õí…ÕÑ¡¡•­•‘ô€¼ùô€¼ø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ½½‘„¼éÉ½½µ%ˆ•±•µ•¹Ðõìñ1¥Ù•QÉ…¹Í±…Ñ¥½¸ÕÍ•ÈõíÕÍ•ÉôÁÉ½™¥±”õíÁÉ½™¥±•ô…ÕÑ¡¡•­•õí…ÕÑ¡¡•­•‘ô€¼ùô€¼ø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ½¡…­­¥¹‘„ˆ•±•µ•¹Ðõìñ%¹™¼Á…”ô‰…‰½ÕÐˆ€¼ùô€¼ø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ½¹…Í¥°µ…±¥Í¥Èˆ•±•µ•¹Ðõìñ%¹™¼Á…”ô‰¡½Üˆ€¼ùô€¼ø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ½½é•±±¥­±•Èˆ•±•µ•¹Ðõìñ%¹™¼Á…”ô‰™•…ÑÕÉ•Ìˆ€¼ùô€¼ø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ½…‰½¹•±¥¬ˆ•±•µ•¹ÐõìñMÕ‰ÍÉ¥ÁÑ¥½¹A…”ÕÍ•ÈõíÕÍ•ÉôÁÉ½™¥±”õíÁÉ½™¥±•ô½¹M…Ù•½ÉUÍ•ÈõíÍ…Ù•I•¥ÍÑ•É•‘AÉ½™¥±•ô€¼ùô€¼ø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ½­…å¥Ðˆ•±•µ•¹ÐõìñÕÑ¡A…”½¹I•¥ÍÑ•É•õíÍ…Ù•I•¥ÍÑ•É•‘AÉ½™¥±•ô€¼ùô€¼ø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ½ÁÉ½™¥°ˆ•±•µ•¹ÐõìñAÉ½™¥±•A…”ÕÍ•ÈõíÕÍ•ÉôÁÉ½™¥±”õíÁÉ½™¥±•ô½¹M…Ù”õíÍ…Ù•AÉ½™¥±•ô½¹M…Ù•½ÉUÍ•ÈõíÍ…Ù•I•¥ÍÑ•É•‘AÉ½™¥±•ô€¼ùô€¼ø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ½¥é±¥±¥¬ˆ•±•µ•¹Ðõìñ%¹™¼Á…”ô‰ÁÉ¥Ù…äˆ€¼ùô€¼ø(€€€€€€€€ñI½ÕÑ”(€€€€€€€€€Á…Ñ ôˆ½­Õ±±…¹¥´µÍ…ÉÑ±…É¤ˆ(€€€€€€€€€•±•µ•¹Ðõìñ%¹™¼Á…”ô‰Ñ•ÉµÌˆ€¼ùô(€€€€€€€€¼ø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ½¥…‘”µÁ½±¥Ñ¥­…Í¤ˆ•±•µ•¹Ðõìñ%¹™¼Á…”ô‰É•™Õ¹ˆ€¼ùô€¼ø(€€€€€€€€ñI½ÕÑ”Á…Ñ ôˆ¨ˆ•±•µ•¹Ðõìñ9½Ñ½Õ¹€¼ùô€¼ø(€€€€€€ð½I½ÕÑ•Ìø(€€€€€ì……ÕÑ¡I•…‘ä€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…ÕÑ µ¹½Ñ”ˆø(€€€€€€€€€íÐ ‰…ÕÑ ¹™¥É•‰…Í•5¥ÍÍ¥¹œˆ¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€¥ô(€€€€ð½1…å½ÕÐø(€€¤ì)ô(