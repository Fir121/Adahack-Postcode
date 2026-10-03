import { MessageSquare } from "lucide-react";

export function TaskFeedbackButton({ taskId }: { taskId: string }) {
  const href =
    process.env.NEXT_PUBLIC_TASK_FEEDBACK_URL?.trim() ||
    `/feedback?task_id=${encodeURIComponent(taskId)}`;
  return (
    <a
      className="task-feedback-button"
      href={href}
      aria-label="Give feedback on this task"
      title="Give feedback on this task"
    >
      <MessageSquare size={16} aria-hidden="true" />
      <span className="task-feedback-tooltip" aria-hidden="true">
        Give feedback on this task
      </span>
    </a>
  );
}
