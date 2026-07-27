import AsyncStorage from '@react-native-async-storage/async-storage';

const CRASH_LOG_KEY = '@fintech/crashLog';
const MAX_ENTRIES = 20;
const MAX_STACK_CHARS = 800;

export interface CrashLogEntry {
  timestamp: string;
  message: string;
  stack?: string;
  isFatal: boolean;
  source: 'global' | 'boundary';
}

/**
 * Appends a crash/error to a capped, rotating log in AsyncStorage — oldest
 * entries drop off past MAX_ENTRIES, and each stack trace is truncated, so
 * this can never grow into a real storage concern (worst case is a few KB).
 * Never throws — logging a crash must not risk causing a second one.
 */
export async function logCrash(
  error: Error,
  source: CrashLogEntry['source'],
  isFatal = false,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CRASH_LOG_KEY);
    const existing: CrashLogEntry[] = raw ? JSON.parse(raw) : [];

    const entry: CrashLogEntry = {
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack ? error.stack.slice(0, MAX_STACK_CHARS) : undefined,
      isFatal,
      source,
    };

    const next = [entry, ...existing].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(CRASH_LOG_KEY, JSON.stringify(next));
  } catch {
    // If logging itself fails, there's nothing safe left to do but drop it.
  }
}

export async function getCrashLog(): Promise<CrashLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CRASH_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearCrashLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CRASH_LOG_KEY);
  } catch {
    // no-op
  }
}

/** Plain-text rendering of the whole log, newest first — for sharing/export. */
export async function formatCrashLogText(): Promise<string> {
  const entries = await getCrashLog();
  if (entries.length === 0) return 'No errors logged on this device.';

  return entries
    .map((e, i) => {
      const header = `#${i + 1} — ${e.timestamp}${e.isFatal ? ' (FATAL)' : ''} [${e.source}]`;
      return `${header}\n${e.message}\n${e.stack ?? '(no stack trace)'}`;
    })
    .join('\n\n---\n\n');
}
