/**
 * Compatibility entry point for consumers that want the screen action
 * registry without importing the footer implementation directly.
 */
import {
  SCREEN_ACTION_REGISTRY,
  getScreenActionContract,
  getScreenActions,
  getScreenAction
} from './commandFooterText.js';

export { SCREEN_ACTION_REGISTRY, getScreenActionContract, getScreenActions, getScreenAction };
