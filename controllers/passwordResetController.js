const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const User = require('../models/User');
require('dotenv').config();

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: '用户未找到' });
    }

    const token = crypto.randomBytes(4).toString('hex').toUpperCase(); // 生成4位验证码
    user.resetToken = token;
    user.resetTokenExpiration = Date.now() + 3600000; // 1小时过期
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    const mailOptions = {
      to: user.email,
      from: 'passwordreset@example.com',
      subject: '密码重置验证码',
      text: `您的密码重置验证码是：${token}\n\n该验证码有效期为1小时。`,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: '验证码已发送到您的邮箱' });
  } catch (error) {
    console.error('邮件发送错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

const verifyCode = async (req, res) => {
  const { email, code } = req.body;
  try {
    const user = await User.findOne({
      email,
      resetToken: code,
      resetTokenExpiration: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: '验证码无效或已过期' });
    }

    res.json({ message: '验证码验证成功' });
  } catch (error) {
    console.error('验证码验证错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

const resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;
  try {
    const user = await User.findOne({
      email,
      resetToken: code,
      resetTokenExpiration: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: '验证码无效或已过期' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiration = undefined;
    await user.save();

    res.json({ message: '密码已重置' });
  } catch (error) {
    console.error('密码重置错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

module.exports = { requestPasswordReset, verifyCode, resetPassword };
