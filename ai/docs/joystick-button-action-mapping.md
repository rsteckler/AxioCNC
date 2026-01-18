# Joystick Button Action to Controller Command Mapping

## Button Actions (from CncAction type)

### Jogging Actions (will be handled later - skip for now)
- `jog_x_pos`, `jog_x_neg`, `jog_y_pos`, `jog_y_neg`, `jog_z_pos`, `jog_z_neg`
- `speed_slow`, `speed_medium`, `speed_fast`

### Homing Actions
- `home_all` → Controller command: `'homing'` ✅
- `home_x` → Controller command: **NOT FOUND** ❌ (only `'homing'` exists)
- `home_y` → Controller command: **NOT FOUND** ❌ (only `'homing'` exists)
- `home_z` → Controller command: **NOT FOUND** ❌ (only `'homing'` exists)

### Zeroing Actions
- `zero_all` → Controller command: **NOT FOUND** ❌ (would need G92 G54 X0 Y0 Z0 or similar)
- `zero_x` → Controller command: **NOT FOUND** ❌ (would need G92 G54 X0 or similar)
- `zero_y` → Controller command: **NOT FOUND** ❌ (would need G92 G54 Y0 or similar)
- `zero_z` → Controller command: **NOT FOUND** ❌ (would need G92 G54 Z0 or similar)

### Job Control Actions
- `start` → Controller command: `'gcode:start'` ✅ (deprecated: `'start'` maps to `'gcode:start'`)
- `stop` → Controller command: `'gcode:stop'` ✅ (deprecated: `'stop'` maps to `'gcode:stop'`)
- `pause` → Controller command: `'gcode:pause'` ✅ (deprecated: `'pause'` maps to `'gcode:pause'`)
- `resume` → Controller command: `'gcode:resume'` ✅ (deprecated: `'resume'` maps to `'gcode:resume'`)
- `feed_hold` → Controller command: `'feedhold'` ✅
- `cycle_start` → Controller command: `'cyclestart'` ✅

### Spindle Actions
- `spindle_on` → Controller command: **NOT FOUND** ❌ (would need G-code: M3 or M4)
- `spindle_off` → Controller command: **NOT FOUND** ❌ (would need G-code: M5)
- `spindle_toggle` → Controller command: **NOT FOUND** ❌ (would need state check + M3/M5)

### Safety Actions
- `emergency_stop` → Controller command: `'reset'` ✅ (sends `\x18` Ctrl-X)

## Controller Commands Available (from GrblController.command handler)

- `'gcode:load'`
- `'gcode:unload'`
- `'gcode:start'`
- `'gcode:stop'`
- `'gcode:pause'` → Maps to `'pause'`
- `'gcode:resume'` → Maps to `'resume'`
- `'feedhold'` → Maps to `'feed_hold'`
- `'cyclestart'` → Maps to `'cycle_start'`
- `'homing'` → Maps to `'home_all'` (only home_all, no individual axes)
- `'unlock'`
- `'reset'` → Maps to `'emergency_stop'`
- `'jogCancel'`
- `'feedOverride'`
- `'spindleOverride'`
- `'rapidOverride'`
- `'gcode'`
- `'macro:run'`
- `'macro:load'`
- `'watchdir:load'`

## Mapping Summary

### Direct Mappings (Button Action → Controller Command)
1. `'home_all'` → `'homing'`
2. `'start'` → `'gcode:start'`
3. `'stop'` → `'gcode:stop'`
4. `'pause'` → `'gcode:pause'`
5. `'resume'` → `'gcode:resume'`
6. `'feed_hold'` → `'feedhold'`
7. `'cycle_start'` → `'cyclestart'`
8. `'emergency_stop'` → `'reset'`

### Actions That Need Implementation
1. `'home_x'`, `'home_y'`, `'home_z'` - Individual axis homing (not supported by Grbl)
2. `'zero_all'`, `'zero_x'`, `'zero_y'`, `'zero_z'` - Zero work coordinates (need G-code: G92 G54 X0 Y0 Z0)
3. `'spindle_on'`, `'spindle_off'`, `'spindle_toggle'` - Spindle control (need G-code: M3, M4, M5)

### Actions to Skip (Handled Later)
1. All `jog_*` actions - Will be handled by jog loop service
2. `'speed_slow'`, `'speed_medium'`, `'speed_fast'` - Will be handled by jog loop service

## Questions for User

1. For zeroing actions (`zero_all`, `zero_x`, `zero_y`, `zero_z`), should we:
   - Send G-code commands directly (e.g., `G92 G54 X0 Y0 Z0`)?
   - Or is there a utility function to generate these commands?

2. For spindle actions (`spindle_on`, `spindle_off`, `spindle_toggle`), should we:
   - Send G-code commands directly (e.g., `M3`, `M5`)?
   - For `spindle_toggle`, should we check current spindle state, or just send M3/M5 alternately?

3. For `home_x`, `home_y`, `home_z` - Grbl only supports `$H` (home all). Should we:
   - Map these to `'homing'` (home all)?
   - Or disable these actions for Grbl controllers?

4. For `'start'`, `'stop'`, `'pause'`, `'resume'` - The controller has both deprecated and new commands. Should we use:
   - Deprecated: `'start'`, `'stop'`, `'pause'`, `'resume'` (they map to new commands internally)
   - Or new: `'gcode:start'`, `'gcode:stop'`, `'gcode:pause'`, `'gcode:resume'`?
