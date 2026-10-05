const { Server } = require('socket.io');
const { authenticateSocket } = require('./auth');
const { CLIENT_EVENTS } = require('./events');
const { authorizeRooms, userRoom } = require('./rooms');
const realtime = require('../services/realtime.service');

function initSocket(httpServer, env) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.frontendUrl,
      methods: ['GET', 'POST'],
    },
  });

  io.use(authenticateSocket);
  realtime.attach(io);

  io.on('connection', (socket) => {
    socket.join(userRoom(socket.user.userId));
    console.log(`Socket connected: ${socket.user.userId}`);

    socket.on(CLIENT_EVENTS.JOIN, async (payload, acknowledge) => {
      const requested = payload && Array.isArray(payload.rooms) ? payload.rooms : [];
      const result = await authorizeRooms(socket.user, requested);
      result.joined.forEach((room) => socket.join(room));

      if (typeof acknowledge === 'function') {
        acknowledge(result);
      }
    });

    socket.on(CLIENT_EVENTS.LEAVE, (payload, acknowledge) => {
      const requested = payload && Array.isArray(payload.rooms) ? payload.rooms : [];
      requested.forEach((room) => {
        if (typeof room === 'string' && room !== userRoom(socket.user.userId)) {
          socket.leave(room);
        }
      });

      if (typeof acknowledge === 'function') {
        acknowledge({ left: requested });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.user.userId}`);
    });
  });

  return io;
}

module.exports = { initSocket };
