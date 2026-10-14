import {
  MAX_TASKS,
  type BoardState,
  type Phase,
  type Task,
  type TimerStatus,
  calendarDate,
  freshBoard,
  reconcile,
  settle,
} from "./board";

export const STORAGE_KEY = "simple-podomoro";

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const phases = new Set<Phase>(["focus", "break"]);
const statuses = new Set<TimerStatus>(["idle", "running", "paused", "done"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTask(value: unknown): Task | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.title !== "string") return null;
  if (typeof value.done !== "boolean") return null;
  return { id: value.id, title: value.title, done: value.done };
}

function parseBoard(value: unknown): BoardState | null {
  if (!isRecord(value)) return null;
  if (typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null;
  if (typeof value.phase !== "string" || !phases.has(value.phase as Phase)) return null;
  if (typeof value.status !== "string" || !statuses.has(value.status as TimerStatus)) return null;
  if (typeof value.remainingMs !== "number" || !Number.isFinite(value.remainingMs)) return null;
  if (value.endsAt !== null && (typeof value.endsAt !== "number" || !Number.isFinite(value.endsAt))) {
    return null;
  }
  if (!Array.isArray(value.tasks) || value.tasks.length > MAX_TASKS) return null;

  const tasks: Task[] = [];
  for (const item of value.tasks) {
    const task = parseTask(item);
    if (!task) return null;
    tasks.push(task);
  }

  const status = value.status as TimerStatus;
  const endsAt = value.endsAt as number | null;
  if (status === "running" && endsAt == null) return null;

  return {
    date: value.date,
    tasks,
    phase: value.phase as Phase,
    status,
    endsAt,
    remainingMs: value.remainingMs,
  };
}

export function saveBoard(store: KeyValueStore, state: BoardState): void {
  store.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadBoard(store: KeyValueStore, now: Date): BoardState {
  const today = calendarDate(now);
  const raw = store.getItem(STORAGE_KEY);
  if (!raw) return freshBoard(today);

  try {
    const parsed = parseBoard(JSON.parse(raw));
    if (!parsed) return freshBoard(today);
    return settle(reconcile(parsed, today), now.getTime());
  } catch {
    return freshBoard(today);
  }
}
