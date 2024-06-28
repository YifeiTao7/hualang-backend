const express = require('express');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const Company = require('../models/Company');
const User = require('../models/User'); // 引入 User 模型
const path = require('path'); // 引入 path 模块

const router = express.Router();

// 使用环境变量直接构造 credentials 对象
const credentials = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'), // 替换转义字符以正确处理多行私钥
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
};

// 初始化 Google Cloud Storage
const storage = new Storage({ credentials });
const bucket = storage.bucket('yifeitaoblogs');

// Multer 配置，用于处理内存中的文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 最大文件大小为 5MB
  },
});

// 获取所有画家信息
router.get('/all', async (req, res) => {
  try {
    const artists = await Artist.find();
    res.json(artists);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 根据名字搜索画家，并确保 company 字段为 null
router.get('/search', async (req, res) => {
  const { name } = req.query;
  try {
    const artists = await Artist.find({
      name: new RegExp(name, 'i'), // 根据名字模糊搜索
      company: null // 仅搜索 company 字段为 null 的画家
    });
    res.json(artists);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取艺术家信息
router.get('/:id', async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.params.id });
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    res.json(artist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 更新艺术家信息
router.put('/:id', async (req, res) => {
  const { name, email, phone, address, weChat, qq, company, exhibitionsHeld, bio, achievements } = req.body;

  try {
    const artist = await Artist.findOne({ userId: req.params.id });
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    artist.name = name || artist.name;
    artist.email = email || artist.email;
    artist.phone = phone || artist.phone;
    artist.address = address || artist.address;
    artist.weChat = weChat || artist.weChat;
    artist.qq = qq || artist.qq;
    artist.company = company || artist.company;
    artist.exhibitionsHeld = exhibitionsHeld || artist.exhibitionsHeld;
    artist.bio = bio || artist.bio; // 更新个人简介
    artist.achievements = achievements || artist.achievements; // 更新成就
    artist.updatedAt = Date.now();

    const updatedArtist = await artist.save();

    // 同步更新 User 中的名字
    if (name) {
      const user = await User.findById(req.params.id);
      if (user) {
        user.name = name;
        await user.save();
      }
    }

    res.json(updatedArtist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// 上传头像
router.put('/:id/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const artist = await Artist.findOne({ userId: req.params.id });
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const blob = bucket.file(`avatars/${req.params.id}${path.extname(file.originalname)}`);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
      },
    });

    blobStream.on('error', err => {
      console.log(err);
      return res.status(500).json({ message: "Error uploading file" });
    });

    blobStream.end(file.buffer);

    blobStream.on('finish', async () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

      artist.avatar = publicUrl;
      artist.updatedAt = Date.now();
      const updatedArtist = await artist.save();
      res.json(updatedArtist);
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取公司下所有艺术家
router.get('/company/:userId', async (req, res) => {
  try {
    const userId = req.params.userId; // 从请求参数中获取 userId

    // 查找对应 userId 的公司
    const company = await Company.findOne({ userId });

    if (!company) {
      return res.status(404).json({ message: 'Company not found' }); // 如果未找到公司，返回 404
    }

    // 使用公司中的 artists 字段中的 userId 列表查找对应的艺术家
    const artists = await Artist.find({ userId: { $in: company.artists } });

    res.json(artists); // 返回公司的艺术家信息
  } catch (err) {
    console.error('Error fetching company:', err); // 打印错误信息
    res.status(500).json({ message: 'Internal server error' }); // 返回 500 错误
  }
});

module.exports = router;
