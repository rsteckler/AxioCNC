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
 * Extract variable names declared with %var = value syntax
 * Returns both unique names and any duplicates found
 */
export function extractInlineVariables(content: string): { 
  variables: Set<string>
  duplicates: string[] 
} {
  const variables = new Set<string>()
  const seen = new Map<string, number>() // Track count of each variable
  const lines = content.split('\n')
  
  for (const line of lines) {
    // Match: %varName = value or %var1=val1,var2=val2,...
    // The % prefix indicates inline variable assignment
    const percentMatch = line.match(/^%(.+)/)
    if (percentMatch) {
      const assignments = percentMatch[1]
      // Split by comma for multiple assignments like %X0=posx,Y0=posy
      const parts = assignments.split(',')
      for (const part of parts) {
        // Match varName = value or varName=value
        const varMatch = part.match(/^\s*(\w+)\s*=/)
        if (varMatch) {
          const varName = varMatch[1]
          variables.add(varName)
          seen.set(varName, (seen.get(varName) || 0) + 1)
        }
      }
    }
  }
  
  // Find duplicates (variables assigned more than once)
  const duplicates = Array.from(seen.entries())
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
  
  return { variables, duplicates }
}

/**
 * Validate that all used parameters are declared and check for duplicates
 */
export function validateMacroParameters(content: string): {
  valid: boolean
  declared: MacroParameter[]
  used: string[]
  undeclared: string[]
  duplicates: string[]
} {
  const declared = parseMacroParameters(content)
  const { variables: inlineVars, duplicates: inlineDuplicates } = extractInlineVariables(content)
  const used = extractUsedParameters(content)
  
  // Check for duplicate @param declarations
  const paramNames: string[] = []
  const paramDuplicates: string[] = []
  for (const param of declared) {
    if (paramNames.includes(param.name)) {
      if (!paramDuplicates.includes(param.name)) {
        paramDuplicates.push(param.name)
      }
    }
    paramNames.push(param.name)
  }
  
  // Check for variables declared both as @param and inline %var
  const declaredNames = new Set(declared.map(p => p.name))
  const conflictDuplicates: string[] = []
  for (const inlineVar of inlineVars) {
    if (declaredNames.has(inlineVar)) {
      conflictDuplicates.push(inlineVar)
    }
  }
  
  // Combine all duplicates
  const allDuplicates = [...new Set([...paramDuplicates, ...inlineDuplicates, ...conflictDuplicates])]
  
  // Filter out built-in variables (posx, posy, etc.) and other known variables
  const knownVariables = new Set([
    'posx', 'posy', 'posz', 'posa',
    'xmin', 'xmax', 'ymin', 'ymax', 'zmin', 'zmax',
    'WCS', 'PLANE', 'UNITS', 'DISTANCE', 'FEEDRATE', 'SPINDLE', 'COOLANT',
    'X0', 'Y0', 'Z0',
  ])
  
  const undeclared = used.filter(param => 
    !declaredNames.has(param) && 
    !knownVariables.has(param) &&
    !inlineVars.has(param)
  )
  
  return {
    valid: undeclared.length === 0 && allDuplicates.length === 0,
    declared,
    used,
    undeclared,
    duplicates: allDuplicates,
  }
}

/**
 * Validate a parameter value matches the expected type
 */
export function validateParameterValue(
  value: string,
  type: MacroParameter['type']
): { valid: boolean; error?: string } {
  if (value.trim() === '') {
    return { valid: false, error: 'Value is required' }
  }

  switch (type) {
    case 'number': {
      const num = Number(value)
      if (isNaN(num)) {
        return { valid: false, error: 'Must be a valid number' }
      }
      return { valid: true }
    }

    case 'boolean': {
      const lower = value.toLowerCase().trim()
      if (!['true', 'false', '1', '0', 'yes', 'no'].includes(lower)) {
        return { valid: false, error: 'Must be true/false, yes/no, or 1/0' }
      }
      return { valid: true }
    }

    case 'string':
      return { valid: true }

    default:
      return { valid: true }
  }
}

/**
 * Convert a parameter value to the appropriate type for the context
 */
export function convertParameterValue(
  value: string,
  type: MacroParameter['type']
): string | number | boolean {
  switch (type) {
    case 'number':
      return Number(value)

    case 'boolean': {
      const lower = value.toLowerCase().trim()
      return ['true', '1', 'yes'].includes(lower)
    }

    case 'string':
    default:
      return value
  }
}
