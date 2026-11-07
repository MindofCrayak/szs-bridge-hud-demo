const STORAGE_KEY = 'szs.notifications.seen.v1';

export interface SeenStateResult {
  ids: string[];
  error?: string;
}

export function loadSeenNotificationIds(): SeenStateResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ids: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
      return { ids: [], error: 'Saved notification seen-state is invalid; acknowledgements are temporarily unavailable.' };
    }
    return { ids: parsed };
  } catch (error) {
    return {
      ids: [],
      error: error instanceof Error ? `Unable to load local notification seen-state: ${error.message}` : 'Unable to load local notification seen-state.',
    };
  }
}

export function persistSeenNotificationIds(ids: readonly string[]): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
    return null;
  } catch (error) {
    return error instanceof Error ? `Unable to save local notification seen-state: ${error.message}` : 'Unable to save local notification seen-state.';
  }
}
