const express = require('express');
const pool = require('../config/db'); // 引入数据库连接池
const dayjs = require('dayjs'); // 引入 dayjs 库
const router = express.Router();

// 生成时间标签的辅助函数
const generateTimeLabels = (period) => {
  const labels = [];
  const now = dayjs();

  if (period === "week") {
    const daysOfWeek = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    for (let i = 0; i < 7; i++) {
      labels.unshift(daysOfWeek[now.subtract(i, "day").day()]);
    }
  } else if (period === "month") {
    for (let i = 1; i <= now.daysInMonth(); i++) {
      labels.push(`${i}日`);
    }
  } else if (period === "year") {
    const months = [
      "一月",
      "二月",
      "三月",
      "四月",
      "五月",
      "六月",
      "七月",
      "八月",
      "九月",
      "十月",
      "十一月",
      "十二月",
    ];
    for (let i = 0; i < 12; i++) {
      labels.push(months[i]);
    }
  }

  console.log(`Generated time labels for period ${period}:`, labels);
  return labels;
};

const generateDateLabels = (period) => {
  const labels = [];
  const now = dayjs();

  if (period === "week") {
    for (let i = 0; i < 7; i++) {
      labels.unshift(now.subtract(i, "day").format("YYYY-MM-DD"));
    }
  } else if (period === "month") {
    for (let i = 1; i <= now.daysInMonth(); i++) {
      labels.push(now.date(i).format("YYYY-MM-DD"));
    }
  } else if (period === "year") {
    for (let i = 0; i < 12; i++) {
      labels.push(now.month(i).format("YYYY-MM"));
    }
  }

  console.log(`Generated date labels for period ${period}:`, labels);
  return labels;
};

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

// 获取热销题材
router.get('/:userid/hot-themes', async (req, res) => {
  const { period } = req.query;

  let periodCondition;
  switch (period) {
    case 'week':
      periodCondition = "DATE_TRUNC('week', NOW())";
      break;
    case 'month':
      periodCondition = "DATE_TRUNC('month', NOW())";
      break;
    case 'year':
      periodCondition = "DATE_TRUNC('year', NOW())";
      break;
    default:
      return res.status(400).json({ message: 'Invalid period' });
  }

  try {
    const result = await pool.query(
      `SELECT artworks.theme, COUNT(sales.id) AS salesCount
       FROM Sales AS sales
       JOIN Artworks AS artworks ON sales.artworkid = artworks.id
       WHERE sales.saleDate >= ${periodCondition}
       GROUP BY artworks.theme`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching hot themes:', err);
    res.status(500).json({ message: err.message });
  }
});

// 获取销售状况
router.get('/:userid/sales-status', async (req, res) => {
  const { period } = req.query;

  let periodCondition;
  switch (period) {
    case 'week':
      periodCondition = "DATE_TRUNC('week', NOW())";
      break;
    case 'month':
      periodCondition = "DATE_TRUNC('month', NOW())";
      break;
    case 'year':
      periodCondition = "DATE_TRUNC('year', NOW())";
      break;
    default:
      return res.status(400).json({ message: 'Invalid period' });
  }

  try {
    const result = await pool.query(
      `SELECT TO_CHAR(sales.saleDate, 'YYYY-MM-DD') AS label,
              SUM(sales.salePrice) AS totalSales,
              SUM(sales.profit) AS totalProfit
       FROM Sales AS sales
       WHERE sales.saleDate >= ${periodCondition}
       GROUP BY TO_CHAR(sales.saleDate, 'YYYY-MM-DD')
       ORDER BY label`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sales status:', err);
    res.status(500).json({ message: err.message });
  }
});

// 获取热销尺寸
router.get('/:userid/hot-sizes', async (req, res) => {
  const { period } = req.query;

  let periodCondition;
  switch (period) {
    case 'week':
      periodCondition = "DATE_TRUNC('week', NOW())";
      break;
    case 'month':
      periodCondition = "DATE_TRUNC('month', NOW())";
      break;
    case 'year':
      periodCondition = "DATE_TRUNC('year', NOW())";
      break;
    default:
      return res.status(400).json({ message: 'Invalid period' });
  }

  try {
    const result = await pool.query(
      `SELECT artworks.size, COUNT(sales.id) AS salesCount
       FROM Sales AS sales
       JOIN Artworks AS artworks ON sales.artworkid = artworks.id
       WHERE sales.saleDate >= ${periodCondition}
       GROUP BY artworks.size`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching hot sizes:', err);
    res.status(500).json({ message: err.message });
  }
});

// 获取时间标签
router.get('/time/timelabels', (req, res) => {
  const { period } = req.query;

  if (!["week", "month", "year"].includes(period)) {
    return res.status(400).json({ message: 'Invalid period' });
  }

  const timeLabels = generateTimeLabels(period);
  const dateLabels = generateDateLabels(period);

  console.log(`Returning time labels and date labels for period ${period}:`, { timeLabels, dateLabels });

  res.json({ timeLabels, dateLabels });
});

module.exports = router;
