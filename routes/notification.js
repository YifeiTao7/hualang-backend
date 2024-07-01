const express = require('express');
const Notification = require('../models/notification');
const Artist = require('../models/Artist');
const Company = require('../models/Company');
const router = express.Router();

let clients = [];

const eventsHandler = (req, res) => {
  const userId = req.query.userId;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  clients.push({ id: clientId, userId, res });

  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
  });
};

const sendEventsToUser = (receiverId, notification) => {
  clients.forEach(client => {
    if (client.userId === receiverId) {
      console.log(`Sending notification to user ${receiverId}`);
      client.res.write(`data: ${JSON.stringify(notification)}\n\n`);
    }
  });
};

router.get('/events', eventsHandler);

router.post('/', async (req, res) => {
  const { senderId, receiverId, type, content } = req.body;

  console.log("Received notification request with receiverId:", receiverId);

  try {
    const notification = new Notification({
      senderId,
      receiverId,
      type,
      content,
    });
    await notification.save();
    sendEventsToUser(receiverId, notification);
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/user/:userId/unread', async (req, res) => {
  try {
    const notifications = await Notification.find({ receiverId: req.params.userId, status: 'pending' });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/accept', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.type === 'invitation') {
      const artist = await Artist.findOne({ userId: notification.receiverId });
      const company = await Company.findOne({ userId: notification.senderId });

      if (artist && company) {
        artist.company = company.userId;
        await artist.save();

        company.artists.push(artist.userId);
        await company.save();

        await Notification.findByIdAndDelete(req.params.id);

        return res.status(200).json({ message: 'Invitation accepted' });
      } else {
        return res.status(404).json({ message: 'Artist or Company not found' });
      }
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.type === 'invitation') {
      const artist = await Artist.findOne({ userId: notification.receiverId });
      const company = await Company.findOne({ userId: notification.senderId });

      if (artist && company) {
        await Notification.findByIdAndDelete(req.params.id);
        return res.status(200).json({ message: 'Invitation rejected' });
      } else {
        return res.status(404).json({ message: 'Artist or Company not found' });
      }
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
