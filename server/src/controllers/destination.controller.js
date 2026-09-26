const mongoose = require('mongoose');
const Destination = require('../models/Destination');

const ALLOWED_TYPES = ['MONGODB', 'POSTGRESQL', 'MYSQL', 'CSV'];

// Helper to sanitize config before sending API responses
const sanitizeConfig = (config = {}) => {
  if (!config || typeof config !== 'object') return {};
  const sanitized = { ...config };
  delete sanitized.uri;
  delete sanitized.password;
  delete sanitized.secret;
  return sanitized;
};

// Formatter to serialize Destination without sensitive fields
const formatDestination = (destination) => ({
  id: destination._id.toString(),
  name: destination.name,
  type: destination.type,
  config: sanitizeConfig(destination.config),
  status: destination.status,
  createdAt: destination.createdAt,
  updatedAt: destination.updatedAt
});

const validateMongoDbConfig = (config, isUpdate = false) => {
  if (!config || typeof config !== 'object') {
    return 'Config must be an object';
  }
  if (!isUpdate || config.uri !== undefined) {
    if (!config.uri || typeof config.uri !== 'string' || !config.uri.trim()) {
      return 'MONGODB config requires a valid uri';
    }
  }
  if (!isUpdate || config.database !== undefined) {
    if (!config.database || typeof config.database !== 'string' || !config.database.trim()) {
      return 'MONGODB config requires a database name';
    }
  }
  if (!isUpdate || config.collection !== undefined) {
    if (!config.collection || typeof config.collection !== 'string' || !config.collection.trim()) {
      return 'MONGODB config requires a collection name';
    }
  }
  return null;
};

const createDestination = async (req, res) => {
  try {
    const { name, type, config, status } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Destination name is required' });
    }

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        message: `Destination type must be one of: ${ALLOWED_TYPES.join(', ')}`
      });
    }

    if (type === 'MONGODB') {
      const configError = validateMongoDbConfig(config, false);
      if (configError) {
        return res.status(400).json({ message: configError });
      }
    } else if (!config || typeof config !== 'object') {
      return res.status(400).json({ message: 'Config must be an object' });
    }

    const newDestination = await Destination.create({
      userId: req.user.id,
      name: name.trim(),
      type,
      config,
      status: status && ['ACTIVE', 'INACTIVE'].includes(status) ? status : 'ACTIVE'
    });

    return res.status(201).json({
      message: 'Destination created successfully',
      destination: formatDestination(newDestination)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error creating destination' });
  }
};

const getDestinations = async (req, res) => {
  try {
    const destinations = await Destination.find({ userId: req.user.id }).sort({ createdAt: -1 });

    return res.status(200).json({
      destinations: destinations.map(formatDestination)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error retrieving destinations' });
  }
};

const getDestinationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    const destination = await Destination.findOne({ _id: id, userId: req.user.id });

    if (!destination) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    return res.status(200).json({
      destination: formatDestination(destination)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error retrieving destination' });
  }
};

const updateDestination = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    const destination = await Destination.findOne({ _id: id, userId: req.user.id });

    if (!destination) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    const { name, type, config, status } = req.body;

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Destination name cannot be empty' });
      }
      destination.name = name.trim();
    }

    const effectiveType = type !== undefined ? type : destination.type;

    if (type !== undefined) {
      if (!ALLOWED_TYPES.includes(type)) {
        return res.status(400).json({
          message: `Destination type must be one of: ${ALLOWED_TYPES.join(', ')}`
        });
      }
      destination.type = type;
    }

    if (config !== undefined) {
      if (!config || typeof config !== 'object') {
        return res.status(400).json({ message: 'Config must be an object' });
      }

      const mergedConfig = {
        ...destination.config,
        ...config
      };

      if (effectiveType === 'MONGODB') {
        const configError = validateMongoDbConfig(mergedConfig, false);
        if (configError) {
          return res.status(400).json({ message: configError });
        }
      }

      destination.config = mergedConfig;
    }

    if (status !== undefined) {
      if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        return res.status(400).json({ message: 'Status must be ACTIVE or INACTIVE' });
      }
      destination.status = status;
    }

    destination.updatedAt = Date.now();
    await destination.save();

    return res.status(200).json({
      message: 'Destination updated successfully',
      destination: formatDestination(destination)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error updating destination' });
  }
};

const deleteDestination = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    const deleted = await Destination.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!deleted) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    return res.status(200).json({
      message: 'Destination deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error deleting destination' });
  }
};

module.exports = {
  createDestination,
  getDestinations,
  getDestinationById,
  updateDestination,
  deleteDestination
};
