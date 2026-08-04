import {
  Captions,
  ChevronDown,
  Languages,
  Mic2,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import "../home-expansion.css";

const waveBars = Array.from({ length: 17 }, (_, index) => (
  <i key={index} aria-hidden="true" />
));

const questions = [
  {
    question: "Karşımdaki kişinin orijinal sesini nasıl duyarım?",
    answer:
      "Görüşme odasında iki taraf da ses bağlantısını açtığında orijinal ses anında iletilir. Aynı ekranda konuşmanın metnini ve çevirisini de takip edebilirsiniz.",
  },
  {
    question: "Dilmaç'ı kullanmak için uygulama indirmem gerekir mi?",
    answer:
      "Hayır. Güncel bir tarayıcı yeterlidir. Oda bağlantısını açın, mikrofon iznini verin ve görüşmeye katılın.",
  },
  {
    question: "Mikrofonum ne zaman açılır?",
    answer:
      "Mikrofon yalnızca siz ses bağlantısını açtığınızda çalışır. Görüşme ekranındaki durum göstergesi mikrofon ve bağlantı durumunu açıkça gösterir.",
  },
  {
    question: "Bağlantı kesilirse konuşmam kaybolur mu?",
    answer:
      "Dilmaç bağlantı durumunu ekranda gösterir ve yeniden bağlanmayı dener. Gönderilmeyi bekleyen metinler sırada tutulur; böylece konuşmanın akışına kaldığınız yerden devam edebilirsiniz.",
  },
];

export default function HomeExpansion() {
  return (
    <>
      <section className="voice-story" aria-labelledby="voice-story-title">
        <div className="voice-story__copy">
          <div className="voice-story__mark" aria-hidden="true">
            <Volume2 />
          </div>
          <h2 id="voice-story-title">İki ses, tek konuşma.</h2>
          <p>
            Karşınızdaki kişinin gerçek sesini duyarken canlı altyazıyı ve yapay
            zekâ çevirisini aynı anda takip edin. Konuşmanın doğallığı kaybolmaz,
            anlamı arada kalmaz.
          </p>
          <ul aria-label="Canlı görüşme özellikleri">
            <li>
              <Mic2 />
              <span>
                <strong>Orijinal sesi duyun</strong>
                Ses tonu ve duygular konuşmada kalsın.
              </span>
            </li>
            <li>
              <Captions />
              <span>
                <strong>Canlı altyazıyı izleyin</strong>
                Söylenenleri kaçırmadan ekrandan takip edin.
              </span>
            </li>
            <li>
              <Languages />
              <span>
                <strong>Anında çeviriyi okuyun</strong>
                Seçtiğiniz dilde doğal ve anlaşılır karşılığını görün.
              </span>
            </li>
          </ul>
        </div>

        <div className="voice-stage" aria-label="İki dil arasındaki canlı ses ve çeviri akışı">
          <div className="voice-stage__topline">
            <span>
              <i aria-hidden="true" /> Canlı ses bağlı
            </span>
            <span>Uçtan uca görüşme</span>
          </div>

          <div className="voice-lane voice-lane--turkish">
            <div className="voice-person" aria-hidden="true">TR</div>
            <div className="voice-lane__content">
              <div className="voice-lane__label">
                <strong>Türkçe</strong>
                <span>Orijinal ses</span>
              </div>
              <div className="voice-wave" aria-hidden="true">{waveBars}</div>
            </div>
            <Volume2 aria-hidden="true" />
          </div>

          <div className="voice-bridge" aria-hidden="true">
            <span />
            <Languages />
            <span />
          </div>

          <div className="voice-lane voice-lane--english">
            <div className="voice-person" aria-hidden="true">EN</div>
            <div className="voice-lane__content">
              <div className="voice-lane__label">
                <strong>English</strong>
                <span>Original voice</span>
              </div>
              <div className="voice-wave" aria-hidden="true">{waveBars}</div>
            </div>
            <Volume2 aria-hidden="true" />
          </div>

          <div className="voice-caption">
            <span>Canlı çeviri</span>
            <p>Yarınki toplantıya saat kaçta başlayalım?</p>
            <strong>What time should we start tomorrow's meeting?</strong>
          </div>
        </div>
      </section>

      <section className="home-faq" aria-labelledby="home-faq-title">
        <div className="home-faq__intro">
          <ShieldCheck aria-hidden="true" />
          <h2 id="home-faq-title">Merak ettikleriniz.</h2>
          <p>Görüşmeye başlamadan önce en sık sorulan kısa sorular.</p>
        </div>
        <div className="home-faq__list">
          {questions.map(({ question, answer }) => (
            <details key={question}>
              <summary>
                <span>{question}</span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
