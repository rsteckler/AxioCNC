/* eslint max-classes-per-file: 0 */
import events from 'events';

export const SP_TYPE_SEND_RESPONSE = 0;
export const SP_TYPE_CHAR_COUNTING = 1;

const noop = () => {};

class SPSendResponse {
    callback = null;

    constructor(options, callback = noop) {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      if (typeof callback === 'function') {
        this.callback = callback;
      }
    }

    process() {
      this.callback && this.callback(this);
    }

    clear() {
      // Do nothing
    }

    get type() {
      return SP_TYPE_SEND_RESPONSE;
    }
}

class SPCharCounting {
    callback = null;

    state = {
      bufferSize: 128, // Defaults to 128
      dataLength: 0,
      queue: [],
      line: ''
    };

    constructor(options, callback = noop) {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }

      // bufferSize
      const bufferSize = Number(options.bufferSize);
      if (bufferSize && bufferSize > 0) {
        this.state.bufferSize = bufferSize;
      }

      if (typeof callback === 'function') {
        this.callback = callback;
      }
    }

    process() {
      this.callback && this.callback(this);
    }

    reset() {
      this.state.bufferSize = 128; // Defaults to 128
      this.state.dataLength = 0;
      this.state.queue = [];
      this.state.line = '';
    }

    clear() {
      this.state.dataLength = 0;
      this.state.queue = [];
      this.state.line = '';
    }

    get type() {
      return SP_TYPE_CHAR_COUNTING;
    }

    get bufferSize() {
      return this.state.bufferSize;
    }

    set bufferSize(bufferSize = 0) {
      bufferSize = Number(bufferSize);
      if (!bufferSize) {
        return;
      }

      // The buffer size cannot be reduced below the size of the data within the buffer.
      this.state.bufferSize = Math.max(bufferSize, this.state.dataLength);
    }

    get dataLength() {
      return this.state.dataLength;
    }

    set dataLength(dataLength) {
      this.state.dataLength = dataLength;
    }

    get queue() {
      return this.state.queue;
    }

    set queue(queue) {
      this.state.queue = queue;
    }

    get line() {
      return this.state.line;
    }

    set line(line) {
      this.state.line = line;
    }
}

const uuid = require('uuid');
const parser = require('gcode-parser');

class Sender extends events.EventEmitter {
    // streaming protocol
    sp = null;

    state = {
      hold: false,
      holdReason: null,
      name: '',
      gcode: '',
      context: {},
      lines: [],
      total: 0,
      sent: 0,
      received: 0,
      startTime: 0,
      finishTime: 0,
      elapsedTime: 0,
      remainingTime: 0,
      m6Indices: [],
      nextM6Index: -1,
      remainingTimeToNextM6: 0,
      nextM6ToolNumber: -1,
      jobId: null,
      stats: {
        // Cumulative XYZ distances (calculated incrementally from G-code)
        totalDistance: { x: 0, y: 0, z: 0, total: 0 },
        cuttingDistance: { x: 0, y: 0, z: 0, total: 0 },
        transitionDistance: { x: 0, y: 0, z: 0, total: 0 },
        retractDistance: { x: 0, y: 0, z: 0, total: 0 },
        // Per-tool statistics
        toolStats: {}, // Map<toolNumber, { distance: {...}, time: 0 }>
        currentTool: null, // Active tool number (runtime), null = no tool loaded
        toolStartTime: 0, // When current tool started (runtime)
        // Position and modal state tracking for incremental distance calculation
        position: { x: 0, y: 0, z: 0 }, // Current position based on G-code
        modalState: {
          motion: 'G0', // G0, G1, G2, G3
          spindle: 'M5', // M3, M4, M5
          distance: 'G90', // G90 (absolute), G91 (relative)
          units: 'G21', // G20 (inches), G21 (mm)
          plane: 'G17', // G17 (XY plane), G18 (XZ plane), G19 (YZ plane)
        },
      }
    };

    stateChanged = false;

    dataFilter = null;

    // @param {number} [type] Streaming protocol type. 0 for send-response, 1 for character-counting.
    // @param {object} [options] The options object.
    // @param {number} [options.bufferSize] The buffer size used in character-counting streaming protocol. Defaults to 127.
    // @param {function} [options.dataFilter] A function to be used to handle the data. The function accepts two arguments: The data to be sent to the controller, and the context.
    constructor(type = SP_TYPE_SEND_RESPONSE, options = {}) {
      super();

      if (typeof options.dataFilter === 'function') {
        this.dataFilter = options.dataFilter;
      }

      // character-counting
      if (type === SP_TYPE_CHAR_COUNTING) {
        this.sp = new SPCharCounting(options, (sp) => {
          if (sp.queue.length > 0) {
            const lineLength = sp.queue.shift();
            sp.dataLength -= lineLength;
          }

          while (!this.state.hold && (this.state.sent < this.state.total)) {
            // Remove leading and trailing whitespace from both ends of a string
            sp.line = sp.line || this.state.lines[this.state.sent].trim();

            if (this.dataFilter) {
              sp.line = this.dataFilter(sp.line, this.state.context) || '';
            }

            // The newline character (\n) consumed the RX buffer space
            if ((sp.line.length > 0) && ((sp.dataLength + sp.line.length + 1) >= sp.bufferSize)) {
              break;
            }

            this.state.sent++;
            this.emit('change');

            if (sp.line.length === 0) {
              this.ack(); // ack empty line
              continue;
            }

            const line = sp.line + '\n';
            sp.line = '';
            sp.dataLength += line.length;
            sp.queue.push(line.length);
            this.emit('data', line, this.state.context);
          }
        });
      }

      // send-response
      if (type === SP_TYPE_SEND_RESPONSE) {
        this.sp = new SPSendResponse(options, (sp) => {
          while (!this.state.hold && (this.state.sent < this.state.total)) {
            // Remove leading and trailing whitespace from both ends of a string
            let line = this.state.lines[this.state.sent].trim();

            if (this.dataFilter) {
              line = this.dataFilter(line, this.state.context) || '';
            }

            this.state.sent++;
            this.emit('change');

            if (line.length === 0) {
              this.ack(); // ack empty line
              continue;
            }

            this.emit('data', line + '\n', this.state.context);
            break;
          }
        });
      }

      this.on('change', () => {
        this.stateChanged = true;
      });
    }

    toJSON() {
      // Calculate current tool's runtime time if job is running
      const stats = { ...this.state.stats };
      if (stats.currentTool !== null && stats.toolStartTime > 0 && this.state.startTime > 0) {
        const now = Date.now();
        const elapsedTime = now - stats.toolStartTime;
        if (stats.toolStats[stats.currentTool]) {
          stats.toolStats[stats.currentTool] = {
            ...stats.toolStats[stats.currentTool],
            time: stats.toolStats[stats.currentTool].time + elapsedTime
          };
        }
      }

      return {
        sp: this.sp.type,
        hold: this.state.hold,
        holdReason: this.state.holdReason,
        name: this.state.name,
        context: this.state.context,
        size: this.state.gcode.length,
        total: this.state.total,
        sent: this.state.sent,
        received: this.state.received,
        startTime: this.state.startTime,
        finishTime: this.state.finishTime,
        elapsedTime: this.state.elapsedTime,
        remainingTime: this.state.remainingTime,
        m6Indices: this.state.m6Indices.map(entry => entry.index), // Extract just the line numbers (indices)
        m6ToolNumbers: this.state.m6Indices.map(entry => entry.toolNumber).filter(tn => tn >= 0), // Extract tool numbers for tools in the job
        nextM6Index: this.state.nextM6Index,
        nextM6ToolNumber: this.state.nextM6ToolNumber,
        remainingTimeToNextM6: this.state.remainingTimeToNextM6,
        jobId: this.state.jobId,
        stats: stats
      };
    }

    hold(reason) {
      if (this.state.hold) {
        return;
      }
      this.state.hold = true;
      this.state.holdReason = reason;
      this.emit('hold');
      this.emit('change');
    }

    unhold() {
      if (!this.state.hold) {
        return;
      }
      this.state.hold = false;
      this.state.holdReason = null;
      this.emit('unhold');
      this.emit('change');
    }

    // @return {boolean} Returns true on success, false otherwise.
    load(name, gcode = '', context = {}) {
      if (typeof gcode !== 'string' || !gcode) {
        return false;
      }

      const lines = gcode.split('\n')
        .filter(line => (line.trim().length > 0));

      if (this.sp) {
        this.sp.clear();
      }
      this.state.hold = false;
      this.state.holdReason = null;
      this.state.name = name;
      this.state.gcode = gcode;
      this.state.context = context;
      this.state.lines = lines;
      this.state.total = this.state.lines.length;
      this.state.sent = 0;
      this.state.received = 0;
      this.state.startTime = 0;
      this.state.finishTime = 0;
      this.state.elapsedTime = 0;
      this.state.remainingTime = 0;

      // Reset stats
      this.resetStats();

      // Scan for M6 tool change commands and extract tool numbers
      const m6Pattern = /\bM0*6\b/i;
      const toolPattern = /\bT(\d+)\b/i;
      this.state.m6Indices = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Remove comments (everything after ;)
        const codePart = line.split(';')[0].trim();
        if (m6Pattern.test(codePart)) {
          // Try to find tool number on the same line
          let toolNumber = -1;
          const toolMatch = codePart.match(toolPattern);
          if (toolMatch) {
            toolNumber = parseInt(toolMatch[1], 10);
          } else if (i > 0) {
            // Check previous line for tool number
            const prevLine = lines[i - 1].split(';')[0].trim();
            const prevToolMatch = prevLine.match(toolPattern);
            if (prevToolMatch) {
              toolNumber = parseInt(prevToolMatch[1], 10);
            }
          }
          this.state.m6Indices.push({ index: i, toolNumber });
        }
      }
      this.state.nextM6Index = this.state.m6Indices.length > 0 ? this.state.m6Indices[0].index : -1;
      this.state.nextM6ToolNumber = this.state.m6Indices.length > 0 ? this.state.m6Indices[0].toolNumber : -1;
      this.state.remainingTimeToNextM6 = 0;

      // Generate new UUID for this job
      this.state.jobId = uuid.v4();

      // Initialize position and modal state
      this.state.stats.position = { x: 0, y: 0, z: 0 };
      this.state.stats.modalState = {
        motion: 'G0',
        spindle: 'M5',
        distance: 'G90',
        units: 'G21',
        plane: 'G17',
      };
      this.state.stats.currentTool = null; // No tool loaded initially

      this.emit('load', name, gcode, context);
      this.emit('change');

      return true;
    }

    unload() {
      if (this.sp) {
        this.sp.clear();
      }
      this.state.hold = false;
      this.state.holdReason = null;
      this.state.name = '';
      this.state.gcode = '';
      this.state.context = {};
      this.state.lines = [];
      this.state.total = 0;
      this.state.sent = 0;
      this.state.received = 0;
      this.state.startTime = 0;
      this.state.finishTime = 0;
      this.state.elapsedTime = 0;
      this.state.remainingTime = 0;
      this.state.m6Indices = [];
      this.state.nextM6Index = -1;
      this.state.nextM6ToolNumber = -1;
      this.state.remainingTimeToNextM6 = 0;
      this.state.jobId = null;

      // Reset stats
      this.resetStats();

      this.emit('unload');
      this.emit('change');
    }

    // Tells the sender an acknowledgement has received.
    // @return {boolean} Returns true on success, false otherwise.
    ack() {
      if (!this.state.gcode) {
        return false;
      }

      if (this.state.received >= this.state.sent) {
        return false;
      }

      // Process the line that was just acknowledged to calculate distance
      const lineIndex = this.state.received;
      if (lineIndex < this.state.lines.length) {
        this.processLineForDistance(this.state.lines[lineIndex], lineIndex);
      }

      this.state.received++;
      this.emit('change');

      return true;
    }

    // Tells the sender to send more data.
    // @return {boolean} Returns true on success, false otherwise.
    next() {
      if (!this.state.gcode) {
        return false;
      }

      const now = new Date().getTime();

      if (this.state.total > 0 && this.state.sent === 0) {
        this.state.startTime = now;
        this.state.finishTime = 0;
        this.state.elapsedTime = 0;
        this.state.remainingTime = 0;
        this.state.nextM6Index = this.state.m6Indices.length > 0 ? this.state.m6Indices[0].index : -1;
        this.state.nextM6ToolNumber = this.state.m6Indices.length > 0 ? this.state.m6Indices[0].toolNumber : -1;
        this.state.remainingTimeToNextM6 = 0;
        this.emit('start', this.state.startTime);
        this.emit('change');
      }

      if (this.sp) {
        this.sp.process();
      }

      // Elapsed Time
      this.state.elapsedTime = now - this.state.startTime;

      // Make a 1 second delay before estimating the remaining time
      if (this.state.elapsedTime >= 1000 && this.state.received > 0) {
        const timePerCode = this.state.elapsedTime / this.state.received;
        this.state.remainingTime = (timePerCode * this.state.total - this.state.elapsedTime);

        // Update next M6 index and calculate remaining time to next M6
        this.state.nextM6Index = -1;
        this.state.nextM6ToolNumber = -1;
        this.state.remainingTimeToNextM6 = 0;
        for (let i = 0; i < this.state.m6Indices.length; i++) {
          const m6Entry = this.state.m6Indices[i];
          if (m6Entry.index >= this.state.received) {
            this.state.nextM6Index = m6Entry.index;
            this.state.nextM6ToolNumber = m6Entry.toolNumber;
            const remainingLines = m6Entry.index - this.state.received;
            this.state.remainingTimeToNextM6 = timePerCode * remainingLines;
            break;
          }
        }
      }

      if (this.state.received >= this.state.total) {
        if (this.state.finishTime === 0) {
          // avoid issue 'end' multiple times
          this.state.finishTime = now;
          this.emit('end', this.state.finishTime);
          this.emit('change');
        }
      }

      return true;
    }

    // Rewinds the internal array pointer.
    // @return {boolean} Returns true on success, false otherwise.
    rewind() {
      if (!this.state.gcode) {
        return false;
      }

      if (this.sp) {
        this.sp.clear();
      }
      this.state.hold = false; // clear hold off state
      this.state.holdReason = null;
      this.state.sent = 0;
      this.state.received = 0;
      this.state.nextM6Index = this.state.m6Indices.length > 0 ? this.state.m6Indices[0].index : -1;
      this.state.nextM6ToolNumber = this.state.m6Indices.length > 0 ? this.state.m6Indices[0].toolNumber : -1;
      this.state.remainingTimeToNextM6 = 0;

      // Reset position and modal state when rewinding (job restart)
      this.state.stats.position = { x: 0, y: 0, z: 0 };
      this.state.stats.modalState = {
        motion: 'G0',
        spindle: 'M5',
        distance: 'G90',
        units: 'G21',
      };

      this.emit('change');

      return true;
    }

    // Checks if there are any state changes. It also clears the stateChanged flag.
    // @return {boolean} Returns true on state changes, false otherwise.
    peek() {
      const stateChanged = this.stateChanged;
      this.stateChanged = false;
      return stateChanged;
    }

    // Reset stats to initial state
    resetStats() {
      this.state.stats = {
        totalDistance: { x: 0, y: 0, z: 0, total: 0 },
        cuttingDistance: { x: 0, y: 0, z: 0, total: 0 },
        transitionDistance: { x: 0, y: 0, z: 0, total: 0 },
        retractDistance: { x: 0, y: 0, z: 0, total: 0 },
        toolStats: {},
        currentTool: null, // null = no tool loaded, will be set on first M6
        toolStartTime: 0,
        position: { x: 0, y: 0, z: 0 },
        modalState: {
          motion: 'G0',
          spindle: 'M5',
          distance: 'G90',
          units: 'G21',
          plane: 'G17',
        },
      };
    }

    // Constants for numerical calculations
    static EPSILON = 0.0001; // Minimum radius/magnitude to avoid numerical errors
    static INTEGRATION_STEP_RADIANS = Math.PI / 20; // ~9 degrees per sample
    static MIN_INTEGRATION_SAMPLES = 20;

    // Tool tracking constants
    static NO_TOOL = 0; // Tool 0 means "no tool loaded"

    // Helper: Check if a tool number is valid (not null, undefined, or 0)
    static isValidTool(toolNumber) {
      return toolNumber !== null && toolNumber !== undefined && toolNumber !== Sender.NO_TOOL;
    }

    // Calculate distance between two points (straight line / chord distance)
    calculateDistance(p1, p2) {
      const dx = Math.abs((p1.x || 0) - (p2.x || 0));
      const dy = Math.abs((p1.y || 0) - (p2.y || 0));
      const dz = Math.abs((p1.z || 0) - (p2.z || 0));
      const total = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return { x: dx, y: dy, z: dz, total };
    }

    // Calculate arc length for G2/G3 arc commands
    // start: start point {x, y, z}
    // end: end point {x, y, z}
    // ijk: arc center offset {i, j, k} relative to start point
    // plane: 'G17' (XY), 'G18' (XZ), 'G19' (YZ)
    // direction: 'G2' (clockwise), 'G3' (counter-clockwise)
    calculateArcLength(start, end, ijk, plane = 'G17', direction = 'G3') {
      // Calculate arc center (relative to start point)
      const center = {
        x: (start.x || 0) + (ijk.i || 0),
        y: (start.y || 0) + (ijk.j || 0),
        z: (start.z || 0) + (ijk.k || 0),
      };

      // Determine which plane we're working in
      let axis3;
      let dxStart, dyStart, dzStart, dxEnd, dyEnd, dzEnd;

      // Calculate vectors from center to start and end points
      dxStart = (start.x || 0) - center.x;
      dyStart = (start.y || 0) - center.y;
      dzStart = (start.z || 0) - center.z;
      dxEnd = (end.x || 0) - center.x;
      dyEnd = (end.y || 0) - center.y;
      dzEnd = (end.z || 0) - center.z;

      // Calculate radius in the plane (only use the two axes of the plane)
      let radius, v1, v2;

      if (plane === 'G18') {
        // XZ plane - radius is in XZ plane
        v1 = { x: dxStart, y: dzStart };
        v2 = { x: dxEnd, y: dzEnd };
        axis3 = 'y';
        radius = Math.sqrt(dxStart * dxStart + dzStart * dzStart);
      } else if (plane === 'G19') {
        // YZ plane - radius is in YZ plane
        v1 = { x: dyStart, y: dzStart };
        v2 = { x: dyEnd, y: dzEnd };
        axis3 = 'x';
        radius = Math.sqrt(dyStart * dyStart + dzStart * dzStart);
      } else {
        // G17 - XY plane (default) - radius is in XY plane
        v1 = { x: dxStart, y: dyStart };
        v2 = { x: dxEnd, y: dyEnd };
        axis3 = 'z';
        radius = Math.sqrt(dxStart * dxStart + dyStart * dyStart);
      }

      if (radius < Sender.EPSILON) {
        // Zero radius, fall back to straight line distance
        return this.calculateDistance(start, end);
      }

      // Calculate angle between vectors (using dot product)
      const dot = v1.x * v2.x + v1.y * v2.y;
      const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

      // Avoid division by zero
      if (mag1 < Sender.EPSILON || mag2 < Sender.EPSILON) {
        return this.calculateDistance(start, end);
      }

      let cosAngle = dot / (mag1 * mag2);
      // Clamp to [-1, 1] to avoid NaN from Math.acos
      cosAngle = Math.max(-1, Math.min(1, cosAngle));

      // Calculate signed angle using cross product for direction
      const cross = v1.x * v2.y - v1.y * v2.x;
      let angle = Math.acos(cosAngle);

      // Determine direction: G2 (clockwise) has negative cross product, G3 (counter-clockwise) has positive
      // But we need to handle full circles and ensure we get the correct arc length
      if (direction === 'G2') {
        // Clockwise: if cross is positive, we need to go the long way, so subtract from 2π
        if (cross > 0) {
          angle = 2 * Math.PI - angle;
        }
        // If cross is negative or zero, angle is already correct (or is 0/180)
      } else if (cross < 0) {
        // G3 counter-clockwise: if cross is negative, go the long way
        angle = 2 * Math.PI - angle;
      }

      // Calculate arc length
      const arcLength = radius * angle;

      // For linear motion along the third axis (if any), add that distance
      const linearAxis3 = Math.abs((end[axis3] || 0) - (start[axis3] || 0));

      // Total distance is the arc length in the plane plus any linear motion
      const total = Math.sqrt(arcLength * arcLength + linearAxis3 * linearAxis3);

      // Calculate component distances based on the actual arc path traveled
      // For a circular arc: x(θ) = center_x + radius * cos(θ), y(θ) = center_y + radius * sin(θ)
      // The path length along each axis requires integrating |dx/dθ| or |dy/dθ| over the angle
      // dx/dθ = -radius * sin(θ), so path along X = ∫|dx/dθ| dθ = radius * ∫|sin(θ)| dθ
      // dy/dθ = radius * cos(θ), so path along Y = ∫|dy/dθ| dθ = radius * ∫|cos(θ)| dθ

      const angle1Start = Math.atan2(v1.y, v1.x);
      const angle1End = Math.atan2(v2.y, v2.x);

      // Normalize angles for calculation
      let angleStart = angle1Start;
      let angleEnd = angle1End;

      // Adjust for direction (we already calculated the actual angle above, but need angles for integration)
      // The integration needs to match the actual arc path traveled
      if (direction === 'G2' && cross > Sender.EPSILON) {
        // Going long way clockwise
        if (angleEnd > angleStart) {
          angleEnd -= 2 * Math.PI;
        }
      } else if (direction === 'G3' && cross < -Sender.EPSILON) {
        // Going long way counter-clockwise
        if (angleEnd < angleStart) {
          angleEnd += 2 * Math.PI;
        }
      }

      // Calculate axis distances using numerical integration of |sin(θ)| and |cos(θ)|
      // For a circular arc:
      // - axis1 (X): dx/dθ = -radius * sin(θ), so path length = radius * ∫|sin(θ)| dθ
      // - axis2 (Y): dy/dθ = radius * cos(θ), so path length = radius * ∫|cos(θ)| dθ
      // We integrate from angleStart to angleEnd to get the actual path traveled along each axis
      // Use the same angle range that matches the calculated arc length
      const integrationAngle = Math.abs(angleEnd - angleStart);
      const numSamples = Math.max(Sender.MIN_INTEGRATION_SAMPLES, Math.ceil(integrationAngle / Sender.INTEGRATION_STEP_RADIANS));
      let axis1PathSum = 0;
      let axis2PathSum = 0;

      const dTheta = Math.abs(angleEnd - angleStart) / numSamples;

      for (let i = 0; i < numSamples; i++) {
        const theta = angleStart + i * dTheta;

        // For axis1 (X): integrate |sin(θ)| - this gives the path length along X
        // For axis2 (Y): integrate |cos(θ)| - this gives the path length along Y
        axis1PathSum += Math.abs(Math.sin(theta)) * dTheta;
        axis2PathSum += Math.abs(Math.cos(theta)) * dTheta;
      }

      // Scale by radius to get actual path distances
      // These represent the actual path length traveled along each axis
      // For orthogonal path components, they don't sum to arcLength (they're independent)
      // axis1ArcDist = radius * ∫|sin(θ)| dθ from start to end
      // axis2ArcDist = radius * ∫|cos(θ)| dθ from start to end
      let axis1ArcDist = radius * axis1PathSum;
      let axis2ArcDist = radius * axis2PathSum;

      // These are the actual path distances along each axis - no normalization needed
      // For example, a semicircle from 0 to π:
      // - ∫|sin(θ)| dθ from 0 to π = 2 (goes from 0 to 1 and back to 0)
      // - ∫|cos(θ)| dθ from 0 to π = 2 (goes from 1 to -1, absolute value)
      // So axis1Dist = radius * 2, axis2Dist = radius * 2, arcLength = radius * π
      // They don't sum directly because they're orthogonal components

      // Declare variables for final distances
      let xDist, yDist, zDist;

      // Assign to x, y, z based on plane
      if (plane === 'G18') {
        // XZ plane
        xDist = axis1ArcDist;
        yDist = linearAxis3; // Y is the third axis
        zDist = axis2ArcDist;
      } else if (plane === 'G19') {
        // YZ plane
        xDist = linearAxis3; // X is the third axis
        yDist = axis1ArcDist;
        zDist = axis2ArcDist;
      } else {
        // G17 - XY plane (default)
        xDist = axis1ArcDist;
        yDist = axis2ArcDist;
        zDist = linearAxis3; // Z is the third axis
      }

      return { x: xDist, y: yDist, z: zDist, total };
    }

    // Add distance to stats
    addDistance(stats, distance) {
      stats.x += distance.x;
      stats.y += distance.y;
      stats.z += distance.z;
      stats.total += distance.total;
    }

    // Parse a G-code word into its components
    // Returns { letter, numericPart, value, isValid } or null if invalid
    parseGcodeWord(word) {
      if (typeof word !== 'string' || word.length === 0) {
        return null;
      }
      const letter = word[0].toUpperCase();
      const numericPart = word.substring(1);
      const value = parseFloat(numericPart);
      return {
        letter,
        numericPart,
        value,
        isValid: !Number.isNaN(value),
      };
    }

    // Process a single G-code line and calculate distance incrementally
    processLineForDistance(line, lineIndex) {
      if (!line || typeof line !== 'string') {
        return;
      }

      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith(';')) {
        return;
      }

      // Remove comments (everything after ;)
      const codePart = trimmedLine.split(';')[0].trim();
      if (!codePart) {
        return;
      }

      try {
        const data = parser.parseLine(codePart, { flatten: true });
        const words = Array.isArray(data.words) ? data.words : [];

        // Store previous position reference (only copy if position changes)
        const previousPositionRef = this.state.stats.position;
        let previousPosition = null; // Will be copied only if needed
        let positionChanged = false;
        let toolChangeDetected = false;
        let newToolNumber; // Only set if T command is found on this line

        // Process all words to update modal state and extract coordinates
        for (const word of words) {
          const parsed = this.parseGcodeWord(word);
          if (!parsed) {
            continue;
          }

          const { letter, value } = parsed;

          if (letter === 'G') {
            // G-code values are parsed from string like "G17" -> 17
            if (parsed.isValid) {
              if (value === 0 || value === 0.0) {
                this.state.stats.modalState.motion = 'G0';
              } else if (value === 1 || value === 1.0) {
                this.state.stats.modalState.motion = 'G1';
              } else if (value === 2 || value === 2.0) {
                this.state.stats.modalState.motion = 'G2';
              } else if (value === 3 || value === 3.0) {
                this.state.stats.modalState.motion = 'G3';
              } else if (value === 90 || value === 90.1) {
                this.state.stats.modalState.distance = 'G90';
              } else if (value === 91 || value === 91.1) {
                this.state.stats.modalState.distance = 'G91';
              } else if (value === 20 || value === 20.0) {
                this.state.stats.modalState.units = 'G20';
              } else if (value === 21 || value === 21.0) {
                this.state.stats.modalState.units = 'G21';
              } else if (value === 17 || value === 17.0) {
                this.state.stats.modalState.plane = 'G17';
              } else if (value === 18 || value === 18.0) {
                this.state.stats.modalState.plane = 'G18';
              } else if (value === 19 || value === 19.0) {
                this.state.stats.modalState.plane = 'G19';
              } else if (value === 28 || value === 30) {
                // Homing - reset position
                this.state.stats.position = { x: 0, y: 0, z: 0 };
                positionChanged = true;
              } else if (value === 92 || value === 92.0) {
                // Coordinate system offset - handled by coordinates below
              }
            }
          } else if (letter === 'M') {
            // M-code values are parsed from string like "M3" -> 3
            if (parsed.isValid) {
              if (value === 3 || value === 3.0) {
                this.state.stats.modalState.spindle = 'M3';
              } else if (value === 4 || value === 4.0) {
                this.state.stats.modalState.spindle = 'M4';
              } else if (value === 5 || value === 5.0) {
                this.state.stats.modalState.spindle = 'M5';
              } else if (value === 6 || value === 6.0) {
                toolChangeDetected = true;
              }
            }
          } else if (letter === 'T') {
            // Tool selection - word is like "T4"
            if (parsed.isValid) {
              newToolNumber = Math.floor(value);
            }
          }
          // Note: X, Y, Z coordinates are processed in the motion command section below
        }

        // Handle tool change - only when M6 is detected (actual tool change)
        // T command alone just selects a tool but doesn't change it until M6
        if (toolChangeDetected && newToolNumber !== undefined) {
          // M6 detected with a tool number - this is the actual tool change
          if (newToolNumber !== this.state.stats.currentTool) {
            // Track tool change for time tracking
            if (this.state.startTime > 0) {
              this.trackToolChange(newToolNumber);
            } else {
              // Job not started yet - just set the tool number (will be tracked when job starts)
              this.state.stats.currentTool = newToolNumber;
              this.ensureToolStats(newToolNumber);
            }
          }
        }

        // Process coordinates for motion commands (G0, G1, G2, G3)
        // Modal state persists across lines, so a line without explicit G command
        // still uses the previously established motion mode (e.g., G3 arc commands)
        const motion = this.state.stats.modalState.motion;
        const isMotionCommand = ['G0', 'G00', 'G1', 'G01', 'G2', 'G02', 'G3', 'G03'].includes(motion);

        // Check if this line has any coordinates (X, Y, Z, I, J, K, R, etc.)
        // If it has coordinates and we're in a motion mode, it's a motion command
        const hasCoordinates = words.some(word => {
          const letter = word[0];
          return ['X', 'Y', 'Z', 'I', 'J', 'K', 'R', 'U', 'V', 'W'].includes(letter);
        });

        // Process if: 1) we're in a motion command mode AND 2) line has coordinates
        // This handles cases like "X-1.587 Z-0.166 I-1.587 J0" where G3 is held from previous line
        if (isMotionCommand && hasCoordinates) {
          // Extract coordinates and arc parameters
          const arcParams = { i: 0, j: 0, k: 0 };
          let hasArcParams = false;

          // Map coordinate letters to position axes
          const axisMap = { 'X': 'x', 'Y': 'y', 'Z': 'z' };

          for (const word of words) {
            const parsed = this.parseGcodeWord(word);
            if (!parsed || !parsed.isValid) {
              continue;
            }

            const { letter: coordLetter, value: coordValue } = parsed;

            // Update position for X, Y, Z coordinates
            if (axisMap[coordLetter]) {
              const axis = axisMap[coordLetter];
              if (this.state.stats.modalState.distance === 'G90') {
                this.state.stats.position[axis] = coordValue;
              } else {
                this.state.stats.position[axis] += coordValue;
              }
              positionChanged = true;
              // Copy previous position only when we know position will change
              if (previousPosition === null) {
                previousPosition = { ...previousPositionRef };
              }
            } else if (coordLetter === 'I') {
              arcParams.i = coordValue;
              hasArcParams = true;
            } else if (coordLetter === 'J') {
              arcParams.j = coordValue;
              hasArcParams = true;
            } else if (coordLetter === 'K') {
              arcParams.k = coordValue;
              hasArcParams = true;
            }
            // Note: R (arc radius) is supported in G-code but we use I/J/K for center-based arcs
          }

          // If position changed but we didn't copy it yet (shouldn't happen, but safety check)
          if (positionChanged && previousPosition === null) {
            previousPosition = { ...previousPositionRef };
          }

          // Calculate distance if position changed
          if (positionChanged && previousPosition !== null) {
            let distance;

            // For arc commands (G2/G3), calculate actual arc length
            // For linear/rapid commands (G0/G1), use straight-line distance
            if ((motion === 'G2' || motion === 'G3') && hasArcParams) {
              // Get plane (default to G17 = XY plane)
              const plane = this.state.stats.modalState.plane || 'G17';
              distance = this.calculateArcLength(
                previousPosition,
                this.state.stats.position,
                arcParams,
                plane,
                motion
              );
            } else {
              // Straight line distance for G0/G1
              distance = this.calculateDistance(previousPosition, this.state.stats.position);
            }

            const isRetract = this.state.stats.position.z > previousPosition.z;
            const modalState = this.state.stats.modalState;
            const isCutting = (modalState.motion === 'G1' ||
                              modalState.motion === 'G2' ||
                              modalState.motion === 'G3') &&
                              (modalState.spindle === 'M3' || modalState.spindle === 'M4');
            const isTransition = modalState.motion === 'G0' || !isCutting;

            // Add to total distance
            this.addDistance(this.state.stats.totalDistance, distance);

            // Add to appropriate category
            if (isCutting) {
              this.addDistance(this.state.stats.cuttingDistance, distance);
            }
            if (isTransition) {
              this.addDistance(this.state.stats.transitionDistance, distance);
            }
            if (isRetract) {
              this.addDistance(this.state.stats.retractDistance, distance);
            }

            // Add to current tool stats (only if a tool is loaded)
            const currentTool = this.state.stats.currentTool;
            if (currentTool !== null && currentTool !== undefined) {
              this.ensureToolStats(currentTool);
              this.addDistance(this.state.stats.toolStats[currentTool].distance, distance);
            }
          }
        }
      } catch (err) {
        // Skip malformed lines, continue processing
        return;
      }
    }

    // Helper: Ensure tool stats exist for a given tool number
    ensureToolStats(toolNumber) {
      if (!this.state.stats.toolStats[toolNumber]) {
        this.state.stats.toolStats[toolNumber] = {
          toolNumber: toolNumber,
          distance: { x: 0, y: 0, z: 0, total: 0 },
          time: 0,
        };
      }
    }

    // Track tool change during runtime
    trackToolChange(toolNumber) {
      // Validate tool number
      if (!Sender.isValidTool(toolNumber)) {
        // Invalid tool number - log warning but don't throw to avoid breaking job
        return;
      }

      const now = Date.now();
      const currentTool = this.state.stats.currentTool;
      const toolStartTime = this.state.stats.toolStartTime;

      // Update previous tool's time if it was running
      if (currentTool !== null && toolStartTime > 0) {
        const elapsedTime = now - toolStartTime;
        this.ensureToolStats(currentTool);
        this.state.stats.toolStats[currentTool].time += elapsedTime;
      }

      // Start new tool
      this.state.stats.currentTool = toolNumber;
      this.state.stats.toolStartTime = now;
      this.ensureToolStats(toolNumber);

      this.emit('change');
    }

    // Update current tool's elapsed time
    updateToolTime() {
      const currentTool = this.state.stats.currentTool;
      const toolStartTime = this.state.stats.toolStartTime;

      if (currentTool !== null && toolStartTime > 0) {
        this.ensureToolStats(currentTool);
        // Time is calculated on-demand in toJSON() when stats are serialized
        // This method ensures the tool stats object exists for the current tool
        this.emit('change');
      }
    }
}

export default Sender;
