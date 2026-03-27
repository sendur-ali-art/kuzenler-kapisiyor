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
const renkSeciciEkran = document.getElementById('renk-secici');

let bekleyenKartIndex = -1;

const baslatBtn = document.createElement('button');
baslatBtn.innerText = '🚀 Oyunu Başlat!';
baslatBtn.style.cssText = 'padding: 10px 20px; font-size: 18px; background-color: #e74c3c; color: white; border: none; border-radius: 10px; cursor: pointer; margin: 10px;';
digerOyuncularDiv.appendChild(baslatBtn);

const sifirlaBtn = document.createElement('button');
sifirlaBtn.innerText = '🔄 Oyunu Sıfırla (Hata Çıkarsa)';
sifirlaBtn.style.cssText = 'padding: 10px 20px; font-size: 16px; background-color: #f39c12; color: white; border: none; border-radius: 10px; cursor: pointer; margin: 10px;';
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
    if (durum.basladi) baslatBtn.style.display = 'none';
    else baslatBtn.style.display = 'inline-block';
    
    if (durum.ortadakiKart) {
        ortadakiKartDiv.innerText = durum.ortadakiKart.deger;
        ortadakiKartDiv.className = `kart ortadaki-kart ${durum.ortadakiKart.renk}`;
        if (durum.ortadakiKart.deger.length > 2) ortadakiKartDiv.classList.add('uzun-yazi');
    } else {
        ortadakiKartDiv.innerText = "Bekleniyor";
        ortadakiKartDiv.className = "kart ortadaki-kart";
    }
});

socket.on('elimiGuncelle', (kartlar) => {
    kartlarimDiv.innerHTML = '';
    kartlar.forEach((kart, index) => {
        const kartEl = document.createElement('div');
        kartEl.className = `kart ${kart.renk}`;
        kartEl.innerText = kart.deger;
        
        if (kart.deger.length > 2) kartEl.classList.add('uzun-yazi');

        kartEl.onclick = () => { 
            if (kart.renk === 'siyah') {
                bekleyenKartIndex = index;
                renkSeciciEkran.style.display = 'flex';
            } else {
                socket.emit('kartAt', { index: index, secilenRenk: null }); 
            }
        };
        kartlarimDiv.appendChild(kartEl);
    });
});

window.renkSecildi = (renk) => {
    renkSeciciEkran.style.display = 'none';
    socket.emit('kartAt', { index: bekleyenKartIndex, secilenRenk: renk });
};

desteCekBtn.onclick = () => { socket.emit('kartCek'); };
socket.on('hata', (mesaj) => { alert(mesaj); });
