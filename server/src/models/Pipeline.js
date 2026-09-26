const mongoose = require('mongoose');

const pipelineSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Pipeline name is required'],
    trim: true
  },
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Source',
    required: [true, 'Source ID is required']
  },
  destinationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Destination',
    required: [true, 'Destination ID is required']
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  },
  syncMode: {
    type: String,
    enum: ['FULL', 'INCREMENTAL'],
    default: 'FULL'
  },
  cursorField: {
    type: String,
    default: null,
    trim: true
  },
  cursorValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  lastSyncAt: {
    type: Date,
    default: null
  },
  isRunning: {
    type: Boolean,
    default: false,
    index: true
  },
  schedule: {
    enabled: {
      type: Boolean,
      default: false,
      index: true
    },
    type: {
      type: String,
      enum: ['INTERVAL', 'CRON'],
      default: 'INTERVAL'
    },
    expression: {
      type: String,
      default: '1h',
      trim: true
    },
    nextRunAt: {
      type: Date,
      default: null,
      index: true
    },
    lastScheduledRunAt: {
      type: Date,
      default: null
    }
  },
  transformations: {
    enabled: {
      type: Boolean,
      default: false
    },
    includeUnmapped: {
      type: Boolean,
      default: true
    },
    addMetadata: {
      type: Boolean,
      default: false
    },
    fieldMappings: [
      {
        sourceField: {
          type: String,
          required: true,
          trim: true
        },
        destinationField: {
          type: String,
          required: true,
          trim: true
        },
        dataType: {
          type: String,
          enum: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'JSON'],
          default: null
        },
        defaultValue: {
          type: mongoose.Schema.Types.Mixed,
          default: null
        },
        transformRule: {
          type: String,
          enum: ['NONE', 'UPPERCASE', 'LOWERCASE', 'TRIM', 'MASK_REDACT', 'MASK_HASH'],
          default: 'NONE'
        }
      }
    ]
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

// Index to optimize scheduler queries for due pipelines
pipelineSchema.index({ status: 1, 'schedule.enabled': 1, 'schedule.nextRunAt': 1, isRunning: 1 });

const Pipeline = mongoose.model('Pipeline', pipelineSchema);

module.exports = Pipeline;
