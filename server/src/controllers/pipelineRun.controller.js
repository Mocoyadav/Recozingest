const mongoose = require('mongoose');
const PipelineRun = require('../models/PipelineRun');

// Helper to format PipelineRun documents for API responses (safe, zero credential exposure)
const formatPipelineRun = (run) => ({
  id: run._id.toString(),
  pipelineId: run.pipelineId?._id ? run.pipelineId._id.toString() : run.pipelineId?.toString(),
  userId: run.userId?._id ? run.userId._id.toString() : run.userId?.toString(),
  status: run.status,
  triggeredBy: run.triggeredBy || 'MANUAL',
  syncMode: run.syncMode || 'FULL',
  sourceType: run.sourceType,
  destinationType: run.destinationType,
  recordsExtracted: run.recordsExtracted,
  recordsTransformed: run.recordsTransformed !== undefined ? run.recordsTransformed : 0,
  recordsLoaded: run.recordsLoaded,
  cursorField: run.cursorField || null,
  cursorValueBefore: run.cursorValueBefore !== undefined ? run.cursorValueBefore : null,
  cursorValueAfter: run.cursorValueAfter !== undefined ? run.cursorValueAfter : null,
  errorMessage: run.errorMessage,
  startedAt: run.startedAt,
  completedAt: run.completedAt,
  createdAt: run.createdAt
});

const getPipelineRuns = async (req, res) => {
  try {
    // Pagination parameters with default page=1, limit=10, max limit=50
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) {
      limit = 10;
    } else if (limit > 50) {
      limit = 50;
    }

    // Tenant isolation: always strictly scoped by req.user.id
    const filter = {
      userId: req.user.id
    };

    // Optional pipelineId filter (via query parameter or route parameter)
    const pipelineId = req.query.pipelineId || req.params.pipelineId || req.params.id;
    if (pipelineId) {
      if (!mongoose.Types.ObjectId.isValid(pipelineId)) {
        return res.status(400).json({ message: 'Invalid pipeline ID' });
      }
      filter.pipelineId = pipelineId;
    }

    const total = await PipelineRun.countDocuments(filter);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const runs = await PipelineRun.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      runs: runs.map(formatPipelineRun),
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Server error fetching pipeline runs'
    });
  }
};

const getPipelineRunById = async (req, res) => {
  try {
    const runId = req.params.runId || req.params.id;

    if (!mongoose.Types.ObjectId.isValid(runId)) {
      return res.status(404).json({ message: 'Pipeline run not found' });
    }

    // Tenant isolation: strictly query by both runId and authenticated userId.
    // Cross-user access or non-existent runs return 404.
    const query = {
      _id: runId,
      userId: req.user.id
    };

    const pipelineId = req.params.pipelineId;
    if (pipelineId) {
      if (!mongoose.Types.ObjectId.isValid(pipelineId)) {
        return res.status(404).json({ message: 'Pipeline run not found' });
      }
      query.pipelineId = pipelineId;
    }

    const run = await PipelineRun.findOne(query);

    if (!run) {
      return res.status(404).json({ message: 'Pipeline run not found' });
    }

    return res.status(200).json({
      run: formatPipelineRun(run)
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Server error fetching pipeline run'
    });
  }
};

module.exports = {
  getPipelineRuns,
  getPipelineRunById,
  formatPipelineRun
};
