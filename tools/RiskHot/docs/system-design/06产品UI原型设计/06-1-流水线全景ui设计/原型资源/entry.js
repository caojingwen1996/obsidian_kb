'use strict';
globalThis.RISKHOT_STANDALONE_PANORAMA = true;

// A standalone panorama always opens its read-only view, including on reload.
if (globalThis.location && globalThis.location.hash !== '#panorama') {
  globalThis.history.replaceState(null, '', '#panorama');
}
