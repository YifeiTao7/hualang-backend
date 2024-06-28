const express = require('express');
const Artwork = require('../models/Artwork');
const Artist = require('../models/Artist');
const router = express.Router();

// 获取指定艺术家的作品
router.get('/artist/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 查找对应的 artist
    const artist = await Artist.findOne({ userId: userId });
    
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    // 使用 artist 的 artworks 数组中的 _id 来查找作品
    const artworks = await Artwork.find({ _id: { $in: artist.artworks } });
    res.status(200).json(artworks);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


// 通过作品的 _id 获取作品信息
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const artwork = await Artwork.findById(id);
    if (!artwork) {
      return res.status(404).json({ message: 'Artwork not found' });
    }
    res.status(200).json(artwork);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch artwork', error });
  }
});

// 删除作品
router.delete('/:id', async (req, res) => {
  try {
    const artwork = await Artwork.findByIdAndDelete(req.params.id);
    if (!artwork) {
      return res.status(404).json({ message: 'Artwork not found' });
    }

    // 更新艺术家的作品列表
    const artist = await Artist.findOne({ userId: artwork.artist });
    if (artist) {
      artist.artworks = artist.artworks.filter(artworkId => !artworkId.equals(req.params.id));
      await artist.save();
    }

    res.status(200).json({ message: 'Artwork deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete artwork', error });
  }
});

// 更新作品的售出状态和价格
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isSold, salePrice } = req.body;

    const artwork = await Artwork.findById(id);
    if (!artwork) {
      return res.status(404).json({ message: 'Artwork not found' });
    }

    artwork.isSold = isSold;
    artwork.salePrice = salePrice;
    artwork.saleDate = isSold ? new Date() : null; // 更新售出日期

    await artwork.save();
    res.status(200).json({ message: 'Artwork updated successfully', artwork });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update artwork', error });
  }
});


module.exports = router;
