"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Check, Download, MessageSquare } from "lucide-react";
import { useCurrentUser, useTask } from "@/hooks/queries";
import { ErrorState, LoadingState } from "@/components/ui";
import { errorMessage } from "@/lib/utils";

interface TaskFeedback {
  id: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  rating: string;
  message: string;
  createdAt: string;
}

export function TaskFeedbackForm({ taskId }: { taskId: string }) {
  const task = useTask(taskId, Boolean(taskId));
  const user = useCurrentUser();
  const [rating, setRating] = useState("helpful");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<TaskFeedback | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task.data || !user.data) return;
    if (!message.trim()) {
      setError("Add a few words about this task.");
      document.getElementById("task-feedback-message")?.focus();
      return;
    }
    try {
      const feedback: TaskFeedback = {
        id: crypto.randomUUID(),
        taskId: task.data.id,
        taskTitle: task.data.title,
        userId: user.data.id,
        rating,
        message: message.trim(),
        createdAt: new Date().toISOString(),
      };
      const key = "our-patch-task-feedback-v1";
      const existing: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (!Array.isArray(existing)) throw new Error("Invalid feedback storage");
      localStorage.setItem(key, JSON.stringify([...existing, feedback]));
      setError("");
      setSaved(feedback);
    } catch {
      setError("Feedback couldn't be saved on this device. Please try again.");
    }
  }

  function download() {
    if (!saved) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(saved, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "our-patch-task-feedback.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main id="main-content" className="feedback-page">
      <Link href="/" className="back-link">
        <ArrowLeft size={16} /> Back to your neighbourhood
      </Link>
      <section className="feedback-form-card">
        <span className="eyebrow">
          <MessageSquare size={15} /> YOUR IDEAS HELP US GROW
        </span>
        <h1>
          Task feedback<span className="brand-dot">.</span>
        </h1>
        {!taskId ? (
          <ErrorState message="Choose a task from your neighbourhood to give feedback." />
        ) : task.isPending ? (
          <LoadingState message="Loading the task…" />
        ) : task.isError ? (
          <ErrorState
            message={errorMessage(task.error)}
            retry={() => {
              void task.refetch();
            }}
          />
        ) : saved ? (
          <div className="feedback-saved" role="status">
            <Check size={28} />
            <h2>Feedback saved.</h2>
            <p>
              Your feedback on {saved.taskTitle} is saved on this device.
              Download a copy to share with the team.
            </p>
            <button className="button button-secondary" onClick={download}>
              <Download size={16} /> Download feedback
            </button>
            <Link className="button button-primary" href="/">
              Back to your neighbourhood
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2>{task.data.title}</h2>
            <p className="muted">
              What worked well? What could make this action easier?
            </p>
            <div className="form-field">
              <label htmlFor="task-feedback-rating">
                How did you find this task?
              </label>
              <select
                id="task-feedback-rating"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
              >
                <option value="helpful">Helpful</option>
                <option value="okay">It was okay</option>
                <option value="needs-improvement">Could be improved</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="task-feedback-message">Your feedback</label>
              <textarea
                id="task-feedback-message"
                rows={5}
                maxLength={2000}
                required
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setError("");
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "task-feedback-error" : undefined}
                placeholder="Tell us about your experience with this task…"
              />
            </div>
            <p className="field-help">
              Feedback is saved in this browser for now.
            </p>
            {error && (
              <p id="task-feedback-error" className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary" type="submit">
              Save feedback <MessageSquare size={16} />
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
