const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = {};
let playerIds = []; 
let deck = [];
let discardPile = [];
let currentPlayerIndex = 0;
let direction = 1;
let gameStarted = false;
let winners = []; // YENİ: Kazananların sırasını tutacağımız liste

const renkler = ['kirmizi', 'mavi', 'yesil', 'sari'];
const degerler = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Pas', 'Yön Değiştir', '+2'];

function createDeck() {
    let newDeck = [];
    for (let renk of renkler) {
        for (let deger of degerler) {
            newDeck.push({ renk: renk, deger: deger });
            if (deger !== '0') newDeck.push({ renk: renk, deger: deger });
        }
    }
    for (let i = 0; i < 4; i++) {
        newDeck.push({ renk: 'siyah', deger: 'Renk Seç' });
        newDeck.push({ renk: 'siyah', deger: '+4 Çek' });
    }
    return newDeck.sort(() => Math.random() - 0.5);
}

function updateAll() {
    for (let i = 0; i < playerIds.length; i++) {
        const id = playerIds[i];
        if (players[id]) {
            players[id].kartSayisi = players[id].hand ? players[id].hand.length : 0;
            // Eğer oyuncu bitirdiyse artık sırası gelmiş gibi yanmasın
            players[id].siraOnda = (i === currentPlayerIndex && gameStarted && !players[id].finished);
        }
    }
    io.emit('oyuncuGuncelleme', players);
    let ortadaki = discardPile[discardPile.length - 1] || null;
    io.emit('oyunDurumu', { basladi: gameStarted, ortadakiKart: ortadaki });

    for (let id of playerIds) {
        if (players[id] && players[id].hand) {
            io.to(id).emit('elimiGuncelle', players[id].hand);
        }
    }
}

// YENİ: Sırayı geçirirken oyunu BİTİRENLERİ otomatik atla
function nextTurn() {
    let loopCount = 0;
    do {
        currentPlayerIndex += direction;
        if (currentPlayerIndex >= playerIds.length) currentPlayerIndex = 0;
        if (currentPlayerIndex < 0) currentPlayerIndex = playerIds.length - 1;
        loopCount++;
        if(loopCount > playerIds.length) break; // Kilitlenmeyi önlemek için
    } while (players[playerIds[currentPlayerIndex]] && players[playerIds[currentPlayerIndex]].finished);
}

io.on('connection', (socket) => {
    socket.on('oyunaKatil', (isim) => {
        if (gameStarted) {
            socket.emit('hata', 'Oyun şu an devam ediyor. Masayı izleyebilirsin.');
        }
        players[socket.id] = { id: socket.id, name: isim, hand: [], finished: false };
        if (!gameStarted) playerIds.push(socket.id);
        updateAll();
    });

    socket.on('oyunuSifirla', () => {
        gameStarted = false;
        deck = []; discardPile = []; winners = [];
        playerIds = Object.keys(players);
        for (let id of playerIds) { 
            if(players[id]) {
                players[id].hand = []; 
                players[id].finished = false;
            }
        }
        io.emit('hata', 'Oyun sıfırlandı! Herkes masaya alındı.');
        updateAll();
    });

    socket.on('oyunuBaslat', () => {
        if (gameStarted || playerIds.length < 2) {
            socket.emit('hata', 'Oyunun başlaması için en az 2 kişi olmalı!');
            return;
        }
        gameStarted = true;
        deck = createDeck();
        discardPile = [];
        winners = [];
        currentPlayerIndex = 0;
        direction = 1;

        for (let id of playerIds) { 
            players[id].hand = deck.splice(0, 7); 
            players[id].finished = false;
        }

        let firstCard = deck.pop();
        while (firstCard.renk === 'siyah' || isNaN(firstCard.deger)) { 
            deck.push(firstCard);
            deck = deck.sort(() => Math.random() - 0.5);
            firstCard = deck.pop();
        }
        discardPile.push(firstCard);

        updateAll();
        io.emit('hata', 'Oyun Başladı! İlk Sıra: ' + players[playerIds[currentPlayerIndex]].name);
    });

    socket.on('kartAt', (data) => {
        if (!gameStarted) return;
        if (playerIds[currentPlayerIndex] !== socket.id) {
            socket.emit('hata', 'Sıra sende değil!');
            return;
        }

        let kartIndex = data.index;
        let secilenRenk = data.secilenRenk;
        
        let p = players[socket.id];
        let playedCard = p.hand[kartIndex];
        let topCard = discardPile[discardPile.length - 1];

        let isValid = false;
        if (playedCard.renk === 'siyah') isValid = true; 
        else if (playedCard.renk === topCard.renk || playedCard.deger === topCard.deger) isValid = true;

        if (!isValid) {
            socket.emit('hata', 'Bu kartı atamazsın! Renk veya sembol eşleşmeli.');
            return;
        }

        p.hand.splice(kartIndex, 1);
        
        if (playedCard.renk === 'siyah' && secilenRenk) {
            playedCard.renk = secilenRenk; 
        }
        
        discardPile.push(playedCard);

        if (p.hand.length === 1) io.emit('hata', '🔔 DİKKAT: ' + p.name + ' TEK KART KALDI!');

        // YENİ: BİRİ KARTINI BİTİRDİĞİNDE
        if (p.hand.length === 0) {
            p.finished = true;
            winners.push(p); // Kazananlar listesine ekle
            
            let siralama = winners.length === 1 ? '🥇 1.' : (winners.length === 2 ? '🥈 2.' : '🥉 3.');
            io.emit('hata', `${siralama} Tebrikler ${p.name}! Kartlarını bitirdin.`);
        }

        // Oyunda hala kartı olan (bitirmemiş) kişileri bul
        let activePlayers = playerIds.filter(id => !players[id].finished);

        // EĞER SADECE 1 KİŞİ KALDIYSA OYUNU TAMAMEN BİTİR
        if (activePlayers.length <= 1) {
            let loserId = activePlayers[0];
            let loser = loserId ? players[loserId] : null;
            
            let bitisMesaji = "🏁 OYUN TAMAMEN BİTTİ!\n\n🏆 SIRALAMA:\n";
            winners.forEach((w, i) => {
                let madalya = i === 0 ? '🥇' : (i === 1 ? '🥈' : '🥉');
                bitisMesaji += `${madalya} ${i+1}. ${w.name}\n`;
            });
            if (loser) bitisMesaji += `\n😭 Kaybeden: ${loser.name}`;
            
            io.emit('hata', bitisMesaji);
            gameStarted = false;
            updateAll();
            return; // Fonksiyonu burada kes
        }

        // Oyun devam ediyorsa özel kartların etkileri
        if (playedCard.deger === 'Yön Değiştir') {
            direction *= -1;
            if (activePlayers.length === 2) nextTurn(); 
        } else if (playedCard.deger === 'Pas') {
            nextTurn();
        } else if (playedCard.deger === '+2') {
            nextTurn();
            let nextPlayerId = playerIds[currentPlayerIndex];
            if(deck.length < 2) { deck = discardPile.splice(0, discardPile.length - 1).sort(() => Math.random() - 0.5); }
            players[nextPlayerId].hand.push(deck.pop());
            players[nextPlayerId].hand.push(deck.pop());
        } else if (playedCard.deger === '+4 Çek') {
            nextTurn();
            let nextPlayerId = playerIds[currentPlayerIndex];
            if(deck.length < 4) { deck = discardPile.splice(0, discardPile.length - 1).sort(() => Math.random() - 0.5); }
            for(let i=0; i<4; i++) players[nextPlayerId].hand.push(deck.pop());
        }

        nextTurn();
        updateAll();
    });

    socket.on('kartCek', () => {
        if (!gameStarted) return;
        if (playerIds[currentPlayerIndex] !== socket.id) {
            socket.emit('hata', 'Sıra sende değil!'); return;
        }
        if (deck.length === 0) {
            let topCard = discardPile.pop();
            deck = discardPile.sort(() => Math.random() - 0.5);
            discardPile = [topCard];
        }
        players[socket.id].hand.push(deck.pop());
        nextTurn();
        updateAll();
    });

    socket.on('disconnect', () => {
        let disconnectedIndex = playerIds.indexOf(socket.id);
        delete players[socket.id];
        
        if (disconnectedIndex !== -1) {
            playerIds.splice(disconnectedIndex, 1);
            let activePlayers = playerIds.filter(id => !players[id].finished);
            if (gameStarted) {
                if (activePlayers.length < 2) {
                    gameStarted = false;
                    io.emit('hata', 'Kalan oyuncu yetersiz, oyun durduruldu.');
                } else {
                    if (disconnectedIndex < currentPlayerIndex) currentPlayerIndex--;
                    else if (currentPlayerIndex >= playerIds.length) currentPlayerIndex = 0;
                    io.emit('hata', 'Bir oyuncu düştü! Sıra düzenlendi.');
                }
            }
        }
        updateAll();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu çalışıyor! Port: ${PORT}`); });
