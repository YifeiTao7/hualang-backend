const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  userid: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  name: {
    type: String,
    required: true,
  },
  address: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
  },
  artists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist'
  }],
  membership: {
    type: String,
    enum: ['trial', 'monthly', 'yearly'],
    default: 'trial'
  },
  membershipStartDate: {
    type: Date,
    default: Date.now
  },
  membershipEndDate: {
    type: Date
  }
}, {
  timestamps: true
});

const Company = mongoose.model('Company', companySchema);

module.exports = Company;
