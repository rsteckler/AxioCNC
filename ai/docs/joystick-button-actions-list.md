# Joystick Button Actions - Complete List

## All Button Actions (excluding jogging - handled separately)

### Safety Actions
1. `emergency_stop` - Emergency stop

### Homing Actions
2. `home_all` - Home all axes

### Zeroing Actions
3. `zero_all` - Zero all axes (set work coordinate zero)
4. `zero_x` - Zero X axis
5. `zero_y` - Zero Y axis
6. `zero_z` - Zero Z axis

### Job Control Actions
7. `start` - Start job (`gcode:start`)
8. `stop` - Stop job (`gcode:stop`)
9. `pause` - Pause job (`gcode:pause`)
10. `resume` - Resume job (`gcode:resume`)
11. `feed_hold` - Feed hold
12. `cycle_start` - Cycle start

### Spindle Actions
13. `spindle_on` - Turn spindle on (M3)
14. `spindle_off` - Turn spindle off (M5)
15. `spindle_toggle` - Toggle spindle (M3 if stopped, M5 if running)

---

## Notes

- **Jogging actions** (`jog_x_pos`, `jog_x_neg`, etc.) are handled separately by the jog loop
- **Speed actions** (`speed_slow`, `speed_medium`, `speed_fast`) are handled separately by the jog loop
- **Individual homing** (`home_x`, `home_y`, `home_z`) will be removed from UI (not supported by Grbl)

---

Please provide the allowed states for each action (when they should be allowed to execute).
