const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Destination name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Destination type is required'],
    enum: ['MONGODB', 'POSTGRESQL', 'MYSQL', 'CSV']
  },
  config: {
    type: Object,
    required: [true, 'Destination config is required']
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

const Destination = mongoose.model('Destination', destinationSchema);

module.exports = Destination;
