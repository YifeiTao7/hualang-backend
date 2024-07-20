const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const router = express.Router();

// 注册
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  console.log('Received registration data:', { name, email, password, role });

  try {
    const userExistsResult = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);

    if (userExistsResult.rows.length > 0) {
      return res.status(400).json({ message: '用户已存在' });
    }

    if (typeof password !== 'string') {
      return res.status(400).json({ message: '密码必须是字符串' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log('Hashed password:', hashedPassword);

    const userResult = await pool.query(
      'INSERT INTO Users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, hashedPassword, role]
    );
    const userid = userResult.rows[0].id;

    if (role === 'artist') {
      await pool.query(
        `INSERT INTO Artists (
          userid, name, phone, address, weChat, qq, companyId, avatar, 
          exhibitionsHeld, signPrice, settledAmount
         ) VALUES (
          $1, $2, '', '', '', '', NULL, '', 
          100, 0.00, 0.00
         )`,
        [userid, name]
      );
    } else if (role === 'company') {
      await pool.query(
        `INSERT INTO Companies (
          userid, name, address, phone, membership, membershipStartDate, membershipEndDate,
          totalSalesVolume, totalSalesAmount
         ) VALUES (
          $1, $2, '', '', 'trial', CURRENT_TIMESTAMP, NULL,
          0, 0.00
         )`,
        [userid, name]
      );
    }

    const token = jwt.sign({ id: userid, role: role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.status(201).json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: '无效的凭证' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: '无效的凭证' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    // Fetch additional stats based on user role
    let stats = {};
    if (user.role === 'artist') {
      const artistStatsQuery = `
        SELECT 
          signPrice,
          (SELECT COALESCE(SUM(salePrice), 0) FROM Sales WHERE artistId = $1) AS totalSalesAmount,
          (SELECT COUNT(*) FROM Sales WHERE artistId = $1) AS totalSalesVolume,
          settledAmount
        FROM Artists
        WHERE userid = $1
      `;
      const artistStatsResult = await pool.query(artistStatsQuery, [user.id]);
      if (artistStatsResult.rows.length > 0) {
        stats = artistStatsResult.rows[0];
      }
    } else if (user.role === 'company') {
      const companyStatsQuery = `
        SELECT 
          totalSalesVolume,
          totalSalesAmount
        FROM Companies
        WHERE userid = $1
      `;
      const companyStatsResult = await pool.query(companyStatsQuery, [user.id]);
      if (companyStatsResult.rows.length > 0) {
        stats = companyStatsResult.rows[0];
      }
    }

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, stats } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
