const mongoose = require('mongoose');

const exhibitionSchema = new mongoose.Schema({
  artistUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  artistName: { type: String, required: true }, // 新增字段
  artworkCount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true } // 举办公司的_id
});

module.exports = mongoose.model('Exhibition', exhibitionSchema);
