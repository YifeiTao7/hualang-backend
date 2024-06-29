const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // 发起者
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // 接收者
  type: { type: String, enum: ['invitation', 'message', 'alert', 'exhibition'], required: true }, // 添加 'exhibition'
  status: { type: String, enum: ['pending', 'read', 'accepted', 'declined'], default: 'pending' },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

module.exports = Notification;
