import React from 'react';
import { Platform } from 'react-native';

/**
 * Register global keyboard shortcuts for the desktop app.
 * @param {Object} handlers - Map of shortcut keys to handler functions
 *   Example: { 'n': () => navigate('AddCase'), 'escape': () => closeModal() }
 */
export function useKeyboardShortcuts(handlers) {
  if (Platform.OS !== 'web') return;

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      // Escape key (no modifier needed)
      if (event.key === 'Escape' && handlers['escape']) {
        event.preventDefault();
        handlers['escape']();
        return;
      }

      // Only trigger with Ctrl (Windows) or Cmd (Mac)
      if (!event.ctrlKey && !event.metaKey) return;

      const key = event.key.toLowerCase();
      if (handlers[key]) {
        event.preventDefault();
        handlers[key]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
