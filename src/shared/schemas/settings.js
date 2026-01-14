/**
 * Shared Zod schemas for system settings
 * Used by both backend (validation) and frontend (types)
 */
import { z } from 'zod';

// =============================================================================
// General Settings
// =============================================================================

export const GeneralSettingsSchema = z.object({
  lang: z.string().default('en'),
  checkForUpdates: z.boolean().default(true),
  allowAnonymousUsageDataCollection: z.boolean().default(false),
});

// =============================================================================
// Controller Settings
// =============================================================================

export const ControllerSettingsSchema = z.object({
  exception: z.object({
    ignoreErrors: z.boolean().default(false),
  }).default({}),
});

// =============================================================================
// Machine Settings
// =============================================================================

export const MachineLimitsSchema = z.object({
  xmin: z.number().default(0),
  xmax: z.number().default(300),
  ymin: z.number().default(0),
  ymax: z.number().default(300),
  zmin: z.number().default(-50),
  zmax: z.number().default(0),
});

export const MachineSettingsSchema = z.object({
  name: z.string().default('My CNC Machine'),
  limits: MachineLimitsSchema.default({}),
  homingCorner: z.enum(['back-left', 'back-right', 'front-left', 'front-right']).optional(),
});

// =============================================================================
// Connection Settings
// =============================================================================

export const ConnectionSettingsSchema = z.object({
  port: z.string().default(''),
  baudRate: z.number().default(115200),
  controllerType: z.string().default('Grbl'),
  setDTR: z.boolean().default(true),
  setRTS: z.boolean().default(true),
  rtscts: z.boolean().default(false),
  autoConnect: z.boolean().default(false),
});

// =============================================================================
// Camera Settings
// =============================================================================

export const CameraSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  mediaSource: z.enum(['ip-camera']).default('ip-camera'),
  ipCameraUrl: z.string().default(''),
  username: z.string().optional(),
  password: z.string().optional(),
  flipHorizontal: z.boolean().default(false),
  flipVertical: z.boolean().default(false),
  rotation: z.number().default(0),
  crosshair: z.boolean().default(false),
  crosshairColor: z.string().default('#ff0000'),
});

// =============================================================================
// Zeroing Methods Settings
// =============================================================================

// Position for BitSetter location
export const PositionSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
});

// Base fields shared by all zeroing methods
const BaseMethodSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  axes: z.enum(['z', 'xy', 'xyz']).default('xyz'),
});

// BitSetter - automatic tool length sensor (Z only)
export const BitSetterMethodSchema = BaseMethodSchema.extend({
  type: z.literal('bitsetter'),
  axes: z.literal('z'),
  position: PositionSchema.default({}),
  probeFeedrate: z.number().default(100),
  probeDistance: z.number().default(50),
  retractHeight: z.number().default(10),
  requireCheck: z.boolean().default(false),
});

// BitZero - corner/edge/center probe (XYZ)
export const BitZeroMethodSchema = BaseMethodSchema.extend({
  type: z.literal('bitzero'),
  probeThickness: z.number().default(12.7),
  probeFeedrate: z.number().default(100),
  probeDistance: z.number().default(25),
  requireCheck: z.boolean().default(false),
});

// Touch Plate - simple Z touch plate
export const TouchPlateMethodSchema = BaseMethodSchema.extend({
  type: z.literal('touchplate'),
  axes: z.literal('z'),
  plateThickness: z.number().default(19.05),
  probeFeedrate: z.number().default(100),
  probeDistance: z.number().default(25),
  requireCheck: z.boolean().default(true),
});

// Manual - user manually zeros (always available)
export const ManualMethodSchema = BaseMethodSchema.extend({
  type: z.literal('manual'),
});

// Custom - user-defined G-code sequence
export const CustomMethodSchema = BaseMethodSchema.extend({
  type: z.literal('custom'),
  gcode: z.string().default(''),
});

// Union of all method types
export const ZeroingMethodSchema = z.discriminatedUnion('type', [
  BitSetterMethodSchema,
  BitZeroMethodSchema,
  TouchPlateMethodSchema,
  ManualMethodSchema,
  CustomMethodSchema,
]);

// Container for all zeroing methods
export const ZeroingMethodsSettingsSchema = z.object({
  methods: z.array(ZeroingMethodSchema).default([
    { id: 'manual-default', type: 'manual', name: 'Manual', enabled: true, axes: 'xyz' },
  ]),
});

// =============================================================================
// Zeroing Strategies Settings
// =============================================================================

// Strategy option: method ID, 'ask', or 'skip'
const StrategyOptionSchema = z.string().default('ask');

export const ZeroingStrategiesSettingsSchema = z.object({
  initialSetup: StrategyOptionSchema,
  toolChange: StrategyOptionSchema,
  afterPause: z.string().default('skip'),
});

// =============================================================================
// Joystick Settings
// =============================================================================

export const JoystickSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  connectionLocation: z.enum(['server', 'client']).default('server'),
  selectedGamepad: z.string().nullable().default(null),
  buttonMappings: z.record(z.string(), z.string()).default({}),
  analogMappings: z.object({
    left_x: z.string().default('jog_x'),
    left_y: z.string().default('jog_y'),
    right_x: z.string().default('none'),
    right_y: z.string().default('jog_z'),
  }).default({}),
  deadzone: z.number().min(0).max(1).default(0.15),
  sensitivity: z.number().min(0.1).max(2).default(1.0),
  invertX: z.boolean().default(false),
  invertY: z.boolean().default(false),
  invertZ: z.boolean().default(false),
  analogJogSpeedXY: z.number().default(3000),
  analogJogSpeedZ: z.number().default(1000),
});

// =============================================================================
// Appearance Settings
// =============================================================================

export const AppearanceSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  accentColor: z.enum(['orange', 'blue', 'green', 'purple', 'red', 'zinc']).default('orange'),
  customThemeId: z.string().nullable().default(null),
});

// =============================================================================
// Complete System Settings Schema
// =============================================================================

export const SystemSettingsSchema = z.object({
  // General
  lang: z.string().default('en'),
  checkForUpdates: z.boolean().default(true),
  allowAnonymousUsageDataCollection: z.boolean().default(false),
  
  // Controller behavior
  controller: ControllerSettingsSchema.default({}),
  
  // Machine configuration
  machine: MachineSettingsSchema.default({}),
  
  // Connection settings
  connection: ConnectionSettingsSchema.default({}),
  
  // Camera settings
  camera: CameraSettingsSchema.default({}),
  
  // Zeroing methods (replaces old toolChange)
  zeroingMethods: ZeroingMethodsSettingsSchema.default({}),
  
  // Zeroing strategies
  zeroingStrategies: ZeroingStrategiesSettingsSchema.default({}),
  
  // Joystick settings
  joystick: JoystickSettingsSchema.default({}),
  
  // Appearance settings
  appearance: AppearanceSettingsSchema.default({}),
});

// =============================================================================
// Utility: Get defaults
// =============================================================================

export const getDefaultSettings = () => SystemSettingsSchema.parse({});

// =============================================================================
// Validation helpers
// =============================================================================

/**
 * Validate a partial settings update
 * @param {object} data - The partial settings to validate
 * @returns {{ success: boolean, data?: object, error?: import('zod').ZodError }}
 */
export const validatePartialSettings = (data) => {
  // Use partial() to make top-level fields optional
  // Nested object validation happens when merged with full settings
  return SystemSettingsSchema.partial().safeParse(data);
};

/**
 * Validate and return full settings with defaults applied
 * @param {object} data - The settings data
 * @returns {object} Validated settings with defaults
 */
export const parseSettings = (data) => {
  return SystemSettingsSchema.parse(data);
};

