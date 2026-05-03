const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../chat.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS thread_members (
    thread_id TEXT NOT NULL REFERENCES threads(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY (thread_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id),
    sender_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now'))
  );
  
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, timestamp);
`);

const createUserStmt = db.prepare('INSERT INTO users (id, username) VALUES (?, ?)');
const getUserStmt = db.prepare('SELECT * FROM users WHERE id = ?');
const getUserByUsernameStmt = db.prepare('SELECT * FROM users WHERE username = ?');

function createUser(id, username) {
  const existing = getUserByUsernameStmt.get(username);
  if (existing) return existing;
  
  createUserStmt.run(id, username);
  return getUser(id);
}

function getUser(id) {
  return getUserStmt.get(id);
}

const createThreadStmt = db.prepare('INSERT INTO threads (id) VALUES (?)');
const addMemberStmt = db.prepare('INSERT INTO thread_members (thread_id, user_id) VALUES (?, ?)');
const createThreadTransaction = db.transaction((id, memberIds) => {
  createThreadStmt.run(id);
  for (const memberId of memberIds) {
    addMemberStmt.run(id, memberId);
  }
});

function createThread(id, memberIds) {
  createThreadTransaction(id, memberIds);
  // Fetch the full thread with members to return consistent data
  const threads = getThreadsForUser(memberIds[0]);
  return threads.find(t => t.id === id);
}

const getThreadsForUserStmt = db.prepare(`
  SELECT t.id, t.created_at,
         (SELECT content FROM messages m WHERE m.thread_id = t.id ORDER BY timestamp DESC LIMIT 1) as lastMessage,
         (SELECT timestamp FROM messages m WHERE m.thread_id = t.id ORDER BY timestamp DESC LIMIT 1) as lastMessageTime,
         (SELECT json_group_array(json_object('user_id', tm.user_id, 'username', u.username)) 
          FROM thread_members tm 
          JOIN users u ON tm.user_id = u.id 
          WHERE tm.thread_id = t.id) as members
  FROM threads t
  JOIN thread_members tm ON t.id = tm.thread_id
  WHERE tm.user_id = ?
`);

function getThreadsForUser(userId) {
  const threads = getThreadsForUserStmt.all(userId);
  return threads.map(t => ({
    ...t,
    members: JSON.parse(t.members)
  }));
}

const saveMessageStmt = db.prepare('INSERT INTO messages (id, thread_id, sender_id, content, timestamp) VALUES (@id, @threadId, @senderId, @content, @timestamp)');

function saveMessage(message) {
  saveMessageStmt.run({
    id: message.id,
    threadId: message.threadId,
    senderId: message.senderId,
    content: message.content,
    timestamp: message.timestamp
  });
  return message;
}

const getMessagesStmt = db.prepare('SELECT id, thread_id as threadId, sender_id as senderId, content, timestamp FROM messages WHERE thread_id = ? ORDER BY timestamp DESC LIMIT ?');

function getMessages(threadId, limit = 50) {
  // Get last N messages ordered descending by time, then reverse to chronological order
  const messages = getMessagesStmt.all(threadId, limit);
  return messages.reverse();
}

module.exports = {
  db,
  createUser,
  getUser,
  getUserByUsername: (username) => getUserByUsernameStmt.get(username),
  createThread,
  getThreadsForUser,
  saveMessage,
  getMessages
};
