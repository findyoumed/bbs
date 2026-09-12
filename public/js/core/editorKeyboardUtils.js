// Shared keyboard contract for Coroke-style title/body editors.
// Keep this helper limited to key classification; screen-specific handlers
// remain responsible for focus, validation, save, and cancel behavior.

export function isEditorEnterKey(event) {
  return event?.key === 'Enter'
    || event?.code === 'Enter'
    || event?.code === 'NumpadEnter'
    || event?.keyCode === 13
    || event?.which === 13;
}

export function isEditorForwardFieldKey(event) {
  return isEditorEnterKey(event)
    || event?.key === 'ArrowDown'
    || (event?.key === 'Tab' && !event.shiftKey);
}
