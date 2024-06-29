const express = require('express');
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const mongoose = require('mongoose');
const Artwork = require('../models/Artwork');
const User = require('../models/User');
const Artist = require('../models/Artist');
const Notification = require('../models/Notification');
const Exhibition = require('../models/Exhibition');
const Company = require('../models/Company');

const router = express.Router();

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
const bucket = storage.bucket('yifeitaoblogs');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const getNextSerialNumber = async (artistId) => {
  const artworks = await Artwork.find({ artist: artistId }).sort({ serialNumber: 1 });
  let nextSerialNumber = 1;

  for (const artwork of artworks) {
    if (artwork.serialNumber === nextSerialNumber) {
      nextSerialNumber++;
    } else {
      break;
    }
  }

  return nextSerialNumber;
};

router.post('/artwork', upload.single('file'), async (req, res) => {
  const { title, description, estimatedPrice, size, artistId } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(artistId)) {
      return res.status(400).json({ message: "Invalid artist ID" });
    }

    const artist = await Artist.findOne({ userId: artistId }).populate('company');
    if (!artist) {
      return res.status(404).json({ message: "Artist not found" });
    }

    const serialNumber = await getNextSerialNumber(artist._id);

    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const blob = bucket.file(`artworks/${Date.now()}-${file.originalname}`);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
      },
    });

    blobStream.on('error', (err) => {
      return res.status(500).json({ message: "Error uploading file" });
    });

    blobStream.end(file.buffer);

    blobStream.on('finish', async () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

      const artwork = new Artwork({
        title,
        description,
        estimatedPrice,
        size,
        artist: artist._id,
        artistName: artist.name, // 设置 artistName 字段
        imageUrl: publicUrl,
        serialNumber,
        isSold: false,
        salePrice: -1,
        saleDate: null,
      });

      const savedArtwork = await artwork.save();

      artist.artworks.push(savedArtwork._id);
      await artist.save();

      // 检查艺术家的作品数量是否达到办展数
      if (artist.artworks.length >= artist.exhibitionsHeld) {
        const exhibition = new Exhibition({
          artistUserId: artist.userId,
          artistName: artist.name,
          artworkCount: artist.artworks.length,
          date: new Date(),
          companyId: artist.company._id,
        });
        await exhibition.save();

        const notification = new Notification({
          senderId: artist._id,
          receiverId: artist.company.userId,
          type: 'alert',
          content: `画家 ${artist.name} 已达到办展要求，目前作品数量为 ${artist.artworks.length} 件。`,
        });
        await notification.save();
      }

      res.status(201).json({ message: 'Artwork uploaded successfully', artwork: savedArtwork });
    });
  } catch (error) {
    res.status(500).json({ message: "Error uploading artwork" });
  }
});

module.exports = router;
