const express = require('express');
const multer = require('multer');
const qiniu = require('qiniu');
const pool = require('../config/db'); // 引入数据库连接池
const router = express.Router();

// 七牛云配置
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
    fileSize: 5 * 1024 * 1024,
  },
});

const getNextSerialNumber = async (artistId) => {
  const result = await pool.query('SELECT serialnumber FROM Artworks WHERE artistid = $1 ORDER BY serialnumber ASC', [artistId]);
  let nextSerialNumber = 1;

  for (const artwork of result.rows) {
    if (artwork.serialnumber === nextSerialNumber) {
      nextSerialNumber++;
    } else {
      break;
    }
  }

  return nextSerialNumber;
};

router.post('/artwork', upload.single('file'), async (req, res) => {
  const { title, description, estimatedPrice, size, artistId } = req.body;

  try {
    const artistResult = await pool.query('SELECT * FROM Artists WHERE userid = $1', [artistId]);
    if (artistResult.rows.length === 0) {
      console.log(`Artist not found for userid: ${artistId}`);
      return res.status(404).json({ message: "Artist not found" });
    }

    const artist = artistResult.rows[0];
    console.log('Artist data:', artist); // 添加调试信息

    const userResult = await pool.query('SELECT name FROM Users WHERE id = $1', [artistId]);
    if (userResult.rows.length === 0) {
      console.log(`User not found for id: ${artistId}`);
      return res.status(404).json({ message: "User not found" });
    }
    const artistname = userResult.rows[0].name;

    let company = null;
    if (artist.companyid) {
      const companyResult = await pool.query('SELECT * FROM Companies WHERE userid = $1', [artist.companyid]);
      if (companyResult.rows.length > 0) {
        company = companyResult.rows[0];
      }
    }

    console.log(`Found artist: ${artistname}, Company ID: ${company ? company.userid : 'N/A'}`);

    const serialNumber = await getNextSerialNumber(artist.userid);

    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const options = {
      scope: bucket,
    };
    const putPolicy = new qiniu.rs.PutPolicy(options);
    const uploadToken = putPolicy.uploadToken(mac);

    const formUploader = new qiniu.form_up.FormUploader(config);
    const putExtra = new qiniu.form_up.PutExtra();

    const key = `artworks/${Date.now()}-${file.originalname}`;

    formUploader.put(uploadToken, key, file.buffer, putExtra, async (err, body, info) => {
      if (err) {
        console.log('Error uploading file:', err);
        return res.status(500).json({ message: "Error uploading file" });
      }
      if (info.statusCode == 200) {
        const publicUrl = `http://sggkpr4pz.hd-bkt.clouddn.com/${key}`;

        const artworkResult = await pool.query(
          'INSERT INTO Artworks (title, description, estimatedprice, size, artistid, imageurl, serialnumber, issold, saleprice, saledate) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
          [title, description, estimatedPrice, size, artist.userid, publicUrl, serialNumber, false, -1, null]
        );

        const savedArtwork = artworkResult.rows[0];
        console.log('Artwork saved:', savedArtwork);

        // 检查艺术家的作品数量是否达到办展数
        const artworkCountResult = await pool.query('SELECT COUNT(*) FROM Artworks WHERE artistid = $1', [artist.userid]);
        const artworkCount = parseInt(artworkCountResult.rows[0].count, 10);
        console.log(`Artist ${artistname} has ${artworkCount} artworks. exhibitionsheld: ${artist.exhibitionsheld}`);

        if (artworkCount >= artist.exhibitionsheld) { // 确保字段名一致
          const exhibitionResult = await pool.query(
            'INSERT INTO Exhibitions (artistuserid, artworkcount, date, companyid) VALUES ($1, $2, $3, $4) RETURNING *',
            [artist.userid, artworkCount, new Date(), company ? company.userid : null]
          );
          console.log('Exhibition created:', exhibitionResult.rows[0]);

          if (company) {
            const notificationResult = await pool.query(
              'INSERT INTO Notifications (senderid, receiverid, type, content) VALUES ($1, $2, $3, $4) RETURNING *',
              [artist.userid, company.userid, 'alert', `画家 ${artistname} 已达到办展要求，目前作品数量为 ${artworkCount} 件。`]
            );
            console.log('Notification sent:', notificationResult.rows[0]);
          }
        }

        res.status(201).json({ message: 'Artwork uploaded successfully', artwork: savedArtwork });
      } else {
        console.log('Error response from Qiniu:', body);
        res.status(info.statusCode).json({ message: body.error });
      }
    });
  } catch (error) {
    console.error('Error uploading artwork:', error);
    res.status(500).json({ message: "Error uploading artwork" });
  }
});

module.exports = router;
