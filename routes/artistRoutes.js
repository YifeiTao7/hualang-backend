const express = require('express');
const multer = require('multer');
const path = require('path');
const qiniu = require('qiniu');
const pool = require('../config/db');
const router = express.Router();

const accessKey = 'j7WinvxEHf6uCrdktyR-d8xl3c3qHgUs1BrK3lO4';
const secretKey = 'vbqvDHTm54uAfjbjZwOOB55GIYgePspYGHrq4YXi';
const bucket = 'hualang-bucket';

const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
const config = new qiniu.conf.Config();
config.zone = qiniu.zone.Zone_z0;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.get('/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Artists');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/search', async (req, res) => {
  const { name } = req.query;
  try {
    const query = 'SELECT * FROM Artists WHERE name ILIKE $1 AND companyId IS NULL';
    const result = await pool.query(query, [`%${name}%`]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:userid', async (req, res) => {
  try {
    const query = 'SELECT a.*, u.email, u.name FROM Artists a JOIN Users u ON a.userid = u.id WHERE a.userid = $1';
    const result = await pool.query(query, [req.params.userid]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:userid/stats', async (req, res) => {
  try {
    const artistStatsQuery = `
      SELECT 
        signPrice,
        settledAmount
      FROM Artists
      WHERE userid = $1
    `;
    const artistStatsResult = await pool.query(artistStatsQuery, [req.params.userid]);
    if (artistStatsResult.rows.length === 0) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    const artistStats = artistStatsResult.rows[0];

    const artistPaymentQuery = `
      SELECT 
        COUNT(*) AS totalSalesVolume,
        COALESCE(SUM(artistPayment), 0) AS totalArtistPayment
      FROM Sales
      WHERE artistId = $1
    `;
    const artistPaymentResult = await pool.query(artistPaymentQuery, [req.params.userid]);
    const artistPaymentStats = artistPaymentResult.rows[0];

    const result = {
      signPrice: artistStats.signprice,
      totalSalesVolume: parseInt(artistPaymentStats.totalsalesvolume, 10),
      totalArtistPayment: parseFloat(artistPaymentStats.totalartistpayment),
      settledAmount: parseFloat(artistStats.settledamount)
    };

    console.log("Fetched artist stats:", result);
    res.json(result);
  } catch (err) {
    console.error('Failed to fetch artist stats:', err);
    res.status(500).json({ message: 'Failed to fetch artist stats', error: err.message });
  }
});







router.put('/:userid/settled-amount', async (req, res) => {
  const { settledAmount } = req.body;

  try {
    const artistResult = await pool.query('SELECT * FROM Artists WHERE userid = $1', [req.params.userid]);
    if (artistResult.rows.length === 0) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const newSettledAmount = parseFloat(artistResult.rows[0].settledamount) + parseFloat(settledAmount);

    await pool.query(
      'UPDATE Artists SET settledAmount = $1, updatedAt = CURRENT_TIMESTAMP WHERE userid = $2',
      [newSettledAmount, req.params.userid]
    );

    const updatedArtist = await pool.query('SELECT settledamount FROM Artists WHERE userid = $1', [req.params.userid]);
    res.json({ settledAmount: updatedArtist.rows[0].settledamount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:userid', async (req, res) => {
  const { phone, address, weChat, qq, companyId, exhibitionsHeld, bio, signPrice } = req.body;

  try {
    const artistResult = await pool.query('SELECT * FROM Artists WHERE userid = $1', [req.params.userid]);
    if (artistResult.rows.length === 0) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    await pool.query(
      'UPDATE Artists SET phone = $1, address = $2, weChat = $3, qq = $4, companyId = $5, exhibitionsHeld = $6, bio = $7, signPrice = $8, updatedAt = CURRENT_TIMESTAMP WHERE userid = $9',
      [
        phone || artistResult.rows[0].phone,
        address || artistResult.rows[0].address,
        weChat || artistResult.rows[0].weChat,
        qq || artistResult.rows[0].qq,
        companyId || artistResult.rows[0].companyId,
        exhibitionsHeld || artistResult.rows[0].exhibitionsHeld,
        bio || artistResult.rows[0].bio,
        signPrice || artistResult.rows[0].signPrice,
        req.params.userid
      ]
    );

    const updatedArtist = await pool.query('SELECT * FROM Artists WHERE userid = $1', [req.params.userid]);
    res.json(updatedArtist.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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

    const bucketManager = new qiniu.rs.BucketManager(mac, config);
    bucketManager.delete(bucket, key, function(err, respBody, respInfo) {
      if (err && respInfo.statusCode !== 612) {
        return res.status(500).json({ message: "Error deleting existing file" });
      }

      const options = { scope: bucket };
      const putPolicy = new qiniu.rs.PutPolicy(options);
      const uploadToken = putPolicy.uploadToken(mac);

      const formUploader = new qiniu.form_up.FormUploader(config);
      const putExtra = new qiniu.form_up.PutExtra();

      formUploader.put(uploadToken, key, file.buffer, putExtra, async (err, body, info) => {
        if (err) {
          return res.status(500).json({ message: "Error uploading file" });
        }
        if (info.statusCode == 200) {
          const publicUrl = `http://sggkpr4pz.hd-bkt.clouddn.com/${key}`;
          await pool.query('UPDATE Artists SET avatar = $1, updatedAt = CURRENT_TIMESTAMP WHERE userid = $2', [publicUrl, req.params.userid]);
          const updatedArtist = await pool.query('SELECT * FROM Artists WHERE userid = $1', [req.params.userid]);

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
          res.status(info.statusCode).json({ message: body.error });
        }
      });
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/company/:userid', async (req, res) => {
  try {
    const companyid = req.params.userid;
    const companyResult = await pool.query('SELECT * FROM companies WHERE userid = $1', [companyid]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const artistsResult = await pool.query(`
      SELECT artists.*, users.name AS artistname, COUNT(artworks.id) AS artworkscount 
      FROM artists 
      JOIN users ON artists.userid = users.id 
      LEFT JOIN artworks ON artworks.artistid = artists.userid 
      WHERE artists.companyid = $1 
      GROUP BY artists.userid, users.name
    `, [companyid]);

    res.json(artistsResult.rows);
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
