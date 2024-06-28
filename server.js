const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Connect Database
connectDB();

// Init Middleware
app.use(cors());
app.use(express.json({ extended: false }));

// Define Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/artworks', require('./routes/artworksRoutes'));
app.use('/api/artists', require('./routes/artistRoutes'));
app.use('/api/notifications', require('./routes/notification'));
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/exhibitions', require('./routes/exhibitionsRoutes'));
app.use('/api/password-reset', require('./routes/passwordReset'));

// WebSocket 连接管理
const clients = new Map();

wss.on('connection', (ws, req) => {
  const userId = new URLSearchParams(req.url.slice(1)).get('userId');

  if (userId) {
    clients.set(userId, ws);

    ws.on('message', (message) => {
      console.log(`Received message => ${message}`);
    });

    ws.on('close', () => {
      clients.delete(userId);
      console.log('Client disconnected');
    });
  }
});

// 发送通知给特定用户
const sendNotificationToUser = (userId, notification) => {
  const ws = clients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(notification));
  }
};

// 在 Express 路由中集成通知发送
app.post('/api/send-notification', (req, res) => {
  const { userId, notification } = req.body;
  sendNotificationToUser(userId, notification);
  res.status(200).send('Notification sent');
});

// 加载定时任务
require('./middleware/cronTasks'); // 确保路径和文件名正确

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
