const express = require('express');
const path = require('path');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3456;
const MAX_PORT = DEFAULT_PORT + 200;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3456', 'http://127.0.0.1:3456', 'http://localhost:61462', 'http://127.0.0.1:61462'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

app.use('/api', apiRoutes);

app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

function tryListen(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Lightspeed Grid server running on port ${port}`);
      resolve(server);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && port < MAX_PORT) {
        console.log(`Port ${port} in use, trying ${port + 1}...`);
        resolve(tryListen(port + 1));
      } else {
        reject(err);
      }
    });
  });
}

tryListen(DEFAULT_PORT).catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
