declare module 'colornames' {
  /**
   * Get a color name by value (hex code)
   * @param value - Color value (hex code, e.g., '#ffffff')
   * @returns Color name as string, or undefined if not found
   */
  function colornames(value: string): string | undefined
  
  export default colornames
}
