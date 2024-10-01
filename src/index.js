// ./src/index.js

const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

module.exports = {
  register(/*{ strapi }*/) {},
  bootstrap({ strapi }) {
    const io = socketIO(strapi.server.httpServer, {
      cors: {
        origin: 'http://localhost:3000', // Update with your frontend URL
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Attach io to strapi so it can be used elsewhere
    strapi.io = io;

    


    io.use((socket, next) => {
      const token = socket.handshake.auth.token;

      if (token) {
        jwt.verify(
          token,
          strapi.config.get('plugin.users-permissions').jwtSecret,
          (err, decoded) => {
            if (err) return next(new Error('Authentication error'));
            socket.user = decoded;
            next();
          }
        );
      } else {
        next(new Error('Authentication error'));
      }
    });

    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.user.id}`);

      // Handle 'join_room' event
      socket.on('join_user_room', (roomId) => {
        socket.join(roomId);
      });

      // Handle 'join_room' and 'leave_room' events
      socket.on('join_room', (roomId) => {
        socket.join(roomId);
      });

      socket.on('leave_room', (roomId) => {
        socket.leave(roomId);
      });


      // Join the user to a room based on their user ID
      socket.join(`user_${socket.user.id}`);

      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.user.id}`);
      });
    });
  },
};
