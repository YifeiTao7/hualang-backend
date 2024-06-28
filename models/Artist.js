const mongoose = require('mongoose');

const artistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
  },
  address: {
    type: String,
  },
  weChat: {
    type: String,
  },
  qq: {
    type: String,
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
  },
  avatar: {
    type: String,
  },
  artworks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artwork'
  }],
  exhibitionsHeld: {
    type: Number,
    default: 100,
  },
  bio: {
    type: String,
    default: "", // 默认为空字符串
  },
  achievements: {
    type: String,
    default: "", // 默认为空字符串
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

const Artist = mongoose.model('Artist', artistSchema);

module.exports = Artist;
