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
  artistName: {
    type: String,
    required: true,
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
  saleDate: {
    type: Date,
  },
  serialNumber: {
    type: Number,
    required: true,
  },
  size: {
    type: String,
    required: true,
  },
}, {
  timestamps: true
});

const Artwork = mongoose.model('Artwork', artworkSchema);

module.exports = Artwork;
