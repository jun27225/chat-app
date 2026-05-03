import { state } from './state.js';

export function showLoginOverlay() {
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('chat-layout').classList.add('hidden');
}

export function hideLoginOverlay() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('chat-layout').classList.remove('hidden');
}

export function renderSidebar(threads, activeThreadId, currentUserId) {
  const threadList = document.getElementById('thread-list');
  threadList.innerHTML = '';

  if (!threads || threads.length === 0) {
    threadList.innerHTML = '<div style="padding: 2rem 1rem; text-align: center; color: var(--text-secondary);"><div style="font-size: 2rem; margin-bottom: 0.5rem;">📭</div><p>Start a new conversation</p></div>';
    return;
  }

  threads.forEach(thread => {
    const li = document.createElement('li');
    li.className = `thread-item ${thread.id === activeThreadId ? 'active' : ''}`;
    li.dataset.id = thread.id;

    let threadName = thread.id.substring(0, 8);
    if (thread.members && Array.isArray(thread.members)) {
      const otherMembers = thread.members.filter(m => m.user_id !== currentUserId);
      if (otherMembers.length > 0) {
        threadName = otherMembers.map(m => m.username || m.user_id).join(', ');
      }
    }

    const nameDiv = document.createElement('div');
    nameDiv.className = 'thread-name';
    nameDiv.textContent = threadName;

    const previewDiv = document.createElement('div');
    previewDiv.className = 'thread-preview';
    if (thread.lastMessage) {
      previewDiv.textContent = thread.lastMessage.content;
    } else {
      previewDiv.textContent = 'No messages yet';
    }

    li.appendChild(nameDiv);
    li.appendChild(previewDiv);
    threadList.appendChild(li);
  });
}

export function renderMessages(messages, currentUserId) {
  const container = document.getElementById('messages-container');
  container.innerHTML = '';

  if (!messages || messages.length === 0) {
    container.innerHTML = '<div class="empty-state-chat" style="margin-top:auto; margin-bottom:auto;"><span class="empty-icon">👋</span><p>Say hello!</p></div>';
    return;
  }

  messages.forEach(msg => {
    const div = document.createElement('div');
    const isSent = (msg.sender_id || msg.senderId) === currentUserId;
    div.className = `message-bubble ${isSent ? 'message-sent' : 'message-received'}`;
    
    div.textContent = msg.content;
    
    const metaDiv = document.createElement('div');
    metaDiv.className = 'message-meta';
    
    const d = new Date(msg.timestamp);
    metaDiv.textContent = isNaN(d.getTime()) ? msg.timestamp : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    div.appendChild(metaDiv);
    container.appendChild(div);
  });

  container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

export function renderConnectionStatus(status) {
  const dot = document.getElementById('connection-status');
  if (status === 'connected') {
    dot.classList.add('connected');
  } else {
    dot.classList.remove('connected');
  }
}

export function showNewChatDialog() {
  return new Promise((resolve) => {
    const modal = document.getElementById('new-chat-modal');
    const input = document.getElementById('new-chat-input');
    const cancelBtn = document.getElementById('cancel-new-chat-btn');
    const confirmBtn = document.getElementById('confirm-new-chat-btn');
    
    modal.classList.remove('hidden');
    input.value = '';
    input.focus();
    
    const cleanup = () => {
      modal.classList.add('hidden');
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      document.removeEventListener('keydown', onKeydown);
    };

    const onCancel = () => { cleanup(); resolve(null); };
    const onConfirm = () => { cleanup(); resolve(input.value.trim() || null); };
    const onKeydown = (e) => {
      if (!modal.classList.contains('hidden')) {
        if (e.key === 'Escape') onCancel();
        if (e.key === 'Enter') onConfirm();
      }
    };

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    document.addEventListener('keydown', onKeydown);
  });
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
  }, 4000);
}

export function showTypingIndicator(userId) {
  const indicator = document.getElementById('typing-indicator');
  const textSpan = indicator.querySelector('span');
  textSpan.textContent = `${userId} is typing`;
  indicator.classList.remove('hidden');
}

export function hideTypingIndicator() {
  document.getElementById('typing-indicator').classList.add('hidden');
}
