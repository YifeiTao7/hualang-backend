const mongoose = require('mongoose');

const artworkSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  creationDate: {
    type: Date,
    default: Date.now,
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  estimatedPrice: {
    type: Number,
    required: true,
  },
  soldPrice: {
    type: Number,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  isSold: {
    type: Boolean,
    default: false,
  },
  salePrice: {
    type: Number,
  },
  saleDate: {  // 新增出售日期字段
    type: Date,
  },
  serialNumber: {
    type: Number, // 新增编号字段
    required: true,
  },
  size: {
    type: String, // 新增尺寸字段
    required: true,
  },
}, {
  timestamps: true
});

const Artwork = mongoose.model('Artwork', artworkSchema);

module.exports = Artwork;
