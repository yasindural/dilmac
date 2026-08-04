# Dilmaç

İki kişinin kendi dilinde konuşup canlı metin ve çeviri üzerinden anlaşmasını sağlayan, mobil uyumlu React uygulaması.

## Yerel çalıştırma

```bash
npm install
npm run dev
```

Kalite kontrolleri: `npm run build`, `npm run lint`, `npm test`.

## Google ile giriş

1. Firebase Console'da bir Web App oluşturun.
2. Authentication > Sign-in method bölümünde Google sağlayıcısını etkinleştirin.
3. `yasindural.github.io` ve kullanacağınız özel alan adını Authorized domains listesine ekleyin.
4. `.env.example` dosyasını `.env.local` olarak kopyalayıp `VITE_FIREBASE_*` değerlerini doldurun.

Google girişi ayarlanmadan site ve misafir çeviri ekranı çalışmaya devam eder; arayüz yapılandırma uyarısı gösterir.

## Çeviri ve güvenlik

Uygulama anahtarsızken sınırlı, açıkça işaretlenmiş demo çeviri yapar. Gerçek çeviri için kullanıcı OpenRouter anahtarını uygulamadaki ayara girebilir. Anahtar `sessionStorage` içinde yalnızca açık sekme boyunca tutulur.

Genel kullanıma açık üretim sürümünde API anahtarını istemciye gömmeyin. Önerilen mimari: kimliği doğrulanmış bir sunucu/edge function üzerinden OpenRouter çağrısı, hız sınırlama ve kötüye kullanım koruması. Statik GitHub Pages bu sırrı tek başına güvenli saklayamaz.

## Canlı konuşma

Konuşma tanıma Web Speech API kullanır; en iyi destek güncel Chrome/Edge üzerindedir. Mikrofon yalnızca kullanıcı düğmeye bastığında açılır. Oda kodu ve davet akışı arayüzde hazırdır; internet üzerinden iki cihazlı gerçek WebRTC görüşmesi için ayrıca bir sinyalleşme servisi (ör. Firebase Realtime Database veya özel WebSocket sunucusu) gerekir.

## Yayınlama

Vite `base` değeri `/dilmac/` olarak ayarlıdır. `dist/` klasörü GitHub Pages'e yayımlanabilir. SPA alt rotaları için Pages ortamında `404.html` yönlendirme kopyası kullanın veya hash router tercih edin.
