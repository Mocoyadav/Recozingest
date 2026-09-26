const express = require('express');
const router = express.Router();
const {
  getPipelineRuns,
  getPipelineRunById
} = require('../controllers/pipelineRun.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.get('/', getPipelineRuns);
router.get('/:id', getPipelineRunById);

module.exports = router;
