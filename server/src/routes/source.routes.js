const express = require('express');
const router = express.Router();
const {
  createSource,
  getSources,
  getSourceById,
  updateSource,
  deleteSource
} = require('../controllers/source.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/', createSource);
router.get('/', getSources);
router.get('/:id', getSourceById);
router.put('/:id', updateSource);
router.delete('/:id', deleteSource);

module.exports = router;
