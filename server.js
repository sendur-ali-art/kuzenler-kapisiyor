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
let turnTimer = null;
const TURN_TIME_LIMIT = 45000; 

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

function reshuffleDiscard() {
    if(discardPile.length > 1) {
        let topCard = discardPile.pop();
        deck = discardPile.sort(() => Math.random() - 0.5);
        discardPile = [topCard];
    } else {
        deck = createDeck();
    }
}

function updateAll() {
    let hostId = playerIds[0]; 
    for (let i = 0; i < playerIds.length; i++) {
        const id = playerIds[i];
        if (players[id]) {
            players[id].isHost = (id === hostId);
            players[id].kartSayisi = players[id].hand ? players[id].hand.length : 0;
            players[id].siraOnda = (i === currentPlayerIndex && gameStarted && !players[id].finished);
        }
    }
    io.emit('oyuncuGuncelleme', players);
    let ortadaki = discardPile[discardPile.length - 1] || null;
    io.emit('oyunDurumu', { basladi: gameStarted, ortadakiKart: ortadaki, hostId: hostId, pendingDraw: pendingDraw });

    for (let id of playerIds) {
        if (players[id] && players[id].hand) {
            io.to(id).emit('elimiGuncelle', players[id].hand);
        }
    }
}

function startTurnTimer() {
    clearTimeout(turnTimer);
    if (gameStarted) {
        turnTimer = setTimeout(() => {
            let currentP = players[playerIds[currentPlayerIndex]];
            if(currentP && !currentP.finished) {
                if (pendingDraw > 0) {
                    for(let i=0; i<pendingDraw; i++) {
                        if (deck.length === 0) reshuffleDiscard();
                        currentP.hand.push(deck.pop());
                    }
                    io.emit('hata', `⏳ SÜRE BİTTİ! ${currentP.name} oynamadığı için otomatik ${pendingDraw} ceza kartı çekti!`);
                    pendingDraw = 0;
                    pendingDrawType = null;
                } else {
                    if (deck.length === 0) reshuffleDiscard();
                    currentP.hand.push(deck.pop());
                    io.emit('hata', `⏳ SÜRE BİTTİ! ${currentP.name} oynamadığı için 1 kart çekti.`);
                }
                nextTurn();
                updateAll();
            }
        }, TURN_TIME_LIMIT);
    }
}

function nextTurn() {
    let loopCount = 0;
    do {
        currentPlayerIndex += direction;
        if (currentPlayerIndex >= playerIds.length) currentPlayerIndex = 0;
        if (currentPlayerIndex < 0) currentPlayerIndex = playerIds.length - 1;
        loopCount++;
        if(loopCount > playerIds.length) break; 
    } while (players[playerIds[currentPlayerIndex]] && players[playerIds[currentPlayerIndex]].finished);
    
    startTurnTimer(); 
}

io.on('connection', (socket) => {
    socket.on('oyunaKatil', (isim) => {
        if (gameStarted) {
            socket.emit('hata', 'Oyun şu an devam ediyor. Masayı izleyebilirsin.');
        }
        players[socket.id] = { id: socket.id, name: isim, hand: [], finished: false, isHost: false };
        if (!gameStarted) playerIds.push(socket.id);
        updateAll();
    });

    socket.on('oyunuSifirla', () => {
        if(socket.id !== playerIds[0]) return; 
        gameStarted = false;
        clearTimeout(turnTimer);
        deck = []; discardPile = []; winners = []; pendingDraw = 0; pendingDrawType = null;
        playerIds = Object.keys(players);
        for (let id of playerIds) { 
            if(players[id]) { players[id].hand = []; players[id].finished = false; }
        }
        io.emit('hata', 'Oyun sıfırlandı! Herkes masaya alındı.');
        updateAll();
    });

    socket.on('oyunuBaslat', () => {
        if (gameStarted || playerIds.length < 2) return;
        if (socket.id !== playerIds[0]) return; 
        
        gameStarted = true;
        deck = createDeck();
        discardPile = []; winners = []; pendingDraw = 0; pendingDrawType = null;
        currentPlayerIndex = 0; direction = 1;

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
        io.emit('hata', 'Oyun Başladı! İlk Sıra: ' + players[playerIds[currentPlayerIndex]].name + '\n⏱️ Hamle süresi 45 saniye!');
        startTurnTimer();
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

        // GÜVENLİK KİLİDİ: Kart bulunamazsa çökmeyi önle
        if (!playedCard) return;

        if (pendingDraw > 0) {
            if (playedCard.deger !== pendingDrawType) {
                socket.emit('hata', `💥 CEZA DURUMU: '${pendingDrawType}' atmalı veya kırmızı Ceza butonuna basmalısın!`);
                return;
            }
        }

        let isValid = false;
        if (playedCard.renk === 'siyah') isValid = true; 
        else if (playedCard.renk === topCard.renk || playedCard.deger === topCard.deger) isValid = true;

        if (!isValid) {
            socket.emit('hata', 'Bu kartı atamazsın! Renk veya sembol eşleşmeli.');
            return;
        }

        p.hand.splice(kartIndex, 1);
        
        if (playedCard.renk === 'siyah' && secilenRenk) playedCard.renk = secilenRenk; 
        
        discardPile.push(playedCard);

        if (playedCard.deger === '+2') {
            pendingDraw += 2;
            pendingDrawType = '+2';
        } else if (playedCard.deger === '+4 Çek') {
            pendingDraw += 4;
            pendingDrawType = '+4 Çek';
        }

        if (p.hand.length === 1) io.emit('hata', '🔔 DİKKAT: ' + p.name + ' TEK KART KALDI!');

        if (p.hand.length === 0) {
            p.finished = true;
            winners.push(p); 
            let siralama = winners.length === 1 ? '🥇 1.' : (winners.length === 2 ? '🥈 2.' : '🥉 3.');
            io.emit('hata', `${siralama} Tebrikler ${p.name}! Kartlarını bitirdin.`);
        }

        let activePlayers = playerIds.filter(id => !players[id].finished);

        if (activePlayers.length <= 1) {
            clearTimeout(turnTimer);
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
            return; 
        }

        if (playedCard.deger === 'Yön Değiştir' && activePlayers.length > 2) direction *= -1;
        else if (playedCard.deger === 'Yön Değiştir' && activePlayers.length === 2) nextTurn(); 
        else if (playedCard.deger === 'Pas') nextTurn();

        nextTurn();
        updateAll();
    });

    socket.on('kartCek', () => {
        if (!gameStarted) return;
        if (playerIds[currentPlayerIndex] !== socket.id) {
            socket.emit('hata', 'Sıra sende değil!'); return;
        }
        
        let p = players[socket.id];
        
        if (pendingDraw > 0) {
            for(let i=0; i<pendingDraw; i++) {
                if (deck.length === 0) reshuffleDiscard();
                p.hand.push(deck.pop());
            }
            io.emit('hata', `💥 ${p.name}, ${pendingDraw} ceza kartı çekti!`);
            pendingDraw = 0;
            pendingDrawType = null;
        } else {
            if (deck.length === 0) reshuffleDiscard();
            p.hand.push(deck.pop());
        }

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
                    clearTimeout(turnTimer);
                    io.emit('hata', 'Kalan oyuncu yetersiz, oyun durduruldu.');
                } else {
                    if (disconnectedIndex < currentPlayerIndex) currentPlayerIndex--;
                    else if (currentPlayerIndex >= playerIds.length) currentPlayerIndex = 0;
                    io.emit('hata', 'Bir oyuncu düştü! Sıra düzenlendi.');
                    startTurnTimer(); 
                }
            }
        }
        updateAll();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Sunucu çalışıyor! Port: ${PORT}`); });
