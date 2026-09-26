const mongoose = require('mongoose');
const Pipeline = require('../models/Pipeline');
const Source = require('../models/Source');
const Destination = require('../models/Destination');
const PipelineRun = require('../models/PipelineRun');
const {
  createSourceConnector,
  createDestinationConnector
} = require('../connectors/connector.factory');
const { findMaxCursor, isGreaterThanCursor } = require('../utils/cursor.util');
const TransformationService = require('./transformation.service');

// Helper to sanitize error messages to prevent credential leakage
const sanitizeErrorMessage = (message) => {
  if (!message || typeof message !== 'string') {
    return 'An unknown error occurred during pipeline execution';
  }

  let sanitized = message;

  // Redact MongoDB connection URIs (with or without credentials)
  sanitized = sanitized.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, 'mongodb://[REDACTED]');

  // Redact any generic URI credentials: scheme://user:password@host
  sanitized = sanitized.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^:@\s]+):([^@\s]+)@/g, '$1[REDACTED]:[REDACTED]@');

  // Redact Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');

  // Redact Authorization headers or values
  sanitized = sanitized.replace(/(?:authorization|auth)["']?\s*[:=]\s*["']?[^"',;\s]+/gi, 'authorization: [REDACTED]');

  // Redact API keys
  sanitized = sanitized.replace(/(?:api[_-]?key|apikey)["']?\s*[:=]\s*["']?[^"',;\s]+/gi, 'apiKey: [REDACTED]');

  // Redact passwords
  sanitized = sanitized.replace(/(?:password|passwd|pwd)["']?\s*[:=]\s*["']?[^"',;\s]+/gi, 'password: [REDACTED]');

  // Redact secret keys or tokens
  sanitized = sanitized.replace(/(?:secret|token)["']?\s*[:=]\s*["']?[^"',;\s]+/gi, 'token: [REDACTED]');

  return sanitized;
};

class PipelineExecutionService {
  static async executePipeline(pipelineId, userId, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(pipelineId)) {
      const error = new Error('Invalid pipeline ID');
      error.statusCode = 400;
      throw error;
    }

    const triggeredBy = options?.triggeredBy === 'SCHEDULED' ? 'SCHEDULED' : 'MANUAL';
    let lockAcquired = false;

    // 1. Concurrency protection: Atomically acquire execution lock
    const pipeline = await Pipeline.findOneAndUpdate(
      { _id: pipelineId, userId, isRunning: { $ne: true } },
      { $set: { isRunning: true } },
      { returnDocument: 'after' }
    );

    if (!pipeline) {
      const existing = await Pipeline.findOne({ _id: pipelineId, userId });
      if (!existing) {
        const error = new Error('Pipeline not found');
        error.statusCode = 404;
        throw error;
      }
      if (existing.isRunning) {
        const error = new Error('Pipeline is currently running. Concurrent executions are not allowed.');
        error.statusCode = 409;
        throw error;
      }
    }

    lockAcquired = true;
    let destinationConnector = null;
    let pipelineRun = null;
    let cursorValueBefore = null;

    try {
      // 2. Verify pipeline status is ACTIVE
      if (pipeline.status !== 'ACTIVE') {
        const error = new Error('Pipeline is not active. Activate the pipeline to run it.');
        error.statusCode = 400;
        throw error;
      }

      // 3. Load associated Source owned by the same user
      const source = await Source.findOne({ _id: pipeline.sourceId, userId });
      if (!source) {
        const error = new Error('Source not found or does not belong to you');
        error.statusCode = 404;
        throw error;
      }

      // 4. Load associated Destination owned by the same user
      const destination = await Destination.findOne({ _id: pipeline.destinationId, userId });
      if (!destination) {
        const error = new Error('Destination not found or does not belong to you');
        error.statusCode = 404;
        throw error;
      }

      // 5. Determine sync mode and initial cursor state
      const syncMode = pipeline.syncMode || 'FULL';
      const cursorField = pipeline.cursorField || null;
      cursorValueBefore = pipeline.cursorValue !== undefined ? pipeline.cursorValue : null;

      // 6. Create a PipelineRun document with status: 'RUNNING'
      pipelineRun = await PipelineRun.create({
        userId,
        pipelineId: pipeline._id,
        status: 'RUNNING',
        sourceType: source.type,
        destinationType: destination.type,
        triggeredBy,
        syncMode,
        cursorField,
        cursorValueBefore,
        cursorValueAfter: cursorValueBefore,
        recordsExtracted: 0,
        recordsTransformed: 0,
        recordsLoaded: 0,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null
      });

      // 7. Create connectors via connector factory
      const sourceConnector = createSourceConnector(source);
      destinationConnector = createDestinationConnector(destination);

      // 8. Test source connection
      await sourceConnector.testConnection();

      // 9. Test destination connection
      await destinationConnector.testConnection();

      // 10. Extract records from source (passing incremental sync parameters)
      const records = await sourceConnector.extract({
        cursorField,
        cursorValue: cursorValueBefore,
        syncMode
      });
      const recordsExtracted = Array.isArray(records) ? records.length : 0;

      // Calculate candidate cursor from the raw extracted records batch before transformation
      let candidateCursor = cursorValueBefore;
      if (syncMode === 'INCREMENTAL' && cursorField && recordsExtracted > 0) {
        const maxBatchCursor = findMaxCursor(records, cursorField);
        if (maxBatchCursor !== null && isGreaterThanCursor(maxBatchCursor, cursorValueBefore)) {
          candidateCursor = maxBatchCursor;
        }
      }

      // Update recordsExtracted in PipelineRun
      pipelineRun.recordsExtracted = recordsExtracted;

      // 11. Apply Data Transformations (if configured/enabled)
      const transformedRecords = TransformationService.transformRecords(
        records,
        pipeline.transformations,
        { pipelineId: pipeline._id, userId }
      );
      const recordsTransformed = Array.isArray(transformedRecords) ? transformedRecords.length : 0;
      pipelineRun.recordsTransformed = recordsTransformed;
      await pipelineRun.save();

      // 12. Load transformed records into destination
      const loadResult = await destinationConnector.loadBatch(transformedRecords);
      const recordsLoaded =
        typeof loadResult?.insertedCount === 'number'
          ? loadResult.insertedCount
          : recordsTransformed;

      // 13. Safe Checkpoint Commit:
      // ONLY update pipeline cursor AFTER destination successfully confirms loaded records!
      if (syncMode === 'INCREMENTAL') {
        if (recordsExtracted > 0) {
          pipeline.cursorValue = candidateCursor;
        }
        pipeline.lastSyncAt = new Date();
        await pipeline.save();
      } else {
        pipeline.lastSyncAt = new Date();
        await pipeline.save();
      }

      // Update PipelineRun status to SUCCESS
      pipelineRun.recordsLoaded = recordsLoaded;
      pipelineRun.cursorValueAfter = pipeline.cursorValue;
      pipelineRun.status = 'SUCCESS';
      pipelineRun.completedAt = new Date();
      await pipelineRun.save();

      // 14. Return execution summary
      return {
        id: pipelineRun._id.toString(),
        pipelineId: pipeline._id.toString(),
        status: pipelineRun.status,
        triggeredBy: pipelineRun.triggeredBy,
        syncMode,
        sourceType: source.type,
        destinationType: destination.type,
        recordsExtracted: pipelineRun.recordsExtracted,
        recordsTransformed: pipelineRun.recordsTransformed,
        recordsLoaded: pipelineRun.recordsLoaded,
        cursorField: pipelineRun.cursorField,
        cursorValueBefore: pipelineRun.cursorValueBefore,
        cursorValueAfter: pipelineRun.cursorValueAfter,
        startedAt: pipelineRun.startedAt,
        completedAt: pipelineRun.completedAt
      };
    } catch (error) {
      // On failure: previous pipeline checkpoint remains untouched in MongoDB!
      const safeMessage = sanitizeErrorMessage(error.message || 'Pipeline execution failed');
      if (pipelineRun) {
        pipelineRun.status = 'FAILED';
        pipelineRun.errorMessage = safeMessage;
        pipelineRun.cursorValueAfter = cursorValueBefore;
        pipelineRun.completedAt = new Date();
        await pipelineRun.save();
      }

      const runError = new Error(safeMessage);
      runError.statusCode = error.statusCode || 500;
      throw runError;
    } finally {
      // 14. Unconditionally release concurrency lock
      if (lockAcquired) {
        try {
          await Pipeline.updateOne({ _id: pipelineId }, { $set: { isRunning: false } });
        } catch {
          // suppress unlock error in finally
        }
      }

      // 15. Finalize/close destination connector even if execution failed
      if (destinationConnector) {
        await destinationConnector.finalize();
      }
    }
  }

  static sanitizeErrorMessage(message) {
    return sanitizeErrorMessage(message);
  }
}

module.exports = PipelineExecutionService;
