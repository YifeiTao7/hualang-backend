const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
require('dotenv').config();

const app = express();

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
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/exhibitions', require('./routes/exhibitionsRoutes'));
app.use('/api/password-reset', require('./routes/passwordReset'));
app.use('/api/notifications', require('./routes/notification'));

// 加载定时任务
require('./middleware/cronTasks'); // 确保路径和文件名正确

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
