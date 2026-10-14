import { describe, expect, it } from "vitest";
import {
  BREAK_MS,
  FOCUS_MS,
  MAX_TASKS,
  addTask,
  calendarDate,
  deleteTask,
  formatClock,
  freshBoard,
  pause,
  project,
  reconcile,
  reset,
  resume,
  settle,
  startBreak,
  startFocus,
  toggleTask,
} from "./board";
import { STORAGE_KEY, loadBoard, saveBoard } from "./storage";

const DATE = "2026-10-14";
const NOW = new Date(2026, 9, 14, 9, 0, 0).getTime();

function memoryStore() {
  const items = new Map<string, string>();
  return {
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      items.set(key, value);
    },
  };
}

describe("calendar date", () => {
  it("uses the local calendar date, including just before midnight", () => {
    expect(calendarDate(new Date(2026, 9, 14, 23, 59))).toBe("2026-10-14");
    expect(calendarDate(new Date(2026, 9, 15, 0, 1))).toBe("2026-10-15");
  });
});

describe("tasks", () => {
  it("starts from an empty board for the given date", () => {
    const board = freshBoard(DATE);
    expect(board.tasks).toEqual([]);
    expect(board.date).toBe(DATE);
    expect(board.phase).toBe("focus");
    expect(board.status).toBe("idle");
    expect(board.endsAt).toBeNull();
    expect(board.remainingMs).toBe(FOCUS_MS);
    expect(FOCUS_MS).toBe(25 * 60 * 1000);
    expect(BREAK_MS).toBe(5 * 60 * 1000);
    expect(MAX_TASKS).toBe(3);
  });

  it("adds a task by its trimmed title", () => {
    const result = addTask(freshBoard(DATE), "  Write the README  ", "a");
    expect(result.error).toBeNull();
    expect(result.state.tasks).toEqual([
      { id: "a", title: "Write the README", done: false },
    ]);
  });

  it("refuses an empty title", () => {
    const start = freshBoard(DATE);
    const result = addTask(start, "   ", "a");
    expect(result.error).toBe("empty");
    expect(result.state).toBe(start);
  });

  it("caps the list at three and refuses a fourth", () => {
    let state = freshBoard(DATE);
    state = addTask(state, "One", "1").state;
    state = addTask(state, "Two", "2").state;
    state = addTask(state, "Three", "3").state;
    const refused = addTask(state, "Four", "4");
    expect(refused.error).toBe("full");
    expect(refused.state.tasks).toHaveLength(3);
    expect(refused.state.tasks.map((task) => task.title)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
  });

  it("marks a task done and can mark it open again", () => {
    const added = addTask(freshBoard(DATE), "Ship the timer", "1").state;
    const done = toggleTask(added, "1");
    expect(done.tasks[0]?.done).toBe(true);
    expect(toggleTask(done, "1").tasks[0]?.done).toBe(false);
  });

  it("deletes one task and leaves the others", () => {
    let state = freshBoard(DATE);
    state = addTask(state, "One", "1").state;
    state = addTask(state, "Two", "2").state;
    expect(deleteTask(state, "1").tasks).toEqual([
      { id: "2", title: "Two", done: false },
    ]);
  });
});

describe("timer", () => {
  it("does not show an extra second when the display clock is slightly behind the start", () => {
    const running = startFocus(freshBoard(DATE), NOW);
    expect(formatClock(project(running, NOW - 150).remainingMs)).toBe("25:00");
  });

  it("starts a 25-minute focus block from an end timestamp", () => {
    const running = startFocus(freshBoard(DATE), NOW);
    expect(running.status).toBe("running");
    expect(running.phase).toBe("focus");
    expect(running.endsAt).toBe(NOW + FOCUS_MS);
    expect(project(running, NOW + 1000)).toEqual({
      phase: "focus",
      status: "running",
      remainingMs: FOCUS_MS - 1000,
    });
  });

  it("pauses by freezing the remaining time and resumes from a new end timestamp", () => {
    const running = startFocus(freshBoard(DATE), NOW);
    const paused = pause(running, NOW + 5000);
    expect(paused.status).toBe("paused");
    expect(paused.endsAt).toBeNull();
    expect(paused.remainingMs).toBe(FOCUS_MS - 5000);
    expect(project(paused, NOW + 20_000).remainingMs).toBe(FOCUS_MS - 5000);

    const resumed = resume(paused, NOW + 8000);
    expect(resumed.status).toBe("running");
    expect(resumed.endsAt).toBe(NOW + 8000 + (FOCUS_MS - 5000));
    expect(project(resumed, NOW + 9000).remainingMs).toBe(FOCUS_MS - 6000);
  });

  it("does not drift when the clock jumps ahead of the saved end timestamp", () => {
    const running = startFocus(freshBoard(DATE), NOW);
    const later = project(running, NOW + 30 * 60 * 1000);
    expect(later.status).toBe("done");
    expect(later.remainingMs).toBe(0);
    expect(later.phase).toBe("focus");
  });

  it("resets the current block to an idle 25:00 focus without touching tasks", () => {
    const withTask = addTask(freshBoard(DATE), "Read", "1").state;
    const running = startFocus(withTask, NOW);
    const cleared = reset(running);
    expect(cleared.status).toBe("idle");
    expect(cleared.phase).toBe("focus");
    expect(cleared.endsAt).toBeNull();
    expect(cleared.remainingMs).toBe(FOCUS_MS);
    expect(cleared.tasks).toEqual(withTask.tasks);
  });

  it("offers a 5-minute break only after focus reaches zero", () => {
    const running = startFocus(freshBoard(DATE), NOW);
    expect(startBreak(running, NOW + 1000)).toBe(running);

    const finished = settle(running, running.endsAt ?? NOW);
    expect(finished.status).toBe("done");
    expect(finished.phase).toBe("focus");
    expect(finished.remainingMs).toBe(0);

    const breaking = startBreak(finished, NOW + FOCUS_MS);
    expect(breaking.phase).toBe("break");
    expect(breaking.status).toBe("running");
    expect(breaking.endsAt).toBe(NOW + FOCUS_MS + BREAK_MS);
  });

  it("offers another focus block only after the break reaches zero", () => {
    const finishedFocus = settle(startFocus(freshBoard(DATE), NOW), NOW + FOCUS_MS);
    const breaking = startBreak(finishedFocus, NOW + FOCUS_MS);
    expect(startFocus(breaking, NOW + FOCUS_MS + 1000)).toBe(breaking);

    const finishedBreak = settle(breaking, breaking.endsAt ?? NOW);
    expect(finishedBreak.status).toBe("done");
    expect(finishedBreak.phase).toBe("break");

    const again = startFocus(finishedBreak, NOW + FOCUS_MS + BREAK_MS);
    expect(again.phase).toBe("focus");
    expect(again.status).toBe("running");
    expect(again.endsAt).toBe(NOW + FOCUS_MS + BREAK_MS + FOCUS_MS);
  });

  it("formats remaining time as minutes and seconds", () => {
    expect(formatClock(FOCUS_MS)).toBe("25:00");
    expect(formatClock(BREAK_MS)).toBe("05:00");
    expect(formatClock(1000)).toBe("00:01");
    expect(formatClock(1)).toBe("00:01");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(1499000)).toBe("24:59");
  });
});

describe("persistence", () => {
  it("drops yesterday's tasks and timer when the saved date is not today", () => {
    const yesterday = addTask(freshBoard("2026-10-13"), "Old", "1").state;
    expect(reconcile(yesterday, DATE).tasks).toEqual([]);
    expect(reconcile(yesterday, DATE).date).toBe(DATE);
    expect(reconcile(yesterday, DATE).status).toBe("idle");
  });

  it("reloads a running focus from its end timestamp", () => {
    const store = memoryStore();
    const running = startFocus(
      addTask(freshBoard(DATE), "Keep this", "1").state,
      NOW,
    );
    saveBoard(store, running);

    const loaded = loadBoard(store, new Date(NOW + 90_000));
    expect(store.getItem(STORAGE_KEY)).toContain("Keep this");
    expect(loaded.tasks.map((task) => task.title)).toEqual(["Keep this"]);
    expect(loaded.status).toBe("running");
    expect(loaded.endsAt).toBe(running.endsAt);
    expect(project(loaded, NOW + 90_000).remainingMs).toBe(FOCUS_MS - 90_000);
  });

  it("reloads a paused block with the frozen remainder", () => {
    const store = memoryStore();
    const paused = pause(startFocus(freshBoard(DATE), NOW), NOW + 12_000);
    saveBoard(store, paused);
    const loaded = loadBoard(store, new Date(NOW + 60_000));
    expect(loaded.status).toBe("paused");
    expect(loaded.remainingMs).toBe(FOCUS_MS - 12_000);
    expect(project(loaded, NOW + 60_000).remainingMs).toBe(FOCUS_MS - 12_000);
  });

  it("treats a passed end timestamp as a finished block", () => {
    const store = memoryStore();
    saveBoard(store, startFocus(freshBoard(DATE), NOW));
    const loaded = loadBoard(store, new Date(NOW + FOCUS_MS + 5));
    expect(loaded.status).toBe("done");
    expect(loaded.phase).toBe("focus");
    expect(loaded.remainingMs).toBe(0);
    expect(loaded.endsAt).toBeNull();
  });

  it("starts fresh when stored data is unreadable", () => {
    const store = memoryStore();
    store.setItem(STORAGE_KEY, "{not json");
    const loaded = loadBoard(store, new Date(2026, 9, 14, 9, 0));
    expect(loaded).toEqual(freshBoard("2026-10-14"));
  });
});
