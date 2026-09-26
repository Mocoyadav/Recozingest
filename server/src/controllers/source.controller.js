const mongoose = require('mongoose');
const Source = require('../models/Source');

const ALLOWED_TYPES = ['REST_API', 'POSTGRESQL', 'MYSQL', 'CSV'];

const formatSource = (source) => ({
  id: source._id.toString(),
  name: source.name,
  type: source.type,
  config: source.config,
  status: source.status,
  createdAt: source.createdAt,
  updatedAt: source.updatedAt
});

const validateRestApiConfig = (config) => {
  if (!config || typeof config !== 'object') {
    return 'Config must be an object';
  }
  if (!config.url || typeof config.url !== 'string' || !config.url.trim()) {
    return 'REST_API config requires a valid url';
  }
  return null;
};

const createSource = async (req, res) => {
  try {
    const { name, type, config, status } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Source name is required' });
    }

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        message: `Source type must be one of: ${ALLOWED_TYPES.join(', ')}`
      });
    }

    if (type === 'REST_API') {
      const configError = validateRestApiConfig(config);
      if (configError) {
        return res.status(400).json({ message: configError });
      }
    } else if (!config || typeof config !== 'object') {
      return res.status(400).json({ message: 'Config must be an object' });
    }

    const newSource = await Source.create({
      userId: req.user.id,
      name: name.trim(),
      type,
      config: {
        ...config,
        ...(type === 'REST_API'
          ? {
              method: config.method ? config.method.toUpperCase() : 'GET',
              headers: config.headers || {}
            }
          : {})
      },
      status: status && ['ACTIVE', 'INACTIVE'].includes(status) ? status : 'ACTIVE'
    });

    return res.status(201).json({
      message: 'Source created successfully',
      source: formatSource(newSource)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error creating source' });
  }
};

const getSources = async (req, res) => {
  try {
    const sources = await Source.find({ userId: req.user.id }).sort({ createdAt: -1 });

    return res.status(200).json({
      sources: sources.map(formatSource)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error retrieving sources' });
  }
};

const getSourceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Source not found' });
    }

    const source = await Source.findOne({ _id: id, userId: req.user.id });

    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }

    return res.status(200).json({
      source: formatSource(source)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error retrieving source' });
  }
};

const updateSource = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Source not found' });
    }

    const source = await Source.findOne({ _id: id, userId: req.user.id });

    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }

    const { name, type, config, status } = req.body;

    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Source name cannot be empty' });
      }
      source.name = name.trim();
    }

    const effectiveType = type !== undefined ? type : source.type;

    if (type !== undefined) {
      if (!ALLOWED_TYPES.includes(type)) {
        return res.status(400).json({
          message: `Source type must be one of: ${ALLOWED_TYPES.join(', ')}`
        });
      }
      source.type = type;
    }

    if (config !== undefined) {
      if (effectiveType === 'REST_API') {
        const configError = validateRestApiConfig(config);
        if (configError) {
          return res.status(400).json({ message: configError });
        }
      } else if (!config || typeof config !== 'object') {
        return res.status(400).json({ message: 'Config must be an object' });
      }

      source.config = {
        ...config,
        ...(effectiveType === 'REST_API'
          ? {
              method: config.method ? config.method.toUpperCase() : 'GET',
              headers: config.headers || {}
            }
          : {})
      };
    }

    if (status !== undefined) {
      if (!['ACTIVE', 'INACTIVE'].includes(status)) {
        return res.status(400).json({ message: 'Status must be ACTIVE or INACTIVE' });
      }
      source.status = status;
    }

    source.updatedAt = Date.now();
    await source.save();

    return res.status(200).json({
      message: 'Source updated successfully',
      source: formatSource(source)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error updating source' });
  }
};

const deleteSource = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Source not found' });
    }

    const deletedSource = await Source.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!deletedSource) {
      return res.status(404).json({ message: 'Source not found' });
    }

    return res.status(200).json({
      message: 'Source deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error deleting source' });
  }
};

module.exports = {
  createSource,
  getSources,
  getSourceById,
  updateSource,
  deleteSource
};
