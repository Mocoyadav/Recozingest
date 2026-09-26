const Pipeline = require('../models/Pipeline');
const PipelineExecutionService = require('./pipelineExecution.service');
const { calculateNextRun } = require('../utils/cron.util');

class SchedulerService {
  constructor() {
    this.timer = null;
    this.isPolling = false;
    this.pollIntervalMs = 10000; // default 10 seconds
  }

  start(pollIntervalMs = 10000) {
    if (this.timer) {
      return;
    }
    this.pollIntervalMs = pollIntervalMs;
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        // Safe logging of any unexpected scheduler polling errors
        console.error('Scheduler tick error:', PipelineExecutionService.sanitizeErrorMessage(err.message));
      });
    }, this.pollIntervalMs);
    // Unref timer so it doesn't keep node event loop open if all else finishes
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Process all currently due pipelines.
   * Can be called directly by tests to deterministically verify scheduled executions.
   */
  async tick() {
    if (this.isPolling) {
      return 0; // Avoid overlapping ticks
    }

    this.isPolling = true;
    let processedCount = 0;

    try {
      const now = new Date();

      // Query active pipelines with enabled schedules that are due to run and not currently executing
      const duePipelines = await Pipeline.find({
        status: 'ACTIVE',
        'schedule.enabled': true,
        'schedule.nextRunAt': { $lte: now },
        isRunning: { $ne: true }
      });

      for (const pipeline of duePipelines) {
        await this.processScheduledPipeline(pipeline);
        processedCount++;
      }
    } finally {
      this.isPolling = false;
    }

    return processedCount;
  }

  async processScheduledPipeline(pipeline) {
    try {
      // Execute pipeline with triggeredBy: 'SCHEDULED'
      await PipelineExecutionService.executePipeline(pipeline._id, pipeline.userId, {
        triggeredBy: 'SCHEDULED'
      });
    } catch (err) {
      // Safe error logging - do not crash the scheduler or server
      const safeErr = PipelineExecutionService.sanitizeErrorMessage(err.message || 'Scheduled execution failed');
      console.warn(`[Scheduler] Pipeline ${pipeline._id} scheduled run failed: ${safeErr}`);
    } finally {
      // Always compute and advance nextRunAt so the pipeline does not get stuck in an endless loop
      try {
        const nextRun = calculateNextRun(
          pipeline.schedule.type || 'INTERVAL',
          pipeline.schedule.expression || '1h'
        );

        await Pipeline.updateOne(
          { _id: pipeline._id },
          {
            $set: {
              'schedule.lastScheduledRunAt': new Date(),
              'schedule.nextRunAt': nextRun
            }
          }
        );
      } catch (scheduleErr) {
        console.error(
          `[Scheduler] Failed to calculate nextRunAt for pipeline ${pipeline._id}:`,
          PipelineExecutionService.sanitizeErrorMessage(scheduleErr.message)
        );
      }
    }
  }
}

module.exports = new SchedulerService();
