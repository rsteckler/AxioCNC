# Outline Button Implementation Plan

## Overview
Implement an "Outline" button on the Setup page's FilePanel that processes the currently loaded G-code file, calculates its top-profile (convex hull of XY positions), and sends the tool around that path to visually indicate the toolpath boundaries.

## Goals
- Extract all XY positions from the G-code toolpath
- Calculate the convex hull (top-profile outline) of these positions
- Generate a path that traces the outline
- Send the tool along this path using G-code commands
- Provide visual feedback during execution
- Ensure safety (appropriate Z height, feed rate, etc.)

## Implementation Steps

### 1. Create G-code Outline Processing Utility
**File**: `apps/web/src/lib/gcodeOutline.ts`

**Purpose**: Extract XY positions from G-code, calculate convex hull, and generate outline path

**Functions**:
- `extractXYPositions(gcode: string): Point2D[]`
  - Use existing `processGCode()` function from `gcodeVisualizer.ts`
  - Extract all XY positions from the toolpath (project to XY plane, ignore Z)
  - Remove duplicates and return unique points
  - Return array of `{ x: number, y: number }` points

- `calculateConcaveHull(points: Point2D[], options?: { concavity?: number }): Point2D[]`
  - Use `concaveman` library to calculate concave hull (outer boundary with indentations)
  - Takes array of XY points
  - Returns ordered array of hull points forming a closed polygon
  - `concavity` parameter: Controls detail level (1 = detailed, Infinity = convex hull, default: 2)
  - Handles outer boundary indentations while ignoring inner holes/cutouts
  - Handle edge cases: < 3 points, collinear points, etc.

- `generateOutlinePath(hullPoints: Point2D[], options: OutlineOptions): string[]`
  - Generate array of G-code commands to trace the concave hull outline
  - Options:
    - `zHeight`: Z height for outline (default: current Z or safe height)
    - `feedRate`: Feed rate for outline moves (default: 500 mm/min)
    - `margin`: Margin around hull (default: 2mm) - offset hull outward
    - `closePath`: Whether to close the path (default: true)
  - Path order: 
    1. Save current position
    2. Lift Z to safe height
    3. Rapid move to first hull point
    4. Lower Z to outline height
    5. Trace hull points with G1 (feed moves)
    6. Close path (return to first point if closePath=true)
    7. Lift Z to safe height
    8. Return to original position (optional)

**Type Definitions**:
```typescript
interface Point2D {
  x: number
  y: number
}

interface OutlineOptions {
  zHeight?: number
  feedRate?: number
  margin?: number
  closePath?: boolean
  returnToStart?: boolean
  concavity?: number // Concave hull detail level (1 = detailed, Infinity = convex, default: 2)
}

interface OutlineResult {
  hullPoints: Point2D[]
  commands: string[]
  bounds: {
    min: Point2D
    max: Point2D
  }
}
```

**Algorithm Choice**:
- **Concaveman Library**: Fast O(n log n) concave hull algorithm
  - Handles outer boundary indentations (concave areas)
  - Ignores inner holes/cutouts (only traces outer boundary)
  - Configurable concavity level for detail control
  - Well-maintained by Mapbox, TypeScript support available

**Concave Hull Algorithm Details (Concaveman)**:
- Based on "A New Concave Hull Algorithm and Concaveness Measure" (Park & Oh, 2012)
- Uses k-nearest points with R-tree indexing for performance
- `concavity` parameter controls detail:
  - `1`: Very detailed, follows indentations closely
  - `2`: Balanced (good default)
  - `5-10`: Less detailed, smoother outline
  - `Infinity`: Convex hull (no indentations)
- Returns ordered polygon points (closed loop)

**Edge Cases**:
- < 3 points: Return error (need at least 3 for a polygon)
- Collinear points: Handled gracefully by algorithm
- Duplicate points: Should be filtered out before processing
- Very sparse points: May need higher concavity value

### 2. Update FilePanel Component
**File**: `apps/web/src/routes/Setup/panels/FilePanel.tsx`

**Changes**:
1. Import new utility and hooks:
   - `extractXYPositions`, `calculateConcaveHull`, `generateOutlinePath` from `@/lib/gcodeOutline`
   - `useGetGcodeQuery` (already imported)
   - `useGcodeCommand` hook (already available via props or import)

2. Add state:
   - `isOutlining: boolean` - Track if outline is in progress
   - `outlineError: string | null` - Store any errors

3. Implement `handleOutline` callback:
   - Check if G-code is loaded (use `useGetGcodeQuery` or `loadedFileName`)
   - Fetch G-code content if needed (use `useLazyGetWorkfileContentQuery` if not in query result)
   - Extract XY positions using `extractXYPositions()`
   - Validate we have enough points (need at least 3 for a hull)
   - Calculate concave hull using `calculateConcaveHull()` with configurable concavity
   - Get current machine position (from props or Redux state)
   - Generate outline path with appropriate options
   - Send G-code commands sequentially (wait for completion or use queue)
   - Handle errors gracefully

4. Update Outline button:
   - Enable button when G-code is loaded
   - Show loading state during execution
   - Disable during execution to prevent multiple runs
   - Display error message if outline fails

**Button States**:
- Disabled: No G-code loaded
- Enabled: G-code loaded, ready to run
- Loading: Outline in progress
- Error: Show error message

### 3. G-code Command Execution Strategy

**Option A: Sequential Command Queue** (Recommended)
- Send commands one at a time
- Wait for acknowledgment or completion before sending next
- Use socket events or polling to detect completion
- More reliable, but slower

**Option B: Batch Command** (If supported)
- Send all commands as a batch
- Backend queues them
- Faster, but requires backend support

**Implementation**:
- Use `sendGcode()` from `useGcodeCommand` hook
- For sequential: Send command → Wait for completion → Send next
- Consider using a command queue utility if one exists
- Add delays between commands if needed (e.g., 100ms)

### 4. Safety Considerations

**Z Height Management**:
- Get current Z position before starting
- Lift to safe height (e.g., current Z + 5mm or absolute 10mm)
- Trace outline at safe height above work
- Return to original Z position after completion

**Feed Rate**:
- Use moderate feed rate (default: 500 mm/min)
- Allow user configuration in settings (future enhancement)
- Use G0 (rapid) for Z movements
- Use G1 (feed) for outline tracing

**Error Handling**:
- Validate G-code exists and is valid
- Check if machine is connected and ready
- Verify bounds are within machine limits
- Handle machine errors (alarm, emergency stop)
- Provide clear error messages to user

**Machine State Checks**:
- Only allow outline when machine is idle
- Prevent during job execution
- Check for alarms before starting
- Respect machine status requirements

### 5. User Experience Enhancements

**Visual Feedback**:
- Show progress indicator during execution
- Display outline dimensions in tooltip or info text
- Highlight outline path in visualizer (future enhancement)

**Notifications**:
- Success notification when outline completes
- Error notification if outline fails
- Warning if bounds are very large

**Settings Integration** (Future):
- Configurable outline feed rate
- Configurable Z height offset
- Configurable margin around bounds
- Option to show outline in visualizer

### 6. Testing Considerations

**Test Cases**:
1. Empty G-code file → Should show error
2. G-code with no XY movement → Should show error (need at least 3 XY points)
3. G-code with valid toolpath → Should calculate hull and trace outline
4. G-code with only 1-2 XY points → Should show error (need 3+ for hull)
5. Collinear points → Should handle gracefully (degenerate hull)
6. Very large hull → Should warn or prevent if outside machine limits
7. Machine not connected → Should flash status or show error
8. Machine in alarm → Should prevent execution
9. Job running → Should prevent execution
10. Multiple rapid clicks → Should prevent duplicate execution
11. Complex shapes (concave areas) → Should trace indentations accurately (concave hull)
12. Shapes with inner holes → Should ignore holes, only trace outer boundary

**Edge Cases**:
- Single point toolpath (no movement) → Error
- Toolpath with only Z movement → Error (no XY points)
- Toolpath with only 2 XY points → Error (need 3+ for hull)
- All points collinear → Degenerate hull (line segment)
- Toolpath with arcs → Should work (extracted points include arc segments)
- Toolpath spanning multiple work coordinate systems → Should work (uses absolute positions)
- Very small hull (< 1mm) → Should still work but may be hard to see
- Concave shapes → Concave hull traces indentations accurately
- Shapes with inner holes → Holes are ignored, only outer boundary traced

## File Structure

```
apps/web/src/
├── lib/
│   └── gcodeOutline.ts          # NEW: Outline calculation and path generation
└── routes/Setup/panels/
    └── FilePanel.tsx            # MODIFY: Add outline button handler
```

## Dependencies

**Existing**:
- `processGCode()` from `@/lib/gcodeVisualizer` - Already processes G-code and provides positions
- `useGcodeCommand` hook - Already provides `sendGcode()` function
- `useGetGcodeQuery` - Already provides loaded G-code data

**New**:
- `concaveman` - Concave hull algorithm library (npm package)
- `@types/concaveman` - TypeScript definitions (dev dependency)

## Implementation Order

1. **Phase 1**: Install dependencies and create `gcodeOutline.ts` utility
   - Install `concaveman` and `@types/concaveman` packages
   - Implement `extractXYPositions()` - extract points from G-code
   - Implement `calculateConcaveHull()` - wrapper around concaveman
   - Implement `generateOutlinePath()` - generate G-code commands
   - Add unit tests if possible

2. **Phase 2**: Update FilePanel
   - Add outline handler
   - Enable/update Outline button
   - Add state management
   - Add error handling

3. **Phase 3**: Testing and refinement
   - Test with various G-code files
   - Handle edge cases
   - Improve error messages
   - Add user feedback

4. **Phase 4** (Future): Enhancements
   - Visual outline in visualizer
   - Settings configuration
   - Corner radius support
   - Progress tracking

## Questions to Resolve

1. **Command Execution**: How should we handle sequential command execution?
   - Do we need to wait for each command to complete?
   - Is there a command queue system we should use?
   - Should we send all commands at once or one-by-one?

2. **Z Height**: What should be the default safe height?
   - Use current Z + offset?
   - Use absolute safe height?
   - Make it configurable?

3. **Feed Rate**: What should be the default feed rate?
   - 500 mm/min seems reasonable
   - Should it be configurable from the start?

4. **Margin**: Should there be a margin around the hull?
   - Default 2mm seems reasonable (offset hull outward)
   - Should it be configurable?
   - Note: Margin requires offsetting the hull polygon, which is more complex than bounding box margin

5. **Hull Algorithm**: Using `concaveman` library
   - Fast O(n log n) concave hull algorithm
   - Handles outer boundary indentations
   - Ignores inner holes/cutouts (perfect for our use case)
   - Configurable concavity level (default: 2)

6. **Visual Feedback**: Should the outline be visible in the visualizer?
   - This would be a nice enhancement
   - Can be added in Phase 4

7. **Error Recovery**: What happens if outline is interrupted?
   - Should we try to return to start position?
   - Should we leave tool at current position?

8. **Concave Shapes**: Using concave hull algorithm
   - Traces outer boundary with indentations accurately
   - Ignores inner holes/cutouts (as requested)
   - Configurable concavity level for detail control

## Notes

- The existing `processGCode()` function processes G-code and provides positions array, so we can extract XY points from that
- The Outline button already exists in FilePanel but is disabled
- G-code commands are sent via socket using `sendGcode()` from `useGcodeCommand`
- Machine position is available via props or Redux state
- Need to ensure outline respects machine limits and safety constraints
- **Concave hull** gives accurate "top-profile" view - traces outer boundary with indentations
- **Ignores inner holes/cutouts** - only traces the outermost boundary (as requested)
- The concave hull will be more accurate than a bounding box or convex hull for real-world toolpaths with indentations
- `concaveman` library is well-tested and performant (O(n log n))
