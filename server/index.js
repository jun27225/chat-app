const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');

const apiRoutes = require('./routes/api');
const { initVibe } = require('./vibe');
const { db } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false, // disabled for inline scripts / socket.io, adjust as needed
}));
app.use(cors({
  origin: '*', // Adjust to match allowed origins in production
}));
app.use(express.json());

app.use('/api', apiRoutes);
app.use(express.static(path.join(__dirname, '../public')));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"]
  }
});
initVibe(io);

const serverInstance = httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const shutdown = () => {
  console.log('Shutting down server gracefully...');
  serverInstance.close(() => {
    console.log('HTTP server closed.');
    db.close();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
