import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { ENV } from './config/env';
import { setupCollaborationSockets } from './socket/collaboration.socket';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ENV.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

setupCollaborationSockets(io);

server.listen(ENV.PORT, () => {
  console.log(`🚀 [CodeSync Backend] Server running in ${ENV.NODE_ENV} mode on port ${ENV.PORT}`);
  console.log(`⚡ [Socket.IO] Real-Time Collaboration engine initialized`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export { server, io };
