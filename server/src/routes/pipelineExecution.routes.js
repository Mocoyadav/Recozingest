const express = require('express');
const router = express.Router();
const { runPipeline } = require('../controllers/pipelineExecution.controller');
const { getPipelineRuns } = require('../controllers/pipelineRun.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/:id/run', runPipeline);
router.get('/:id/runs', (req, res, next) => {
  req.query.pipelineId = req.params.id;
  return getPipelineRuns(req, res, next);
});

module.exports = router;
