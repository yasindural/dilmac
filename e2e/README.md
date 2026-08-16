# Oda E2E testi

Gerçek iki tarayıcı penceresiyle canlı çeviri odasını uçtan uca test eder:
sahte mikrofon akışı + sürülebilir konuşma tanıma + yerel PeerJS sunucusu.

Çalıştırma:
1. `npx vite build --mode e2e --outDir dist-e2e`  (VITE_E2E=1 ile giriş atlanır)
2. `node e2e/peer-server.mjs` (127.0.0.1:9100)
3. `npx vite preview --outDir dist-e2e --port 4201`
4. `node e2e/oda-testi.mjs`

Kapsam (26 kontrol):
- **A** misafirin ev sahibinden önce girmesi, ev sahibinin sayfayı yenilemesi
- **B** bağlantı + iki tarafta dinleme + canlı ses kurulumu
- **C** hızlı konuşmada parça kaybı ve çift balon
- **D** kısa ama gerçek kelimelerin (ok/no) iletilmesi
- **E** art arda seslendirme: sıra, kesilme, çakışma, mikrofonun geri açılması
- **F** balona dokunup okutmanın kuyrukla çakışmaması, hayalet ses
- **G** yankı bastırma ve gerçek eş zamanlı konuşmanın korunması
- **J** seslendirme sırasında canlı sesin kısılması (ducking) ve geri açılması
- **H** misafirin yeniden bağlanması, kopukluk sırasındaki mesajın ulaşması
- **K** üçüncü sekmenin odayı ele geçirememesi
- **I** 320/375 px'te yatay taşma

Sahte seslendirme motoru gerçek `speechSynthesis` gibi sıralı çalışır ve her
sesin başlangıç/bitiş anını kaydeder; üst üste binme ile yarıda kesilme bu
zaman çizelgesinden ölçülür.

## Mobil tarama

`node mobil-tarama.mjs` — 7 ekran boyutu × 5 site dili (35 kombinasyon):
yatay taşma, dokunma hedefi boyutu (≥40px) ve kontrol çubuğunun ekran içinde
kalması kontrol edilir. Deneme süresi pili gibi kardeş şeritler main içinde yer
kapladığı için oda yüksekliğinin flex ile hesaplanması şarttır; bu tarama o
regresyonu yakalar.
