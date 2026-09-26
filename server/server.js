const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/auth.routes');
const sourceRoutes = require('./src/routes/source.routes');
const destinationRoutes = require('./src/routes/destination.routes');
const pipelineExecutionRoutes = require('./src/routes/pipelineExecution.routes');
const pipelineRoutes = require('./src/routes/pipeline.routes');
const pipelineRunRoutes = require('./src/routes/pipelineRun.routes');
const schedulerService = require('./src/services/scheduler.service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'RicozIngest backend is running'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/pipelines', pipelineExecutionRoutes);
app.use('/api/pipelines', pipelineRoutes);
app.use('/api/pipeline-runs', pipelineRunRoutes);

const startServer = async () => {
  await connectDB();
  schedulerService.start();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = app;


