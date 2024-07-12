const express = require('express');
const pool = require('../config/db'); // 引入数据库连接池
const router = express.Router();

// 获取所有展会安排
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Exhibitions');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 根据公司ID获取该公司名下的所有展会安排
router.get('/company/:companyuserid', async (req, res) => {
  const { companyuserid } = req.params;

  try {
    const companyResult = await pool.query('SELECT * FROM Companies WHERE userid = $1', [companyuserid]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const exhibitionsResult = await pool.query('SELECT * FROM Exhibitions WHERE companyId = $1', [companyuserid]);
    const exhibitions = exhibitionsResult.rows;

    for (const exhibition of exhibitions) {
      const artistResult = await pool.query('SELECT name FROM Users WHERE id = $1', [exhibition.artistuserid]);
      if (artistResult.rows.length > 0) {
        exhibition.artistName = artistResult.rows[0].name;
        exhibition.content = `画家 ${artistResult.rows[0].name} 已达到办展要求，目前作品数量为 ${exhibition.artworkcount} 件。`;
      }
    }

    console.log('Fetched exhibitions for company:', exhibitions); // 添加这行
    res.json(exhibitions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 创建展会安排
router.post('/', async (req, res) => {
  const { artistuserid, artworkCount, date, companyuserid } = req.body;

  try {
    const artistResult = await pool.query('SELECT * FROM Artists WHERE userid = $1', [artistuserid]);
    if (artistResult.rows.length === 0) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    const artist = artistResult.rows[0];

    const companyResult = await pool.query('SELECT * FROM Companies WHERE userid = $1', [companyuserid]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const newExhibitionResult = await pool.query(
      `INSERT INTO Exhibitions (artistuserid, artistName, artworkCount, date, companyId)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [artistuserid, artist.name, artworkCount, date, companyuserid]
    );

    console.log('Created new exhibition:', newExhibitionResult.rows[0]); // 添加这行
    res.status(201).json(newExhibitionResult.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 删除展会安排
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM Exhibitions WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Exhibition not found' });
    }
    console.log('Deleted exhibition:', result.rows[0]); // 添加这行
    res.json({ message: 'Exhibition deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
