import { Vector3 } from 'three'

declare module 'gcode-toolpath' {
  interface ToolpathOptions {
    // Add options as needed
    [key: string]: unknown
  }

  interface LineSegment {
    // Line segment properties
    [key: string]: unknown
  }

  interface ArcSegment {
    // Arc segment properties
    [key: string]: unknown
  }

  class Toolpath {
    constructor(options?: ToolpathOptions)
    
    /**
     * Load G-code and parse into segments
     */
    loadFromString(gcode: string): void
    
    /**
     * Get all segments (lines and arcs)
     */
    getSegments(): Array<LineSegment | ArcSegment>
    
    /**
     * Get motion type for a segment
     */
    getMotionType(segment: LineSegment | ArcSegment): string | undefined
    
    // Add other methods as needed
    [key: string]: unknown
  }

  export default Toolpath
}
