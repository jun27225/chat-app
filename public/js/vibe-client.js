import { io } from 'https://cdn.socket.io/4.7.4/socket.io.esm.min.js';

let socket;

/**
 * connectToVibe() — Initializes the Antigravity Vibe provider.
 * Sets up the WebSocket connection, authenticates the user,
 * and registers all listeners for the real-time communication channel.
 * @param {string} userId - The current user's unique identifier
 * @returns {Promise<Socket>} - The connected socket instance
 */
export function connectToVibe(userId) {
  return new Promise((resolve) => {
    socket = io({ query: { userId } });

    socket.on('connect', () => {
      socket.emit('vibe:join', { userId });
    });

    socket.on('vibe:joined', (threads) => {
      resolve({ threads, socket });
    });

    socket.on('vibe:message', (payload) => {
      onMessageReceived(payload);
    });

    socket.on('vibe:thread-created', (thread) => {
      window.dispatchEvent(new CustomEvent('vibe:thread-created', { detail: thread }));
    });

    socket.on('vibe:typing', (data) => {
      window.dispatchEvent(new CustomEvent('vibe:typing', { detail: data }));
    });
    
    socket.on('vibe:error', (error) => {
      window.dispatchEvent(new CustomEvent('vibe:error', { detail: error }));
    });

    socket.on('connect_error', (err) => {
      console.error('Vibe connect error:', err);
    });

    socket.on('disconnect', (reason) => {
      console.warn('Vibe disconnected:', reason);
    });
  });
}

/**
 * sendMessage() — Packages the text into a JSON payload and
 * emits it through the Vibe channel to the specified thread.
 * @param {string} text - The message content
 * @param {string} threadId - The target thread ID
 */
export function sendMessage(text, threadId) {
  if (socket && socket.connected) {
    try {
      socket.emit('vibe:message', { threadId, content: text });
    } catch (e) {
      throw new Error('Failed to send message');
    }
  } else {
    throw new Error('Vibe is not connected');
  }
}

export function sendTyping(threadId) {
  if (socket && socket.connected) {
    try {
      socket.emit('vibe:typing', { threadId });
    } catch (e) {
      console.warn('Failed to send typing event');
    }
  }
}

/**
 * onMessageReceived() — Background listener callback triggered
 * when the Vibe pushes a new message packet. Updates the client
 * state and triggers a UI re-render of the chat window.
 * @param {Object} payload - { id, threadId, senderId, content, timestamp }
 */
export function onMessageReceived(payload) {
  console.log('Message received via Vibe:', payload);
  window.dispatchEvent(new CustomEvent('vibe:message', { detail: payload }));
}
