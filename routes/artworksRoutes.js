const express = require('express');
const multer = require('multer');
const qiniu = require('qiniu');
const pool = require('../config/db'); // 引入数据库连接池
const path = require('path');
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
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// 根据画名和作者名搜索作品
router.get('/search', async (req, res) => {
  const { query, companyId } = req.query;

  try {
    console.log(`Searching artworks with query: ${query} and companyId: ${companyId}`);
    const companyResult = await pool.query('SELECT * FROM Companies WHERE userid = $1', [companyId]);

    if (companyResult.rows.length === 0) {
      console.log(`Company not found for userid: ${companyId}`);
      return res.status(404).json({ message: 'Company not found' });
    }

    console.log(`Company found: ${companyResult.rows[0].name}`);

    const artistResult = await pool.query('SELECT * FROM Artists WHERE companyId = $1', [companyResult.rows[0].userid]);
    console.log(`Found ${artistResult.rows.length} artists for the company.`);

    const artistIds = artistResult.rows.map(artist => artist.userid);
    console.log(`Artist IDs: ${artistIds}`);

    const artworkResult = await pool.query(
      `SELECT Artworks.*, Users.name AS artistName 
       FROM Artworks 
       JOIN Artists ON Artworks.artistId = Artists.userid 
       JOIN Users ON Artists.userid = Users.id
       WHERE (Artworks.title ILIKE $1 OR Users.name ILIKE $1) 
       AND Artworks.artistId = ANY($2::int[])`,
      [`%${query}%`, artistIds]
    );

    console.log(`Found ${artworkResult.rows.length} artworks matching the query.`);
    res.status(200).json(artworkResult.rows);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 获取指定艺术家的所有作品
router.get('/artist/:artistId', async (req, res) => {
  const artistId = req.params.artistId;
  try {
    const result = await pool.query('SELECT * FROM Artworks WHERE artistId = $1', [artistId]);
    console.log("Database Query Result:", result.rows); // 确认输出
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch artworks:", err);
    res.status(500).json({ message: err.message });
  }
});

// 通过作品的 _id 获取作品信息
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching artwork with id: ${id}`);

    const artworkResult = await pool.query('SELECT * FROM Artworks WHERE id = $1', [id]);

    if (artworkResult.rows.length === 0) {
      console.log(`Artwork not found with id: ${id}`);
      return res.status(404).json({ message: 'Artwork not found' });
    }

    res.status(200).json(artworkResult.rows[0]);
  } catch (error) {
    console.error('Failed to fetch artwork:', error);
    res.status(500).json({ message: 'Failed to fetch artwork', error });
  }
});

// 删除作品
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Deleting artwork with id: ${id}`);

    const artworkResult = await pool.query('DELETE FROM Artworks WHERE id = $1 RETURNING *', [id]);

    if (artworkResult.rows.length === 0) {
      console.log(`Artwork not found with id: ${id}`);
      return res.status(404).json({ message: 'Artwork not found' });
    }

    // 删除七牛云上的图片
    const filePath = artworkResult.rows[0].imageurl;
    const fileName = filePath.split('/').pop();
    const bucketManager = new qiniu.rs.BucketManager(mac, config);

    bucketManager.delete(bucket, `artworks/${fileName}`, function(err, respBody, respInfo) {
      if (err) {
        console.error('Failed to delete file from Qiniu:', err);
        return res.status(500).json({ message: 'Failed to delete artwork or associated image', error: err });
      } else {
        console.log('File deleted from Qiniu successfully:', respBody);
        res.status(200).json({ message: 'Artwork and associated image deleted successfully' });
      }
    });
  } catch (error) {
    console.error('Failed to delete artwork or associated image:', error);
    res.status(500).json({ message: 'Failed to delete artwork or associated image', error });
  }
});

// 更新作品的售出状态和价格
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isSold, salePrice } = req.body;
    console.log(`Updating artwork with id: ${id}, isSold: ${isSold}, salePrice: ${salePrice}`);

    const artworkResult = await pool.query('SELECT * FROM Artworks WHERE id = $1', [id]);

    if (artworkResult.rows.length === 0) {
      console.log(`Artwork not found with id: ${id}`);
      return res.status(404).json({ message: 'Artwork not found' });
    }

    await pool.query(
      `UPDATE Artworks SET isSold = $1, salePrice = $2, saleDate = $3, updatedAt = CURRENT_TIMESTAMP WHERE id = $4`,
      [isSold, salePrice, isSold ? new Date() : null, id]
    );

    const updatedArtwork = await pool.query('SELECT * FROM Artworks WHERE id = $1', [id]);
    res.status(200).json({ message: 'Artwork updated successfully', artwork: updatedArtwork.rows[0] });
  } catch (error) {
    console.error('Failed to update artwork:', error);
    res.status(500).json({ message: 'Failed to update artwork', error });
  }
});

module.exports = router;
