const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let users = {};

io.on('connection', socket => {
  socket.on('join', name => {
    users[socket.id] = name;
    socket.broadcast.emit('user-joined', socket.id, name);
  });

  socket.on('offer', (id, offer) => {
    socket.to(id).emit('offer', socket.id, offer);
  });

  socket.on('answer', (id, answer) => {
    socket.to(id).emit('answer', socket.id, answer);
  });

  socket.on('ice-candidate', (id, candidate) => {
    socket.to(id).emit('ice-candidate', socket.id, candidate);
  });

  socket.on('disconnect', () => {
    socket.broadcast.emit('user-left', socket.id);
    delete users[socket.id];
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
