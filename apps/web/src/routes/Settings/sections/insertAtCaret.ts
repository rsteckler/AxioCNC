/**
 * Inserts text at the current cursor position in a textarea element.
 * Preserves scroll position and sets cursor position after insertion.
 * 
 * Based on the legacy insertAtCaret utility from app-legacy/widgets/Macro/insertAtCaret.js
 */
export function insertAtCaret(textarea: HTMLTextAreaElement, text: string) {
  const scrollPos = textarea.scrollTop
  const caretPos = textarea.selectionStart
  const front = textarea.value.substring(0, caretPos)
  const back = textarea.value.substring(textarea.selectionEnd, textarea.value.length)
  
  textarea.value = front + text + back
  textarea.selectionStart = caretPos + text.length
  textarea.selectionEnd = caretPos + text.length
  textarea.focus()
  textarea.scrollTop = scrollPos
}
