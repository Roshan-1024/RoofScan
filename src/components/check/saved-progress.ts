/**
 * Progress lives in sessionStorage: it survives a reload, stays in this tab
 * only, and is cleared when the tab closes. Nothing is sent to a server.
 */
export const PROGRESS_KEY = "roofscan:check:v1";

/** Forgets saved progress, so a step that no longer renders can't come back on every reload. */
export function clearSavedProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // Storage blocked: nothing was saved.
  }
}
