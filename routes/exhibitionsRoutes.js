const express = require('express');
const mongoose = require('mongoose'); // 确保导入 mongoose
const router = express.Router();
const Exhibition = require('../models/Exhibition');
const Artist = require('../models/Artist');
const Company = require('../models/Company'); // 确保引入 Company 模型

// 获取所有展会安排
router.get('/', async (req, res) => {
  try {
    const exhibitions = await Exhibition.find();
    res.json(exhibitions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 根据公司ID获取该公司名下的所有展会安排
router.get('/company/:companyId', async (req, res) => {
  const { companyId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    const company = await Company.findOne({ userId: companyId });
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const exhibitions = await Exhibition.find({ companyId: company._id });
    res.json(exhibitions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 创建展会安排
router.post('/', async (req, res) => {
  const { artistUserId, artworkCount, date, companyId } = req.body;

  try {
    const artist = await Artist.findOne({ userId: artistUserId });
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const exhibition = new Exhibition({
      artistUserId,
      artistName: artist.name,
      artworkCount,
      date,
      companyId,
    });

    const newExhibition = await exhibition.save();
    res.status(201).json(newExhibition);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 删除展会安排
router.delete('/:id', async (req, res) => {
  try {
    const exhibition = await Exhibition.findByIdAndDelete(req.params.id);
    if (!exhibition) {
      return res.status(404).json({ message: 'Exhibition not found' });
    }
    res.json({ message: 'Exhibition deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
