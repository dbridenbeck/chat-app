const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

io.on('connection', (socket) => {
  
  socket.on('join', ({ username, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, username, room });
    
    if (error) {
      return callback(error);
    }
    
    socket.join(user.room);
    
    socket.emit("displayMessage", generateMessage("Admin", "Welcome to the chat room!"));
    socket.broadcast
      .to(user.room)
      .emit(
        "displayMessage",
        generateMessage("Admin", `${user.username} has joined!`)
      );
    
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room)
    })
    callback();
  });

  socket.on('sendMessage', (message, callback) => {
    const filter = new Filter();
    const { username, room } = getUser(socket.id);
    if (filter.isProfane(message)) {
      return callback("You kiss yo momma with that mounth? Profanity is not allowed.");
    }

    io.to(room).emit('displayMessage', generateMessage(username, message));
    callback();
  });

  socket.on('shareLocation', ({ latitude, longitude }, callback) => {
    const { username, room } = getUser(socket.id);
    io.to(room).emit(
      "locationMessage",
      generateLocationMessage(username, `https://google.com/maps?q=${latitude},${longitude}`)
    );

    callback();
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);
    if (user) {
      io.to(user.room).emit('displayMessage', generateMessage("Admin", `${user.username} has left the chat.`));
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room)
      });
    }
  });
});

server.listen(port, console.log(`Chat app running on port ${port}!`));