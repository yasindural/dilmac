# Oda E2E testi

Gerçek iki tarayıcı penceresiyle canlı çeviri odasını uçtan uca test eder:
sahte mikrofon akışı + sürülebilir konuşma tanıma + yerel PeerJS sunucusu.

Çalıştırma:
1. `npx vite build --mode e2e --outDir dist-e2e`  (VITE_E2E=1 ile giriş atlanır)
2. `node e2e/peer-server.mjs` (127.0.0.1:9100)
3. `npx vite preview --outDir dist-e2e --port 4201`
4. `node e2e/oda-testi.mjs`

Kapsam: bozuk STT girdilerinin bozulmadan iletimi, yankı bastırma (B1/B1b),
sıra serbestliği (B2), gerçek eş zamanlı konuşma (B3), toparlanma (B4),
8 mesajlık sohbette kayıp/çift kontrolü (B5), yankı sızıntısı (B6).
