const socket = io();

let isim = "";
while (!isim || isim.trim() === "") {
    isim = prompt("Kuzenler Kapışıyor'a Hoş Geldin! Lütfen bir isim gir:");
}
socket.emit('oyunaKatil', isim);

const oyuncuListesi = document.getElementById('oyuncu-listesi');
const kartlarimDiv = document.getElementById('kartlarim');
const ortadakiKartDiv = document.getElementById('ortadaki-kart');
const desteCekBtn = document.getElementById('deste-cek');
const digerOyuncularDiv = document.getElementById('diger-oyuncular');

// Başlat Butonu
const baslatBtn = document.createElement('button');
baslatBtn.innerText = '🚀 Oyunu Başlat!';
baslatBtn.style.padding = '10px 20px';
baslatBtn.style.fontSize = '18px';
baslatBtn.style.backgroundColor = '#e74c3c';
baslatBtn.style.color = 'white';
baslatBtn.style.border = 'none';
baslatBtn.style.borderRadius = '10px';
baslatBtn.style.cursor = 'pointer';
baslatBtn.style.margin = '10px';
digerOyuncularDiv.appendChild(baslatBtn);

// Sıfırla (Kurtarıcı) Butonu
const sifirlaBtn = document.createElement('button');
sifirlaBtn.innerText = '🔄 Oyunu Sıfırla (Hata Çıkarsa)';
sifirlaBtn.style.padding = '10px 20px';
sifirlaBtn.style.fontSize = '16px';
sifirlaBtn.style.backgroundColor = '#f39c12';
sifirlaBtn.style.color = 'white';
sifirlaBtn.style.border = 'none';
sifirlaBtn.style.borderRadius = '10px';
sifirlaBtn.style.cursor = 'pointer';
sifirlaBtn.style.margin = '10px';
digerOyuncularDiv.appendChild(sifirlaBtn);

baslatBtn.onclick = () => { socket.emit('oyunuBaslat'); };
sifirlaBtn.onclick = () => { socket.emit('oyunuSifirla'); };

socket.on('oyuncuGuncelleme', (players) => {
    oyuncuListesi.innerHTML = '';
    for (let id in players) {
        const p = players[id];
        const li = document.createElement('li');
        li.innerText = `${p.name} ${p.kartSayisi !== undefined ? `(${p.kartSayisi} Kart)` : '(İzleyici)'}`;
        if (p.siraOnda) li.style.border = '4px solid #e74c3c'; 
        oyuncuListesi.appendChild(li);
    }
});

socket.on('oyunDurumu', (durum) => {
    if (durum.basladi) {
        baslatBtn.style.display = 'none';
    } else {
        baslatBtn.style.display = 'inline-block';
        ortadakiKartDiv.innerText = "Bekleniyor";
        ortadakiKartDiv.className = "kart ortadaki-kart";
    }
    
    if (durum.ortadakiKart) {
        ortadakiKartDiv.innerText = durum.ortadakiKart.deger;
        ortadakiKartDiv.className = `kart ortadaki-kart ${durum.ortadakiKart.renk}`;
    }
});

socket.on('elimiGuncelle', (kartlar) => {
    kartlarimDiv.innerHTML = '';
    kartlar.forEach((kart, index) => {
        const kartEl = document.createElement('div');
        kartEl.className = `kart ${kart.renk}`;
        kartEl.innerText = kart.deger;
        kartEl.onclick = () => { socket.emit('kartAt', index); };
        kartlarimDiv.appendChild(kartEl);
    });
});

desteCekBtn.onclick = () => { socket.emit('kartCek'); };
socket.on('hata', (mesaj) => { alert(mesaj); });
