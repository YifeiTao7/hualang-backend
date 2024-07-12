const express = require('express');
const pool = require('../config/db'); // 引入数据库连接池
const router = express.Router();

let clients = [];

// 事件处理器
const eventsHandler = (req, res) => {
  const userid = req.query.userid; // 修改为userid
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  clients.push({ id: clientId, userid, res });

  const sendHeartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000); // 每20秒发送一次心跳包

  req.on('close', () => {
    clearInterval(sendHeartbeat);
    clients = clients.filter(client => client.id !== clientId);
  });
};

const sendEventsToUser = (receiverid, notification) => {
  clients.forEach(client => {
    if (client.userid === receiverid) {
      console.log(`Sending notification to user ${receiverid}`);
      client.res.write(`data: ${JSON.stringify(notification)}\n\n`);
    }
  });
};

router.get('/events', eventsHandler);

// 发送通知
router.post('/', async (req, res) => {
  const { senderid, receiverid, type, content } = req.body;
  console.log("Received data:", { senderid, receiverid, type, content });  // 打印接收到的数据

  if (!senderid || !receiverid) {
    return res.status(400).json({ message: "Sender ID and Receiver ID are required" });
  }

  try {
    // 插入通知
    const notificationResult = await pool.query(
      'INSERT INTO Notifications (senderid, receiverid, type, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [senderid, receiverid, type, content]
    );

    const notification = notificationResult.rows[0];
    sendEventsToUser(receiverid, notification);
    res.status(201).json(notification);
  } catch (err) {
    console.error("Failed to insert notification:", err);
    res.status(500).json({ message: err.message });
  }
});

// 获取用户未读通知
router.get('/user/:userid/unread', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Notifications WHERE receiverid = $1 AND status = $2', [req.params.userid, 'pending']);
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to get unread notifications:", err);
    res.status(500).json({ message: err.message });
  }
});

// 接受通知
router.post('/:id/accept', async (req, res) => {
  try {
    console.log(`Accepting notification with ID: ${req.params.id}`);
    const notificationResult = await pool.query('SELECT * FROM Notifications WHERE id = $1', [req.params.id]);
    if (notificationResult.rows.length === 0) {
      console.log('Notification not found');
      return res.status(404).json({ message: 'Notification not found' });
    }
    const notification = notificationResult.rows[0];
    console.log('Notification found:', notification);

    if (notification.type === 'invitation') {
      const artistResult = await pool.query('SELECT * FROM Artists WHERE userid = $1', [notification.receiverid]);
      const companyResult = await pool.query('SELECT * FROM Companies WHERE userid = $1', [notification.senderid]);

      if (artistResult.rows.length > 0 && companyResult.rows.length > 0) {
        console.log('Artist and Company found');
        const artist = artistResult.rows[0];
        const company = companyResult.rows[0];

        await pool.query('UPDATE Artists SET companyid = $1 WHERE userid = $2', [company.userid, artist.userid]);
        await pool.query('DELETE FROM Notifications WHERE id = $1', [req.params.id]);

        return res.status(200).json({ message: 'Invitation accepted' });
      } else {
        console.log('Artist or Company not found');
        return res.status(404).json({ message: 'Artist or Company not found' });
      }
    } else {
      return res.status(400).json({ message: 'Invalid notification type' });
    }
  } catch (err) {
    console.error('Error accepting invitation:', err);
    res.status(500).json({ message: err.message });
  }
});

// 拒绝通知
router.post('/:id/reject', async (req, res) => {
  try {
    const notificationResult = await pool.query('SELECT * FROM Notifications WHERE id = $1', [req.params.id]);
    if (notificationResult.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    const notification = notificationResult.rows[0];

    if (notification.type === 'invitation') {
      const artistResult = await pool.query('SELECT * FROM Artists WHERE userid = $1', [notification.receiverid]);
      const companyResult = await pool.query('SELECT * FROM Companies WHERE userid = $1', [notification.senderid]);

      if (artistResult.rows.length > 0 && companyResult.rows.length > 0) {
        await pool.query('DELETE FROM Notifications WHERE id = $1', [req.params.id]);
        return res.status(200).json({ message: 'Invitation rejected' });
      } else {
        return res.status(404).json({ message: 'Artist or Company not found' });
      }
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 删除通知
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM Notifications WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
