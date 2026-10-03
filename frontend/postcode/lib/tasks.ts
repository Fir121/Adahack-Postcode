import type {
  PostcodeIndicator,
  Task,
  TaskCompletion,
  TaskProof,
} from "@/types/domain";
import { dayKey } from "@/lib/utils";
import { indicatorStatus } from "@/lib/scoring";

export function isTaskAvailable(
  task: Task,
  history: TaskCompletion[],
  communityId: string,
  now = new Date(),
): boolean {
  return !history.some(
    (c) =>
      c.taskId === task.id &&
      c.communityId === communityId &&
      c.status !== "rejected" &&
      (task.repeat === "once" || dayKey(c.completedAt) === dayKey(now)),
  );
}

export function weakestIndicator(
  indicators: PostcodeIndicator[],
): PostcodeIndicator | undefined {
  return [...indicators].sort(
    (a, b) =>
      (a.score ?? indicatorStatus[a.status].rank * 25) -
      (b.score ?? indicatorStatus[b.status].rank * 25),
  )[0];
}

// A deliberately small ranking function; replace with backend recommendations later.
export function recommendTasks(
  tasks: Task[],
  indicators: PostcodeIndicator[],
): Task[] {
  const weak = weakestIndicator(indicators);
  if (!weak) return tasks;
  return [...tasks].sort(
    (a, b) =>
      Number(b.targetIndicators.includes(weak.id)) -
      Number(a.targetIndicators.includes(weak.id)),
  );
}

export function validateProof(
  task: Task,
  proof: TaskProof,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const requirement of task.proofRequirements) {
    if (
      requirement.type === "declaration" &&
      requirement.required &&
      !proof.declaration
    )
      errors.declaration = "Please confirm that you completed this action.";
    if (
      requirement.type === "text" &&
      (requirement.required || proof.text?.trim()) &&
      (proof.text?.trim().length ?? 0) < requirement.minLength
    )
      errors.text = `Tell us a little more (at least ${requirement.minLength} characters).`;
    if (requirement.type === "image") {
      if (requirement.required && !proof.image)
        errors.image = "Please choose a photo.";
      else if (
        proof.image &&
        !requirement.acceptedTypes.includes(proof.image.type)
      )
        errors.image = "Choose a JPEG, PNG, or WebP image.";
      else if (proof.image && proof.image.size > requirement.maxBytes)
        errors.image = `Your photo must be smaller than ${Math.round(requirement.maxBytes / 1024 / 1024)} MB.`;
      else if (proof.image && proof.image.size === 0)
        errors.image = "This file is empty. Please choose another photo.";
    }
  }
  return errors;
}
