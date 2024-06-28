const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Artist = require('../models/Artist'); // 导入 Artist 模型
const Company = require('../models/Company'); // 导入 Company 模型

const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: '用户已存在' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
    });

    await user.save();

    // 根据用户角色创建对应的艺术家或公司数据
    if (role === 'artist') {
      const artist = new Artist({
        userId: user._id, // 确保传递 userId
        name: user.name, // 默认值
        email: user.email,
        phone: "", // 默认值
        address: "",
        weChat: "",
        qq: "",
        company: null, // 公司ID可以为空
        avatar: "", // 默认值或初始值为空
      });
      await artist.save();
    } else if (role === 'company') {
      const company = new Company({
        userId: user._id, // 确保传递 userId
        name: user.name, // 默认值
        email: user.email,
        phone: "", // 默认值
        address: "",
      });
      await company.save();
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.status(201).json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: '无效的凭证' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: '无效的凭证' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({ token, user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
