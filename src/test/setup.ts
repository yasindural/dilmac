import '@testing-library/jest-dom/vitest';

// jsdom Element.scrollTo desteklemiyor; canlı akış bileşenleri bunu kullanıyor.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() { /* jsdom stub */ };
}
