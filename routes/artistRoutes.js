const express = require('express');
const multer = require('multer');
const path = require('path');
const qiniu = require('qiniu');
const pool = require('../config/db');
const router = express.Router();

const accessKey = 'j7WinvxEHf6uCrdktyR-d8xl3c3qHgUs1BrK3lO4';
const secretKey = 'vbqvDHTm54uAfjbjZwOOB55GIYgePspYGHrq4YXi';
const bucket = 'zhonghualang';

// 配置七牛云的鉴权对象
const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
const config = new qiniu.conf.Config();
// 选择存储区域，例如华东
config.zone = qiniu.zone.Zone_z0;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// 获取所有画家信息
router.get('/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Artists');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 根据名字搜索画家，并确保 company 字段为 null
router.get('/search', async (req, res) => {
  const { name } = req.query;
  try {
    const query = `
      SELECT * 
      FROM Artists 
      WHERE name ILIKE $1 AND companyId IS NULL
    `;
    const result = await pool.query(query, [`%${name}%`]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取艺术家信息，包括用户的邮箱
router.get('/:userid', async (req, res) => {
  try {
    const query = `
      SELECT a.*, u.email, u.name 
      FROM Artists a
      JOIN Users u ON a.userid = u.id
      WHERE a.userid = $1
    `;
    const result = await pool.query(query, [req.params.userid]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 更新艺术家信息
router.put('/:userid', async (req, res) => {
  const { phone, address, weChat, qq, companyId, exhibitionsHeld, bio } = req.body;

  try {
    const artistResult = await pool.query('SELECT * FROM Artists WHERE userid = $1', [req.params.userid]);
    if (artistResult.rows.length === 0) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    await pool.query(
      `UPDATE Artists 
       SET phone = $1, address = $2, weChat = $3, qq = $4, companyId = $5, exhibitionsHeld = $6, bio = $7, updatedAt = CURRENT_TIMESTAMP 
       WHERE userid = $8`,
      [phone || artistResult.rows[0].phone, address || artistResult.rows[0].address, weChat || artistResult.rows[0].weChat, qq || artistResult.rows[0].qq, companyId || artistResult.rows[0].companyId, exhibitionsHeld || artistResult.rows[0].exhibitionsHeld, bio || artistResult.rows[0].bio, req.params.userid]
    );

    const updatedArtist = await pool.query('SELECT * FROM Artists WHERE userid = $1', [req.params.userid]);
    res.json(updatedArtist.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 上传头像
router.put('/:userid/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Artists WHERE userid = $1', [req.params.userid]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const oldAvatar = result.rows[0].avatar;

    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const key = `avatars/${req.params.userid}${path.extname(file.originalname)}`;

    // 删除已有文件
    const bucketManager = new qiniu.rs.BucketManager(mac, config);
    bucketManager.delete(bucket, key, function(err, respBody, respInfo) {
      if (err && respInfo.statusCode !== 612) { // 612 表示文件不存在
        console.log('Error deleting existing file:', err);
        return res.status(500).json({ message: "Error deleting existing file" });
      }

      const options = {
        scope: bucket,
      };
      const putPolicy = new qiniu.rs.PutPolicy(options);
      const uploadToken = putPolicy.uploadToken(mac);

      const formUploader = new qiniu.form_up.FormUploader(config);
      const putExtra = new qiniu.form_up.PutExtra();

      formUploader.put(uploadToken, key, file.buffer, putExtra, async (err, body, info) => {
        if (err) {
          console.log('Error uploading file:', err);
          return res.status(500).json({ message: "Error uploading file" });
        }
        if (info.statusCode == 200) {
          console.log('File uploaded successfully:', body);
          const publicUrl = `http://sggkpr4pz.hd-bkt.clouddn.com/${key}`;
          await pool.query('UPDATE Artists SET avatar = $1, updatedAt = CURRENT_TIMESTAMP WHERE userid = $2', [publicUrl, req.params.userid]);
          const updatedArtist = await pool.query('SELECT * FROM Artists WHERE userid = $1', [req.params.userid]);

          // 删除旧头像
          if (oldAvatar) {
            const oldKey = oldAvatar.split('/').pop();
            bucketManager.delete(bucket, oldKey, function(err, respBody, respInfo) {
              if (err) {
                console.log('Error deleting old avatar:', err);
              } else {
                console.log('Old avatar deleted successfully');
              }
            });
          }

          res.json(updatedArtist.rows[0]);
        } else {
          console.log('Error response from Qiniu:', body);
          res.status(info.statusCode).json({ message: body.error });
        }
      });
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取公司下的所有艺术家信息
router.get('/company/:userid', async (req, res) => {
  try {
    const companyid = req.params.userid;
    console.log(`Fetching artists for company ID: ${companyid}`);
    
    const companyResult = await pool.query('SELECT * FROM companies WHERE userid = $1', [companyid]);
    if (companyResult.rows.length === 0) {
      console.log(`Company not found for userid: ${companyid}`);
      return res.status(404).json({ message: 'Company not found' });
    }

    console.log(`Company found: ${companyResult.rows[0].name}, ID: ${companyid}`);
    
    const artistsResult = await pool.query(`
      SELECT artists.*, users.name AS artistname, COUNT(artworks.id) AS artworkscount 
      FROM artists 
      JOIN users ON artists.userid = users.id 
      LEFT JOIN artworks ON artworks.artistid = artists.userid 
      WHERE artists.companyid = $1 
      GROUP BY artists.userid, users.name
    `, [companyid]);

    console.log('Fetched artists:', artistsResult.rows);
    res.json(artistsResult.rows);
  } catch (err) {
    console.error('Error fetching company:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
