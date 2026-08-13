import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { conversationLanguages, languageByCode, searchLanguages } from "../lib/languages";

// Şık dil seçici: bayrak + dilin kendi adıyla bir kapsül düğme; dokununca
// arama kutulu bir panel açılır. 20 dil listeyle değil aramayla bulunur.
type Props = {
  value: string;                 // seçili dil kodu (ör. "tr-TR")
  onChange: (code: string) => void;
  label: string;                 // "SİZ" / "ÇEVİRİ" gibi üst etiket
  disabled?: boolean;
  align?: "start" | "end";
};

export default function LanguagePicker({ value, onChange, label, disabled = false, align = "start" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = languageByCode(value) || conversationLanguages[0];
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
        aria-expanded={open}
      >
        <small>{label}</small>
        <span className="lp-value">
          <i aria-hidden="true">{selected.flag}</i>
          <b>{selected.name}</b>
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
                  placeholder="Dil ara · search language"
                  aria-label="Dil ara"
                />
              </div>
              <button type="button" className="lp-close" onClick={() => setOpen(false)} aria-label="Kapat"><X /></button>
            </div>
            <div className="lp-list" role="listbox">
              {results.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  role="option"
                  aria-selected={language.code === selected.code}
                  className={`lp-item ${language.code === selected.code ? "on" : ""}`}
                  onClick={() => { onChange(language.code); setOpen(false); }}
                >
                  <i aria-hidden="true">{language.flag}</i>
                  <span><b>{language.name}</b><small>{language.api}</small></span>
                  {language.code === selected.code && <Check aria-hidden="true" />}
                </button>
              ))}
              {results.length === 0 && <p className="lp-empty">Sonuç yok · no match</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
