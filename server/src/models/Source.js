const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Source name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Source type is required'],
    enum: ['REST_API', 'POSTGRESQL', 'MYSQL', 'CSV']
  },
  config: {
    type: Object,
    required: [true, 'Source config is required']
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Source = mongoose.model('Source', sourceSchema);

module.exports = Source;
