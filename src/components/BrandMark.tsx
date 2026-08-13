// Dilmaç logosu: iki konuşma balonu üst üste — biri dolu (siz), biri
// çizgili (karşı taraf). Marka gradyanlı yumuşak kare içinde; 24 px'te bile
// okunur kalsın diye ayrıntı yerine siluet üzerine kurulu.
export default function BrandMark({ className = "brandmark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="dilmac-mark-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#6366f1" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11.5" fill="url(#dilmac-mark-grad)" />
      {/* arka balon — karşı taraf */}
      <path
        d="M18 16 H30 A3 3 0 0 1 33 19 V25 A3 3 0 0 1 30 28 H27.5 V31 L23.5 28 H18 A3 3 0 0 1 15 25 V19 A3 3 0 0 1 18 16 Z"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.6"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* ön balon — siz */}
      <path
        d="M10.5 7.5 H23.5 A3.5 3.5 0 0 1 27 11 V17 A3.5 3.5 0 0 1 23.5 20.5 H17 L13 23.8 V20.5 H10.5 A3.5 3.5 0 0 1 7 17 V11 A3.5 3.5 0 0 1 10.5 7.5 Z"
        fill="#ffffff"
      />
    </svg>
  );
}
