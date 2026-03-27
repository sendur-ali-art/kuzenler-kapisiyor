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
baslatBtn.style.cssText = 'padding: 10px 20px; font-size: 18px; background-color: #e74c3c; color: white; border: none; border-radius: 10px; cursor: pointer; margin: 10px; display: none;';
digerOyuncularDiv.appendChild(baslatBtn);

const sifirlaBtn = document.createElement('button');
sifirlaBtn.innerText = '🔄 Oyunu Sıfırla';
sifirlaBtn.style.cssText = 'padding: 10px 20px; font-size: 16px; background-color: #f39c12; color: white; border: none; border-radius: 10px; cursor: pointer; margin: 10px; display: none;';
digerOyuncularDiv.appendChild(sifirlaBtn);

baslatBtn.onclick = () => { socket.emit('oyunuBaslat'); };
sifirlaBtn.onclick = () => { socket.emit('oyunuSifirla'); };

socket.on('oyuncuGuncelleme', (players) => {
    oyuncuListesi.innerHTML = '';
    for (let id in players) {
        const p = players[id];
        const li = document.createElement('li');
        
        let durumYazisi = p.finished ? '🏁 Bitirdi' : (p.kartSayisi !== undefined ? `(${p.kartSayisi} Kart)` : '(İzleyici)');
        let isimYazisi = p.isHost ? `👑 ${p.name}` : p.name;
        
        li.innerText = `${isimYazisi} ${durumYazisi}`;
        if (p.siraOnda) li.style.border = '4px solid #e74c3c'; 
        else li.style.border = 'none'; 
        
        oyuncuListesi.appendChild(li);
    }
});

socket.on('oyunDurumu', (durum) => {
    let amIHost = (socket.id === durum.hostId);
    if (amIHost) {
        baslatBtn.style.display = durum.basladi ? 'none' : 'inline-block';
        sifirlaBtn.style.display = 'inline-block';
    } else {
        baslatBtn.style.display = 'none';
        sifirlaBtn.style.display = 'none';
    }
    
    if (durum.pendingDraw > 0) {
        desteCekBtn.innerText = `Ceza Çek (${durum.pendingDraw})`;
        desteCekBtn.style.backgroundColor = '#e74c3c';
    } else {
        desteCekBtn.innerText = 'Kart Çek';
        desteCekBtn.style.backgroundColor = '#2c3e50';
    }
    
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

// YENİ VE ŞIK BİLDİRİM SİSTEMİ (Tarayıcıyı kitlemeyen çözüm)
function gosterBildirim(mesaj) {
    let toast = document.createElement('div');
    toast.innerText = mesaj;
    toast.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background-color: #c0392b; color: white; padding: 15px 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.4); z-index: 10000; font-size: 16px; font-weight: bold; text-align: center; max-width: 90%; pointer-events: none; opacity: 1; transition: opacity 0.5s;';
    document.body.appendChild(toast);
    
    // 3 saniye sonra kendiliğinden kaybolur
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

desteCekBtn.onclick = () => { socket.emit('kartCek'); };
socket.on('hata', (mesaj) => { gosterBildirim(mesaj); });
