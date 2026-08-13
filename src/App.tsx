import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
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
import { billingProvider, plans as planCatalog, startCheckout } from "./lib/billing";
import "./membership.css";
import AccessGate from "./components/AccessGate";
import { useAccess } from "./lib/access";
import { fetchServerPlan } from "./lib/serverPlan";
import { clearSpeechQueue, isSpeechQueueBusy, queueSpeech, speakText, unlockSpeechOutput } from "./lib/speechOutput";
import { siteLanguages, useI18n, type SiteLang } from "./lib/i18n";
import HomeExpansion from "./components/HomeExpansion";
import AiPractice from "./components/AiPractice";
import HeroScene from "./components/HeroScene";
// Premium katman en son yüklenir; tüm sayfa stillerinin üstünde kalması gerekir.
import "./premium.css";
const langs = [
  ["tr-TR", "Türkçe"],
  ["en-US", "İngilizce"],
  ["de-DE", "Almanca"],
  ["fr-FR", "Fransızca"],
  ["es-ES", "İspanyolca"],
  ["it-IT", "İtalyanca"],
  ["ar-SA", "Arapça"],
];
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
  return (
    <Link className="brand" to="/" aria-label="Dilmaç ana sayfa">
      <span className="brandmark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <strong>Dilmaç</strong>
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
  const { lang, setLang, t } = useI18n();
  // Sayfa kaydırıldığında başlık camlaşır; sınıfı gövdeye yazıyoruz ki
  // her sayfa aynı davranışı ücretsiz alsın.
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
          aria-label={t("menu.open")}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? "open" : ""} aria-label="Ana menü">
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
          {user && (
            <Link className="member-chip" to="/profil" onClick={() => setOpen(false)}>
              <UserCircle />
              <span><small>{planCatalog.find((p) => p.id === profile?.plan)?.name || "Üye"}</small><strong>{profile?.firstName || user.displayName || "Profilim"}</strong></span>
            </Link>
          )}
          {user ? (
            <button className="ghost auth-button" onClick={() => logout()}><LogOut />{t("auth.logout")}</button>
          ) : (
            <Link className="ghost auth-button" to="/kayit" onClick={() => setOpen(false)}><LogIn />{t("auth.signup")}</Link>
          )}
          <button className="primary" onClick={() => navigate("/uygulama")}>
            {t("cta.start")}
            <ArrowRight />
          </button>
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer>
        <div className="foot-grid">
          <div className="foot-brand">
            <Brand />
            <p>İki kişi kendi dilinde konuşur, Dilmaç aradaki mesafeyi kapatır. Tarayıcıda çalışır, kurulum istemez.</p>
          </div>
          <div className="foot-col">
            <h4>Ürün</h4>
            <Link to="/uygulama">Canlı çeviri</Link>
            <Link to="/deneme">AI ile pratik</Link>
            <Link to="/ozellikler">Özellikler</Link>
            <Link to="/abonelik">Abonelik</Link>
          </div>
          <div className="foot-col">
            <h4>Kaynaklar</h4>
            <Link to="/nasil-calisir">Nasıl çalışır</Link>
            <Link to="/hakkinda">Hakkında</Link>
            <Link to="/kayit">Kayıt ol</Link>
            <Link to="/profil">Hesabım</Link>
          </div>
          <div className="foot-col">
            <h4>Yasal</h4>
            <Link to="/gizlilik">{t("footer.privacy")}</Link>
            <Link to="/kullanim-sartlari">{t("footer.terms")}</Link>
            <Link to="/iade-politikasi">İade politikası</Link>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} Dilmaç</span>
          <em>Dil farklı. Konuşma aynı.</em>
        </div>
      </footer>
    </>
  );
}
function AuthPage({ onRegistered }: { onRegistered: (user: User, profile: MemberProfile) => void }) {
  const navigate = useNavigate();
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
    } catch (reason) { setError((reason as Error).message); }
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
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="auth-split">
    <div className="auth-pitch">
      <span className="eyebrow"><Sparkles /> Ücretsiz hesap</span>
      <h1>Konuşmaya bir adım kaldı.</h1>
      <p>Hesabınızı saniyeler içinde açın; canlı çeviri odanız ve AI pratik ekranınız anında hazır olsun.</p>
      <div className="auth-benefits">
        <span><CheckCircle2 />Sınırsız AI pratik ve canlı çeviri odası</span>
        <span><CheckCircle2 />7 dilde çift yönlü konuşma</span>
        <span><CheckCircle2 />Görüşmeleriniz sunucuda saklanmaz</span>
        <span><CheckCircle2 />Kredi kartı istemez</span>
      </div>
      <div className="auth-mini" aria-hidden="true">
        <div className="row"><span className="scene-dot" />Oda bağlı · DLM-482</div>
        <div className="bubble"><b>Merhaba, nasılsın?</b><small>Hello, how are you?</small></div>
        <div className="bubble"><b>I&apos;m good, thanks!</b><small>İyiyim, teşekkürler!</small></div>
      </div>
    </div>
    <div className="auth-card">
      <h2>{mode === "register" ? "Hesap oluştur" : "Tekrar hoş geldiniz"}</h2>
      <p>{mode === "register" ? "30 saniyede kaydolun, hemen konuşmaya başlayın." : "Hesabınıza giriş yapın ve kaldığınız yerden devam edin."}</p>
      <div className="auth-tabs">
        <button type="button" className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>Kayıt ol</button>
        <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Giriş yap</button>
      </div>
      <button className="google-button" onClick={google} disabled={busy}><GoogleLogo />Google ile {mode === "register" ? "kayıt ol" : "giriş yap"}</button>
      <div className="auth-divider"><span>veya e-posta ile</span></div>
      <form onSubmit={submit}>
        {mode === "register" && <div className="name-row">
          <label>Ad<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" /></label>
          <label>Soyad<input value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" /></label>
        </div>}
        <label><span><Mail />E-posta</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="ornek@email.com" /></label>
        <label><span><LockKeyhole />Şifre</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="En az 6 karakter" /></label>
        {error && <div className="auth-error"><AlertCircle />{error}</div>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Lütfen bekleyin…" : mode === "register" ? "Hesabımı oluştur" : "Giriş yap"}<ArrowRight /></button>
      </form>
      <p className="auth-legal">Devam ederek <Link to="/kullanim-sartlari">Kullanım Şartları</Link> ve <Link to="/gizlilik">Gizlilik</Link> metnini kabul etmiş olursunuz.</p>
    </div>
  </section>;
}

function SubscriptionPage({ user, profile, onSaveForUser }: { user: User | null; profile: MemberProfile | null; onSaveForUser: (user: User, profile: MemberProfile) => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
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
      // Ödeme sağlayıcısı bağlıysa ücretli planlar gerçek checkout'a gider;
      // plan, ödeme onaylanınca webhook üzerinden sunucuya yazılır.
      if (plan !== "free" && billingProvider() !== "none") {
        await startCheckout({ planId: plan, uid: activeUser.uid, email: activeUser.email });
        setBusy(null);
        return;
      }
      const next = { ...(readProfile(activeUser) || defaultProfile(activeUser)), plan };
      onSaveForUser(activeUser, next);
      navigate(next.completed ? "/profil" : "/profil?welcome=1");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="pricing">
      <div className="pricing-head reveal">
        <span className="eyebrow"><Crown /> Abonelik</span>
        <h1>Dil engelini <em>tamamen</em> kaldırın.</h1>
        <p>Karşınızdaki kendi dilinde konuşsun, siz kendi dilinizde duyun. Ücretsiz başlayın, ihtiyacınız büyüyünce yükseltin.</p>
      </div>

      <div className="pricing-assure reveal">
        <span><ShieldCheck />30 gün koşulsuz iade</span>
        <span><CheckCircle2 />İstediğiniz an iptal</span>
        <span><Lock />Kart bilgisi bize ulaşmaz</span>
        <span><CheckCircle2 />Kurulum gerekmez</span>
      </div>

      <div className="pricing-grid">
        {planCatalog.map((plan) => {
          const current = profile?.plan === plan.id;
          return (
            <article key={plan.id} className={`pricing-card reveal ${plan.highlight ? "featured" : ""}`}>
              {plan.highlight && <b className="pricing-badge">EN POPÜLER</b>}
              <h2>{plan.name}</h2>
              <p className="note">{plan.note}</p>
              <div className="pricing-amount"><b>{plan.price}</b><span>{plan.period}</span></div>
              <ul>{plan.features.map((feature) => <li key={feature}><CheckCircle2 />{feature}</li>)}</ul>
              {current ? (
                <button className="pricing-cta current" type="button" disabled>Mevcut planınız</button>
              ) : user ? (
                <button className="primary pricing-cta" type="button" disabled={busy === plan.id} onClick={() => choose(plan.id)}>
                  {busy === plan.id ? "İşleniyor…" : plan.id === "free" ? "Ücretsiz devam et" : `${plan.name}'a geç`}
                </button>
              ) : (
                <button className="google-button" type="button" disabled={busy === plan.id} onClick={() => choose(plan.id)}>
                  <GoogleLogo />{busy === plan.id ? "Bağlanıyor…" : "Google ile başla"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {error && <p className="pricing-note" style={{ color: "var(--coral)" }}>{error}</p>}

      <div className="compare reveal">
        <h3>Planları yan yana görün</h3>
        <table>
          <thead>
            <tr>
              <th>Özellik</th>
              <th>Başlangıç</th>
              <th className="col-pro">Pro</th>
              <th>Ekip</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Canlı çeviri odası", "✓", "✓", "✓"],
              ["AI ile sesli pratik", "✓", "✓", "✓"],
              ["Desteklenen dil sayısı", "7", "7", "7"],
              ["Görüşme süresi", "Sınırlı", "Sınırsız", "Sınırsız"],
              ["Orijinal ses + çeviri sesi", "✓", "✓", "✓"],
              ["Öncelikli çeviri hızı", "—", "✓", "✓"],
              ["Aynı anda birden fazla oda", "—", "—", "✓"],
              ["Ekip üyesi yönetimi", "—", "—", "✓"],
              ["Öncelikli destek", "—", "E-posta", "Öncelikli"],
              ["30 gün koşulsuz iade", "—", "✓", "✓"],
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
          ? <>Şu an <b>ödeme alınmıyor</b>. Plan seçiminiz hesabınıza işlenir; ödeme sağlayıcısı bağlandığında aynı ekrandan devam edeceksiniz.</>
          : <>Ödemeler <b>güvenli sağlayıcı</b> üzerinden alınır; kart bilgileriniz Dilmaç'a hiçbir zaman ulaşmaz. Aboneliğinizi istediğiniz an iptal edebilirsiniz.</>}
      </p>

      <div className="pricing-faq reveal">
        <h3>Sık sorulanlar</h3>
        <details><summary>Ücretsiz planda ne kadar konuşabilirim?</summary><p>Lansman süresince ücretsiz hesapla hem AI pratik hem canlı çeviri sınırsız. İlerleyen dönemde ücretsiz planda süre sınırı uygulanabilir; aboneler bundan etkilenmez.</p></details>
        <details><summary>Görüşmelerim kaydediliyor mu?</summary><p>Hayır. Konuşmalar iki tarayıcı arasında doğrudan kurulur; metin ve ses sunucuda saklanmaz. Yalnızca hata ayıklama için teknik hata kayıtları tutulur.</p></details>
        <details><summary>İstediğim zaman iptal edebilir miyim?</summary><p>Evet. Aboneliğinizi istediğiniz an durdurabilirsiniz; dönem sonuna kadar kullanmaya devam edersiniz. Ayrıca tüm ücretli planlarda 30 gün koşulsuz para iade garantisi vardır — soru sormayız.</p></details>
        <details><summary>Hangi diller destekleniyor?</summary><p>Türkçe, İngilizce, Almanca, Fransızca, İspanyolca, İtalyanca ve Arapça. Her iki taraf kendi dilini seçer, çeviri iki yönlü çalışır.</p></details>
      </div>
    </section>
  );
}

function ProfilePage({ user, profile, onSave, onSaveForUser }: { user: User | null; profile: MemberProfile | null; onSave: (profile: MemberProfile) => void; onSaveForUser: (user: User, profile: MemberProfile) => void }) {
  const navigate = useNavigate();
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
    } catch (error) { alert((error as Error).message); }
  };
  if (!user || !initial) {
    return (
      <section className="auth-split">
        <div className="auth-pitch">
          <span className="eyebrow"><UserCircle /> Üyelik merkezi</span>
          <h1>Profilinizi oluşturun.</h1>
          <p>Google hesabınızla saniyeler içinde kaydolun; canlı çeviri odanız ve pratik ekranınız hazır olsun.</p>
          <div className="auth-benefits">
            <span><CheckCircle2 />Sınırsız AI pratik</span>
            <span><CheckCircle2 />Kendi canlı çeviri odanız</span>
            <span><CheckCircle2 />Kredi kartı istemez</span>
          </div>
        </div>
        <div className="auth-card">
          <h2>Hemen başlayın</h2>
          <p>Tek dokunuşla güvenli kayıt.</p>
          <button className="google-button" onClick={() => void google()}><GoogleLogo />Google ile kayıt ol</button>
          <div className="auth-divider"><span>veya</span></div>
          <Link className="ghost" to="/kayit" style={{ width: "100%", justifyContent: "center", height: 52 }}><LogIn />E-posta ile devam et</Link>
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
          <h1>{initial.completed ? `Merhaba, ${firstName || "hoş geldiniz"}` : "Kaydınızı tamamlayın"}</h1>
          <p>{user.email}</p>
        </div>
        <span className={`plan-badge ${initial.plan}`}>
          {initial.plan === "free" ? <Sparkles /> : <Crown />}
          {currentPlan.name.toUpperCase()}
        </span>
      </div>

      <div className="dash-grid">
        <form className="dash-card" onSubmit={save}>
          <h2>Hesap bilgileri</h2>
          <p className="big">Profilinizi güncelleyin</p>
          <label>Ad<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" /></label>
          <label>Soyad<input value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" /></label>
          <label>E-posta<input value={user.email || ""} disabled /></label>
          <div className="dash-actions">
            <button className="primary" type="submit"><CheckCircle2 />{saved ? "Kaydedildi" : "Kaydet ve devam et"}</button>
          </div>
        </form>

        <div className="dash-card">
          <h2>Aboneliğiniz</h2>
          <p className="big">{currentPlan.name} · {currentPlan.price}</p>
          <div className="trust-list" style={{ marginBottom: 18 }}>
            {currentPlan.features.slice(0, 4).map((feature) => (
              <span key={feature}><CheckCircle2 />{feature}</span>
            ))}
          </div>
          <div className="dash-actions">
            <Link className="primary" to="/abonelik"><CreditCard />{initial.plan === "free" ? "Pro'ya yükselt" : "Planı yönet"}</Link>
          </div>
        </div>

        <div className="dash-card">
          <h2>Hızlı başlangıç</h2>
          <p className="big">Konuşmaya başlayın</p>
          <div className="trust-list" style={{ marginBottom: 18 }}>
            <span><Radio />Canlı çeviri odası açın ve bağlantıyı paylaşın.</span>
            <span><Bot />Karşınızda kimse yoksa AI ile pratik yapın.</span>
          </div>
          <div className="dash-actions">
            <Link className="primary" to="/uygulama"><Mic />Canlı çeviriyi aç</Link>
            <Link className="ghost" to="/deneme"><Bot />AI ile pratik</Link>
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
  const marquee = [
    "Türkçe", "English", "Deutsch", "Français", "Español", "Italiano", "العربية",
  ];
  return (
    <div className="home">
      {/* ---------- HERO ---------- */}
      <section className="hero">
        <div>
          <span className="eyebrow"><Sparkles /> Canlı konuşma çevirisi</span>
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
              AI ile ücretsiz dene
            </Link>
          </div>
          <div className="trust">
            <span><Radio />{t("trust.1")}</span>
            <span><ShieldCheck />{t("trust.2")}</span>
            <span><Users />{t("trust.3")}</span>
            <span><WifiOff />Kurulum yok</span>
          </div>
        </div>
        <HeroScene />
      </section>

      {/* ---------- DİLLER ŞERİDİ ---------- */}
      <section className="langs-band reveal">
        <h2>7 dilde çift yönlü konuşma — herkes kendi dilinde kalır</h2>
        <div className="langs-track">
          {[...marquee, ...marquee].map((name, index) => (
            <span key={`${name}-${index}`}><i />{name}</span>
          ))}
        </div>
      </section>

      {/* ---------- NASIL ÇALIŞIR ---------- */}
      <section className="band reveal">
        <div className="section-head">
          <span className="eyebrow"><Zap /> Dört adım</span>
          <h2>{t("steps.title")}</h2>
          <p>Hesap açmadan da deneyebilirsiniz. Odayı açın, bağlantıyı paylaşın, konuşmaya başlayın.</p>
        </div>
        <div className="steps">
          {[
            ["01", t("step.1")],
            ["02", t("step.2")],
            ["03", t("step.3")],
            ["04", t("step.4")],
          ].map(([n, text]) => (
            <div key={n}>
              <b>{n}</b>
              <h3>{text}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- BENTO ÖZELLİKLER ---------- */}
      <section className="reveal">
        <div className="section-head">
          <span className="eyebrow"><Star /> Neden Dilmaç</span>
          <h2>Konuşmanın hızında çeviri.</h2>
          <p>Yazışma değil, konuşma için tasarlandı. Ses, metin ve çeviri aynı ekranda akar.</p>
        </div>
        <div className="bento">
          <article className="wide">
            <Gauge className="bento-ico" />
            <h3>{t("f1.t")}</h3>
            <p>Siz konuşurken cümle tamamlanır tamamlanmaz çeviri karşı tarafa düşer. Bekleme, tuşa basma, sıra bekleme yok.</p>
            <div className="bento-demo">
              <div className="row"><b>Türkçe</b> Yarınki toplantı saat kaçta?</div>
              <div className="bar"><i /></div>
              <div className="row"><b>English</b> What time is tomorrow&apos;s meeting?</div>
            </div>
          </article>
          <article className="tall">
            <Headphones className="bento-ico" />
            <h3>Orijinal ses + çeviri</h3>
            <p>Karşınızdakinin gerçek sesini duyarsınız; ton ve duygu kaybolmaz. Çeviri aynı anda hem yazıyla hem sesle gelir.</p>
          </article>
          <article>
            <MessagesSquare className="bento-ico" />
            <h3>{t("f2.t")}</h3>
            <p>Her iki taraf da kendi dilini seçer. Çeviri iki yönlü, tek ekranda akan tek bir sohbet olarak görünür.</p>
          </article>
          <article>
            <Bot className="bento-ico" />
            <h3>AI ile pratik</h3>
            <p>Karşınızda kimse yokken yapay zekâ ile sesli pratik yapın. Aynı ekran, aynı deneyim.</p>
          </article>
          <article className="wide">
            <Lock className="bento-ico" />
            <h3>Görüşmeler saklanmaz</h3>
            <p>Ses ve metin iki tarayıcı arasında doğrudan taşınır; sunucuda görüşme kaydı tutulmaz. Mikrofon yalnızca siz açtığınızda çalışır.</p>
          </article>
          <article>
            <Languages className="bento-ico" />
            <h3>7 dil, tek arayüz</h3>
            <p>Türkçe, İngilizce, Almanca, Fransızca, İspanyolca, İtalyanca ve Arapça arasında anında geçiş.</p>
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
          <article><Heart /><b>Ailede</b><p>Farklı ülkelerdeki yakınlarınızla arada tercüman olmadan konuşun.</p></article>
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
            <span><ShieldCheck />Görüşme metni ve sesi sunucuda saklanmaz.</span>
            <span><ShieldCheck />Mikrofon yalnızca siz başlattığınızda açılır.</span>
            <span><ShieldCheck />Ses bağlantısı iki tarayıcı arasında doğrudan kurulur.</span>
            <span><ShieldCheck />Ödemeler yetkili satıcı üzerinden alınır; kart bilgisi bize ulaşmaz.</span>
            <span><ShieldCheck />Tüm ücretli planlarda 30 gün koşulsuz iade.</span>
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
// AI pratik kayıtsız kullanıcıya 2 dakika açıktır; hesabı olan sınırsız kullanır.
function AiPracticePage({ user, authChecked }: { user: User | null; authChecked: boolean }) {
  const visible = useVisible();
  const [conversing, setConversing] = useState(false);
  const access = useAccess({
    uid: user ? null : "anon",
    plan: "free",
    active: visible && conversing,
    ready: authChecked,
  });
  if (user) return <AiPractice />;
  return (
    <AccessGate state={access.state} remaining={access.remaining} variant="ai" paused={!conversing}>
      <AiPractice onConversingChange={setConversing} />
    </AccessGate>
  );
}
function LiveTranslation({ user, profile, authChecked }: { user: User | null; profile: MemberProfile | null; authChecked: boolean }) {
  const visible = useVisible();
  // Sayaç yalnızca gerçekten konuşulurken işler. Odayı açıp karşı tarafı
  // beklemek, bağlantı kurulmadan durmak veya sekmeyi arka plana almak
  // kullanıcının hakkını yakmaz.
  const [conversing, setConversing] = useState(false);
  const access = useAccess({
    uid: user?.uid || null,
    plan: profile?.plan || "free",
    active: visible && conversing,
    ready: authChecked,
  });
  return (
    <AccessGate state={access.state} remaining={access.remaining} paused={!conversing}>
      <Translator onConversingChange={setConversing} />
    </AccessGate>
  );
}
function Translator({ onConversingChange }: { onConversingChange?: (value: boolean) => void } = {}) {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [source, setSource] = useState("tr-TR"),
    [target, setTarget] = useState("İngilizce"),
    [localMessages, setLocalMessages] = useState<QueueItem[]>([]),
    [remoteMessages, setRemoteMessages] = useState<RoomMessage[]>([]),
    [room, setRoom] = useState(""),
    [active, setActive] = useState(""),
    [key] = useState(sessionStorage.getItem("dilmac-key") || "backend"),
    [notice, setNotice] = useState("Hazır"),
    [, setRole] = useState<"host" | "guest" | null>(null),
    [draft, setDraft] = useState(""),
    [remoteMuted, setRemoteMuted] = useState(false),
    [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [remoteLanguage, setRemoteLanguage] = useState<RoomLanguage | null>(null);
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
  const receiveMessage = useCallback((message: RoomMessage) => {
    if (!message.source.trim() || !message.translated.trim()) return;
    setRemoteMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    setNotice("Karşı taraftan yeni çeviri geldi.");
    if (!autoSpeakRef.current) return;
    const code = langs.find(([, name]) => name === message.targetLanguage)?.[0] || "tr-TR";
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
      queueSpeech(message.translated, code, { onEnd: resume, onError: resume });
      return;
    }
    window.setTimeout(() => queueSpeech(message.translated, code, { onEnd: resume, onError: resume }), handoverDelay);
  }, []);
  const receiveRemoteLanguage = useCallback((language: RoomLanguage) => {
    setRemoteLanguage(language);
    setTarget(language.name);
    setNotice(`Karşı tarafın dili ${language.name}; çeviri dili otomatik güncellendi.`);
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
      setNotice("Orijinal ses bağlantısı kuruldu. Artık birbirinizi duyabilirsiniz.");
    }
  }, [roomConnection.voiceConnected]);
  useEffect(() => queueRef.current!.subscribe(setLocalMessages), []);
  useEffect(() => {
    const language = langs.find(([code]) => code === source);
    if (language) sendLanguage({ code: language[0], name: language[1] });
  }, [sendLanguage, source]);
  const changeSourceLanguage = (code: string) => {
    setSource(code);
    const language = langs.find(([candidate]) => candidate === code);
    if (language) {
      sendLanguage({ code: language[0], name: language[1] });
      setNotice(`Konuşma diliniz ${language[1]} olarak güncellendi.`);
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
      connectRoom(incoming, incomingRole);
      setNotice(`${incoming} odasına bağlanılıyor…`);
    }
  }, [connectRoom, navigate, roomId]);
  const enqueue = useCallback((text: string) => {
    queueRef.current?.enqueue({ source: text, sourceLanguage: langs.find(([code]) => code === source)?.[1] || source, targetLanguage: target });
    setNotice("Mesaj sıraya alındı.");
  }, [source, target]);
  const speech = useSpeech(source, enqueue);
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
  const conversing = roomConnection.connected
    && (speech.listening || localMessages.length > 0 || remoteMessages.length > 0);
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
      setNotice("Oda kodu 6 harf veya rakam olmalı.");
      return;
    }
    navigate(`/oda/${room.toUpperCase()}`);
  };
  const speak = (text: string, languageName?: string) => {
    const code = langs.find(([, name]) => name === languageName)?.[0] || "tr-TR";
    speakText(text, code);
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
      setNotice("Orijinal ses kapatıldı.");
      return;
    }
    const enabled = await roomConnection.enableVoice();
    if (enabled) setNotice("Mikrofonunuz açık. Karşı tarafın ses bağlantısı bekleniyor.");
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
      setNotice("iPhone'da çeviri mikrofonu açıldı. Orijinal sesi ayrıca açabilirsiniz.");
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
  const statusError = speech.error || roomConnection.error || roomConnection.voiceError;
  if (!roomId) return <section className="room-lobby"><div className="lobby-hero"><div className="lobby-icon"><Languages /></div><h1>Konuşma odanızı açın.</h1><p>Yeni bir oda oluşturun veya size gönderilen kodla doğrudan görüşmeye katılın.</p></div><div className="lobby-actions"><article><span>Yeni görüşme</span><h2>Bir oda oluşturun</h2><p>Size özel bağlantıyı paylaşın; ikinci kişi tek dokunuşla katılsın.</p><button className="primary" onClick={createRoom}>Oda oluştur<ArrowRight /></button></article><article><span>Davete katıl</span><h2>Oda kodunu girin</h2><p>Bağlantının sonundaki 6 karakterli kodu kullanabilirsiniz.</p><label>Oda kodu<input value={room} maxLength={6} onChange={(event) => setRoom(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="A1B2C3" /></label><button className="ghost" onClick={join}>Odaya katıl<ArrowRight /></button></article></div><div className="lobby-note"><ShieldCheck /> Görüşmeler doğrudan iki tarayıcı arasında kurulur.</div></section>;
  return (
    <RoomScreen
      roomCode={active}
      inviteLink={inviteLink}
      connected={roomConnection.connected}
      connecting={roomConnection.connecting}
      peerLanguage={remoteLanguage?.name || null}
      localMessages={localMessages}
      remoteMessages={remoteMessages}
      languages={langs}
      sourceCode={source}
      onSourceChange={changeSourceLanguage}
      targetName={target}
      onTargetChange={setTarget}
      targetLocked={Boolean(remoteLanguage)}
      listening={speech.listening}
      interimText={speech.interimText}
      onToggleMic={toggleConversation}
      micSupported={speech.supported}
      autoSpeak={autoSpeak}
      onToggleAutoSpeak={() => {
        unlockSpeechOutput();
        setAutoSpeak((value) => {
          if (value) clearSpeechQueue();
          localStorage.setItem("dilmac-autospeak", value ? "0" : "1");
          return !value;
        });
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
      status={statusError || notice}
      statusIsError={Boolean(statusError)}
      audioSlot={<audio ref={remoteAudioRef} autoPlay playsInline aria-hidden="true" />}
    />
  );
}
const pages: {
  [k: string]: { title: string; intro: string; sections: [string, string][] };
} = {
  about: {
    title: "Hakkında",
    intro:
      "Dilmaç, farklı dillerde konuşan iki insanın doğal iletişimini kolaylaştırmak için tasarlandı.",
    sections: [
      [
        "Neden Dilmaç?",
        "Dil engelini mümkün olan en sade arayüzle azaltmak; konuşmayı bölmeden anlaşmayı sağlamak.",
      ],
      [
        "Yaklaşımımız",
        "Önce çalışan iletişim, sonra gösteriş. İzinler, hata durumları ve mahremiyet açıkça anlatılır.",
      ],
    ],
  },
  how: {
    title: "Nasıl Çalışır",
    intro: "Dört kısa adımda canlı görüşmeye başlayın.",
    sections: [
      [
        "1. Dilleri seçin",
        "Kendi konuşma dilinizi ve duymak istediğiniz hedef dili belirleyin.",
      ],
      [
        "2. Oda oluşturun",
        "Altı karakterli oda kodunu veya davet bağlantısını diğer kişiyle paylaşın.",
      ],
      [
        "3. Sesli görüşmeyi açın",
        "Tarayıcı izninden sonra orijinal sesiniz karşı tarafa ulaşır; konuşmanız aynı anda yazıya dönüşür.",
      ],
      [
        "4. Çeviriyi alın",
        "Metin seçtiğiniz dile çevrilir ve isterseniz sesli okunur.",
      ],
    ],
  },
  features: {
    title: "Özellikler",
    intro: "Canlı iletişim için gereken temel araçlar tek yerde.",
    sections: [
      [
        "Orijinal ses görüşmesi",
        "İki kişi birbirinin gerçek sesini WebRTC üzerinden duyarken altyazı ve çeviriyi aynı ekranda takip eder.",
      ],
      [
        "Canlı konuşma tanıma",
        "Desteklenen tarayıcılarda Web Speech API ile konuşmayı anlık metne dönüştürür.",
      ],
      [
        "Doğal çeviri",
        "Bağlama uygun, doğal çeviri üreten güncel bir yapay zekâ modeli kullanır.",
      ],
      [
        "Sesli okuma",
        "Çevrilen cümleyi cihazınızın ses motoruyla dinleyebilirsiniz.",
      ],
      [
        "Erişilebilir tasarım",
        "Klavye kullanımı, görünür odak, yüksek kontrast ve azaltılmış hareket desteği içerir.",
      ],
    ],
  },
  privacy: {
    title: "Gizlilik",
    intro:
      "Bu metin genel bilgilendirme taslağıdır; hukuki danışmanlık değildir.",
    sections: [
      [
        "Mikrofon",
        "Mikrofon yalnızca sizin açık eyleminizle başlatılır. Tarayıcı iznini dilediğiniz zaman kaldırabilirsiniz.",
      ],
      [
        "Çeviri verisi",
        "Gerçek AI çevirisinde metin seçtiğiniz sağlayıcıya gönderilir. Sağlayıcının gizlilik koşulları ayrıca geçerlidir.",
      ],
      [
        "Teknik altyapı",
        "Çeviri istekleri Dilmaç sunucusu üzerinden işlenir; tarayıcınızda hiçbir gizli bilgi saklanmaz.",
      ],
    ],
  },
  terms: {
    title: "Kullanım Şartları",
    intro:
      "Dilmaç, bireysel geliştirici Yasin Dural tarafından işletilen bir yazılım hizmetidir (SaaS). Bu sayfayı kullanarak aşağıdaki şartları kabul etmiş olursunuz.",
    sections: [
      [
        "Hizmetin niteliği",
        "Dilmaç tamamen otomatik çalışan bir yazılım ürünüdür; çeviriler yapay zekâ tarafından üretilir, insan çevirmen veya danışmanlık hizmeti içermez. Çeviriler kritik, tıbbi, hukuki veya acil durum iletişiminde tek kaynak olarak kullanılmamalıdır.",
      ],
      [
        "Abonelik ve yenileme",
        "Pro ve Ekip planları aylık aboneliktir ve her dönem sonunda otomatik olarak yenilenir. Yenileme tutarı ve tarihi satın alma sırasında ve ödeme makbuzunuzda açıkça gösterilir. Fiyat değişiklikleri bir sonraki dönemden önce e-posta ile bildirilir.",
      ],
      [
        "İptal",
        "Aboneliğinizi istediğiniz an iptal edebilirsiniz: ödeme makbuzunuzdaki abonelik yönetimi bağlantısından veya destek e-postasına yazarak. İptal sonrası mevcut dönemin sonuna kadar erişiminiz devam eder; bir sonraki dönem ücreti tahsil edilmez.",
      ],
      [
        "İade",
        "Tüm ücretli planlar 30 gün koşulsuz para iade garantisi kapsamındadır. Ayrıntılar İade Politikası sayfasındadır.",
      ],
      [
        "Ödeme işlemcisi",
        "Ödemeler yetkili satıcımız (Merchant of Record) Paddle tarafından işlenir. Kart bilgileriniz Dilmaç'a ulaşmaz; fatura ve vergi işlemleri Paddle üzerinden yürütülür.",
      ],
      [
        "Kullanıcı sorumluluğu",
        "Mikrofon izinlerinin ve hesabınızın güvenli kullanımından siz sorumlusunuz. Hizmetin hukuka aykırı amaçla kullanımı yasaktır.",
      ],
      [
        "Süreklilik",
        "Tarayıcı veya üçüncü taraf servislerine bağlı özelliklerin kesintisiz çalışacağı garanti edilmez; planlı kesintiler makul süre önce duyurulur.",
      ],
      [
        "İletişim",
        "Sorularınız için: yasdural@gmail.com",
      ],
    ],
  },
  refund: {
    title: "İade Politikası",
    intro:
      "30 gün koşulsuz para iade garantisi. Soru sormuyoruz.",
    sections: [
      [
        "Kapsam",
        "Tüm ücretli Dilmaç planları (Pro ve Ekip), ilk satın alma tarihinden itibaren 30 gün boyunca koşulsuz para iade garantisi kapsamındadır. Herhangi bir sebep belirtmeniz gerekmez.",
      ],
      [
        "Nasıl iade alırım?",
        "Satın almadan sonraki 30 gün içinde yasdural@gmail.com adresine e-posta gönderin veya ödeme makbuzunuzdaki Paddle destek bağlantısını kullanın. İadeniz kesintisiz, tam tutar olarak yapılır.",
      ],
      [
        "Süre",
        "İade talepleri en geç 5 iş günü içinde işleme alınır. Tutarın kartınıza yansıması bankanıza bağlı olarak 5-10 iş günü sürebilir.",
      ],
      [
        "Yenileme ödemeleri",
        "Otomatik yenileme sonrasında fark ettiyseniz endişelenmeyin: yenileme tarihinden itibaren 30 gün içinde başvurursanız yenileme ödemesi de tam olarak iade edilir.",
      ],
    ],
  },
};
function Info({ data }: { data: typeof pages.about }) {
  return (
    <section className="info">
      <h1>{data.title}</h1>
      <p className="lead">{data.intro}</p>
      {data.sections.map(([h, p]) => (
        <article key={h}>
          <h2>{h}</h2>
          <p>{p}</p>
        </article>
      ))}
    </section>
  );
}
function NotFound() {
  return (
    <section className="info">
      <h1>Sayfa bulunamadı</h1>
      <p>Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.</p>
      <Link className="primary" to="/">
        Ana sayfaya dön
      </Link>
    </section>
  );
}
export function App() {
  const [user, setUser] = useState<User | null>(null);
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
        <Route path="/deneme" element={<AiPracticePage user={user} authChecked={authChecked} />} />
        <Route path="/oda/:roomId" element={<LiveTranslation user={user} profile={profile} authChecked={authChecked} />} />
        <Route path="/hakkinda" element={<Info data={pages.about} />} />
        <Route path="/nasil-calisir" element={<Info data={pages.how} />} />
        <Route path="/ozellikler" element={<Info data={pages.features} />} />
        <Route path="/abonelik" element={<SubscriptionPage user={user} profile={profile} onSaveForUser={saveRegisteredProfile} />} />
        <Route path="/kayit" element={<AuthPage onRegistered={saveRegisteredProfile} />} />
        <Route path="/profil" element={<ProfilePage user={user} profile={profile} onSave={saveProfile} onSaveForUser={saveRegisteredProfile} />} />
        <Route path="/gizlilik" element={<Info data={pages.privacy} />} />
        <Route
          path="/kullanim-sartlari"
          element={<Info data={pages.terms} />}
        />
        <Route path="/iade-politikasi" element={<Info data={pages.refund} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!authReady && (
        <div className="auth-note">
          Google girişi için Firebase ortam değişkenleri bekleniyor.
        </div>
      )}
    </Layout>
  );
}
