import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  Menu,
  X,
  Mic,
  MicOff,
  Volume2,
  Copy,
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
  Share2,
  Link2,
  Sparkles,
  KeyRound,
  RotateCcw,
  ChevronDown,
  Headphones,
  PhoneCall,
  PhoneOff,
  VolumeX,
  UserCircle,
  Crown,
  Camera,
  CreditCard,
  Mail,
  LockKeyhole,
} from "lucide-react";
import { authReady, loginEmail, loginGoogle, logout, observeUser, registerEmail } from "./lib/auth";
import type { User } from "firebase/auth";
import { translate } from "./lib/translation";
import { useSpeech } from "./hooks/useSpeech";
import { useRoom, type RoomLanguage, type RoomMessage } from "./hooks/useRoom";
import { finishOpenRouter } from "./lib/openrouterAuth";
import { bundledOpenRouterKey } from "./lib/runtimeConfig";
import { MessageQueue, type QueueItem } from "./lib/messageQueue";
import HomeExpansion from "./components/HomeExpansion";
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
  photoURL: string;
  plan: PlanId;
  completed: boolean;
};
const plans: { id: PlanId; name: string; price: string; note: string; features: string[] }[] = [
  { id: "free", name: "Başlangıç", price: "Ücretsiz", note: "Dilmaç'ı keşfetmek için", features: ["Günde 15 dakika mock kullanım", "Temel dil çiftleri", "Tek cihaz profili"] },
  { id: "pro", name: "Pro", price: "₺149 / ay", note: "Düzenli görüşmeler için", features: ["Sınırsız mock görüşme", "Tüm dil çiftleri", "Görüşme geçmişi", "Öncelikli çeviri"] },
  { id: "business", name: "Ekip", price: "₺399 / ay", note: "Küçük ekipler için", features: ["5 kullanıcıya kadar", "Ortak çalışma alanı", "Kullanım raporları", "Öncelikli destek"] },
];
const profileKey = (uid: string) => `dilmac-profile:${uid}`;
function readProfile(user: User | null): MemberProfile | null {
  if (!user) return null;
  try {
    const saved = localStorage.getItem(profileKey(user.uid));
    if (saved) return JSON.parse(saved) as MemberProfile;
  } catch { /* malformed local mock data is ignored */ }
  return null;
}
function defaultProfile(user: User): MemberProfile {
  const parts = (user.displayName || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" "), photoURL: user.photoURL || "", plan: "free", completed: false };
}
function useSmartScroll(changeCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const [hasNew, setHasNew] = useState(false);
  const onScroll = () => { const node = ref.current; if (!node) return; nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight <= 140; if (nearBottom.current) setHasNew(false); };
  const scrollToLatest = () => { const node = ref.current; if (!node) return; node.scrollTo({ top: node.scrollHeight, behavior: "smooth" }); nearBottom.current = true; setHasNew(false); };
  useEffect(() => { const node = ref.current; if (!node) return; if (nearBottom.current) requestAnimationFrame(() => node.scrollTo({ top: node.scrollHeight, behavior: "smooth" })); else setHasNew(true); }, [changeCount]);
  return { ref, onScroll, hasNew, scrollToLatest };
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
  return (
    <>
      <a href="#main" className="skip">
        İçeriğe geç
      </a>
      <header>
        <Brand />
        <button
          className="mobile-menu"
          aria-label="Menüyü aç"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? "open" : ""} aria-label="Ana menü">
          {[
            ["/", "Ana Sayfa"],
            ["/nasil-calisir", "Nasıl Çalışır"],
            ["/ozellikler", "Özellikler"],
            ["/abonelik", "Abonelik"],
            ["/hakkinda", "Hakkında"],
          ].map(([p, n]) => (
            <NavLink key={p} to={p} onClick={() => setOpen(false)}>
              {n}
            </NavLink>
          ))}
          <button
            className="icon-btn"
            onClick={() => setDark(!dark)}
            aria-label={dark ? "Açık tema" : "Koyu tema"}
          >
            {dark ? <Sun /> : <Moon />}
          </button>
          {user && (
            <Link className="member-chip" to="/profil" onClick={() => setOpen(false)}>
              {profile?.photoURL ? <img src={profile.photoURL} alt="" referrerPolicy="no-referrer" /> : <UserCircle />}
              <span><small>{plans.find((p) => p.id === profile?.plan)?.name || "Üye"}</small><strong>{profile?.firstName || user.displayName || "Profilim"}</strong></span>
            </Link>
          )}
          {user ? (
            <button className="ghost auth-button" onClick={() => logout()}><LogOut />Çıkış</button>
          ) : (
            <Link className="ghost auth-button" to="/kayit" onClick={() => setOpen(false)}><LogIn />Kayıt ol</Link>
          )}
          <button className="primary" onClick={() => navigate("/uygulama")}>
            Canlı çeviriyi başlat
            <ArrowRight />
          </button>
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer>
        <Brand />
        <p>Dilleri değil, mesafeleri aşın.</p>
        <div>
          <Link to="/gizlilik">Gizlilik</Link>
          <Link to="/kullanim-sartlari">Kullanım Şartları</Link>
        </div>
        <small>© {new Date().getFullYear()} Dilmaç</small>
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
        onRegistered(result.user, { firstName: firstName.trim(), lastName: lastName.trim(), photoURL: "", plan: "free", completed: true });
      } else await loginEmail(email.trim(), password);
      navigate("/uygulama");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="auth-page"><div className="auth-shell">
    <div className="auth-copy"><span>YENİ ÜYELİK</span><h1>Konuşmaya bir adım kaldı.</h1><p>Normal üyelik oluşturun veya Google hesabınızla saniyeler içinde devam edin.</p><ul><li><CheckCircle2 />Profilinizi kişiselleştirin</li><li><CheckCircle2 />Mock planınızı seçin</li><li><CheckCircle2 />Canlı çeviri odanızı açın</li></ul></div>
    <div className="auth-card"><div className="auth-tabs"><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Kayıt ol</button><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Giriş yap</button></div>
      <button className="google-button" onClick={google} disabled={busy}><strong>G</strong>Google ile {mode === "register" ? "kayıt ol" : "giriş yap"}</button>
      <div className="auth-divider"><span>veya e-posta ile</span></div>
      <form onSubmit={submit}>{mode === "register" && <div className="name-row"><label>Ad<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" /></label><label>Soyad<input value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" /></label></div>}
        <label><span><Mail />E-posta</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="ornek@email.com" /></label>
        <label><span><LockKeyhole />Şifre</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="En az 6 karakter" /></label>
        {error && <div className="auth-error"><AlertCircle />{error}</div>}<button className="primary" type="submit" disabled={busy}>{busy ? "Lütfen bekleyin…" : mode === "register" ? "Normal kayıt oluştur" : "Giriş yap"}<ArrowRight /></button>
      </form><small>Devam ederek Kullanım Şartları ve Gizlilik metnini kabul etmiş olursunuz.</small></div>
  </div></section>;
}
function SubscriptionPage({ user, profile, onSave }: { user: User | null; profile: MemberProfile | null; onSave: (profile: MemberProfile) => void }) {
  const navigate = useNavigate();
  const choose = async (plan: PlanId) => {
    if (!user) {
      try { await loginGoogle(); } catch (error) { alert((error as Error).message); }
      return;
    }
    const next = { ...(profile || defaultProfile(user)), plan };
    onSave(next);
    navigate(next.completed ? "/profil" : "/profil?welcome=1");
  };
  return <section className="membership-page">
    <div className="membership-hero"><span><Crown /> MOCK ABONELİK</span><h1>Size uygun planı seçin.</h1><p>Şimdilik hiçbir ücret alınmaz. Seçiminiz yalnızca bu cihazda demo olarak saklanır.</p></div>
    <div className="plan-grid">{plans.map((plan) => <article key={plan.id} className={plan.id === "pro" ? "featured" : ""}>
      {plan.id === "pro" && <b className="popular">En popüler</b>}<h2>{plan.name}</h2><p>{plan.note}</p><strong className="plan-price">{plan.price}</strong>
      <ul>{plan.features.map((feature) => <li key={feature}><CheckCircle2 />{feature}</li>)}</ul>
      <button className={profile?.plan === plan.id ? "ghost" : "primary"} onClick={() => choose(plan.id)}>{profile?.plan === plan.id ? "Mevcut plan" : user ? "Mock planı seç" : "Google ile kayıt ol"}</button>
    </article>)}</div>
  </section>;
}
function ProfilePage({ user, profile, onSave }: { user: User | null; profile: MemberProfile | null; onSave: (profile: MemberProfile) => void }) {
  const navigate = useNavigate();
  const initial = user ? (profile || defaultProfile(user)) : null;
  const [firstName, setFirstName] = useState(initial?.firstName || "");
  const [lastName, setLastName] = useState(initial?.lastName || "");
  const [photoURL, setPhotoURL] = useState(initial?.photoURL || "");
  if (!user || !initial) return <section className="profile-gate"><UserCircle /><h1>Profilinizi oluşturun</h1><p>Önce Google hesabınızla güvenli şekilde kayıt olun.</p><button className="primary" onClick={() => loginGoogle().catch((error) => alert(error.message))}><LogIn />Google ile kayıt ol</button></section>;
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const next = { ...initial, firstName: firstName.trim(), lastName: lastName.trim(), photoURL: photoURL.trim(), completed: true };
    if (!next.firstName || !next.lastName) return;
    onSave(next); navigate("/uygulama");
  };
  const currentPlan = plans.find((plan) => plan.id === initial.plan) || plans[0];
  return <section className="profile-page">
    <div className="profile-heading"><span>ÜYELİK MERKEZİ</span><h1>{initial.completed ? "Profilim" : "Kaydınızı tamamlayın"}</h1><p>Google hesabınız doğrulandı. Dilmaç deneyiminizi kişiselleştirelim.</p></div>
    <div className="profile-layout"><form className="profile-card" onSubmit={save}>
      <div className="avatar-editor">{photoURL ? <img src={photoURL} alt="Profil önizlemesi" referrerPolicy="no-referrer" /> : <UserCircle />}<span><Camera /> Profil fotoğrafı</span></div>
      <label>Ad<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" /></label>
      <label>Soyad<input value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" /></label>
      <label>Profil fotoğrafı bağlantısı<input value={photoURL} onChange={(e) => setPhotoURL(e.target.value)} placeholder="Google fotoğrafınız otomatik gelir" inputMode="url" /></label>
      <label>Google hesabı<input value={user.email || ""} disabled /></label>
      <button className="primary" type="submit"><CheckCircle2 />Profili kaydet ve devam et</button>
    </form><aside className="subscription-card"><CreditCard /><small>MOCK ABONELİK</small><h2>{currentPlan.name}</h2><strong>{currentPlan.price}</strong><p>Gerçek ödeme bağlantısı henüz aktif değildir.</p><Link className="ghost" to="/abonelik">Planı görüntüle veya değiştir</Link></aside></div>
  </section>;
}
function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <h1>
            Konuş,
            <br />
            <span>anlaşıl.</span>
          </h1>
          <p>
            Dilmaç, iki kişi arasındaki konuşmayı anında yazıya döker ve seçilen
            dile çevirir. Farklı dillerde konuşun, kesintisiz anlaşın.
          </p>
          <Link className="primary large" to="/uygulama">
            Canlı çeviriyi başlat
            <ArrowRight />
          </Link>
          <div className="trust">
            <span>
              <Radio />
              Gerçek zamanlı
            </span>
            <span>
              <ShieldCheck />
              Kontrol sizde
            </span>
            <span>
              <Users />
              İki kişilik
            </span>
          </div>
        </div>
        <LivePreview />
      </section>
      <section className="band">
        <h2>Nasıl çalışır?</h2>
        <div className="steps">
          {[
            ["01", "Dili seçin"],
            ["02", "Odayı paylaşın"],
            ["03", "Konuşun"],
            ["04", "Anında anlayın"],
          ].map(([n, t]) => (
            <div key={n}>
              <b>{n}</b>
              <h3>{t}</h3>
            </div>
          ))}
        </div>
      </section>
      <section className="privacy">
        <div className="shield">
          <ShieldCheck />
        </div>
        <div>
          <h2>Konuşmanız sizin.</h2>
          <p>
            Dilmaç, açık ve anlaşılır izinlerle çalışır. Mikrofon yalnızca siz
            başlattığınızda açılır; API anahtarınız kalıcı olarak sunucuya
            gönderilmez.
          </p>
          <Link to="/gizlilik">
            Gizlilik yaklaşımını okuyun <ArrowRight />
          </Link>
        </div>
      </section>
      <section className="feature-strip">
        <article>
          <Radio />
          <div>
            <h3>Gerçek zamanlı çeviri</h3>
            <p>Konuşurken çevirir, bekletmez.</p>
          </div>
        </article>
        <article>
          <Languages />
          <div>
            <h3>Çift yönlü iletişim</h3>
            <p>Her iki tarafı da anlar ve çevirir.</p>
          </div>
        </article>
        <article>
          <ShieldCheck />
          <div>
            <h3>Gizlilik odaklı</h3>
            <p>Veriniz ve kontrol her zaman sizde.</p>
          </div>
        </article>
        <article>
          <Users />
          <div>
            <h3>Sade ve güçlü</h3>
            <p>Gereksiz kalabalık yok.</p>
          </div>
        </article>
      </section>
      <section className="use-cases">
        <div className="section-copy">
          <span><Globe2 /> Her yerde aynı dil</span>
          <h2>Dil engeli hayatın önüne geçmesin.</h2>
          <p>Seyahatten iş toplantısına, eğitimden günlük sohbete kadar Dilmaç konuşmanın akışını korur.</p>
        </div>
        <div className="use-grid">
          <article><Plane /><b>Seyahatte</b><p>Yol tarifi sorun, rezervasyon yapın, bulunduğunuz yere güvenle uyum sağlayın.</p></article>
          <article><Briefcase /><b>İş hayatında</b><p>Farklı dillerdeki ekiplerle toplantıyı kesmeden iletişim kurun.</p></article>
          <article><GraduationCap /><b>Eğitimde</b><p>Dersleri ve konuşmaları kendi dilinizde takip etmeyi kolaylaştırın.</p></article>
        </div>
      </section>
      <HomeExpansion />
      <section className="home-cta">
        <div><h2>Birbirinizi anlamaya hazırsınız.</h2><p>Odanızı oluşturun, bağlantıyı paylaşın ve konuşmaya başlayın.</p></div>
        <Link className="primary large" to="/uygulama">Canlı çeviriyi aç<ArrowRight /></Link>
      </section>
    </>
  );
}
function LivePreview() {
  return (
    <div className="preview" aria-label="Canlı çeviri örneği">
      <div className="status">
        <i />
        Canlı bağlantı
      </div>
      <div className="wave">▂▅▃▇▄▆▂▅▇▃▆▄▂▇▅</div>
      <b>Türkçe</b>
      <p>Yarınki toplantı saat kaçta başlayacak?</p>
      <hr />
      <b>English</b>
      <p className="accent">What time will tomorrow's meeting start?</p>
      <div className="preview-controls">
        <span>
          <Mic />
          Dinliyor
        </span>
        <Volume2 />
      </div>
    </div>
  );
}
function Translator() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [source, setSource] = useState("tr-TR"),
    [target, setTarget] = useState("İngilizce"),
    [localMessages, setLocalMessages] = useState<QueueItem[]>([]),
    [remoteMessages, setRemoteMessages] = useState<RoomMessage[]>([]),
    [room, setRoom] = useState(""),
    [active, setActive] = useState(""),
    [key, setKey] = useState(sessionStorage.getItem("dilmac-key") || bundledOpenRouterKey),
    [notice, setNotice] = useState("Hazır"),
    [copied, setCopied] = useState(false),
    [role, setRole] = useState<"host" | "guest" | null>(null),
    [draft, setDraft] = useState(""),
    [remoteMuted, setRemoteMuted] = useState(false),
    [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [remoteLanguage, setRemoteLanguage] = useState<RoomLanguage | null>(null);
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
  const createRoom = () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    navigate(`/oda/${code}?role=host`);
  };
  const inviteLink = active
    ? `${location.origin}${import.meta.env.BASE_URL}oda/${active}`
    : "";
  const copyInvite = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setNotice("Davet bağlantısı kopyalandı.");
    window.setTimeout(() => setCopied(false), 1800);
  };
  const shareInvite = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      await navigator.share({ title: "Dilmaç canlı çeviri", text: `Dilmaç'ta ${active} odasına katıl.`, url: inviteLink });
    } else await copyInvite();
  };
  const join = () => {
    if (!/^[A-Z0-9]{6}$/.test(room.toUpperCase())) {
      setNotice("Oda kodu 6 harf veya rakam olmalı.");
      return;
    }
    navigate(`/oda/${room.toUpperCase()}`);
  };
  const speak = (t: string) =>
    speechSynthesis.speak(new SpeechSynthesisUtterance(t));
  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault();
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
    if (speech.listening) {
      speech.toggle();
      return;
    }
    if (!roomConnection.voiceEnabled) {
      const enabled = await roomConnection.enableVoice();
      if (!enabled) return;
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
  const voiceStatus = roomConnection.voiceError
    ? roomConnection.voiceError
    : roomConnection.voiceConnected
      ? "Orijinal ses canlı"
      : roomConnection.voiceEnabled && roomConnection.remoteVoiceReady
        ? "Ses bağlantısı kuruluyor…"
        : roomConnection.voiceEnabled
          ? "Mikrofonunuz açık, karşı taraf bekleniyor"
          : roomConnection.remoteVoiceReady
            ? "Karşı taraf hazır, mikrofonunuzu açın"
            : "Orijinal ses bağlantısını açın";
  const statusError = speech.error || roomConnection.error || roomConnection.voiceError;
  const pendingCount = localMessages.filter((message) => message.status === "queued" || message.status === "translating").length;
  const localScroll = useSmartScroll(localMessages.length);
  const remoteScroll = useSmartScroll(remoteMessages.length);
  if (!roomId) return <section className="room-lobby"><div className="lobby-hero"><div className="lobby-icon"><Languages /></div><h1>Konuşma odanızı açın.</h1><p>Yeni bir oda oluşturun veya size gönderilen kodla doğrudan görüşmeye katılın.</p></div><div className="lobby-actions"><article><span>Yeni görüşme</span><h2>Bir oda oluşturun</h2><p>Size özel bağlantıyı paylaşın; ikinci kişi tek dokunuşla katılsın.</p><button className="primary" onClick={createRoom}>Oda oluştur<ArrowRight /></button></article><article><span>Davete katıl</span><h2>Oda kodunu girin</h2><p>Bağlantının sonundaki 6 karakterli kodu kullanabilirsiniz.</p><label>Oda kodu<input value={room} maxLength={6} onChange={(event) => setRoom(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="A1B2C3" /></label><button className="ghost" onClick={join}>Odaya katıl<ArrowRight /></button></article></div><div className="lobby-note"><ShieldCheck /> Görüşmeler doğrudan iki tarayıcı arasında kurulur.</div></section>;
  return (
    <section className="workspace">
      <div className="workspace-head">
        <div>
          <h1 className="live-title"><span aria-hidden="true"><Languages /></span>Canlı <em>çeviri</em></h1>
          <p>Konuşun veya yazın; çeviri karşı tarafa anında ulaşsın.</p>
        </div>
        <div className="connection">
          <i className={roomConnection.connected ? "on" : roomConnection.connecting ? "waiting" : ""} />
          {roomConnection.connected ? "İkiniz de odadasınız" : roomConnection.connecting ? "Karşı taraf bekleniyor" : active ? `Oda ${active}` : "Bağlantı bekleniyor"}
        </div>
      </div>
      <div className="quick-guide"><Sparkles /><span><b>1.</b> Oda oluştur</span><i/><span><b>2.</b> Bağlantıyı gönder</span><i/><span><b>3.</b> Konuşmaya başla</span></div>
      <section className="room-card" aria-label="Görüşme odası">
        <div className="room-card-copy"><span><Link2 /> Görüşme bağlantısı {role && <b>• {role === "host" ? "Oda sahibi" : "Katılımcı"}</b>}</span><h2>{roomConnection.connected ? "Bağlantı kuruldu, konuşabilirsiniz" : active ? `Oda ${active} hazır` : "Karşı tarafı görüşmeye davet edin"}</h2><p>{roomConnection.connected ? "Söyledikleriniz çevrilerek iki ekranda da anında görünecek." : active ? "Bu bağlantıyı gönderdiğiniz kişi doğrudan odanıza gelir." : "Yeni bir oda oluşturun veya size gönderilen 6 karakterli kodu girin."}</p></div>
        {active && <div className="invite-box"><div><small>Paylaşılabilir bağlantı</small><strong>{inviteLink}</strong></div><button className="ghost" onClick={copyInvite}><Copy />{copied ? "Kopyalandı" : "Kopyala"}</button><button className="primary" onClick={shareInvite}><Share2 />Paylaş</button></div>}
      </section>
      <div className="ai-connect ready"><div><KeyRound /><span><b>Gerçek AI çevirisi hazır</b><small>OpenRouter otomatik bağlı — hiçbir ayar gerekmiyor.</small></span></div></div>
      <section className={`voice-dock ${roomConnection.voiceConnected ? "connected" : ""} ${roomConnection.voiceError ? "has-error" : ""}`} aria-label="Orijinal ses bağlantısı">
        <audio ref={remoteAudioRef} autoPlay playsInline aria-hidden="true" />
        <div className="voice-dock-icon" aria-hidden="true"><Headphones /></div>
        <div className="voice-dock-copy">
          <small>CANLI ORİJİNAL SES</small>
          <strong>{voiceStatus}</strong>
          <span>İki taraf da bir kez açar. Yankıyı önlemek için kulaklık önerilir.</span>
        </div>
        <div className="voice-dock-actions">
          <button className="ghost voice-output" type="button" onClick={toggleRemotePlayback} disabled={!roomConnection.voiceConnected}>
            {remoteMuted ? <VolumeX /> : <Volume2 />}
            {playbackBlocked ? "Sesi oynat" : remoteMuted ? "Sesi aç" : roomConnection.voiceConnected ? "Sesi kapat" : "Ses bekleniyor"}
          </button>
          <button className={roomConnection.voiceEnabled ? "ghost voice-stop" : "primary"} type="button" onClick={toggleVoice} disabled={roomConnection.voiceConnecting && !roomConnection.voiceEnabled}>
            {roomConnection.voiceEnabled ? <PhoneOff /> : <PhoneCall />}
            {roomConnection.voiceEnabled ? "Mikrofonu kapat" : roomConnection.voiceConnecting ? "Mikrofon açılıyor…" : "Orijinal sesi aç"}
          </button>
        </div>
      </section>
      <div className="languagebar">
        <label>
          Konuştuğunuz dil
          <select value={source} onChange={(event) => changeSourceLanguage(event.target.value)}>
            {langs.map((l) => (
              <option key={l[0]} value={l[0]}>
                {l[1]}
              </option>
            ))}
          </select>
        </label>
        <Languages />
        <label>
          {remoteLanguage ? "Karşı tarafın dili (otomatik)" : "Çeviri dili"}
          <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={Boolean(remoteLanguage)}>
            {langs.map((l) => (
              <option key={l[0]} value={l[1]}>
                {l[1]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="conversation conversation-focus">
        <div className="speaker remote remote-focus">
          <h2>Karşı tarafın konuşmaları</h2><span className={`presence ${roomConnection.connected ? "online" : ""}`}>{roomConnection.connected ? "Çevrim içi" : "Bekleniyor"}</span>
          <div className="message-feed" ref={remoteScroll.ref} onScroll={remoteScroll.onScroll}>{remoteMessages.length ? remoteMessages.map((m) => <article key={m.id}><p><small>{m.sourceLanguage}</small>{m.source}</p><strong>{m.translated}</strong><small className="message-status">Teslim alındı</small><button onClick={() => speak(m.translated)} aria-label="Karşı tarafın çevirisini dinle"><Volume2 /></button></article>) : <div className="empty"><Users /><p>{roomConnection.connected ? "Bağlantı kuruldu. Karşı taraf konuştuğunda yalnızca onun mesajları burada görünecek." : "İkinci kişi davet bağlantısıyla katıldığında burada görünür."}</p></div>}</div>
          {remoteScroll.hasNew && <button className="new-messages" onClick={remoteScroll.scrollToLatest}>Yeni mesajlar<ChevronDown /></button>}
        </div>
        <div className="talk-panel">
          <div className="talk-panel-head">
            <div><small>SİZ KONUŞUN</small><strong>Karşı taraf çevirisini görsün</strong></div>
            <div className={`wave ${speech.listening ? "active" : ""}`}>▂▅▃▇▄▆▂▅▇▃▆▄▂</div>
          </div>
          <form className="message-composer" onSubmit={submitDraft}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Yazın veya mikrofonla konuşun…" aria-label="Çevrilecek mesaj" />
            <button className="primary" aria-label="Çevir ve gönder" disabled={!draft.trim()} type="submit"><ArrowRight /><span>Kuyruğa ekle</span></button>
          </form>
          <button
            className={`mic ${speech.listening ? "live" : ""}`}
            onClick={toggleConversation}
          >
            {speech.listening ? <MicOff /> : <Mic />}
            <span>
              {speech.listening ? "Dinlemeyi durdur" : "Konuşmaya başla"}
            </span>
          </button>
          <details className="own-history">
            <summary>
              <span className="slash" aria-hidden="true">/</span>
              <span><b>Kendi konuşmalarım</b><small>{localMessages.length ? `${localMessages.length} mesaj` : "Henüz mesaj yok"}</small></span>
              {pendingCount > 0 && <em>{pendingCount} bekliyor</em>}
              <ChevronDown />
            </summary>
            <div className="message-feed" ref={localScroll.ref} onScroll={localScroll.onScroll}>
              {localMessages.length ? localMessages.map((m) => (
                <article key={m.id} className={`message-${m.status}`}>
                  <p>{m.source}</p>
                  {m.translated && <strong>{m.translated}</strong>}
                  <small className="message-status">{m.status === "queued" ? "Sırada" : m.status === "translating" ? "Çevriliyor…" : m.status === "sent" ? "Gönderildi" : m.status === "delivered" ? "Teslim edildi" : "Gönderilemedi"}</small>
                  {m.status === "failed" && <button className="retry" onClick={() => queueRef.current?.retry(m.id)}><RotateCcw />Tekrar dene</button>}
                  {m.translated && <button onClick={() => speak(m.translated)} aria-label="Çeviriyi dinle"><Volume2 /></button>}
                </article>
              )) : <div className="empty">Henüz kendi konuşmanız yok.</div>}
            </div>
            {localScroll.hasNew && <button className="new-messages own-new" onClick={localScroll.scrollToLatest}>Yeni mesajlar<ChevronDown /></button>}
          </details>
        </div>
      </div>
      <div
        className={`notice ${statusError ? "error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {statusError ? <AlertCircle /> : <CheckCircle2 />}
        {statusError || notice}
      </div>
      <details className="settings">
        <summary>Gerçek AI çevirisi ayarı</summary>
        <p>
          OpenRouter anahtarınız yalnızca bu sekmenin belleğinde tutulur. Ortak
          bilgisayarda kullanmayın.
        </p>
        <input
          type="password"
          value={key}
          placeholder="sk-or-..."
          aria-label="OpenRouter API anahtarı"
          onChange={(e) => {
            setKey(e.target.value);
            sessionStorage.setItem("dilmac-key", e.target.value);
          }}
        />
      </details>
    </section>
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
        "OpenRouter üzerinden seçilebilir yapay zekâ modeliyle bağlama uygun çeviri yapar.",
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
        "API anahtarı",
        "Girilen OpenRouter anahtarı sessionStorage içinde, yalnızca açık sekme oturumu boyunca tutulur.",
      ],
    ],
  },
  terms: {
    title: "Kullanım Şartları",
    intro:
      "Bu metin yayımlama öncesi hukuk uzmanı tarafından gözden geçirilmesi gereken genel bir taslaktır.",
    sections: [
      [
        "Hizmetin niteliği",
        "Çeviriler otomatik üretilir; kritik, tıbbi, hukuki veya acil durum iletişiminde tek kaynak olarak kullanılmamalıdır.",
      ],
      [
        "Kullanıcı sorumluluğu",
        "Mikrofon, hesap ve üçüncü taraf API anahtarlarının güvenli kullanımından kullanıcı sorumludur.",
      ],
      [
        "Süreklilik",
        "Tarayıcı veya üçüncü taraf servislerine bağlı özelliklerin kesintisiz çalışacağı garanti edilmez.",
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
function OpenRouterCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("OpenRouter bağlantısı tamamlanıyor…");
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("code");
    if (!code) { setMessage("OpenRouter doğrulama kodu bulunamadı."); return; }
    finishOpenRouter(code).then((returnTo) => navigate(returnTo, { replace: true })).catch((error: Error) => setMessage(error.message));
  }, [navigate]);
  return <section className="oauth-callback"><div className="lobby-icon"><KeyRound /></div><h1>{message}</h1><p>Bu sayfayı kapatmayın.</p></section>;
}
export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [dark, setDark] = useState(
    localStorage.getItem("dilmac-theme") !== "light",
  );
  useEffect(() => observeUser((nextUser) => { setUser(nextUser); setProfile(readProfile(nextUser)); }), []);
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
        <Route path="/uygulama" element={<Translator />} />
        <Route path="/oda/:roomId" element={<Translator />} />
        <Route path="/openrouter-callback" element={<OpenRouterCallback />} />
        <Route path="/hakkinda" element={<Info data={pages.about} />} />
        <Route path="/nasil-calisir" element={<Info data={pages.how} />} />
        <Route path="/ozellikler" element={<Info data={pages.features} />} />
        <Route path="/abonelik" element={<SubscriptionPage user={user} profile={profile} onSave={saveProfile} />} />
        <Route path="/kayit" element={<AuthPage onRegistered={saveRegisteredProfile} />} />
        <Route path="/profil" element={<ProfilePage user={user} profile={profile} onSave={saveProfile} />} />
        <Route path="/gizlilik" element={<Info data={pages.privacy} />} />
        <Route
          path="/kullanim-sartlari"
          element={<Info data={pages.terms} />}
        />
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
