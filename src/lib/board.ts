export const FOCUS_MS = 25 * 60 * 1000;
export const BREAK_MS = 5 * 60 * 1000;
export const MAX_TASKS = 3;

export type Phase = "focus" | "break";
export type TimerStatus = "idle" | "running" | "paused" | "done";

export type Task = {
  id: string;
  title: string;
  done: boolean;
};

export type BoardState = {
  date: string;
  tasks: Task[];
  phase: Phase;
  status: TimerStatus;
  endsAt: number | null;
  remainingMs: number;
};

export type AddTaskResult = {
  state: BoardState;
  error: "empty" | "full" | null;
};

export function calendarDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function freshBoard(date: string): BoardState {
  return {
    date,
    tasks: [],
    phase: "focus",
    status: "idle",
    endsAt: null,
    remainingMs: FOCUS_MS,
  };
}

export function addTask(state: BoardState, title: string, id: string): AddTaskResult {
  const trimmed = title.trim();
  if (!trimmed) return { state, error: "empty" };
  if (state.tasks.length >= MAX_TASKS) return { state, error: "full" };
  return {
    state: {
      ...state,
      tasks: [...state.tasks, { id, title: trimmed, done: false }],
    },
    error: null,
  };
}

export function toggleTask(state: BoardState, id: string): BoardState {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === id ? { ...task, done: !task.done } : task,
    ),
  };
}

export function deleteTask(state: BoardState, id: string): BoardState {
  return {
    ...state,
    tasks: state.tasks.filter((task) => task.id !== id),
  };
}

export function startFocus(state: BoardState, nowMs: number): BoardState {
  const canStart =
    (state.status === "idle" && state.phase === "focus") ||
    (state.status === "done" && state.phase === "break");
  if (!canStart) return state;
  return {
    ...state,
    phase: "focus",
    status: "running",
    endsAt: nowMs + FOCUS_MS,
    remainingMs: FOCUS_MS,
  };
}

export function startBreak(state: BoardState, nowMs: number): BoardState {
  if (state.phase !== "focus" || state.status !== "done") return state;
  return {
    ...state,
    phase: "break",
    status: "running",
    endsAt: nowMs + BREAK_MS,
    remainingMs: BREAK_MS,
  };
}

export function pause(state: BoardState, nowMs: number): BoardState {
  if (state.status !== "running" || state.endsAt == null) return state;
  const remainingMs = Math.max(0, state.endsAt - nowMs);
  if (remainingMs === 0) {
    return { ...state, status: "done", endsAt: null, remainingMs: 0 };
  }
  return { ...state, status: "paused", endsAt: null, remainingMs };
}

export function resume(state: BoardState, nowMs: number): BoardState {
  if (state.status !== "paused") return state;
  return {
    ...state,
    status: "running",
    endsAt: nowMs + state.remainingMs,
    remainingMs: state.remainingMs,
  };
}

export function reset(state: BoardState): BoardState {
  return {
    ...state,
    phase: "focus",
    status: "idle",
    endsAt: null,
    remainingMs: FOCUS_MS,
  };
}

export function project(state: BoardState, nowMs: number): {
  phase: Phase;
  status: TimerStatus;
  remainingMs: number;
} {
  if (state.status === "running" && state.endsAt != null) {
    const cap = state.phase === "focus" ? FOCUS_MS : BREAK_MS;
    const remainingMs = Math.min(cap, state.endsAt - nowMs);
    if (remainingMs <= 0) {
      return { phase: state.phase, status: "done", remainingMs: 0 };
    }
    return { phase: state.phase, status: "running", remainingMs };
  }
  return {
    phase: state.phase,
    status: state.status,
    remainingMs: state.remainingMs,
  };
}

export function settle(state: BoardState, nowMs: number): BoardState {
  const view = project(state, nowMs);
  if (state.status === "running" && view.status === "done") {
    return { ...state, status: "done", endsAt: null, remainingMs: 0 };
  }
  return state;
}

export function formatClock(remainingMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function reconcile(state: BoardState, today: string): BoardState {
  if (state.date !== today) return freshBoard(today);
  return state;
}
