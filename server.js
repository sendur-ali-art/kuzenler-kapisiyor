const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Oyuncuların göreceği tasarım dosyalarını "public" klasöründen alacağız
app.use(express.static('public'));

// Oyun verilerini tutacağımız yer
let players = {};

io.on('connection', (socket) => {
    console.log('Yeni bir kuzen oyuna katıldı! ID:', socket.id);

    // Oyuncu bağlandığında onu listeye ekle
    players[socket.id] = { id: socket.id, name: 'Bekleniyor...' };

    socket.on('disconnect', () => {
        console.log('Bir kuzen oyundan ayrıldı:', socket.id);
        delete players[socket.id];
        io.emit('oyuncuGuncelleme', players); // Diğer oyunculara haber ver
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu çalışıyor! Port: ${PORT}`);
});
