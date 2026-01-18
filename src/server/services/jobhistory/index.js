import events from 'events';
import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import logger from '../../lib/logger';
import uuid from 'uuid';

const log = logger('service:jobhistory');

/**
 * JobHistoryService - Stores completed job history and statistics
 * 
 * Data structure:
 * - jobs: Array of completed jobs (flexible schema)
 * - stats: Accumulated statistics across all jobs
 * - toolStats: Per-tool usage statistics
 */
class JobHistoryService extends events.EventEmitter {
    file = '';
    
    data = {
        jobs: [],           // Array of job records
        stats: {            // Accumulated stats
            totalJobs: 0,
            successfulJobs: 0,
            failedJobs: 0,
            stoppedJobs: 0,
            totalTime: 0,   // milliseconds
            totalLines: 0,
            totalDistance: 0, // mm (if tracked)
        },
        toolStats: {}      // Map<toolNumber, ToolStats>
    };

    watcher = null;

    /**
     * Load job history from file
     * @param {string} file - Path to JSON file
     */
    load(file) {
        this.file = file;
        this.reload();
        this.emit('load', this.data);

        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }

        try {
            // Ensure directory exists
            const dir = path.dirname(this.file);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            if (!fs.existsSync(this.file)) {
                const content = JSON.stringify(this.data, null, 2);
                fs.writeFileSync(this.file, content, 'utf8');
            }

            this.watcher = fs.watchFile(this.file, (curr, prev) => {
                if (curr?.mtimeMs !== prev?.mtimeMs) {
                    log.debug(`Job history file changed: ${this.file}`);
                    this.reload();
                    this.emit('change', this.data);
                }
            });
        } catch (err) {
            log.error(`Error setting up job history file watcher: ${err}`);
            this.emit('error', err);
        }

        return this.data;
    }

    /**
     * Reload data from file
     */
    reload() {
        try {
            if (fs.existsSync(this.file)) {
                const content = fs.readFileSync(this.file, 'utf8');
                this.data = JSON.parse(content);
            }
        } catch (err) {
            log.error(`Unable to load job history from ${this.file}: ${err}`);
            this.emit('error', err);
            return false;
        }

        // Ensure data structure is valid
        if (!_.isArray(this.data.jobs)) {
            this.data.jobs = [];
        }
        if (!_.isPlainObject(this.data.stats)) {
            this.data.stats = {
                totalJobs: 0,
                successfulJobs: 0,
                failedJobs: 0,
                stoppedJobs: 0,
                totalTime: 0,
                totalLines: 0,
                totalDistance: 0,
            };
        }
        if (!_.isPlainObject(this.data.toolStats)) {
            this.data.toolStats = {};
        }

        return true;
    }

    /**
     * Save data to file
     */
    sync() {
        try {
            const content = JSON.stringify(this.data, null, 2);
            fs.writeFileSync(this.file, content, 'utf8');
        } catch (err) {
            log.error(`Unable to write job history to ${this.file}: ${err}`);
            this.emit('error', err);
            return false;
        }
        return true;
    }

    /**
     * Add a completed job to history
     * @param {object} jobData - Job data (flexible schema)
     * @returns {string} Job ID
     */
    addJob(jobData) {
        this.reload();

        // Generate job ID if not provided
        const jobId = jobData.id || uuid.v4();
        const timestamp = jobData.timestamp || Date.now();

        // Create job record with required fields
        const job = {
            id: jobId,
            timestamp: timestamp,
            status: jobData.status || 'unknown', // 'completed', 'stopped', 'error', 'power_loss', 'panic_stop', etc.
            ...jobData, // Include all other fields (flexible schema)
        };

        // Add to jobs array (most recent first)
        this.data.jobs.unshift(job);

        // Keep only last 1000 jobs (configurable limit)
        const maxJobs = 1000;
        if (this.data.jobs.length > maxJobs) {
            this.data.jobs = this.data.jobs.slice(0, maxJobs);
        }

        // Update accumulated stats
        this.updateStats(job);

        // Update tool stats
        this.updateToolStats(job);

        this.sync();
        this.emit('job:added', job);

        return jobId;
    }

    /**
     * Add a job from controller completion info
     * This is a convenience method that controllers can call directly
     * @param {object} controller - Controller instance
     * @param {string} port - Serial port
     * @param {object} completionInfo - Completion info from controller
     * @returns {string} Job ID
     */
    addJobFromController(controller, port, completionInfo) {
        try {
            // Get sender state for additional job data
            const senderState = controller.sender?.toJSON() || completionInfo.senderState || {};

            // Extract tool usage from sender state
            const tools = this.extractToolUsage(senderState, controller);

            // Determine job status from completion reason
            let status = 'unknown';
            if (completionInfo.reason === 'completed') {
                status = completionInfo.wasSuccessful ? 'completed' : 'error';
            } else if (completionInfo.reason === 'stopped') {
                status = 'stopped';
            } else if (completionInfo.reason === 'error') {
                status = 'error';
            } else if (completionInfo.reason === 'reset') {
                status = 'reset';
            } else if (completionInfo.reason === 'panic_stop' || completionInfo.reason === 'panic') {
                status = 'panic_stop';
            } else if (completionInfo.reason === 'power_loss' || completionInfo.reason === 'power') {
                status = 'power_loss';
            } else {
                status = completionInfo.reason || 'unknown';
            }

            // Build job data with flexible schema
            // Note: wasSuccessful is not stored - status already encodes this (status='completed' means wasSuccessful=true)
            const jobData = {
                timestamp: completionInfo.timestamp || Date.now(),
                status: status,
                reason: completionInfo.reason || 'unknown',
                port: port,
                controllerType: controller.type || 'unknown',
                
                // File information
                fileName: senderState.name || 'unknown',
                fileSize: senderState.size || 0,
                
                // Job statistics
                stats: {
                    total: senderState.total || 0,
                    sent: senderState.sent || 0,
                    received: senderState.received || 0,
                    startTime: senderState.startTime || 0,
                    finishTime: senderState.finishTime || completionInfo.timestamp || Date.now(),
                    elapsedTime: senderState.elapsedTime || 0,
                },
                
                // Tool usage
                tools: tools,
                
                // Additional context from sender
                context: senderState.context || {},
                
                // M6 tool change information
                m6Indices: senderState.m6Indices || [],
            };

            // Store the job
            const jobId = this.addJob(jobData);
            log.info(`Stored job history: id=${jobId}, port="${port}", status=${status}, file="${jobData.fileName}"`);

            return jobId;
        } catch (err) {
            log.error(`Error storing job history: ${err.message}`, err);
            throw err;
        }
    }

    /**
     * Extract tool usage information from sender state
     * @param {object} senderState - Sender state JSON
     * @param {object} controller - Controller instance
     * @returns {Array} Array of tool usage objects
     */
    extractToolUsage(senderState, controller) {
        const tools = [];
        const toolUsageMap = new Map();

        // Get M6 indices (tool change locations)
        const m6Indices = senderState.m6Indices || [];

        // Try to get tool information from parser state if available
        // This would require tracking tool changes during job execution
        // For now, we'll extract what we can from the sender state

        // If we have context with tool information, use it
        if (senderState.context && senderState.context.tool) {
            const toolNumber = parseInt(senderState.context.tool, 10);
            if (!isNaN(toolNumber)) {
                toolUsageMap.set(toolNumber, {
                    toolNumber: toolNumber,
                    time: senderState.elapsedTime || 0,
                    // Distance would need to be calculated from G-code
                    distance: 0,
                });
            }
        }

        // Convert map to array
        toolUsageMap.forEach((usage, toolNumber) => {
            tools.push(usage);
        });

        return tools;
    }

    /**
     * Update accumulated statistics from a job
     * @param {object} job - Job record
     */
    updateStats(job) {
        const stats = this.data.stats;

        stats.totalJobs += 1;

        // Count by status
        // Note: status is set to 'completed' only when wasSuccessful is true
        // So we only need to check status, not both status and wasSuccessful
        if (job.status === 'completed') {
            stats.successfulJobs += 1;
        } else if (job.status === 'error') {
            stats.failedJobs += 1;
        } else if (job.status === 'stopped') {
            stats.stoppedJobs += 1;
        }

        // Accumulate time (elapsedTime in milliseconds)
        if (job.stats?.elapsedTime) {
            stats.totalTime += job.stats.elapsedTime;
        }

        // Accumulate lines
        if (job.stats?.received) {
            stats.totalLines += job.stats.received;
        }

        // Accumulate distance if available
        if (job.stats?.distance) {
            stats.totalDistance += job.stats.distance;
        }
    }

    /**
     * Update tool statistics from a job
     * @param {object} job - Job record
     */
    updateToolStats(job) {
        if (!job.tools || !_.isArray(job.tools)) {
            return;
        }

        job.tools.forEach(toolUsage => {
            const toolNumber = toolUsage.toolNumber;
            if (!toolNumber) {
                return;
            }

            if (!this.data.toolStats[toolNumber]) {
                this.data.toolStats[toolNumber] = {
                    toolNumber: toolNumber,
                    totalJobs: 0,
                    totalTime: 0,      // milliseconds
                    totalDistance: 0,  // mm
                    usageCount: 0,     // Number of times tool was used
                };
            }

            const toolStat = this.data.toolStats[toolNumber];
            toolStat.totalJobs += 1;
            toolStat.usageCount += 1;

            if (toolUsage.time) {
                toolStat.totalTime += toolUsage.time;
            }
            if (toolUsage.distance) {
                toolStat.totalDistance += toolUsage.distance;
            }
        });
    }

    /**
     * Get all jobs (with optional filtering)
     * @param {object} options - Query options
     * @returns {Array} Array of job records
     */
    getJobs(options = {}) {
        this.reload();

        let jobs = [...this.data.jobs];

        // Filter by status if provided
        if (options.status) {
            jobs = jobs.filter(job => job.status === options.status);
        }

        // Limit results
        if (options.limit) {
            jobs = jobs.slice(0, options.limit);
        }

        // Offset for pagination
        if (options.offset) {
            jobs = jobs.slice(options.offset);
        }

        return jobs;
    }

    /**
     * Get a specific job by ID
     * @param {string} jobId - Job ID
     * @returns {object|null} Job record or null
     */
    getJob(jobId) {
        this.reload();
        return this.data.jobs.find(job => job.id === jobId) || null;
    }

    /**
     * Get accumulated statistics
     * @returns {object} Statistics object
     */
    getStats() {
        this.reload();
        return { ...this.data.stats };
    }

    /**
     * Get tool statistics
     * @param {number} toolNumber - Optional tool number filter
     * @returns {object|Array} Tool stats object or array of all tool stats
     */
    getToolStats(toolNumber = null) {
        this.reload();

        if (toolNumber !== null) {
            return this.data.toolStats[toolNumber] || null;
        }

        // Return all tool stats as array
        return Object.values(this.data.toolStats);
    }

    /**
     * Delete a job (and update stats)
     * @param {string} jobId - Job ID
     * @returns {boolean} Success
     */
    deleteJob(jobId) {
        this.reload();

        const index = this.data.jobs.findIndex(job => job.id === jobId);
        if (index === -1) {
            return false;
        }

        const job = this.data.jobs[index];
        this.data.jobs.splice(index, 1);

        // Recalculate stats (remove this job's contribution)
        // For simplicity, we'll just recalculate from remaining jobs
        this.recalculateStats();

        this.sync();
        this.emit('job:deleted', jobId);

        return true;
    }

    /**
     * Recalculate all stats from jobs (useful after deletion)
     */
    recalculateStats() {
        // Reset stats
        this.data.stats = {
            totalJobs: 0,
            successfulJobs: 0,
            failedJobs: 0,
            stoppedJobs: 0,
            totalTime: 0,
            totalLines: 0,
            totalDistance: 0,
        };

        this.data.toolStats = {};

        // Recalculate from all jobs
        this.data.jobs.forEach(job => {
            this.updateStats(job);
            this.updateToolStats(job);
        });
    }

    /**
     * Clear all job history
     */
    clear() {
        this.data = {
            jobs: [],
            stats: {
                totalJobs: 0,
                successfulJobs: 0,
                failedJobs: 0,
                stoppedJobs: 0,
                totalTime: 0,
                totalLines: 0,
                totalDistance: 0,
            },
            toolStats: {},
        };
        this.sync();
        this.emit('cleared');
    }
}

const jobHistory = new JobHistoryService();

export default jobHistory;
