import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { authReady, loginGoogle, logout, observeUser } from "./lib/auth";
import type { User } from "firebase/auth";
import { translate } from "./lib/translation";
import { useSpeech } from "./hooks/useSpeech";
import { useRoom, type RoomMessage } from "./hooks/useRoom";
import { connectOpenRouter, finishOpenRouter } from "./lib/openrouterAuth";
const langs = [
  ["tr-TR", "Türkçe"],
  ["en-US", "İngilizce"],
  ["de-DE", "Almanca"],
  ["fr-FR", "Fransızca"],
  ["es-ES", "İspanyolca"],
  ["it-IT", "İtalyanca"],
  ["ar-SA", "Arapça"],
];
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
  dark,
  setDark,
}: {
  children: React.ReactNode;
  user: User | null;
  dark: boolean;
  setDark: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const authClick = async () => {
    if (user) await logout();
    else
      try {
        await loginGoogle();
      } catch (e) {
        alert((e as Error).message);
      }
  };
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
          <button className="ghost" onClick={authClick}>
            {user ? (
              <>
                <LogOut />
                Çıkış
              </>
            ) : (
              <>
                <LogIn />
                Google ile giriş
              </>
            )}
          </button>
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
    [messages, setMessages] = useState<(RoomMessage & { demo?: boolean; mine: boolean })[]>([]),
    [room, setRoom] = useState(""),
    [active, setActive] = useState(""),
    [key, setKey] = useState(sessionStorage.getItem("dilmac-key") || ""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("Hazır"),
    [copied, setCopied] = useState(false),
    [role, setRole] = useState<"host" | "guest" | null>(null),
    [draft, setDraft] = useState("");
  const receiveMessage = useCallback((message: RoomMessage) => {
    setMessages((current) => [...current, { ...message, mine: false }]);
    setNotice("Karşı taraftan yeni çeviri geldi.");
  }, []);
  const roomConnection = useRoom(receiveMessage);
  const connectRoom = roomConnection.join;
  useEffect(() => {
    const legacyRoom = new URLSearchParams(location.search).get("room")?.toUpperCase();
    if (!roomId && legacyRoom && /^[A-Z0-9]{6}$/.test(legacyRoom)) {
      navigate(`/oda/${legacyRoom}`, { replace: true });
      return;
    }
    const incoming = roomId?.toUpperCase();
    if (incoming && /^[A-Z0-9]{6}$/.test(incoming)) {
      setRoom(incoming);
      setActive(incoming);
      const incomingRole = new URLSearchParams(location.search).get("role") === "host" ? "host" : "guest";
      setRole(incomingRole);
      connectRoom(incoming, incomingRole);
      setNotice(`${incoming} odasına bağlanılıyor…`);
    }
  }, [connectRoom, navigate, roomId]);
  const add = async (text: string) => {
    if (!key) {
      setNotice("Gerçek çeviri için önce OpenRouter hesabınızı bağlayın.");
      return;
    }
    setBusy(true);
    setNotice("Çevriliyor…");
    try {
      const r = await translate(text, target, key || undefined);
      const message: RoomMessage = { id: crypto.randomUUID(), source: text, translated: r.text, sourceLanguage: langs.find(([code]) => code === source)?.[1] || source, targetLanguage: target, sentAt: Date.now() };
      setMessages((v) => [...v, { ...message, demo: r.demo, mine: true }]);
      const delivered = roomConnection.send(message);
      setNotice(
        r.demo
          ? "Demo çeviri — gerçek çeviri için API anahtarı ekleyin"
          : delivered ? "Çeviri tamamlandı ve karşı tarafa gönderildi." : "Çeviri tamamlandı. Karşı taraf bağlanınca iletilecek.",
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const speech = useSpeech(source, add);
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
    setDraft("");
    void add(text);
  };
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
      <div className={`ai-connect ${key ? "ready" : ""}`}><div><KeyRound /><span><b>{key ? "Gerçek AI çevirisi hazır" : "Çeviri bağlantısı gerekiyor"}</b><small>{key ? "OpenRouter bağlı — demo modu kapalı" : "Ücretsiz girişle OpenRouter hesabınızı güvenli biçimde bağlayın."}</small></span></div>{!key && <button className="primary" onClick={() => void connectOpenRouter(location.pathname + location.search)}>OpenRouter'ı bağla<ArrowRight /></button>}</div>
      <div className="languagebar">
        <label>
          Konuştuğunuz dil
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {langs.map((l) => (
              <option key={l[0]} value={l[0]}>
                {l[1]}
              </option>
            ))}
          </select>
        </label>
        <Languages />
        <label>
          Çeviri dili
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {langs.map((l) => (
              <option key={l[0]} value={l[1]}>
                {l[1]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="conversation">
        <div className="speaker">
          <h2>Sen</h2>
          <div className={`wave ${speech.listening ? "active" : ""}`}>
            ▂▅▃▇▄▆▂▅▇▃▆▄▂
          </div>
          {messages.some((m) => m.mine) ? (
            messages.filter((m) => m.mine).map((m) => (
              <article key={m.id}>
                <p>{m.source}</p>
                <strong>{m.translated}</strong>
                {m.demo && <small>Demo</small>}
                <button
                  onClick={() => speak(m.translated)}
                  aria-label="Çeviriyi dinle"
                >
                  <Volume2 />
                </button>
              </article>
            ))
          ) : (
            <div className="empty">
              Mikrofona dokunun ve konuşmaya başlayın.
            </div>
          )}
          <form className="message-composer" onSubmit={submitDraft}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Yazın veya mikrofonla konuşun…" aria-label="Çevrilecek mesaj" />
            <button className="primary" aria-label="Çevir ve gönder" disabled={busy || !draft.trim()} type="submit"><ArrowRight /><span>Çevir ve gönder</span></button>
          </form>
          <button
            className={`mic ${speech.listening ? "live" : ""}`}
            onClick={speech.toggle}
            disabled={busy}
          >
            {speech.listening ? <MicOff /> : <Mic />}
            <span>
              {speech.listening ? "Dinlemeyi durdur" : "Konuşmaya başla"}
            </span>
          </button>
        </div>
        <div className="speaker remote">
          <h2>Karşı taraf</h2><span className={`presence ${roomConnection.connected ? "online" : ""}`}>{roomConnection.connected ? "Çevrim içi" : "Bekleniyor"}</span>
          {messages.some((m) => !m.mine) ? messages.filter((m) => !m.mine).map((m) => <article key={m.id}><p><small>{m.sourceLanguage}</small>{m.source}</p><strong>{m.translated}</strong><button onClick={() => speak(m.translated)} aria-label="Karşı tarafın çevirisini dinle"><Volume2 /></button></article>) : <div className="empty"><Users /><p>{roomConnection.connected ? "Bağlantı kuruldu. Karşı taraf konuştuğunda çevirisi burada görünecek." : "İkinci kişi davet bağlantısıyla katıldığında burada görünür."}</p></div>}
        </div>
      </div>
      <div
        className={`notice ${speech.error || roomConnection.error ? "error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {speech.error || roomConnection.error ? <AlertCircle /> : <CheckCircle2 />}
        {speech.error || roomConnection.error || notice}
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
        "3. Mikrofonu açın",
        "Tarayıcı izninden sonra konuşmanız anlık olarak yazıya çevrilir.",
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
  const [dark, setDark] = useState(
    localStorage.getItem("dilmac-theme") !== "light",
  );
  useEffect(() => observeUser(setUser), []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("dilmac-theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <Layout user={user} dark={dark} setDark={setDark}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/uygulama" element={<Translator />} />
        <Route path="/oda/:roomId" element={<Translator />} />
        <Route path="/openrouter-callback" element={<OpenRouterCallback />} />
        <Route path="/hakkinda" element={<Info data={pages.about} />} />
        <Route path="/nasil-calisir" element={<Info data={pages.how} />} />
        <Route path="/ozellikler" element={<Info data={pages.features} />} />
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
