const PipelineExecutionService = require('../services/pipelineExecution.service');

const runPipeline = async (req, res) => {
  try {
    const { id } = req.params;
    const run = await PipelineExecutionService.executePipeline(id, req.user.id);

    return res.status(200).json({
      message: 'Pipeline executed successfully',
      run
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || 'Pipeline execution failed'
    });
  }
};

module.exports = {
  runPipeline
};
