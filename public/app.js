const socket = io();

// İsim girmeyi ZORUNLU yapıyoruz
let isim = "";
while (!isim || isim.trim() === "") {
    isim = prompt("Kuzenler Kapışıyor'a Hoş Geldin! Lütfen bir isim gir (Boş bırakılamaz):");
}
socket.emit('oyunaKatil', isim);

const oyuncuListesi = document.getElementById('oyuncu-listesi');
const kartlarimDiv = document.getElementById('kartlarim');
const ortadakiKartDiv = document.getElementById('ortadaki-kart');
const desteCekBtn = document.getElementById('deste-cek');

// Oyunu Başlat butonu
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

document.getElementById('diger-oyuncular').appendChild(baslatBtn);

baslatBtn.onclick = () => { socket.emit('oyunuBaslat'); };

socket.on('oyuncuGuncelleme', (players) => {
    oyuncuListesi.innerHTML = '';
    for (let id in players) {
        const p = players[id];
        const li = document.createElement('li');
        li.innerText = `${p.name} ${p.kartSayisi !== undefined ? `(${p.kartSayisi} Kart)` : '(Bekliyor)'}`;
        if (p.siraOnda) li.style.border = '3px solid #e74c3c'; 
        oyuncuListesi.appendChild(li);
    }
});

socket.on('oyunDurumu', (durum) => {
    if (durum.basladi) baslatBtn.style.display = 'none';
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
