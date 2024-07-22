const express = require('express');
const pool = require('../config/db'); // 引入数据库连接池
const dayjs = require('dayjs'); // 引入 dayjs 库
const router = express.Router();

// 生成时间标签的辅助函数
const generateTimeLabels = () => {
  const labels = { week: [], month: [], year: [] };
  const now = dayjs();

  const daysOfWeek = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  for (let i = 0; i < 7; i++) {
    labels.week.unshift(daysOfWeek[now.subtract(i, "day").day()]);
  }

  for (let i = 1; i <= now.daysInMonth(); i++) {
    labels.month.push(`${i}日`);
  }

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
    labels.year.push(months[i]);
  }

  return labels;
};

const generateDateLabels = () => {
  const labels = { week: [], month: [], year: [] };
  const now = dayjs();

  for (let i = 0; i < 7; i++) {
    labels.week.unshift(now.subtract(i, "day").format("YYYY-MM-DD"));
  }

  for (let i = 1; i <= now.daysInMonth(); i++) {
    labels.month.push(now.date(i).format("YYYY-MM-DD"));
  }

  for (let i = 0; i < 12; i++) {
    labels.year.push(now.month(i).format("YYYY-MM"));
  }

  return labels;
};

// 按月份汇总年数据的辅助函数
const aggregateYearlyData = (sales) => {
  const monthlySales = {};

  sales.forEach((sale) => {
    const month = sale.label.substring(0, 7); // 获取月份部分，例如 '2024-07'
    if (!monthlySales[month]) {
      monthlySales[month] = { totalsales: 0, totalprofit: 0 };
    }
    monthlySales[month].totalsales += parseFloat(sale.totalsales);
    monthlySales[month].totalprofit += parseFloat(sale.totalprofit);
  });

  return Object.entries(monthlySales).map(([label, { totalsales, totalprofit }]) => ({
    label,
    totalsales: totalsales.toFixed(2),
    totalprofit: totalprofit.toFixed(2),
  }));
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

// 获取所有数据的接口
router.get('/alldata/:userid', async (req, res) => {
  const { userid } = req.params;

  try {
    const companyResult = await pool.query('SELECT * FROM Companies WHERE userid = $1', [userid]);
    const artistsResult = await pool.query('SELECT * FROM Artists WHERE companyId = $1', [userid]);
    const exhibitionsResult = await pool.query('SELECT * FROM Exhibitions WHERE companyId = $1', [userid]);

    const getHotThemes = async (periodCondition) => {
      return pool.query(
        `SELECT artworks.theme, COUNT(sales.id) AS salesCount
         FROM Sales AS sales
         JOIN Artworks AS artworks ON sales.artworkid = artworks.id
         WHERE sales.saleDate >= ${periodCondition}
         AND artworks.artistId IN (SELECT userid FROM Artists WHERE companyId = $1)
         GROUP BY artworks.theme`,
        [userid]
      );
    };

    const getSales = async (periodCondition) => {
      return pool.query(
        `SELECT TO_CHAR(sales.saleDate, 'YYYY-MM-DD') AS label,
                SUM(sales.salePrice) AS totalSales,
                SUM(sales.profit) AS totalProfit
         FROM Sales AS sales
         WHERE sales.saleDate >= ${periodCondition}
         AND sales.companyId = $1
         GROUP BY TO_CHAR(sales.saleDate, 'YYYY-MM-DD')
         ORDER BY label`,
        [userid]
      );
    };

    const getHotSizes = async (periodCondition) => {
      return pool.query(
        `SELECT artworks.size, COUNT(sales.id) AS salesCount
         FROM Sales AS sales
         JOIN Artworks AS artworks ON sales.artworkid = artworks.id
         WHERE sales.saleDate >= ${periodCondition}
         AND artworks.artistId IN (SELECT userid FROM Artists WHERE companyId = $1)
         GROUP BY artworks.size`,
        [userid]
      );
    };

    const weekCondition = "NOW() - INTERVAL '7 days'";
    const monthCondition = "NOW() - INTERVAL '1 month'";
    const yearCondition = "NOW() - INTERVAL '1 year'";

    const [weekHotThemes, monthHotThemes, yearHotThemes] = await Promise.all([
      getHotThemes(weekCondition),
      getHotThemes(monthCondition),
      getHotThemes(yearCondition),
    ]);

    const [weekSales, monthSales, yearSales] = await Promise.all([
      getSales(weekCondition),
      getSales(monthCondition),
      getSales(yearCondition),
    ]);

    const [weekHotSizes, monthHotSizes, yearHotSizes] = await Promise.all([
      getHotSizes(weekCondition),
      getHotSizes(monthCondition),
      getHotSizes(yearCondition),
    ]);

    const timeLabels = generateTimeLabels();
    const dateLabels = generateDateLabels();

    const aggregatedYearSales = aggregateYearlyData(yearSales.rows);

    res.json({
      company: companyResult.rows[0],
      artists: artistsResult.rows,
      exhibitions: exhibitionsResult.rows,
      weekHotThemes: weekHotThemes.rows,
      monthHotThemes: monthHotThemes.rows,
      yearHotThemes: yearHotThemes.rows,
      weekSales: weekSales.rows,
      monthSales: monthSales.rows,
      yearSales: aggregatedYearSales,
      weekHotSizes: weekHotSizes.rows,
      monthHotSizes: monthHotSizes.rows,
      yearHotSizes: yearHotSizes.rows,
      timeLabels,
      dateLabels,
    });
  } catch (err) {
    console.error('Error fetching all data:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
