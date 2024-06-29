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

// 加载定时任务
require('./middleware/cronTasks'); // 确保路径和文件名正确

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
