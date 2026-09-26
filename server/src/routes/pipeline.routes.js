const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/pipeline.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/', createPipeline);
router.get('/', getPipelines);
router.get('/:id', getPipelineById);
router.put('/:id', updatePipeline);
router.delete('/:id', deletePipeline);

// Schedule management endpoints
router.get('/:id/schedule', getSchedule);
router.put('/:id/schedule', updateSchedule);
router.patch('/:id/schedule/enable', enableSchedule);
router.patch('/:id/schedule/disable', disableSchedule);

// Transformation management endpoints
router.get('/:id/transform', getTransformations);
router.put('/:id/transform', updateTransformations);
router.post('/:id/transform/preview', previewTransformations);

module.exports = router;
