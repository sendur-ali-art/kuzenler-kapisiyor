const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Oyun verileri
let players = {};
let playerIds = []; 
let deck = [];
let discardPile = [];
let currentPlayerIndex = 0;
let direction = 1;
let gameStarted = false;

const renkler = ['kirmizi', 'mavi', 'yesil', 'sari'];
const degerler = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Pas', 'Yön Değiştir', '+2'];

// Desteyi Oluşturma ve Karıştırma
function createDeck() {
    let newDeck = [];
    for (let renk of renkler) {
        for (let deger of degerler) {
            newDeck.push({ renk: renk, deger: deger });
            if (deger !== '0') newDeck.push({ renk: renk, deger: deger }); // 0 hariç her karttan ikişer tane
        }
    }
    // Siyah (Özel) Kartlar
    for (let i = 0; i < 4; i++) {
        newDeck.push({ renk: 'siyah', deger: 'Renk Seç' });
        newDeck.push({ renk: 'siyah', deger: '+4 Çek' });
    }
    // Desteyi Karıştır
    return newDeck.sort(() => Math.random() - 0.5);
}

// Tüm ekranları güncelle
function updateAll() {
    for (let i = 0; i < playerIds.length; i++) {
        const id = playerIds[i];
        players[id].kartSayisi = players[id].hand ? players[id].hand.length : 0;
        players[id].siraOnda = (i === currentPlayerIndex && gameStarted);
    }
    
    io.emit('oyuncuGuncelleme', players);
    
    let ortadaki = discardPile[discardPile.length - 1] || null;
    io.emit('oyunDurumu', { basladi: gameStarted, ortadakiKart: ortadaki });

    for (let id of playerIds) {
        if (players[id].hand) {
            io.to(id).emit('elimiGuncelle', players[id].hand);
        }
    }
}

// Sırayı bir sonrakine geçir
function nextTurn() {
    currentPlayerIndex += direction;
    if (currentPlayerIndex >= playerIds.length) currentPlayerIndex = 0;
    if (currentPlayerIndex < 0) currentPlayerIndex = playerIds.length - 1;
}

io.on('connection', (socket) => {
    players[socket.id] = { id: socket.id, name: 'Bekleniyor...', hand: [] };
    playerIds.push(socket.id);

    socket.on('oyunaKatil', (isim) => {
        players[socket.id].name = isim;
        updateAll();
    });

    // Oyunu Başlat
    socket.on('oyunuBaslat', () => {
        if (gameStarted || playerIds.length < 2) {
            socket.emit('hata', 'Oyunun başlaması için en az 2 kişi olmalı!');
            return;
        }
        gameStarted = true;
        deck = createDeck();
        discardPile = [];
        currentPlayerIndex = 0;
        direction = 1;

        // Herkese 7 kart dağıt
        for (let id of playerIds) {
            players[id].hand = deck.splice(0, 7);
        }

        // Ortaya ilk kartı aç (Siyah denk gelirse desteye geri koyup tekrar çek)
        let firstCard = deck.pop();
        while (firstCard.renk === 'siyah') { 
            deck.push(firstCard);
            deck = deck.sort(() => Math.random() - 0.5);
            firstCard = deck.pop();
        }
        discardPile.push(firstCard);

        updateAll();
        io.emit('hata', 'Oyun Başladı! İlk Sıra: ' + players[playerIds[currentPlayerIndex]].name);
    });

    // Oyuncu kart attığında
    socket.on('kartAt', (kartIndex) => {
        if (!gameStarted) return;
        if (playerIds[currentPlayerIndex] !== socket.id) {
            socket.emit('hata', 'Acele etme, sıra sende değil! 😅');
            return;
        }

        let p = players[socket.id];
        let playedCard = p.hand[kartIndex];
        let topCard = discardPile[discardPile.length - 1];

        // Kurallar: Renk veya Sayı uyuşmalı (Siyah kartlar her şeye atılır)
        let isValid = false;
        if (playedCard.renk === 'siyah') isValid = true; 
        else if (playedCard.renk === topCard.renk || playedCard.deger === topCard.deger) isValid = true;
        else if (topCard.renk === 'siyah') isValid = true; // Ortada siyah varsa istenen renk atılabilir

        if (!isValid) {
            socket.emit('hata', 'Bu kartı atamazsın! Renk veya sembol eşleşmeli.');
            return;
        }

        // Kartı elden çıkar, ortaya at
        p.hand.splice(kartIndex, 1);
        discardPile.push(playedCard);

        // "TEK KALDI" Uyarısı
        if (p.hand.length === 1) {
            io.emit('hata', '🔔 DİKKAT: ' + p.name + ' TEK KART KALDI!');
        }

        // KAZANMA DURUMU
        if (p.hand.length === 0) {
            io.emit('hata', '🏆 TEBRİKLER! ' + p.name + ' KAZANDI!');
            gameStarted = false;
            updateAll();
            return;
        }

        // Özel Kartların Etkileri
        if (playedCard.deger === 'Yön Değiştir') {
            direction *= -1;
            if (playerIds.length === 2) nextTurn(); // 2 kişiyse pas görevi görür
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

    // Oyuncu kart çektiğinde
    socket.on('kartCek', () => {
        if (!gameStarted) return;
        if (playerIds[currentPlayerIndex] !== socket.id) {
            socket.emit('hata', 'Sıra sende değil!');
            return;
        }

        // Deste bittiyse ortadaki kartları karıştırıp yeni deste yap
        if (deck.length === 0) {
            let topCard = discardPile.pop();
            deck = discardPile.sort(() => Math.random() - 0.5);
            discardPile = [topCard];
        }

        players[socket.id].hand.push(deck.pop());
        nextTurn();
        updateAll();
    });

    // Biri oyundan çıktığında
    socket.on('disconnect', () => {
        delete players[socket.id];
        playerIds = playerIds.filter(id => id !== socket.id);
        if (playerIds.length < 2 && gameStarted) {
            gameStarted = false;
            io.emit('hata', 'Yeterli oyuncu kalmadığı için oyun iptal oldu.');
        }
        updateAll();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu çalışıyor! Port: ${PORT}`);
});
