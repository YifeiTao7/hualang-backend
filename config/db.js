require('dotenv').config();
const { Pool } = require('pg');

// 从环境变量中获取数据库连接字符串
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  password: String(process.env.DB_PASSWORD) // 明确转换密码为字符串
});

// 示例查询
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Database connected:', res.rows);
  }
});

module.exports = pool;
