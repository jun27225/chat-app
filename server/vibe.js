const crypto = require('crypto');
const db = require('./db');

// The Vibe Engine — manages real-time communication channels

const userSockets = new Map();

function initVibe(io) {
  io.on('connection', socket => {
    socket.on('vibe:join', ({ userId }) => {
      socket.userId = userId;
      const threads = db.getThreadsForUser(userId);
      
      threads.forEach(thread => {
        socket.join(thread.id);
      });
      
      socket.emit('vibe:joined', threads);
      userSockets.set(userId, socket.id);
    });

    socket.on('vibe:message', ({ threadId, content }) => {
      const msg = {
        id: crypto.randomUUID(),
        threadId,
        senderId: socket.userId,
        content,
        timestamp: new Date().toISOString()
      };
      
      db.saveMessage(msg);
      io.to(threadId).emit('vibe:message', msg);
    });

    socket.on('vibe:typing', ({ threadId }) => {
      socket.to(threadId).emit('vibe:typing', { threadId, userId: socket.userId });
    });

    socket.on('vibe:create-thread', ({ recipientId }) => {
      try {
        let recipient = db.getUserByUsername(recipientId);
        
        // Auto-create recipient if they don't exist (ensures seamless operation after DB reset)
        if (!recipient) {
          recipient = db.createUser(recipientId, recipientId);
        }

        const id = crypto.randomUUID();
        const thread = db.createThread(id, [socket.userId, recipient.id]);
        
        socket.join(id);
        const recipientSocketId = userSockets.get(recipientId);
        if (recipientSocketId) {
          const recipientSocket = io.sockets.sockets.get(recipientSocketId);
          if (recipientSocket) {
            recipientSocket.join(id);
          }
        }
        
        io.to(id).emit('vibe:thread-created', thread);
      } catch (error) {
        console.error('Failed to create thread:', error.message);
        socket.emit('vibe:error', { message: 'Failed to start chat. Make sure the user exists.' });
      }
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        userSockets.delete(socket.userId);
        // Ensure we broadcast user-offline appropriately in later phases if required.
      }
    });
  });
}

module.exports = { initVibe };
