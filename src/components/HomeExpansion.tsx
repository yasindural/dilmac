import {
  Captions,
  ChevronDown,
  Languages,
  Mic2,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import "../home-expansion.css";

const waveBars = Array.from({ length: 17 }, (_, index) => (
  <i key={index} aria-hidden="true" />
));

export default function HomeExpansion() {
  const { t } = useI18n();
  const questions = [
    { question: t("q1"), answer: t("a1") },
    { question: t("q2"), answer: t("a2") },
    { question: t("q3"), answer: t("a3") },
    { question: t("q4"), answer: t("a4") },
  ];
  return (
    <>
      <section className="voice-story" aria-labelledby="voice-story-title">
        <div className="voice-story__copy">
          <div className="voice-story__mark" aria-hidden="true">
            <Volume2 />
          </div>
          <h2 id="voice-story-title">{t("vs.title")}</h2>
          <p>
            {t("vs.p")}
          </p>
          <ul aria-label={t("a11y.callFeatures")}>
            <li>
              <Mic2 />
              <span>
                <strong>{t("vs1.t")}</strong>
                {t("vs1.p")}
              </span>
            </li>
            <li>
              <Captions />
              <span>
                <strong>{t("vs2.t")}</strong>
                {t("vs2.p")}
              </span>
            </li>
            <li>
              <Languages />
              <span>
                <strong>{t("vs3.t")}</strong>
                {t("vs3.p")}
              </span>
            </li>
          </ul>
        </div>

        <div className="voice-stage" aria-label={t("a11y.voiceStage")}>
          <div className="voice-stage__topline">
            <span>
              <i aria-hidden="true" /> {t("vs.live")}
            </span>
            <span>{t("vs.e2e")}</span>
          </div>

          <div className="voice-lane voice-lane--turkish">
            <div className="voice-person" aria-hidden="true">TR</div>
            <div className="voice-lane__content">
              <div className="voice-lane__label">
                <strong>Türkçe</strong>
                <span>{t("vs.original")}</span>
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
                <span>{t("vs.original")}</span>
              </div>
              <div className="voice-wave" aria-hidden="true">{waveBars}</div>
            </div>
            <Volume2 aria-hidden="true" />
          </div>

          <div className="voice-caption">
            <span>{t("vs.caption")}</span>
            <p>Yarınki toplantı saat kaçta?</p>
            <strong>What time is tomorrow's meeting?</strong>
          </div>
        </div>
      </section>

      <section className="home-faq" aria-labelledby="home-faq-title">
        <div className="home-faq__intro">
          <ShieldCheck aria-hidden="true" />
          <h2 id="home-faq-title">{t("faq.title")}</h2>
          <p>{t("faq.sub")}</p>
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
