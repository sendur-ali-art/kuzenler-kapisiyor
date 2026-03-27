const socket = io();

// Oyuna girişte isim soralım
const isim = prompt("Kuzenler Kapışıyor'a Hoş Geldin! Adın ne olsun?") || "Gizemli Kuzen";
socket.emit('oyunaKatil', isim);

const oyuncuListesi = document.getElementById('oyuncu-listesi');
const kartlarimDiv = document.getElementById('kartlarim');
const ortadakiKartDiv = document.getElementById('ortadaki-kart');
const desteCekBtn = document.getElementById('deste-cek');

// Oyunu Başlat butonu (Sadece oyun başlamadan önce görünür)
const baslatBtn = document.createElement('button');
baslatBtn.innerText = '🚀 Oyunu Başlat!';
baslatBtn.style.padding = '15px 30px';
baslatBtn.style.fontSize = '20px';
baslatBtn.style.backgroundColor = '#e74c3c';
baslatBtn.style.color = 'white';
baslatBtn.style.border = 'none';
baslatBtn.style.borderRadius = '10px';
baslatBtn.style.cursor = 'pointer';
baslatBtn.style.marginBottom = '20px';

// Butonu diğer oyuncular listesinin altına ekleyelim
document.getElementById('diger-oyuncular').appendChild(baslatBtn);

baslatBtn.onclick = () => {
    socket.emit('oyunuBaslat');
};

// Sunucudan gelen oyuncu listesini ekrana yansıt
socket.on('oyuncuGuncelleme', (players) => {
    oyuncuListesi.innerHTML = '';
    for (let id in players) {
        const p = players[id];
        const li = document.createElement('li');
        // İsim ve kart sayısını yazdır
        li.innerText = `${p.name} ${p.kartSayisi !== undefined ? `(${p.kartSayisi} Kart)` : '(Bekliyor)'}`;
        
        // Sıra ondaysa çerçeve ile belli et
        if (p.siraOnda) li.style.border = '3px solid #e74c3c'; 
        
        oyuncuListesi.appendChild(li);
    }
});

// Oyun durumunu (ortadaki kart vb.) güncelle
socket.on('oyunDurumu', (durum) => {
    if (durum.basladi) {
        baslatBtn.style.display = 'none'; // Oyun başlayınca butonu sakla
    }
    if (durum.ortadakiKart) {
        ortadakiKartDiv.innerText = durum.ortadakiKart.deger;
        ortadakiKartDiv.className = `kart ortadaki-kart ${durum.ortadakiKart.renk}`;
    }
});

// Senin elindeki kartları ekrana çiz
socket.on('elimiGuncelle', (kartlar) => {
    kartlarimDiv.innerHTML = '';
    kartlar.forEach((kart, index) => {
        const kartEl = document.createElement('div');
        kartEl.className = `kart ${kart.renk}`;
        kartEl.innerText = kart.deger;
        
        // Karta tıklayınca sunucuya "bu kartı oynamak istiyorum" mesajı gönder
        kartEl.onclick = () => {
            socket.emit('kartAt', index);
        };
        kartlarimDiv.appendChild(kartEl);
    });
});

// Desteden kart çekme butonu
desteCekBtn.onclick = () => {
    socket.emit('kartCek');
};

// Hata veya kural dışı hamle uyarıları
socket.on('hata', (mesaj) => {
    alert(mesaj);
});
