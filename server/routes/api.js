const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// GET /api/threads/:userId -> calls getThreadsForUser(userId)
router.get('/threads/:userId', (req, res) => {
  try {
    const threads = db.getThreadsForUser(req.params.userId);
    res.json(threads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/messages/:threadId -> calls getMessages(threadId)
router.get('/messages/:threadId', (req, res) => {
  try {
    const messages = db.getMessages(req.params.threadId);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/threads -> body { memberIds: [id1, id2] }, calls createThread()
router.post('/threads', (req, res) => {
  try {
    const { memberIds } = req.body;
    if (!memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({ error: 'memberIds array is required' });
    }
    const id = crypto.randomUUID();
    const thread = db.createThread(id, memberIds);
    res.status(201).json(thread);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users -> body { id, username }, calls createUser()
router.post('/users', (req, res) => {
  try {
    const { id, username } = req.body;
    if (!id || !username) {
      return res.status(400).json({ error: 'id and username are required' });
    }
    const user = db.createUser(id, username);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
