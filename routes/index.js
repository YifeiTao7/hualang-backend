const express = require('express');
const authRoutes = require('./authRoutes');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use('/api/auth', authRoutes);

// Example protected route
router.get('/api/protected', authMiddleware, (req, res) => {
  res.send(`Hello, ${req.user.role}`);
});

module.exports = router;
