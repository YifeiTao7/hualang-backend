const express = require('express');
const pool = require('../config/db'); // 引入数据库连接池
const router = express.Router();

// 获取公司信息
router.get('/:userid', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Companies WHERE userid = $1', [req.params.userid]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 解约画家
router.delete('/unbind-artist/:companyuserid/:artistuserid', async (req, res) => {
  try {
    const { companyuserid, artistuserid } = req.params;
    
    console.log(`Unbinding artist ${artistuserid} from company ${companyuserid}`);

    const artistResult = await pool.query('SELECT * FROM Artists WHERE userid = $1', [artistuserid]);
    if (artistResult.rows.length === 0) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    const artist = artistResult.rows[0];

    const companyResult = await pool.query('SELECT * FROM Companies WHERE userid = $1', [companyuserid]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }
    const company = companyResult.rows[0];

    console.log(`Artist companyId: ${artist.companyid}, Company userId: ${company.userid}`);

    // 确保画家属于该公司
    if (artist.companyid !== company.userid) {
      return res.status(400).json({ message: 'Artist does not belong to this company' });
    }

    // 将 artist 的 companyid 字段置为空
    await pool.query('UPDATE Artists SET companyid = NULL WHERE userid = $1', [artistuserid]);

    res.json({ message: 'Artist unbound successfully' });
  } catch (err) {
    console.error('Error:', err); // 日志记录
    res.status(500).json({ message: err.message });
  }
});

// 订阅会员
router.post('/membership/:userid/subscribe', async (req, res) => {
  const { userid } = req.params;
  const { type } = req.body;

  let membershipEndDate;
  const currentDate = new Date();

  if (type === 'trial') {
    membershipEndDate = new Date(currentDate.setDate(currentDate.getDate() + 7));
  } else if (type === 'monthly') {
    membershipEndDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1));
  } else if (type === 'yearly') {
    membershipEndDate = new Date(currentDate.setFullYear(currentDate.getFullYear() + 1));
  }

  try {
    const result = await pool.query(
      `UPDATE Companies 
       SET membership = $1, membershipStartDate = $2, membershipEndDate = $3 
       WHERE userid = $4 
       RETURNING membership, membershipStartDate, membershipEndDate`,
      [type, new Date(), membershipEndDate, userid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update membership:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
