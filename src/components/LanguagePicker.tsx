import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { languageByCode, searchLanguages } from "../lib/languages";
import { useI18n } from "../lib/i18n";

// Şık dil seçici: bayrak + dilin kendi adıyla bir kapsül düğme; dokununca
// arama kutulu bir panel açılır. Yalnızca gerçekten desteklenen diller gösterilir.
type Props = {
  value: string;                 // seçili dil kodu (ör. "tr-TR")
  onChange: (code: string) => void;
  label: string;                 // "SİZ" / "ÇEVİRİ" gibi üst etiket
  disabled?: boolean;
  align?: "start" | "end";
  placeholder?: string;
};

export default function LanguagePicker({ value, onChange, label, disabled = false, align = "start", placeholder }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = languageByCode(value);
  const results = useMemo(() => searchLanguages(query), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`lp-button ${disabled ? "locked" : ""}`}
        onClick={() => { if (!disabled) setOpen(true); }}
        aria-haspopup="dialog"
        aria-disabled={disabled}
        aria-expanded={open}
      >
        <small>{label}</small>
        <span className="lp-value">
          {selected ? <i aria-hidden="true">{selected.flag}</i> : <i className="lp-placeholder-dot" aria-hidden="true" />}
          <b>{selected?.display || selected?.name || placeholder || "—"}</b>
          {!disabled && <ChevronDown aria-hidden="true" />}
        </span>
      </button>

      {open && (
        <div className={`lp-layer ${align}`} role="dialog" aria-modal="true" aria-label={label}>
          <div className="lp-backdrop" onClick={() => setOpen(false)} />
          <div className="lp-panel">
            <div className="lp-head">
              <div className="lp-search">
                <Search aria-hidden="true" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("lp.search")}
                  aria-label={t("lp.search")}
                />
              </div>
              <button type="button" className="lp-close" onClick={() => setOpen(false)} aria-label={t("lp.close")}><X /></button>
            </div>
            <div className="lp-list" role="listbox">
              {results.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  role="option"
                  aria-selected={language.code === selected?.code}
                  className={`lp-item ${language.code === selected?.code ? "on" : ""}`}
                  onClick={() => { onChange(language.code); setOpen(false); }}
                >
                  <i aria-hidden="true">{language.flag}</i>
                  <span><b>{language.display || language.name}</b><small>{language.api}</small></span>
                  {language.code === selected?.code && <Check aria-hidden="true" />}
                </button>
              ))}
              {results.length === 0 && <p className="lp-empty">{t("lp.empty")}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
