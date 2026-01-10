import events from 'events';
import logger from '../../lib/logger';

const log = logger('service:machinestatus');

/**
 * MachineStatusManager - Single source of truth for machine status
 *
 * Tracks machine status per port (connection, homed, alarm, workflow, etc.)
 * Reacts to controller events even when no frontend is connected.
 * Emits status changes via Socket.IO to connected clients.
 */
class MachineStatusManager extends events.EventEmitter {
    /**
     * Status storage: Map<port, MachineStatus>
     * Each status object contains:
     * - port: string
     * - connected: boolean
     * - controllerType: string | null
     * - machineStatus: 'not_connected' | 'connected_pre_home' | 'connected_post_home' | 'alarm' | 'running'
     * - isHomed: boolean
     * - isJobRunning: boolean
     * - homingInProgress: boolean
     * - controllerState: { activeState, mpos, wpos } | null
     * - workflowState: 'idle' | 'running' | 'paused' | null
     * - lastUpdate: number (timestamp)
     */
    statusByPort = new Map();

    /**
     * Socket.IO instance for emitting events
     */
    io = null;

    /**
     * Set Socket.IO instance
     */
    setIO(io) {
        this.io = io;
    }

    /**
     * Get default status for a port
     */
    getDefaultStatus(port) {
        return {
            port: port || '',
            connected: false,
            controllerType: null,
            machineStatus: 'not_connected',
            isHomed: false,
            isJobRunning: false,
            homingInProgress: false,
            controllerState: null,
            workflowState: null,
            lastUpdate: Date.now()
        };
    }

    /**
     * Get status for a port (or default if not exists)
     */
    getStatus(port) {
        if (!port) {
            return null;
        }

        if (!this.statusByPort.has(port)) {
            // Create default status for this port
            this.statusByPort.set(port, this.getDefaultStatus(port));
        }

        return this.statusByPort.get(port);
    }

    /**
     * Get all statuses (for /api/machine/status without port param)
     */
    getAllStatuses() {
        const statuses = {};
        this.statusByPort.forEach((status, port) => {
            statuses[port] = status;
        });
        return statuses;
    }

    /**
     * Compute derived machineStatus from status state
     * Priority order:
     * 1. Alarm (highest priority)
     * 2. Running (workflow:state === 'running')
     * 3. Connected + Homed (post-home)
     * 4. Connected + Not Homed (pre-home)
     * 5. Not Connected
     */
    computeMachineStatus(status) {
        if (!status.connected) {
            return 'not_connected';
        }

        // Check for alarm state (highest priority - overrides everything)
        if (status.controllerState?.activeState === 'Alarm') {
            return 'alarm';
        }

        // Check for hold state (can happen during running jobs, so check before workflow state)
        // This is reactive - checked every 250ms when controller state updates
        if (status.controllerState?.activeState === 'Hold') {
            return 'hold';
        }

        // Check for running job (only if not in hold or alarm)
        if (status.workflowState === 'running') {
            return 'running';
        }

        // Check homed state
        if (status.isHomed) {
            return 'connected_post_home';
        }

        return 'connected_pre_home';
    }

    /**
     * Update status for a port
     * Merges updates into existing status and recomputes derived fields
     */
    updateStatus(port, updates) {
        if (!port) {
            log.warn('updateStatus called without port');
            return undefined;
        }

        const currentStatus = this.getStatus(port);
        const previousMachineStatus = currentStatus.machineStatus;
        const previousIsHomed = currentStatus.isHomed;

        // Log state preservation checks
        if (updates.isHomed !== undefined && previousIsHomed !== updates.isHomed) {
            log.debug(`isHomed changing for ${port}: ${previousIsHomed} → ${updates.isHomed}`, {
                updates: Object.keys(updates),
                previousIsHomed,
                newIsHomed: updates.isHomed
            });
        }

        // Merge updates
        Object.assign(currentStatus, updates, {
            lastUpdate: Date.now()
        });

        // Recompute derived machineStatus
        const newMachineStatus = this.computeMachineStatus(currentStatus);
        currentStatus.machineStatus = newMachineStatus;

        // Store updated status
        this.statusByPort.set(port, currentStatus);

        // Emit change event if machineStatus changed
        if (previousMachineStatus !== newMachineStatus) {
            log.debug(`Status changed for ${port}: ${previousMachineStatus} → ${newMachineStatus}`, {
                isHomed: currentStatus.isHomed,
                activeState: currentStatus.controllerState?.activeState,
                workflowState: currentStatus.workflowState
            });
        }

        // Log if isHomed changed unexpectedly
        if (previousIsHomed !== currentStatus.isHomed && previousIsHomed === true && currentStatus.isHomed === false) {
            log.warn(`WARNING: isHomed reset from true to false for ${port}!`, {
                previousMachineStatus,
                newMachineStatus,
                activeState: currentStatus.controllerState?.activeState,
                updates: Object.keys(updates)
            });
        }

        // Emit status change event (for Socket.IO)
        this.emitStatusChange(port, currentStatus);

        return currentStatus;
    }

    /**
     * Emit status change to all connected sockets via Socket.IO
     */
    emitStatusChange(port, status) {
        // Emit to EventEmitter (for internal listeners)
        this.emit('status:change', port, status);

        // Emit via Socket.IO to all connected clients
        if (this.io) {
            this.io.emit('machine:status', port, status);
        }
    }

    /**
     * Handle serialport:open event
     * Preserves existing state (especially isHomed) if port is already connected
     */
    handleSerialPortOpen(port, options) {
        log.debug(`Serial port opened: ${port}`, options);

        const controllerType = options?.controllerType || null;

        // Get current status to preserve existing state
        const currentStatus = this.getStatus(port);
        const isAlreadyConnected = currentStatus.connected;
        const wasHomed = currentStatus.isHomed;

        // If already connected, preserve homed state (this happens when a new socket joins an existing connection)
        if (isAlreadyConnected) {
            log.debug(`Port ${port} already connected, preserving existing state (isHomed: ${wasHomed}, machineStatus: ${currentStatus.machineStatus})`);
            this.updateStatus(port, {
                connected: true,
                controllerType: controllerType || currentStatus.controllerType,
                // Preserve homed state and other flags when already connected
                isHomed: wasHomed, // CRITICAL: Preserve homed state
                isJobRunning: currentStatus.isJobRunning,
                homingInProgress: currentStatus.homingInProgress,
                // Preserve workflow state if available
                workflowState: currentStatus.workflowState,
                // Preserve controller state if available (or it will be updated by handleControllerState)
                controllerState: currentStatus.controllerState
            });
            log.debug(`Port ${port} state preserved: isHomed=${wasHomed}, machineStatus=${currentStatus.machineStatus}`);
        } else {
            // New connection - reset state
            log.debug(`Port ${port} new connection, resetting state`);
            this.updateStatus(port, {
                connected: true,
                controllerType: controllerType,
                isHomed: false, // Reset on new connection
                isJobRunning: false,
                homingInProgress: false
            });
        }
    }

    /**
     * Handle serialport:close event
     */
    handleSerialPortClose(port) {
        log.debug(`Serial port closed: ${port}`);

        this.updateStatus(port, {
            connected: false,
            controllerType: null,
            isHomed: false,
            isJobRunning: false,
            homingInProgress: false,
            controllerState: null,
            workflowState: null
        });
    }

    /**
     * Handle controller:state event
     * Detects alarm state, homing completion, and position updates
     * IMPORTANT: Preserves existing isHomed state unless we detect a transition
     */
    handleControllerState(port, controllerType, state) {
        if (!port || !state) {
            return;
        }

        const currentStatus = this.getStatus(port);
        const previousActiveState = currentStatus.controllerState?.activeState || '';
        const currentActiveState = state.status?.activeState || '';

        // CRITICAL: Preserve existing homed state (don't reset it unless we detect a transition)
        // Only update isHomed if we detect a clear transition or alarm
        let isHomed = currentStatus.isHomed;
        let homingInProgress = false;

        // Track homing completion: transition from "Home" to "Idle"
        if (previousActiveState === 'Home' && currentActiveState === 'Idle') {
            // Homing completed
            isHomed = true;
            log.debug(`Homing completed for ${port} (detected transition: Home → Idle)`);
        } else if (currentActiveState === 'Home') {
            // Currently homing
            homingInProgress = true;
            log.debug(`Homing in progress for ${port}`);
        }

        // Reset homed status on alarm (machine needs to be re-homed)
        if (currentActiveState === 'Alarm') {
            isHomed = false;
            log.debug(`Alarm detected for ${port}, resetting homed status`);
        }

        // Log state preservation
        if (isHomed === currentStatus.isHomed && currentStatus.isHomed) {
            log.debug(`Preserving homed state for ${port} (isHomed: ${isHomed}, activeState: ${currentActiveState})`);
        }

        // Update controller state
        this.updateStatus(port, {
            controllerType: controllerType,
            isHomed: isHomed, // Preserve existing homed state unless transition detected
            homingInProgress: homingInProgress,
            controllerState: {
                activeState: currentActiveState,
                mpos: state.status?.mpos || null,
                wpos: state.status?.wpos || null
            }
        });
    }

    /**
     * Handle workflow:state event
     * Tracks job running state
     */
    handleWorkflowState(port, workflowState) {
        if (!port) {
            return;
        }

        const isJobRunning = workflowState === 'running';

        this.updateStatus(port, {
            workflowState: workflowState,
            isJobRunning: isJobRunning
        });
    }

    /**
     * Handle reset command - reset homed state
     */
    handleReset(port) {
        if (!port) {
            return;
        }

        log.debug(`Reset command for ${port}, resetting homed status`);

        this.updateStatus(port, {
            isHomed: false,
            homingInProgress: false,
            isJobRunning: false,
            machineStatus: 'connected_pre_home' // Will be recomputed, but set explicitly for clarity
        });
    }

    /**
     * Handle unlock command - reset homed state (position may not be trusted)
     */
    handleUnlock(port) {
        if (!port) {
            return;
        }

        log.debug(`Unlock command for ${port}, resetting homed status`);

        this.updateStatus(port, {
            isHomed: false,
            homingInProgress: false,
            machineStatus: 'connected_pre_home' // Will be recomputed
        });
    }

    /**
     * Handle homing command - set homing in progress
     */
    handleHoming(port) {
        if (!port) {
            return;
        }

        log.debug(`Homing command for ${port}`);

        this.updateStatus(port, {
            homingInProgress: true
        });
    }

    /**
     * Remove status for a port (cleanup)
     */
    removeStatus(port) {
        if (port && this.statusByPort.has(port)) {
            this.statusByPort.delete(port);
            log.debug(`Removed status for ${port}`);
        }
    }

    /**
     * Get status summary for a port (for REST API)
     */
    getStatusSummary(port) {
        const status = this.getStatus(port);
        if (!status) {
            return null;
        }

        return {
            port: status.port,
            connected: status.connected,
            controllerType: status.controllerType,
            machineStatus: status.machineStatus,
            isHomed: status.isHomed,
            isJobRunning: status.isJobRunning,
            homingInProgress: status.homingInProgress,
            controllerState: status.controllerState,
            workflowState: status.workflowState,
            lastUpdate: status.lastUpdate
        };
    }
}

// Create singleton instance
const machineStatusManager = new MachineStatusManager();

export default machineStatusManager;
