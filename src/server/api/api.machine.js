import { ensureString } from 'ensure-type';
import logger from '../lib/logger';
import machineStatusManager from '../services/machinestatus/MachineStatusManager';
import {
  ERR_BAD_REQUEST
} from '../constants';

const log = logger('api:machine');

/**
 * GET /api/machine/status
 * 
 * Query machine status for a specific port or all ports
 * 
 * Query params:
 * - port (optional): Specific port to query. If not provided, returns all statuses
 * 
 * Response:
 * {
 *   "status": { ... }  // Single port status
 * }
 * or
 * {
 *   "statuses": { ... }  // All port statuses (map of port -> status)
 * }
 */
export const getStatus = (req, res) => {
  const port = ensureString(req.query.port || req.body.port || '');

  try {
    if (port) {
      // Return status for specific port
      const status = machineStatusManager.getStatusSummary(port);

      if (!status) {
        log.warn(`Status not found for port: ${port}`);
        return res.status(404).send({
          msg: `Machine status not found for port: ${port}`
        });
      }

      return res.send({
        status: status
      });
    } else {
      // Return all statuses
      const allStatuses = machineStatusManager.getAllStatuses();
      const statuses = {};

      // Convert to summary format
      Object.keys(allStatuses).forEach(p => {
        statuses[p] = machineStatusManager.getStatusSummary(p);
      });

      return res.send({
        statuses: statuses
      });
    }
  } catch (err) {
    log.error(`Error getting machine status: ${err}`);
    return res.status(500).send({
      msg: 'Failed to get machine status',
      err: err.message
    });
  }
};
