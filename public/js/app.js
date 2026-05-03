import { state } from './state.js';
import { connectToVibe, sendMessage, sendTyping } from './vibe-client.js';
import { 
  showLoginOverlay, 
  hideLoginOverlay, 
  renderSidebar, 
  renderMessages, 
  renderConnectionStatus, 
  showNewChatDialog,
  showToast,
  showTypingIndicator,
  hideTypingIndicator
} from './ui.js';
import { 
  saveMessageToCache, 
  getMessagesFromCache, 
  saveThreadsToCache, 
  getThreadsFromCache, 
  saveDraft, 
  getDraft, 
  clearDraft 
} from './storage.js';

let appSocket = null;

// --- State Subscriptions ---

state.subscribe('user-updated', () => {
  // Global user updates if needed
});

state.subscribe('threads-updated', (threads) => {
  renderSidebar(threads, state.data.activeThreadId, state.data.currentUserId);
});

state.subscribe('active-thread-changed', async (threadId) => {
  localStorage.setItem('vibe_activeThreadId', threadId);
  renderSidebar(state.data.threads, threadId, state.data.currentUserId);
  
  if (!state.data.messages[threadId]) {
    // 1. Load from cache immediately
    const cachedMessages = await getMessagesFromCache(threadId);
    if (cachedMessages.length > 0) {
      state.setMessages(threadId, cachedMessages);
    }
    
    // 2. Fetch from server
    try {
      const res = await fetch(`/api/messages/${threadId}`);
      if (res.ok) {
        const history = await res.json();
        state.setMessages(threadId, history);
        history.forEach(m => saveMessageToCache(m));
      } else if (cachedMessages.length === 0) {
        state.setMessages(threadId, []);
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
      if (cachedMessages.length === 0) state.setMessages(threadId, []);
    }
  } else {
    renderMessages(state.data.messages[threadId], state.data.currentUserId);
  }
  
  document.getElementById('chat-title').textContent = `Chat: ${threadId.substring(0, 8)}`;

  const msgInput = document.getElementById('message-input');
  
  // Get draft from cache if not in state
  let draft = state.data.drafts[threadId];
  if (draft === undefined) {
    draft = await getDraft(threadId);
    state.updateDraft(threadId, draft);
  } else {
    msgInput.value = draft || '';
  }
  msgInput.focus();
});

state.subscribe('messages-updated', ({ threadId, messages }) => {
  if (state.data.activeThreadId === threadId) {
    renderMessages(messages, state.data.currentUserId);
  }
});

state.subscribe('connection-status-changed', (status) => {
  renderConnectionStatus(status);
  const banner = document.getElementById('reconnecting-banner');
  if (status === 'disconnected') {
    banner?.classList.remove('hidden');
    showToast('Disconnected from server', 'error');
  } else if (status === 'connected') {
    if (banner && !banner.classList.contains('hidden')) {
      banner.classList.add('hidden');
      showToast('Reconnected successfully', 'success');
      // Re-emit vibe:join on reconnection handled by connect event already (in vibes-client init / app.js)
    }
  }
});

state.subscribe('draft-updated', ({ threadId, text }) => {
  if (text) {
    saveDraft(threadId, text);
  } else {
    clearDraft(threadId);
  }
});

// --- UI Event Listeners ---

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username-input').value.trim();
  if (!username) return;

  const userId = username.toLowerCase();
  
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, username })
    });
    
    if (!res.ok) {
      throw new Error('Server returned error during login');
    }
    
    const user = await res.json();
    
    state.setCurrentUser(user.id, user.username);
    localStorage.setItem('vibe_userId', user.id);
    localStorage.setItem('vibe_username', user.username);
    
    const vibe = await connectToVibe(user.id);
    appSocket = vibe.socket;
    
    state.setConnectionStatus('connected');
    
    // Merge server threads and cache
    const serverThreads = vibe.threads || [];
    saveThreadsToCache(serverThreads);
    state.setThreads(serverThreads);
    
    appSocket.on('disconnect', () => {
      state.setConnectionStatus('disconnected');
    });
    
    appSocket.on('connect', () => {
      state.setConnectionStatus('connected');
    });
    
    hideLoginOverlay();

  } catch (error) {
    console.error('Login failed:', error);
    alert('Failed to login or connect to server.');
  }
});

document.getElementById('thread-list').addEventListener('click', (e) => {
  const item = e.target.closest('.thread-item');
  if (item) {
    const threadId = item.dataset.id;
    state.setActiveThread(threadId);
  }
});

document.getElementById('new-chat-btn').addEventListener('click', async () => {
  const recipientId = await showNewChatDialog();
  if (recipientId && appSocket) {
    appSocket.emit('vibe:create-thread', { recipientId: recipientId.toLowerCase() });
  }
});

document.getElementById('message-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const activeThreadId = state.data.activeThreadId;
  const content = document.getElementById('message-input').value.trim();
  
  if (activeThreadId && content) {
    // Optimistic UI update
    const optimisticMsg = {
      id: 'temp-' + Date.now(),
      thread_id: activeThreadId,
      sender_id: state.data.currentUserId,
      content,
      timestamp: new Date().toISOString()
    };
    state.addMessage(optimisticMsg);
    saveMessageToCache(optimisticMsg);

    try {
      sendMessage(content, activeThreadId);
      document.getElementById('message-input').value = '';
      state.updateDraft(activeThreadId, '');
    } catch (err) {
      showToast(err.message || 'Failed to send message', 'error');
      const messages = state.data.messages[activeThreadId];
      if (messages) {
        state.setMessages(activeThreadId, messages.filter(m => m.id !== optimisticMsg.id));
      }
    }
  }
});

let typingTimeout = null;
document.getElementById('message-input').addEventListener('input', (e) => {
  if (state.data.activeThreadId) {
    state.updateDraft(state.data.activeThreadId, e.target.value);
    
    if (appSocket) {
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        sendTyping(state.data.activeThreadId);
      }, 500);
    }
  }
});

// --- Vibe Engine Events ---
window.addEventListener('vibe:message', (e) => {
  const payload = e.detail;
  const threadId = payload.threadId || payload.thread_id;
  
  // Remove optimistic message if present
  if (state.data.messages[threadId]) {
    const messages = state.data.messages[threadId];
    const pendingIdx = messages.findIndex(m => m.id.toString().startsWith('temp-') && m.content === payload.content);
    if (pendingIdx !== -1) {
      messages.splice(pendingIdx, 1);
    }
  }

  saveMessageToCache(payload);
  state.addMessage(payload);
  
  // Save updated thread with lastMessage to cache
  const thread = state.data.threads.find(t => t.id === threadId);
  if (thread) saveThreadsToCache(state.data.threads);
});

window.addEventListener('vibe:thread-created', (e) => {
  state.addThread(e.detail);
  saveThreadsToCache(state.data.threads);
});

let hideTypingId = null;
window.addEventListener('vibe:typing', (e) => {
  const payload = e.detail;
  if (state.data.activeThreadId === payload.threadId) {
    showTypingIndicator(payload.userId);
    if (hideTypingId) clearTimeout(hideTypingId);
    hideTypingId = setTimeout(() => {
      hideTypingIndicator();
    }, 3000);
  }
});

window.addEventListener('vibe:error', (e) => {
  showToast(e.detail.message, 'error');
});

// Init
async function initApp() {
  const storedUserId = localStorage.getItem('vibe_userId');
  const storedUsername = localStorage.getItem('vibe_username');
  
  if (storedUserId && storedUsername) {
    state.setCurrentUser(storedUserId, storedUsername);
    const cachedThreads = await getThreadsFromCache();
    if (cachedThreads && cachedThreads.length > 0) {
      state.setThreads(cachedThreads);
    }
    const activeId = localStorage.getItem('vibe_activeThreadId');
    if (activeId) {
      state.setActiveThread(activeId);
    }
    
    try {
      // Ensure user exists on server (e.g. if DB was just reset)
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: storedUserId, username: storedUsername })
      });

      const vibe = await connectToVibe(storedUserId);
      appSocket = vibe.socket;
      state.setConnectionStatus('connected');
      
      const serverThreads = vibe.threads || [];
      saveThreadsToCache(serverThreads);
      state.setThreads(serverThreads);
      
      appSocket.on('disconnect', () => state.setConnectionStatus('disconnected'));
      appSocket.on('connect', () => state.setConnectionStatus('connected'));
      
      hideLoginOverlay();
    } catch (err) {
      console.error('Auto login failed', err);
      showLoginOverlay();
    }
  } else {
    showLoginOverlay();
  }
}

initApp();
