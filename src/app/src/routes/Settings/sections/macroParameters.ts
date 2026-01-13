/**
 * Utility functions for parsing and handling macro parameters
 */

export interface MacroParameter {
  name: string
  type: 'number' | 'string' | 'boolean'
  defaultValue?: string
}

/**
 * Parse parameter declarations from macro content
 * Looks for lines like: ; @param name:type or ; @param name:type=defaultValue
 */
export function parseMacroParameters(content: string): MacroParameter[] {
  const parameters: MacroParameter[] = []
  const lines = content.split('\n')
  
  for (const line of lines) {
    // Match: ; @param name:type or ; @param name:type=defaultValue
    const match = line.match(/^\s*;\s*@param\s+(\w+):(\w+)(?:=(.+))?/i)
    if (match) {
      const [, name, type, defaultValue] = match
      
      // Validate type
      if (type === 'number' || type === 'string' || type === 'boolean') {
        parameters.push({
          name,
          type: type as 'number' | 'string' | 'boolean',
          defaultValue: defaultValue?.trim(),
        })
      }
    }
  }
  
  return parameters
}

/**
 * Extract unique parameter names used in macro content (e.g., [paramName])
 */
export function extractUsedParameters(content: string): string[] {
  const matches = content.matchAll(/\[(\w+)\]/g)
  const usedParams = new Set<string>()
  
  for (const match of matches) {
    usedParams.add(match[1])
  }
  
  return Array.from(usedParams).sort()
}

/**
 * Validate that all used parameters are declared
 */
export function validateMacroParameters(content: string): {
  valid: boolean
  declared: MacroParameter[]
  used: string[]
  undeclared: string[]
} {
  const declared = parseMacroParameters(content)
  const declaredNames = new Set(declared.map(p => p.name))
  const used = extractUsedParameters(content)
  
  // Filter out built-in variables (posx, posy, etc.) and other known variables
  const knownVariables = new Set([
    'posx', 'posy', 'posz', 'posa',
    'xmin', 'xmax', 'ymin', 'ymax', 'zmin', 'zmax',
    'WCS', 'PLANE', 'UNITS', 'DISTANCE', 'FEEDRATE', 'SPINDLE', 'COOLANT',
    'X0', 'Y0', 'Z0',
  ])
  
  const undeclared = used.filter(param => 
    !declaredNames.has(param) && !knownVariables.has(param)
  )
  
  return {
    valid: undeclared.length === 0,
    declared,
    used,
    undeclared,
  }
}
