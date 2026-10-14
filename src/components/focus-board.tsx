"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  calendarDate,
  deleteTask,
  formatClock,
  freshBoard,
  pause,
  project,
  reset,
  resume,
  settle,
  startBreak,
  startFocus,
  toggleTask,
  type BoardState,
} from "@/lib/board";
import { loadBoard, saveBoard } from "@/lib/storage";

function formatBoardDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function statusCopy(board: BoardState): string {
  if (board.status === "done" && board.phase === "focus") {
    return "This focus block is done.";
  }
  if (board.status === "done" && board.phase === "break") {
    return "This break is done.";
  }
  if (board.status === "paused" && board.phase === "focus") {
    return "Focus is paused. Resume when you are ready.";
  }
  if (board.status === "paused") {
    return "Break is paused.";
  }
  if (board.status === "running" && board.phase === "focus") {
    return "Focus is running.";
  }
  if (board.status === "running") {
    return "Break is running.";
  }
  return "Ready for a 25-minute focus block.";
}

function advance(current: BoardState | null, nowMs: number): BoardState {
  const today = calendarDate(new Date(nowMs));
  const base = current ?? loadBoard(window.localStorage, new Date(nowMs));
  const dated = base.date === today ? base : freshBoard(today);
  return settle(dated, nowMs);
}

export function FocusBoard() {
  const [board, setBoard] = useState<BoardState | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const tick = (nowMs: number) => {
      setNow(nowMs);
      setBoard((current) => {
        const next = advance(current, nowMs);
        if (next !== current) saveBoard(window.localStorage, next);
        return next;
      });
    };
    const timeout = window.setTimeout(() => tick(Date.now()), 0);
    const interval = window.setInterval(() => tick(Date.now()), 200);
    const onVisible = () => tick(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  function commit(next: BoardState) {
    saveBoard(window.localStorage, next);
    setBoard(next);
  }

  if (!board || now == null) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
        <h1 className="font-display text-2xl uppercase leading-tight sm:text-3xl">
          simple-podomoro
        </h1>
        <p className="text-sm text-muted-foreground">Opening today’s board…</p>
      </main>
    );
  }

  const live = settle(board, now);
  const view = project(live, now);
  const tasksDone = live.tasks.length > 0 && live.tasks.every((task) => task.done);

  function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) {
      setNotice("Write a task title before adding it.");
      return;
    }
    if (live.tasks.length >= 3) {
      setNotice("This board holds three tasks. Delete one to make room.");
      return;
    }
    setNotice(null);
    setDraft("");
    commit({
      ...live,
      tasks: [...live.tasks, { id: crypto.randomUUID(), title, done: false }],
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header>
        <h1 className="font-display text-2xl uppercase leading-tight sm:text-3xl">
          simple-podomoro
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{formatBoardDate(live.date)}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{view.phase === "focus" ? "Focus" : "Break"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="font-display text-5xl leading-none tracking-wide uppercase sm:text-6xl">
            {formatClock(view.remainingMs)}
          </p>
          <p>{statusCopy(live)}</p>
          <div className="flex flex-wrap gap-3">
            {view.status === "idle" && view.phase === "focus" ? (
              <Button type="button" onClick={() => commit(startFocus(live, Date.now()))}>
                Start focus
              </Button>
            ) : null}
            {view.status === "running" ? (
              <Button type="button" variant="secondary" onClick={() => commit(pause(live, Date.now()))}>
                Pause
              </Button>
            ) : null}
            {view.status === "paused" ? (
              <Button type="button" onClick={() => commit(resume(live, Date.now()))}>
                Resume
              </Button>
            ) : null}
            {view.status === "done" && view.phase === "focus" ? (
              <Button type="button" onClick={() => commit(startBreak(live, Date.now()))}>
                Start 5-minute break
              </Button>
            ) : null}
            {view.status === "done" && view.phase === "break" ? (
              <Button type="button" onClick={() => commit(startFocus(live, Date.now()))}>
                Start another focus block
              </Button>
            ) : null}
            {view.status !== "idle" ? (
              <Button type="button" variant="secondary" onClick={() => commit(reset(live))}>
                Reset
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today’s tasks</CardTitle>
          {live.tasks.length === 0 ? (
            <p>
              Name today’s three tasks. A focus block is 25 minutes, then a 5-minute break. This
              list stays on this device until the date changes.
            </p>
          ) : null}
          {tasksDone ? <p>All of today’s tasks are done.</p> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {live.tasks.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {live.tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-col gap-3 border-b-2 border-border pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span
                    className={
                      task.done ? "break-words text-muted-foreground line-through" : "break-words"
                    }
                  >
                    {task.title}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => commit(toggleTask(live, task.id))}
                    >
                      {task.done ? "Undo" : "Mark done"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => commit(deleteTask(live, task.id))}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <form onSubmit={onAdd} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="task-title">
              Task title
            </label>
            <Input
              id="task-title"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (notice) setNotice(null);
              }}
              placeholder="What are you focusing on?"
              maxLength={120}
            />
            <Button type="submit">Add task</Button>
          </form>
          {notice ? <p className="text-sm text-destructive">{notice}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
