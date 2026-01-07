/**
 * TypeScript type declarations for system settings schemas
 * Auto-inferred from Zod schemas
 */
import { z } from 'zod';
import {
  SystemSettingsSchema,
  GeneralSettingsSchema,
  ControllerSettingsSchema,
  MachineSettingsSchema,
  MachineLimitsSchema,
  ConnectionSettingsSchema,
  CameraSettingsSchema,
  PositionSchema,
  ZeroingMethodSchema,
  ZeroingMethodsSettingsSchema,
  ZeroingStrategiesSettingsSchema,
  BitSetterMethodSchema,
  BitZeroMethodSchema,
  TouchPlateMethodSchema,
  ManualMethodSchema,
  CustomMethodSchema,
  JoystickSettingsSchema,
  AppearanceSettingsSchema,
} from './settings.js';

// Inferred types from Zod schemas
export type SystemSettings = z.infer<typeof SystemSettingsSchema>;
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;
export type ControllerSettings = z.infer<typeof ControllerSettingsSchema>;
export type MachineSettings = z.infer<typeof MachineSettingsSchema>;
export type MachineLimits = z.infer<typeof MachineLimitsSchema>;
export type ConnectionSettings = z.infer<typeof ConnectionSettingsSchema>;
export type CameraSettings = z.infer<typeof CameraSettingsSchema>;
export type Position = z.infer<typeof PositionSchema>;

// Zeroing method types
export type ZeroingMethod = z.infer<typeof ZeroingMethodSchema>;
export type ZeroingMethodsSettings = z.infer<typeof ZeroingMethodsSettingsSchema>;
export type ZeroingStrategiesSettings = z.infer<typeof ZeroingStrategiesSettingsSchema>;
export type BitSetterMethod = z.infer<typeof BitSetterMethodSchema>;
export type BitZeroMethod = z.infer<typeof BitZeroMethodSchema>;
export type TouchPlateMethod = z.infer<typeof TouchPlateMethodSchema>;
export type ManualMethod = z.infer<typeof ManualMethodSchema>;
export type CustomMethod = z.infer<typeof CustomMethodSchema>;

export type JoystickSettings = z.infer<typeof JoystickSettingsSchema>;
export type AppearanceSettings = z.infer<typeof AppearanceSettingsSchema>;

// Re-export schemas
export {
  SystemSettingsSchema,
  GeneralSettingsSchema,
  ControllerSettingsSchema,
  MachineSettingsSchema,
  MachineLimitsSchema,
  ConnectionSettingsSchema,
  CameraSettingsSchema,
  PositionSchema,
  ZeroingMethodSchema,
  ZeroingMethodsSettingsSchema,
  ZeroingStrategiesSettingsSchema,
  BitSetterMethodSchema,
  BitZeroMethodSchema,
  TouchPlateMethodSchema,
  ManualMethodSchema,
  CustomMethodSchema,
  JoystickSettingsSchema,
  AppearanceSettingsSchema,
  getDefaultSettings,
  validatePartialSettings,
  parseSettings,
} from './settings.js';
