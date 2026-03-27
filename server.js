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
let winners = []; 
let pendingDraw = 0;
let pendingDrawType = null; 

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
    let hostId = playerIds[0]; 
    playerIds.forEach((id, i) => {
        if (players[id]) {
            players[id].isHost = (id === hostId);
            players[id].kartSayisi = players[id].hand ? players[id].hand.length : 0;
            players[id].siraOnda = (i === currentPlayerIndex && gameStarted && !players[id].finished);
        }
    });
    io.emit('oyuncuGuncelleme', players);
    let ortadaki = discardPile[discardPile.length - 1] || null;
    io.emit('oyunDurumu', { basladi: gameStarted, ortadakiKart: ortadaki, hostId: hostId, pendingDraw: pendingDraw });
    playerIds.forEach(id => {
        if (players[id] && players[id].hand) io.to(id).emit('elimiGuncelle', players[id].hand);
    });
}

function nextTurn() {
    let loop = 0;
    do {
        currentPlayerIndex = (currentPlayerIndex + direction + playerIds.length) % playerIds.length;
        loop++;
    } while (players[playerIds[currentPlayerIndex]].finished && loop < playerIds.length);
}

io.on('connection', (socket) => {
    socket.on('oyunaKatil', (isim) => {
        players[socket.id] = { id: socket.id, name: isim, hand: [], finished: false };
        if (!gameStarted) playerIds.push(socket.id);
        updateAll();
    });

    socket.on('oyunuSifirla', () => {
        gameStarted = false;
        deck = []; discardPile = []; winners = []; pendingDraw = 0;
        playerIds = Object.keys(players);
        playerIds.forEach(id => { players[id].hand = []; players[id].finished = false; });
        io.emit('hata', '🔄 Oyun sıfırlandı!');
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
        if (!gameStarted || playerIds[currentPlayerIndex] !== socket.id) return;
        let p = players[socket.id];
        let playedCard = p.hand[data.index];
        if (!playedCard) return;

        // Ceza katlama kontrolü
        if (pendingDraw > 0 && playedCard.deger !== pendingDrawType) {
            socket.emit('hata', 'Cezayı katlamalı veya çekmelisin!');
            return;
        }

        let top = discardPile[discardPile.length - 1];
        if (playedCard.renk !== 'siyah' && playedCard.renk !== top.renk && playedCard.deger !== top.deger) {
            socket.emit('hata', 'Geçersiz hamle!');
            return;
        }

        p.hand.splice(data.index, 1);
        if (playedCard.renk === 'siyah' && data.secilenRenk) playedCard.renk = data.secilenRenk;
        discardPile.push(playedCard);

        if (playedCard.deger === '+2') { pendingDraw += 2; pendingDrawType = '+2'; }
        else if (playedCard.deger === '+4 Çek') { pendingDraw += 4; pendingDrawType = '+4 Çek'; }

        if (p.hand.length === 0) {
            p.finished = true;
            winners.push(p);
            if (playerIds.filter(id => !players[id].finished).length <= 1) {
                gameStarted = false;
                io.emit('hata', 'Oyun Bitti!');
            }
        }

        if (playedCard.deger === 'Yön Değiştir') direction *= -1;
        if (playedCard.deger === 'Pas') nextTurn();
        
        nextTurn();
        updateAll();
    });

    socket.on('kartCek', () => {
        if (!gameStarted || playerIds[currentPlayerIndex] !== socket.id) return;
        let p = players[socket.id];
        if (pendingDraw > 0) {
            for(let i=0; i<pendingDraw; i++) {
                if(deck.length === 0) { deck = createDeck(); }
                p.hand.push(deck.pop());
            }
            pendingDraw = 0; pendingDrawType = null;
        } else {
            if(deck.length === 0) { deck = createDeck(); }
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
