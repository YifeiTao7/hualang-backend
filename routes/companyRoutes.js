const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const Artist = require('../models/Artist');

// 获取公司信息
router.get('/:userId', async (req, res) => {
  try {
    const company = await Company.findOne({ userId: req.params.userId });
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    res.json(company);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 解约画家
router.delete('/unbind-artist/:companyUserId/:artistUserId', async (req, res) => {
  try {
    const { companyUserId, artistUserId } = req.params;
    const artist = await Artist.findOne({ userId: artistUserId });

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const company = await Company.findOne({ userId: companyUserId });

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // 确保画家属于该公司
    if (artist.company.toString() !== company._id.toString()) {
      return res.status(400).json({ message: 'Artist does not belong to this company' });
    }

    // 从公司的 artists 数组中移除指定的画家userId
    console.log('Before update:', company.artists); // 日志记录
    company.artists = company.artists.filter(userId => userId.toString() !== artist.userId.toString());
    console.log('After update:', company.artists); // 日志记录

    // 将 artist 的 company 字段置为空
    artist.company = null;

    await company.save();
    await artist.save();

    res.json({ message: 'Artist unbound successfully' });
  } catch (err) {
    console.error('Error:', err); // 日志记录
    res.status(500).json({ message: err.message });
  }
});

// 订阅会员
router.post('/membership/:userId/subscribe', async (req, res) => {
  const { userId } = req.params;
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
    const company = await Company.findOneAndUpdate(
      { userId },
      { 
        membership: type, 
        membershipStartDate: new Date(),
        membershipEndDate: membershipEndDate 
      },
      { new: true }
    );
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json({ membership: company.membership, membershipStartDate: company.membershipStartDate, membershipEndDate: company.membershipEndDate });
  } catch (error) {
    console.error('Failed to update membership:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
