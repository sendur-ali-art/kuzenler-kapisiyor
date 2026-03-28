const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// 🔒 ODA ŞİFRESİNİ BURADAN DEĞİŞTİREBİLİRSİN:
const ODA_SIFRESI = "kuzenler";

let players = {};
let playerIds = []; 
let deck = [];
let discardPile = [];
let currentPlayerIndex = 0;
let direction = 1;
let gameStarted = false;
let winners = []; 
let pendingDraw = 0;

const renkler = ['kirmizi', 'mavi', 'yesil', 'sari'];
const degerler = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Pas', 'Yön Değiştir', '+2'];

function createDeck() {
    let d = [];
    renkler.forEach(r => {
        degerler.forEach(v => {
            d.push({ renk: r, deger: v });
            if (v !== '0') d.push({ renk: r, deger: v });
        });
    });
    for (let i = 0; i < 4; i++) {
        d.push({ renk: 'siyah', deger: 'Renk Seç' });
        d.push({ renk: 'siyah', deger: '+4 Çek' });
    }
    return d.sort(() => Math.random() - 0.5);
}

function updateAll() {
    let hId = playerIds[0]; 
    let safePlayers = {}; 
    
    playerIds.forEach((id, i) => {
        if (players[id]) {
            players[id].isHost = (id === hId);
            players[id].kartSayisi = players[id].hand ? players[id].hand.length : 0;
            players[id].siraOnda = (i === currentPlayerIndex && gameStarted && !players[id].finished);
            
            safePlayers[id] = {
                name: players[id].name,
                isHost: players[id].isHost,
                kartSayisi: players[id].kartSayisi,
                siraOnda: players[id].siraOnda,
                finished: players[id].finished
            };
        }
    });
    
    io.emit('oyuncuGuncelleme', safePlayers); 
    io.emit('oyunDurumu', { 
        basladi: gameStarted, 
        ortadakiKart: discardPile[discardPile.length - 1] || null, 
        hostId: hId, 
        pendingDraw: pendingDraw 
    });
    
    playerIds.forEach(id => {
        if (players[id] && players[id].hand) io.to(id).emit('elimiGuncelle', players[id].hand);
    });
}

function nextTurn() {
    let loop = 0;
    do {
        currentPlayerIndex = (currentPlayerIndex + direction + playerIds.length) % playerIds.length;
        loop++;
    } while (players[playerIds[currentPlayerIndex]] && players[playerIds[currentPlayerIndex]].finished && loop < playerIds.length);
}

io.on('connection', (socket) => {
    
    // YENİ: Oyuna katılırken şifreyi de kontrol ediyoruz
    socket.on('oyunaKatil', (data) => {
        // Veri yoksa veya şifre yanlışsa anında bağlantıyı kes!
        if (!data || data.sifre !== ODA_SIFRESI) {
            socket.emit('girisHatasi', '❌ Yanlış şifre! Bu odaya girmeye izniniz yok.');
            socket.disconnect();
            return;
        }

        let isim = data.isim;
        if(typeof isim !== 'string' || isim.length > 20) isim = "Oyuncu";
        
        players[socket.id] = { id: socket.id, name: isim, hand: [], finished: false };
        if (!gameStarted) playerIds.push(socket.id);
        updateAll();
    });

    socket.on('mesajGonder', (metin) => {
        if (typeof metin !== 'string' || metin.length > 150) return; 
        if(players[socket.id]) {
            io.emit('yeniMesaj', { isim: players[socket.id].name, metin: metin });
        }
    });

    socket.on('oyunuSifirla', () => {
        gameStarted = false;
        deck = []; discardPile = []; winners = []; pendingDraw = 0;
        playerIds = Object.keys(players);
        playerIds.forEach(id => { if(players[id]) { players[id].hand = []; players[id].finished = false; } });
        io.emit('hata', '🔄 Sıfırlandı!');
        updateAll();
    });

    socket.on('oyunuBaslat', () => {
        if (playerIds.length < 2) return;
        gameStarted = true;
        deck = createDeck();
        discardPile = []; winners = []; pendingDraw = 0;
        currentPlayerIndex = 0; direction = 1;
        playerIds.forEach(id => { players[id].hand = deck.splice(0, 7); players[id].finished = false; });
        let first = deck.pop();
        while (first.renk === 'siyah' || isNaN(first.deger)) { deck.push(first); deck.sort(() => Math.random()-0.5); first = deck.pop(); }
        discardPile.push(first);
        updateAll();
    });

    socket.on('kartAt', (data) => {
        if (!data || typeof data.index !== 'number') return;
        if (!gameStarted || playerIds[currentPlayerIndex] !== socket.id) return;
        let p = players[socket.id];
        if (!p || !p.hand) return;
        
        let card = p.hand[data.index];
        if (!card) return;

        const isPlus = (card.deger === '+2' || card.deger === '+4 Çek');
        if (pendingDraw > 0 && !isPlus) {
            socket.emit('hata', '⚠️ Cezayı çekmelisin!');
            return;
        }

        let top = discardPile[discardPile.length - 1];
        if (card.renk !== 'siyah' && card.renk !== top.renk && card.deger !== top.deger) {
            socket.emit('hata', '❌ Geçersiz hamle!');
            return;
        }

        p.hand.splice(data.index, 1);
        if (card.renk === 'siyah' && data.secilenRenk) card.renk = data.secilenRenk;
        discardPile.push(card);

        if (p.hand.length === 1) io.emit('hata', `🔔 ${p.name} TEK KART!`);

        if (card.deger === '+2') pendingDraw += 2;
        if (card.deger === '+4 Çek') pendingDraw += 4;

        if (p.hand.length === 0) {
            p.finished = true;
            winners.push(p);
            if (playerIds.filter(id => !players[id].finished).length <= 1) {
                gameStarted = false;
                io.emit('hata', '🏆 OYUN BİTTİ!');
            }
        }

        if (card.deger === 'Yön Değiştir') direction *= -1;
        if (card.deger === 'Pas') nextTurn();
        
        nextTurn();
        updateAll();
    });

    socket.on('kartCek', () => {
        if (!gameStarted || playerIds[currentPlayerIndex] !== socket.id) return;
        let p = players[socket.id];
        if (!p || !p.hand) return;
        
        if (pendingDraw > 0) {
            for(let i=0; i<pendingDraw; i++) {
                if(deck.length === 0) deck = createDeck();
                p.hand.push(deck.pop());
            }
            pendingDraw = 0;
        } else {
            if(deck.length === 0) deck = createDeck();
            p.hand.push(deck.pop());
        }
        nextTurn();
        updateAll();
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        playerIds = playerIds.filter(id => id !== socket.id);
        updateAll();
    });
});

server.listen(process.env.PORT || 3000, () => console.log('Live!'));
