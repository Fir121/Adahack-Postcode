import { TaskFeedbackForm } from "@/components/tasks/task-feedback-form";

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ task_id?: string | string[] }>;
}) {
  const { task_id } = await searchParams;
  return (
    <TaskFeedbackForm taskId={typeof task_id === "string" ? task_id : ""} />
  );
}
