const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db'); // 引入数据库连接池
const router = express.Router();

// 注册
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  console.log('Received registration data:', { name, email, password, role });

  try {
    // 检查用户是否已存在
    const userExistsResult = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);

    if (userExistsResult.rows.length > 0) {
      return res.status(400).json({ message: '用户已存在' });
    }

    // 确保密码是字符串
    if (typeof password !== 'string') {
      return res.status(400).json({ message: '密码必须是字符串' });
    }

    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log('Hashed password:', hashedPassword);

    // 插入新用户
    const userResult = await pool.query(
      'INSERT INTO Users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, hashedPassword, role]
    );
    const userid = userResult.rows[0].id;

    // 根据用户角色创建对应的艺术家或公司数据
    if (role === 'artist') {
      await pool.query(
        `INSERT INTO Artists (userid, name, phone, address, weChat, qq, companyId, avatar)
         VALUES ($1, $2, '', '', '', '', NULL, '')`,
        [userid, name]
      );
    } else if (role === 'company') {
      await pool.query(
        `INSERT INTO Companies (userid, name, address, phone, membership, membershipStartDate, membershipEndDate)
         VALUES ($1, $2, '', '', 'trial', CURRENT_TIMESTAMP, NULL)`,
        [userid, name]
      );
    }

    // 生成JWT
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

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
