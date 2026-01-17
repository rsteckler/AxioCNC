import logger from '../../lib/logger';
import jobHistory from './index';
import store from '../../store';

const log = logger('service:jobhistory:hook');

/**
 * Hook into controller job:complete events to automatically store job history
 * This service listens to all controllers and stores completed jobs
 */
class JobHistoryHook {
    /**
     * Initialize the hook - listen to all existing and new controllers
     */
    initialize() {
        // Hook into existing controllers
        this.hookExistingControllers();

        // Watch for new controllers being added
        // Controllers are stored in the store, so we'll check periodically
        // or hook into the store events if available
        this.watchForNewControllers();
    }

    /**
     * Hook into existing controllers
     */
    hookExistingControllers() {
        const controllers = store.get('controllers', {});
        Object.keys(controllers).forEach(port => {
            const controller = controllers[port];
            if (controller) {
                this.attachListener(controller, port);
            }
        });
    }

    /**
     * Watch for new controllers being added
     * Since controllers are created dynamically, we check periodically
     */
    watchForNewControllers() {
        // Check every 2 seconds for new controllers
        setInterval(() => {
            const controllers = store.get('controllers', {});
            Object.keys(controllers).forEach(port => {
                const controller = controllers[port];
                if (controller && !controller._jobHistoryHookAttached) {
                    this.attachListener(controller, port);
                }
            });
        }, 2000);
    }

    /**
     * Attach job:complete listener to a controller
     * @param {object} controller - Controller instance
     * @param {string} port - Serial port
     */
    attachListener(controller, port) {
        if (controller._jobHistoryHookAttached) {
            return; // Already attached
        }

        controller.on('job:complete', (completionInfo) => {
            this.handleJobComplete(controller, port, completionInfo);
        });

        controller._jobHistoryHookAttached = true;
        log.debug(`Attached job history hook to controller on port "${port}"`);
    }

    /**
     * Handle job completion event
     * @param {object} controller - Controller instance
     * @param {string} port - Serial port
     * @param {object} completionInfo - Completion info from controller
     */
    handleJobComplete(controller, port, completionInfo) {
        try {
            log.debug(`Job completed on port "${port}": ${completionInfo.reason}`);

            // Get sender state for additional job data
            const senderState = controller.sender?.toJSON() || completionInfo.senderState || {};

            // Extract tool usage from sender state
            // M6 indices indicate tool changes - we can track which tools were used
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
            const jobData = {
                timestamp: completionInfo.timestamp || Date.now(),
                status: status,
                wasSuccessful: completionInfo.wasSuccessful || false,
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
                    // Distance could be calculated from G-code if needed
                    // distance: calculateDistance(senderState),
                },
                
                // Tool usage
                tools: tools,
                
                // Additional context from sender
                context: senderState.context || {},
                
                // M6 tool change information
                m6Indices: senderState.m6Indices || [],
            };

            // Store the job
            const jobId = jobHistory.addJob(jobData);
            log.info(`Stored job history: id=${jobId}, port="${port}", status=${status}, file="${jobData.fileName}"`);

        } catch (err) {
            log.error(`Error storing job history: ${err.message}`, err);
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
}

const jobHistoryHook = new JobHistoryHook();

export default jobHistoryHook;
