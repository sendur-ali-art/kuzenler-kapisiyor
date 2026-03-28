const socket = io();

const sesAt = new Audio('https://www.soundjay.com/buttons/sounds/button-20.mp3');
const sesCek = new Audio('https://www.soundjay.com/buttons/sounds/button-21.mp3');
const sesMesaj = new Audio('https://www.soundjay.com/buttons/sounds/button-16.mp3');

let isim = "";
while (!isim || !isim.trim()) {
    isim = prompt("Kuzenler Kapışıyor! İsmin nedir?");
}

// YENİ: ŞİFRE SORMA EKRANI
let sifre = "";
while (!sifre || !sifre.trim()) {
    sifre = prompt("Lütfen Oda Şifresini Girin:");
}

// İsim ve Şifreyi sunucuya birlikte gönderiyoruz
socket.emit('oyunaKatil', {
    isim: isim.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    sifre: sifre.trim()
});

// YENİ: Yanlış şifre girildiğinde olacaklar
socket.on('girisHatasi', (mesaj) => {
    alert(mesaj);
    window.location.reload(); // Şifreyi tekrar denemesi için sayfayı yenile
});

const mesajlarDiv = document.getElementById('mesajlar');
const mesajInput = document.getElementById('mesaj-metni');
const mesajGonderBtn = document.getElementById('mesaj-gonder');

mesajGonderBtn.onclick = () => {
    if (mesajInput.value.trim()) {
        socket.emit('mesajGonder', mesajInput.value);
        mesajInput.value = '';
    }
};
mesajInput.onkeypress = (e) => { if (e.key === 'Enter') mesajGonderBtn.click(); };

socket.on('yeniMesaj', (data) => {
    const m = document.createElement('div');
    const b = document.createElement('b');
    b.innerText = data.isim + ': ';
    m.appendChild(b);
    m.appendChild(document.createTextNode(data.metin)); 
    mesajlarDiv.appendChild(m);
    mesajlarDiv.scrollTop = mesajlarDiv.scrollHeight;
    sesMesaj.play().catch(() => {});
});

const oyuncuListesi = document.getElementById('oyuncu-listesi');
const kartlarimDiv = document.getElementById('kartlarim');
const ortadakiKartDiv = document.getElementById('ortadaki-kart');
const desteCekBtn = document.getElementById('deste-cek');
const renkSeciciEkran = document.getElementById('renk-secici');
let bekleyenKartIndex = -1;

const baslatBtn = document.createElement('button');
baslatBtn.innerText = '🚀 BAŞLAT';
baslatBtn.style.cssText = 'position:fixed; top:70px; right:20px; padding:10px; background:red; color:white; border-radius:10px; display:none; z-index:100; font-weight:bold; cursor:pointer; border:none;';
document.body.appendChild(baslatBtn);

const sifirlaBtn = document.createElement('button');
sifirlaBtn.innerText = '🔄 SIFIRLA';
sifirlaBtn.style.cssText = 'position:fixed; top:70px; left:20px; padding:10px; background:orange; color:white; border-radius:10px; z-index:100; font-weight:bold; cursor:pointer; border:none;';
document.body.appendChild(sifirlaBtn);

baslatBtn.onclick = () => socket.emit('oyunuBaslat');
sifirlaBtn.onclick = () => socket.emit('oyunuSifirla');

socket.on('oyuncuGuncelleme', (players) => {
    oyuncuListesi.innerHTML = '';
    for (let id in players) {
        const p = players[id];
        const li = document.createElement('li');
        li.innerText = `${p.isHost ? '👑 ' : ''}${p.name} (${p.finished ? '🏁' : p.kartSayisi})`;
        if (p.siraOnda) li.style.borderColor = 'red';
        oyuncuListesi.appendChild(li);
    }
});

socket.on('oyunDurumu', (durum) => {
    baslatBtn.style.display = (socket.id === durum.hostId && !durum.basladi) ? 'block' : 'none';
    if (durum.pendingDraw > 0) {
        desteCekBtn.innerText = `CEZA (${durum.pendingDraw})`;
        desteCekBtn.style.background = 'red';
    } else {
        desteCekBtn.innerText = 'ÇEK';
        desteCekBtn.style.background = '#263238';
    }
    if (durum.ortadakiKart) {
        if(ortadakiKartDiv.innerText !== durum.ortadakiKart.deger) sesAt.play().catch(() => {});
        ortadakiKartDiv.innerText = durum.ortadakiKart.deger;
        ortadakiKartDiv.className = `kart ortadaki-kart ${durum.ortadakiKart.renk}`;
        if (durum.ortadakiKart.deger.length > 2) ortadakiKartDiv.classList.add('uzun-yazi');
    }
});

socket.on('elimiGuncelle', (kartlar) => {
    kartlarimDiv.innerHTML = '';
    kartlar.forEach((k, index) => {
        const div = document.createElement('div');
        div.className = `kart ${k.renk}`;
        div.innerText = k.deger;
        if (k.deger.length > 2) div.classList.add('uzun-yazi');
        div.onclick = () => {
            if (k.renk === 'siyah') {
                bekleyenKartIndex = index;
                renkSeciciEkran.style.display = 'flex';
            } else {
                socket.emit('kartAt', { index: index, secilenRenk: null });
            }
        };
        kartlarimDiv.appendChild(div);
    });
});

window.renkSecildi = (r) => {
    renkSeciciEkran.style.display = 'none';
    socket.emit('kartAt', { index: bekleyenKartIndex, secilenRenk: r });
};

desteCekBtn.onclick = () => {
    sesCek.play().catch(() => {});
    socket.emit('kartCek');
};

socket.on('hata', (m) => {
    const t = document.createElement('div');
    t.innerText = m;
    t.style.cssText = 'position:fixed; top:10px; left:50%; transform:translateX(-50%); background:#333; color:white; padding:10px; border-radius:10px; z-index:10000; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
});
