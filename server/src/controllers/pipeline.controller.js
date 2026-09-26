const mongoose = require('mongoose');
const Pipeline = require('../models/Pipeline');
const Source = require('../models/Source');
const Destination = require('../models/Destination');
const { calculateNextRun, validateScheduleExpression } = require('../utils/cron.util');
const TransformationService = require('../services/transformation.service');
const { createSourceConnector } = require('../connectors/connector.factory');

// Helper to format pipeline response without any sensitive data
const formatPipeline = (pipeline) => {
  const formatted = {
    id: pipeline._id.toString(),
    name: pipeline.name,
    sourceId: pipeline.sourceId?._id
      ? pipeline.sourceId._id.toString()
      : pipeline.sourceId?.toString(),
    destinationId: pipeline.destinationId?._id
      ? pipeline.destinationId._id.toString()
      : pipeline.destinationId?.toString(),
    status: pipeline.status,
    syncMode: pipeline.syncMode || 'FULL',
    cursorField: pipeline.cursorField || null,
    cursorValue: pipeline.cursorValue !== undefined ? pipeline.cursorValue : null,
    lastSyncAt: pipeline.lastSyncAt || null,
    isRunning: Boolean(pipeline.isRunning),
    schedule: {
      enabled: Boolean(pipeline.schedule?.enabled),
      type: pipeline.schedule?.type || 'INTERVAL',
      expression: pipeline.schedule?.expression || '1h',
      nextRunAt: pipeline.schedule?.nextRunAt || null,
      lastScheduledRunAt: pipeline.schedule?.lastScheduledRunAt || null
    },
    transformations: {
      enabled: Boolean(pipeline.transformations?.enabled),
      includeUnmapped: pipeline.transformations?.includeUnmapped !== false,
      addMetadata: Boolean(pipeline.transformations?.addMetadata),
      fieldMappings: Array.isArray(pipeline.transformations?.fieldMappings)
        ? pipeline.transformations.fieldMappings.map((m) => ({
            sourceField: m.sourceField,
            destinationField: m.destinationField,
            dataType: m.dataType || null,
            defaultValue: m.defaultValue !== undefined ? m.defaultValue : null,
            transformRule: m.transformRule || 'NONE'
          }))
        : []
    },
    createdAt: pipeline.createdAt,
    updatedAt: pipeline.updatedAt
  };

  if (pipeline.sourceId && pipeline.sourceId.name) {
    formatted.source = {
      id: pipeline.sourceId._id.toString(),
      name: pipeline.sourceId.name,
      type: pipeline.sourceId.type
    };
  }

  if (pipeline.destinationId && pipeline.destinationId.name) {
    formatted.destination = {
      id: pipeline.destinationId._id.toString(),
      name: pipeline.destinationId.name,
      type: pipeline.destinationId.type
    };
  }

  return formatted;
};

const createPipeline = async (req, res) => {
  try {
    const { name, sourceId, destinationId, status, syncMode, cursorField } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Pipeline name is required' });
    }

    if (!sourceId || !mongoose.Types.ObjectId.isValid(sourceId)) {
      return res.status(400).json({ message: 'A valid sourceId is required' });
    }

    if (!destinationId || !mongoose.Types.ObjectId.isValid(destinationId)) {
      return res.status(400).json({ message: 'A valid destinationId is required' });
    }

    if (syncMode !== undefined && !['FULL', 'INCREMENTAL'].includes(syncMode)) {
      return res.status(400).json({ message: 'syncMode must be FULL or INCREMENTAL' });
    }

    const resolvedSyncMode = syncMode || 'FULL';

    if (resolvedSyncMode === 'INCREMENTAL') {
      if (!cursorField || typeof cursorField !== 'string' || !cursorField.trim()) {
        return res.status(400).json({ message: 'cursorField is required for INCREMENTAL syncMode' });
      }
    }

    // Verify source ownership
    const source = await Source.findOne({ _id: sourceId, userId: req.user.id });
    if (!source) {
      return res.status(404).json({ message: 'Source not found or does not belong to you' });
    }

    // Verify destination ownership
    const destination = await Destination.findOne({ _id: destinationId, userId: req.user.id });
    if (!destination) {
      return res.status(404).json({ message: 'Destination not found or does not belong to you' });
    }

    if (req.body.transformations !== undefined) {
      const validation = TransformationService.validateTransformationConfig(req.body.transformations);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }
    }

    const newPipeline = await Pipeline.create({
      userId: req.user.id,
      name: name.trim(),
      sourceId,
      destinationId,
      status: status && ['ACTIVE', 'INACTIVE'].includes(status) ? status : 'ACTIVE',
      syncMode: resolvedSyncMode,
      cursorField: resolvedSyncMode === 'INCREMENTAL' ? cursorField.trim() : null,
      cursorValue: null,
      lastSyncAt: null,
      transformations: req.body.transformations || {
        enabled: false,
        includeUnmapped: true,
        addMetadata: false,
        fieldMappings: []
      }
    });

    const populatedPipeline = await Pipeline.findById(newPipeline._id)
      .populate('sourceId', 'name type')
      .populate('destinationId', 'name type');

    return res.status(201).json({
      message: 'Pipeline created successfully',
      pipeline: formatPipeline(populatedPipeline)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error creating pipeline' });
  }
};

const getPipelines = async (req, res) => {
  try {
    const pipelines = await Pipeline.find({ userId: req.user.id })
      .populate('sourceId', 'name type')
      .populate('destinationId', 'name type')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      pipelines: pipelines.map(formatPipeline)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error retrieving pipelines' });
  }
};

const getPipelineById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const pipeline = await Pipeline.findOne({ _id: id, userId: req.user.id })
      .populate('sourceId', 'name type')
      .populate('destinationId', 'name type');

    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    return res.status(200).json({
      pipeline: formatPipeline(pipeline)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error retrieving pipeline' });
  }
};

const updatePipeline = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const pipeline = await Pipeline.findOne({ _id: id, userId: req.user.id });

    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const { name, sourceId, destinationId, status, syncMode, cursorField, resetCursor } = req.body;

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Pipeline name cannot be empty' });
      }
      pipeline.name = name.trim();
    }

    if (sourceId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(sourceId)) {
        return res.status(400).json({ message: 'Invalid sourceId' });
      }
      const source = await Source.findOne({ _id: sourceId, userId: req.user.id });
      if (!source) {
        return res.status(404).json({ message: 'Source not found or does not belong to you' });
      }
      pipeline.sourceId = sourceId;
    }

    if (destinationId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(destinationId)) {
        return res.status(400).json({ message: 'Invalid destinationId' });
      }
      const destination = await Destination.findOne({ _id: destinationId, userId: req.user.id });
      if (!destination) {
        return res.status(404).json({ message: 'Destination not found or does not belong to you' });
      }
      pipeline.destinationId = destinationId;
    }

    if (status !== undefined) {
      if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        return res.status(400).json({ message: 'Status must be ACTIVE or INACTIVE' });
      }
      pipeline.status = status;
    }

    if (syncMode !== undefined) {
      if (!['FULL', 'INCREMENTAL'].includes(syncMode)) {
        return res.status(400).json({ message: 'syncMode must be FULL or INCREMENTAL' });
      }
      pipeline.syncMode = syncMode;
    }

    if (pipeline.syncMode === 'INCREMENTAL') {
      if (cursorField !== undefined) {
        if (!cursorField || typeof cursorField !== 'string' || !cursorField.trim()) {
          return res.status(400).json({ message: 'cursorField is required for INCREMENTAL syncMode' });
        }
        pipeline.cursorField = cursorField.trim();
      } else if (!pipeline.cursorField) {
        return res.status(400).json({ message: 'cursorField is required for INCREMENTAL syncMode' });
      }
    } else if (syncMode === 'FULL') {
      if (cursorField !== undefined) {
        pipeline.cursorField = cursorField ? cursorField.trim() : null;
      }
    }

    if (resetCursor === true) {
      pipeline.cursorValue = null;
    }

    if (req.body.transformations !== undefined) {
      const validation = TransformationService.validateTransformationConfig(req.body.transformations);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }
      pipeline.transformations = req.body.transformations;
    }

    pipeline.updatedAt = Date.now();
    await pipeline.save();

    const updatedPipeline = await Pipeline.findById(pipeline._id)
      .populate('sourceId', 'name type')
      .populate('destinationId', 'name type');

    return res.status(200).json({
      message: 'Pipeline updated successfully',
      pipeline: formatPipeline(updatedPipeline)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error updating pipeline' });
  }
};

const deletePipeline = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const deleted = await Pipeline.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!deleted) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    return res.status(200).json({
      message: 'Pipeline deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error deleting pipeline' });
  }
};

const getSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const pipeline = await Pipeline.findOne({ _id: id, userId: req.user.id });
    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    return res.status(200).json({
      pipelineId: pipeline._id.toString(),
      schedule: {
        enabled: Boolean(pipeline.schedule?.enabled),
        type: pipeline.schedule?.type || 'INTERVAL',
        expression: pipeline.schedule?.expression || '1h',
        nextRunAt: pipeline.schedule?.nextRunAt || null,
        lastScheduledRunAt: pipeline.schedule?.lastScheduledRunAt || null
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error retrieving schedule' });
  }
};

const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const pipeline = await Pipeline.findOne({ _id: id, userId: req.user.id });
    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const { type, expression, enabled } = req.body;
    const scheduleType = type || pipeline.schedule?.type || 'INTERVAL';
    const scheduleExpr = expression || pipeline.schedule?.expression || '1h';

    const validation = validateScheduleExpression(scheduleType, scheduleExpr);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error });
    }

    pipeline.schedule = pipeline.schedule || {};
    pipeline.schedule.type = scheduleType;
    pipeline.schedule.expression = scheduleExpr.trim();

    if (enabled !== undefined) {
      pipeline.schedule.enabled = Boolean(enabled);
    }

    if (pipeline.schedule.enabled) {
      pipeline.schedule.nextRunAt = calculateNextRun(scheduleType, scheduleExpr);
    } else {
      pipeline.schedule.nextRunAt = null;
    }

    pipeline.updatedAt = Date.now();
    await pipeline.save();

    return res.status(200).json({
      message: 'Schedule updated successfully',
      schedule: pipeline.schedule
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error updating schedule' });
  }
};

const enableSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const pipeline = await Pipeline.findOne({ _id: id, userId: req.user.id });
    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const scheduleType = pipeline.schedule?.type || 'INTERVAL';
    const scheduleExpr = pipeline.schedule?.expression || '1h';

    const validation = validateScheduleExpression(scheduleType, scheduleExpr);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error });
    }

    pipeline.schedule = pipeline.schedule || {};
    pipeline.schedule.enabled = true;
    pipeline.schedule.nextRunAt = calculateNextRun(scheduleType, scheduleExpr);
    pipeline.updatedAt = Date.now();
    await pipeline.save();

    return res.status(200).json({
      message: 'Schedule enabled successfully',
      schedule: pipeline.schedule
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error enabling schedule' });
  }
};

const disableSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const pipeline = await Pipeline.findOne({ _id: id, userId: req.user.id });
    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    pipeline.schedule = pipeline.schedule || {};
    pipeline.schedule.enabled = false;
    pipeline.schedule.nextRunAt = null;
    pipeline.updatedAt = Date.now();
    await pipeline.save();

    return res.status(200).json({
      message: 'Schedule disabled successfully',
      schedule: pipeline.schedule
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error disabling schedule' });
  }
};

const getTransformations = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const pipeline = await Pipeline.findOne({ _id: id, userId: req.user.id });
    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    return res.status(200).json({
      pipelineId: pipeline._id.toString(),
      transformations: {
        enabled: Boolean(pipeline.transformations?.enabled),
        includeUnmapped: pipeline.transformations?.includeUnmapped !== false,
        addMetadata: Boolean(pipeline.transformations?.addMetadata),
        fieldMappings: Array.isArray(pipeline.transformations?.fieldMappings)
          ? pipeline.transformations.fieldMappings.map((m) => ({
              sourceField: m.sourceField,
              destinationField: m.destinationField,
              dataType: m.dataType || null,
              defaultValue: m.defaultValue !== undefined ? m.defaultValue : null,
              transformRule: m.transformRule || 'NONE'
            }))
          : []
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error retrieving transformations' });
  }
};

const updateTransformations = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const pipeline = await Pipeline.findOne({ _id: id, userId: req.user.id });
    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const bodyConfig = req.body.transformations || req.body;
    const validation = TransformationService.validateTransformationConfig(bodyConfig);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error });
    }

    const { enabled, includeUnmapped, addMetadata, fieldMappings } = bodyConfig;

    pipeline.transformations = pipeline.transformations || {};
    if (enabled !== undefined) pipeline.transformations.enabled = Boolean(enabled);
    if (includeUnmapped !== undefined) pipeline.transformations.includeUnmapped = Boolean(includeUnmapped);
    if (addMetadata !== undefined) pipeline.transformations.addMetadata = Boolean(addMetadata);
    if (fieldMappings !== undefined) pipeline.transformations.fieldMappings = fieldMappings;

    pipeline.updatedAt = Date.now();
    await pipeline.save();

    return res.status(200).json({
      message: 'Transformations updated successfully',
      transformations: {
        enabled: Boolean(pipeline.transformations.enabled),
        includeUnmapped: pipeline.transformations.includeUnmapped !== false,
        addMetadata: Boolean(pipeline.transformations.addMetadata),
        fieldMappings: Array.isArray(pipeline.transformations.fieldMappings)
          ? pipeline.transformations.fieldMappings.map((m) => ({
              sourceField: m.sourceField,
              destinationField: m.destinationField,
              dataType: m.dataType || null,
              defaultValue: m.defaultValue !== undefined ? m.defaultValue : null,
              transformRule: m.transformRule || 'NONE'
            }))
          : []
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error updating transformations' });
  }
};

const previewTransformations = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    const pipeline = await Pipeline.findOne({ _id: id, userId: req.user.id });
    if (!pipeline) {
      return res.status(404).json({ message: 'Pipeline not found' });
    }

    // Determine config to preview: allow config override from body, or fallback to saved pipeline transformations
    let configToPreview = pipeline.transformations;
    if (req.body.transformations || req.body.fieldMappings || req.body.enabled !== undefined) {
      const candidateConfig = req.body.transformations || {
        enabled: req.body.enabled !== undefined ? req.body.enabled : true,
        includeUnmapped: req.body.includeUnmapped !== undefined ? req.body.includeUnmapped : true,
        addMetadata: Boolean(req.body.addMetadata),
        fieldMappings: req.body.fieldMappings || []
      };
      const validation = TransformationService.validateTransformationConfig(candidateConfig);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }
      configToPreview = candidateConfig;
    }

    const effectiveConfig = {
      ...(configToPreview && typeof configToPreview.toObject === 'function'
        ? configToPreview.toObject()
        : configToPreview),
      enabled: true
    };

    let sampleRecords = req.body.sampleRecords;

    if (!sampleRecords || !Array.isArray(sampleRecords) || sampleRecords.length === 0) {
      // Fetch a small sample from the source connector without writing to destination
      const source = await Source.findOne({ _id: pipeline.sourceId, userId: req.user.id });
      if (!source) {
        return res.status(404).json({ message: 'Source not found' });
      }
      const sourceConnector = createSourceConnector(source);
      await sourceConnector.testConnection();
      const extracted = await sourceConnector.extract({ syncMode: 'FULL' });
      sampleRecords = (Array.isArray(extracted) ? extracted : []).slice(0, 3);
    }

    const preview = TransformationService.previewTransformation(sampleRecords, effectiveConfig, {
      pipelineId: pipeline._id
    });

    return res.status(200).json({
      message: 'Transformation preview generated successfully',
      preview
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error previewing transformations' });
  }
};

module.exports = {
  createPipeline,
  getPipelines,
  getPipelineById,
  updatePipeline,
  deletePipeline,
  getSchedule,
  updateSchedule,
  enableSchedule,
  disableSchedule,
  getTransformations,
  updateTransformations,
  previewTransformations
};
