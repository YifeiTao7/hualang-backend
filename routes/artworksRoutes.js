const express = require('express');
const Artwork = require('../models/Artwork');
const Artist = require('../models/Artist');
const Company = require('../models/Company'); // 确保你引入了 Company 模型
const { Storage } = require('@google-cloud/storage'); // 引入 Google Cloud Storage
const router = express.Router();
const mongoose = require('mongoose');

// Google Cloud Storage 配置
const credentials = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
};

const storage = new Storage({ credentials });
const bucketName = 'yifeitaoblogs';

// 根据画名和作者名搜索作品
router.get('/search', async (req, res) => {
  const { query, companyId } = req.query;

  try {
    console.log(`Searching artworks with query: ${query} and companyId: ${companyId}`);
    const company = await Company.findOne({ userId: companyId });

    if (!company) {
      console.log(`Company not found for userId: ${companyId}`);
      return res.status(404).json({ message: 'Company not found' });
    }

    console.log(`Company found: ${company.name}`);

    // 获取公司的所有艺术家
    const artists = await Artist.find({ userId: { $in: company.artists } });
    console.log(`Found ${artists.length} artists for the company.`);

    const artistIds = artists.map(artist => artist._id);
    console.log(`Artist IDs: ${artistIds}`);

    const artworks = await Artwork.find({
      $or: [
        { title: new RegExp(query, 'i') },
        { artistName: new RegExp(query, 'i') }
      ],
      artist: { $in: artistIds }
    });

    console.log(`Found ${artworks.length} artworks matching the query.`);

    res.status(200).json(artworks);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/artist/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`Fetching artworks for artist with userId: ${userId}`);
    
    // 查找对应的 artist
    const artist = await Artist.findOne({ userId });
    
    if (!artist) {
      console.log(`Artist not found for userId: ${userId}`);
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    // 使用 artist 的 artworks 数组中的 _id 来查找作品
    const artworks = await Artwork.find({ _id: { $in: artist.artworks } });
    res.status(200).json(artworks);
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 通过作品的 _id 获取作品信息
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching artwork with id: ${id}`);
    const artwork = await Artwork.findById(id);
    if (!artwork) {
      console.log(`Artwork not found with id: ${id}`);
      return res.status(404).json({ message: 'Artwork not found' });
    }
    res.status(200).json(artwork);
  } catch (error) {
    console.error('Failed to fetch artwork:', error);
    res.status(500).json({ message: 'Failed to fetch artwork', error });
  }
});

// 删除作品
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Deleting artwork with id: ${id}`);
    const artwork = await Artwork.findByIdAndDelete(id);
    if (!artwork) {
      console.log(`Artwork not found with id: ${id}`);
      return res.status(404).json({ message: 'Artwork not found' });
    }

    // 删除 Google Cloud Storage 上的图片
    const fileName = artwork.imageUrl.split('/').pop();
    const filePath = `artworks/${fileName}`;
    try {
      await storage.bucket(bucketName).file(filePath).delete();
      console.log(`Deleted file from Google Cloud Storage: ${filePath}`);
    } catch (err) {
      console.error(`Failed to delete file from Google Cloud Storage: ${filePath}`, err);
      if (err.code !== 404) {
        return res.status(500).json({ message: 'Failed to delete artwork or associated image', error: err });
      }
    }

    // 更新艺术家的作品列表
    const artist = await Artist.findById(artwork.artist);
    if (artist) {
      console.log(`Updating artist's artworks before: ${artist.artworks}`);
      artist.artworks = artist.artworks.filter(artworkId => !artworkId.equals(mongoose.Types.ObjectId(id)));
      await artist.save();
      console.log(`Updating artist's artworks after: ${artist.artworks}`);
    } else {
      console.log(`Artist not found with id: ${artwork.artist}`);
    }

    res.status(200).json({ message: 'Artwork and associated image deleted successfully' });
  } catch (error) {
    console.error('Failed to delete artwork or associated image:', error);
    res.status(500).json({ message: 'Failed to delete artwork or associated image', error });
  }
});

// 更新作品的售出状态和价格
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isSold, salePrice } = req.body;
    console.log(`Updating artwork with id: ${id}, isSold: ${isSold}, salePrice: ${salePrice}`);

    const artwork = await Artwork.findById(id);
    if (!artwork) {
      console.log(`Artwork not found with id: ${id}`);
      return res.status(404).json({ message: 'Artwork not found' });
    }

    artwork.isSold = isSold;
    artwork.salePrice = salePrice;
    artwork.saleDate = isSold ? new Date() : null; // 更新售出日期

    await artwork.save();
    res.status(200).json({ message: 'Artwork updated successfully', artwork });
  } catch (error) {
    console.error('Failed to update artwork:', error);
    res.status(500).json({ message: 'Failed to update artwork', error });
  }
});

module.exports = router;
