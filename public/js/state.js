class State {
  constructor() {
    this.data = {
      currentUserId: null,
      currentUserUsername: null,
      threads: [],              // [{ id, members, created_at, lastMessage }]
      activeThreadId: null,
      messages: {},             // { [threadId]: Message[] }
      drafts: {},               // { [threadId]: string }
      connectionStatus: 'disconnected'
    };
    this.listeners = {};
  }

  subscribe(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, payload) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(payload));
    }
  }

  setCurrentUser(id, username) {
    this.data.currentUserId = id;
    this.data.currentUserUsername = username;
    this.emit('user-updated', { id, username });
  }

  setThreads(threads) {
    this.data.threads = threads;
    this.emit('threads-updated', this.data.threads);
  }
  
  addThread(thread) {
    if (!this.data.threads.find(t => t.id === thread.id)) {
      this.data.threads.push(thread);
      this.emit('threads-updated', this.data.threads);
    }
  }

  setActiveThread(id) {
    if (this.data.activeThreadId !== id) {
      this.data.activeThreadId = id;
      this.emit('active-thread-changed', id);
    }
  }

  addMessage(msg) {
    const threadId = msg.thread_id || msg.threadId;
    if (!this.data.messages[threadId]) {
      this.data.messages[threadId] = [];
    }
    
    // Check for duplicates
    if (!this.data.messages[threadId].find(m => m.id === msg.id)) {
      this.data.messages[threadId].push(msg);
      
      // Update thread lastMessage if applicable
      const thread = this.data.threads.find(t => t.id === threadId);
      if (thread) {
        thread.lastMessage = msg;
        this.emit('threads-updated', this.data.threads);
      }
      
      this.emit('messages-updated', { threadId, messages: this.data.messages[threadId] });
    }
  }
  
  setMessages(threadId, messages) {
    this.data.messages[threadId] = messages;
    this.emit('messages-updated', { threadId, messages: this.data.messages[threadId] });
  }

  updateDraft(threadId, text) {
    this.data.drafts[threadId] = text;
    this.emit('draft-updated', { threadId, text });
  }

  setConnectionStatus(status) {
    this.data.connectionStatus = status;
    this.emit('connection-status-changed', status);
  }
}

export const state = new State();
