const express = require('express');
const router = express.Router();
const {
  createDestination,
  getDestinations,
  getDestinationById,
  updateDestination,
  deleteDestination
} = require('../controllers/destination.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

router.post('/', createDestination);
router.get('/', getDestinations);
router.get('/:id', getDestinationById);
router.put('/:id', updateDestination);
router.delete('/:id', deleteDestination);

module.exports = router;
