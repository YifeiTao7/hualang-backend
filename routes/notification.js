const express = require('express');
const Notification = require('../models/Notification');
const Artist = require('../models/Artist');
const Company = require('../models/Company');
const router = express.Router();
const mongoose = require('mongoose');

// 创建通知（包括邀请）
router.post('/', async (req, res) => {
  const { senderId, receiverId, type, content } = req.body;

  try {
    const notification = new Notification({
      senderId,
      receiverId,
      type,
      content,
    });
    await notification.save();
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 获取用户的未读通知
router.get('/user/:userId/unread', async (req, res) => {
  try {
    const notifications = await Notification.find({ receiverId: req.params.userId, status: 'pending' });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 更新通知状态
router.put('/:id', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.status = req.body.status;
    await notification.save();

    if (req.body.status === 'accepted' && notification.type === 'invitation') {
      const artist = await Artist.findOne({ userId: notification.receiverId });
      const company = await Company.findOne({ userId: notification.senderId });

      if (artist && company) {
        console.log(`Updating artist ${artist.name} with company ${company.name}`);
        artist.company = company._id; // 更新画家的公司字段
        await artist.save();
        console.log(`Artist ${artist.name} company updated to ${artist.company}`);

        console.log(`Adding artist ${artist.name} to company ${company.name}`);
        company.artists.push(artist.userId); // 将画家ID添加到公司的画家库中
        await company.save();
        console.log(`Artist ${artist.name} added to company ${company.name}`);

        // 向公司发送一条新通知
        const companyNotification = new Notification({
          senderId: artist.userId,
          receiverId: company.userId,
          type: 'alert',
          content: `${artist.name} 已接受您的邀请。`,
        });
        await companyNotification.save();
        console.log('Company notification created:', companyNotification);

        // 删除原始通知
        await Notification.findByIdAndDelete(req.params.id);
        console.log('Invitation notification deleted');

        // 返回新通知
        return res.json(companyNotification);
      } else {
        console.log('Artist or Company not found:', { artist, company });
        return res.status(404).json({ message: 'Artist or Company not found' });
      }
    } else if (req.body.status === 'rejected' && notification.type === 'invitation') {
      // 向公司发送一条拒绝通知
      const artist = await Artist.findOne({ userId: notification.receiverId });
      const company = await Company.findOne({ userId: notification.senderId });

      if (artist && company) {
        const companyNotification = new Notification({
          senderId: artist.userId,
          receiverId: company.userId,
          type: 'alert',
          content: `${artist.name} 已拒绝您的邀请。`,
        });
        await companyNotification.save();
        console.log('Company rejection notification created:', companyNotification);

        // 删除原始通知
        await Notification.findByIdAndDelete(req.params.id);
        console.log('Invitation notification deleted');

        // 返回新通知
        return res.json(companyNotification);
      } else {
        console.log('Artist or Company not found:', { artist, company });
        return res.status(404).json({ message: 'Artist or Company not found' });
      }
    }

    // 返回更新后的通知
    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 删除通知
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status (500).json({ message: err.message });
  }
});

module.exports = router;
