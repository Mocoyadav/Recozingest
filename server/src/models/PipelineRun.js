const mongoose = require('mongoose');

const pipelineRunSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  pipelineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pipeline',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['RUNNING', 'SUCCESS', 'FAILED'],
    required: true
  },
  sourceType: {
    type: String,
    required: true
  },
  destinationType: {
    type: String,
    required: true
  },
  triggeredBy: {
    type: String,
    enum: ['MANUAL', 'SCHEDULED'],
    default: 'MANUAL'
  },
  syncMode: {
    type: String,
    enum: ['FULL', 'INCREMENTAL'],
    default: 'FULL'
  },
  cursorField: {
    type: String,
    default: null
  },
  cursorValueBefore: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  cursorValueAfter: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  recordsExtracted: {
    type: Number,
    default: 0
  },
  recordsTransformed: {
    type: Number,
    default: 0
  },
  recordsLoaded: {
    type: Number,
    default: 0
  },
  errorMessage: {
    type: String,
    default: null
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for optimal history queries and tenant isolation
pipelineRunSchema.index({ userId: 1, createdAt: -1 });
pipelineRunSchema.index({ pipelineId: 1, createdAt: -1 });
pipelineRunSchema.index({ userId: 1, pipelineId: 1, createdAt: -1 });

const PipelineRun = mongoose.model('PipelineRun', pipelineRunSchema);

module.exports = PipelineRun;
