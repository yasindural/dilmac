import '@testing-library/jest-dom/vitest';

// jsdom Element.scrollTo desteklemiyor; canlı akış bileşenleri bunu kullanıyor.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() { /* jsdom stub */ };
}

// jsdom matchMedia sağlamıyor; hareket/işaretçi tercihlerini soran bileşenler için stub.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
