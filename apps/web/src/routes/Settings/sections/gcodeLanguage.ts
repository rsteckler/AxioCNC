/**
 * G-code syntax highlighting for CodeMirror 6
 * Based on Grbl syntax highlighting from vscode-grbl
 * https://raw.githubusercontent.com/emarkham/vscode-grbl/refs/heads/master/syntaxes/GrblSyntaxHighlightingDef.tmLanguage
 */

import { StreamLanguage, syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// Define G-code language using StreamParser
export const gcodeLanguage = StreamLanguage.define({
  name: 'gcode',
  
  tokenTable: {
    // Custom token names -> tags
    gcodeComment: t.comment,
    gcodeCmd: t.keyword,
    gcodeAxis: t.variableName,
    gcodeNumber: t.number,
    gcodeVar: t.atom,
    gcodeOp: t.operator,
    gcodeInvalid: t.invalid,
  },
  
  token(stream) {
    // Comments - semicolon style
    if (stream.match(/^;.*/)) {
      return 'gcodeComment'
    }
    
    // Comments - parentheses style
    if (stream.peek() === '(') {
      stream.next()
      if (!stream.skipTo(')')) {
        stream.skipToEnd()
      }
      if (stream.peek() === ')') stream.next()
      return 'gcodeComment'
    }
    
    // Skip whitespace
    if (stream.eatSpace()) {
      return null
    }
    
    // Invalid G commands (G followed by 3+ digits)
    if (stream.match(/^G\d{3,}/)) {
      return 'gcodeInvalid'
    }
    
    // Invalid G52
    if (stream.match(/^G52\b/)) {
      return 'gcodeInvalid'
    }
    
    // G commands (G0-G4, G17-G19, G20-G21, G28, G30, G38, G53-G59, G90-G91, G92.1, G93-G94)
    if (stream.match(/^G(?:[0-4]|1[7-9]|2[01]|28\.?1?|30(?:\.1)?|38(?:\.2)?|5[3-9]|9[0-4]|92\.1)\b/)) {
      return 'gcodeCmd'
    }
    
    // M commands (M3, M4, M5, M8, M9, M30, M100, M101)
    if (stream.match(/^M(?:[34589]|30|10[01])\b/)) {
      return 'gcodeCmd'
    }
    
    // Special commands (%wait, %X0=, etc.)
    if (stream.match(/^%/)) {
      return 'gcodeCmd'
    }
    
    // Variables (# followed by digits)
    if (stream.match(/^#\d+/)) {
      return 'gcodeVar'
    }
    
    // Variable interpolation brackets [posx]
    if (stream.match(/^\[[^\]]*\]/)) {
      return 'gcodeVar'
    }
    
    // Parameter declarations (@param)
    if (stream.match(/^@[A-Za-z_]\w*/)) {
      return 'gcodeVar'
    }
    
    // Axis words (X, Y, Z, I, J, K, F, S, R, P, etc.)
    if (stream.match(/^[XYZIJKFSRPT]/i)) {
      // Try to match the number part too
      if (stream.match(/^-?\d+\.?\d*/)) {
        return 'gcodeAxis'
      }
      return 'gcodeAxis'
    }
    
    // Numbers (standalone or after operators)
    if (stream.match(/^-?\d+\.?\d*/)) {
      return 'gcodeNumber'
    }
    
    // O/N line numbers
    if (stream.match(/^[ON]\d+/)) {
      return 'gcodeNumber'
    }
    
    // Operators and brackets
    if (stream.match(/^[[\]()=+\-*/]/)) {
      return 'gcodeOp'
    }
    
    // Default: advance one character
    stream.next()
    return null
  }
})

// Define highlighting styles
// Using colors that work well in both light and dark modes
const gcodeHighlightStyleDef = HighlightStyle.define([
  { tag: t.comment, color: '#6a9955' }, // Green for comments
  { tag: t.keyword, color: '#569cd6' }, // Blue for G/M commands
  { tag: t.number, color: '#b5cea8' }, // Light green for numbers
  { tag: t.variableName, color: '#ce9178' }, // Orange for axis words
  { tag: t.atom, color: '#9cdcfe' }, // Light blue for variables
  { tag: t.operator, color: '#d4d4d4' }, // Light gray for operators
  { tag: t.invalid, color: '#f48771', textDecoration: 'line-through' }, // Red strikethrough for invalid
])

// Export as extension ready to use
export const gcodeHighlightStyle = syntaxHighlighting(gcodeHighlightStyleDef)
