/**
 * Job History API
 *
 * Endpoints for storing and retrieving job history, statistics, and tool usage
 */
import jobHistory from '../services/jobhistory';
import {
  ERR_BAD_REQUEST,
  ERR_NOT_FOUND,
} from '../constants';

/**
 * GET /api/jobhistory
 * Get list of completed jobs with optional filtering
 * Query params: status, limit, offset
 */
export const list = (req, res) => {
  const options = {
    status: req.query.status || null,
    limit: req.query.limit ? parseInt(req.query.limit, 10) : null,
    offset: req.query.offset ? parseInt(req.query.offset, 10) : null,
  };

  const jobs = jobHistory.getJobs(options);
  res.send(jobs);
};

/**
 * GET /api/jobhistory/:id
 * Get details of a specific job
 */
export const get = (req, res) => {
  const { id } = req.params;

  if (!id) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'Job ID is required',
    });
    return;
  }

  const job = jobHistory.getJob(id);

  if (!job) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Job not found',
    });
    return;
  }

  res.send(job);
};

/**
 * POST /api/jobhistory
 * Store a completed job
 * Body: Job data (flexible schema)
 */
export const create = (req, res) => {
  const jobData = req.body;

  if (!jobData) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'Job data is required',
    });
    return;
  }

  try {
    const jobId = jobHistory.addJob(jobData);
    res.send({
      id: jobId,
      msg: 'Job stored successfully',
    });
  } catch (err) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'Failed to store job',
      error: err.message,
    });
  }
};

/**
 * GET /api/jobhistory/stats
 * Get accumulated statistics
 */
export const getStats = (req, res) => {
  const stats = jobHistory.getStats();
  res.send(stats);
};

/**
 * GET /api/jobhistory/tools
 * Get tool statistics
 * Query param: toolNumber (optional, to get specific tool)
 */
export const getToolStats = (req, res) => {
  const toolNumber = req.query.toolNumber
    ? parseInt(req.query.toolNumber, 10)
    : null;

  const toolStats = jobHistory.getToolStats(toolNumber);
  res.send(toolStats);
};

/**
 * DELETE /api/jobhistory/:id
 * Delete a specific job
 */
export const remove = (req, res) => {
  const { id } = req.params;

  if (!id) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'Job ID is required',
    });
    return;
  }

  const success = jobHistory.deleteJob(id);

  if (!success) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Job not found',
    });
    return;
  }

  res.send({
    msg: 'Job deleted successfully',
  });
};

/**
 * DELETE /api/jobhistory
 * Clear all job history (admin operation)
 */
export const clear = (req, res) => {
  jobHistory.clear();
  res.send({
    msg: 'Job history cleared successfully',
  });
};
