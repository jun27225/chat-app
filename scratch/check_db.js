const Database = require('better-sqlite3');
const db = new Database('chat.db');
console.log('Users:', db.prepare('SELECT * FROM users').all());
console.log('Threads:', db.prepare('SELECT * FROM threads').all());
console.log('Thread Members:', db.prepare('SELECT * FROM thread_members').all());
db.close();
