"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Clock3,
  ImagePlus,
  LoaderCircle,
  Sprout,
  X,
} from "lucide-react";
import type { CompletionResponse, Task, TaskProof } from "@/types/domain";
import { completeTask } from "@/lib/api/completions";
import { ApiError } from "@/lib/api/client";
import { apiConfig } from "@/lib/api/config";
import { validateProof } from "@/lib/tasks";
import { dateLabel, dayKey, errorMessage } from "@/lib/utils";
import { formatGreenScore } from "@/lib/scoring";
import { useTask } from "@/hooks/queries";
import { ErrorState, LoadingState, IndicatorIcon } from "@/components/ui";
import { useGreenHour } from "@/components/layout/green-hour";

export function CompletionModal({
  task,
  communityId,
  postcode,
  onClose,
  onComplete,
}: {
  task: Task;
  communityId: string;
  postcode: string;
  onClose: () => void;
  onComplete: (result: CompletionResponse) => Promise<void>;
}) {
  const { active: greenHourActive } = useGreenHour();
  const details = useTask(task.id, !apiConfig.useMock);
  const dialog = useRef<HTMLDialogElement>(null);
  const [proof, setProof] = useState<TaskProof>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: () => completeTask({ taskId: task.id, communityId, proof }),
    onSuccess: onComplete,
    onError: (error) => {
      if (error instanceof ApiError && error.fields) setErrors(error.fields);
    },
  });
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = validateProof(task, proof);
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`proof-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    mutation.mutate();
  }
  const approved = mutation.data?.completion.status === "approved";
  const basePoints =
    details.data?.points ?? task.points ?? (apiConfig.useMock ? 1 : undefined);
  const points =
    basePoints === undefined
      ? undefined
      : basePoints * (greenHourActive ? 2 : 1);
  return (
    <dialog
      ref={dialog}
      className="completion-modal"
      aria-labelledby="task-modal-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!mutation.isPending) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current && !mutation.isPending) {
          const rect = dialog.current.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <button
        className="modal-close"
        aria-label="Close action"
        disabled={mutation.isPending}
        onClick={onClose}
      >
        <X size={20} />
      </button>
      {!apiConfig.useMock ? (
        mutation.isSuccess ? (
          <div className="completion-success">
            <span className="success-sprout">
              <Check size={36} />
            </span>
            <h2 id="task-modal-title">Action recorded.</h2>
            <p>
              {task.title} · {dateLabel(mutation.data.completion.completedAt)}
            </p>
            <div className="success-summary">
              <strong>
                {mutation.data.completion.points === undefined
                  ? "Added to your action history"
                  : `${mutation.data.completion.points} ${mutation.data.completion.points === 1 ? "point" : "points"}`}
              </strong>
            </div>
            <p className="muted">
              Your action is saved in your history and included in your
              community leaderboard.
            </p>
            <button className="button button-primary" onClick={onClose}>
              Back to my neighbourhood <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <>
            <span className="task-category">Community action</span>
            <h2 id="task-modal-title">{details.data?.title ?? task.title}</h2>
            {details.isPending ? (
              <LoadingState message="Loading action details…" />
            ) : details.isError ? (
              <ErrorState
                message={errorMessage(details.error)}
                retry={() => {
                  void details.refetch();
                }}
              />
            ) : (
              <>
                <p className="modal-description">{details.data.description}</p>
                <p className="task-meta">
                  {points} {points === 1 ? "point" : "points"}
                  {greenHourActive && (
                    <span className="green-hour-points">2× GreenHour</span>
                  )}
                </p>
                <form onSubmit={submit} noValidate>
                  <h3>Done your good thing?</h3>
                  <p className="muted">
                    Record this action for{" "}
                    {dateLabel(dayKey(new Date()) + "T12:00:00Z")}.
                  </p>
                  <label className="checkbox-label proof-field">
                    <input
                      type="checkbox"
                      checked={proof.declaration ?? false}
                      disabled={mutation.isPending}
                      onChange={(event) =>
                        setProof({ declaration: event.target.checked })
                      }
                    />
                    I have completed this action
                  </label>
                  {mutation.isError && (
                    <p className="form-error" role="alert">
                      {errorMessage(mutation.error)}
                    </p>
                  )}
                  <button
                    className="button button-primary"
                    disabled={mutation.isPending || !proof.declaration}
                    type="submit"
                  >
                    {mutation.isPending
                      ? "Recording your action…"
                      : "Record action"}{" "}
                    <ArrowRight size={17} />
                  </button>
                </form>
              </>
            )}
          </>
        )
      ) : mutation.isSuccess ? (
        <div className="completion-success">
          <span className="success-sprout">
            <Sprout size={38} />
          </span>
          <span className="eyebrow">
            {approved ? "ONE MORE GOOD THING" : "THANKS FOR LENDING A HAND"}
          </span>
          <h2 id="task-modal-title">
            {approved
              ? "Look what we're growing."
              : "Your action is being reviewed."}
          </h2>
          <p>
            {approved
              ? `Your contribution is now part of ${postcode}'s community progress.`
              : "We'll add your contribution once your proof is approved."}
          </p>
          {approved && (
            <div className="success-score">
              <strong>
                {formatGreenScore(mutation.data.progress.score)}
                <small>/100</small>
              </strong>
              <span>Community Green Score</span>
            </div>
          )}
          <div className="success-summary">
            <Check size={17} />
            <span>{task.title}</span>
          </div>
          <p className="muted">
            {approved
              ? "A little action. A greener story. Keep growing together."
              : "You can follow its status in your account history."}
          </p>
          <button className="button button-primary" onClick={onClose}>
            Back to my neighbourhood <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <>
          <span className="task-category">
            <IndicatorIcon type={task.targetIndicators[0]} size={16} />{" "}
            {task.category}
          </span>
          <h2 id="task-modal-title">{task.title}</h2>
          <div className="task-meta">
            <Clock3 size={15} /> {task.estimatedTime} · {task.effort}
            <span>
              · {points} {points === 1 ? "point" : "points"}
            </span>
            {greenHourActive && (
              <span className="green-hour-points">2× GreenHour</span>
            )}
          </div>
          <p className="modal-description">{task.description}</p>
          <div className="task-why">
            <Sprout size={19} />
            <div>
              <strong>Why this little action matters</strong>
              <p>{task.whyItMatters}</p>
            </div>
          </div>
          <form onSubmit={submit} noValidate>
            <h3>Done your good thing?</h3>
            <p className="muted">Share the proof this action needs.</p>
            <fieldset disabled={mutation.isPending} className="proof-fields">
              {task.proofRequirements.map((requirement) => (
                <div className="proof-field" key={requirement.type}>
                  {requirement.type === "declaration" ? (
                    <label className="checkbox-label">
                      <input
                        id="proof-declaration"
                        type="checkbox"
                        checked={proof.declaration ?? false}
                        onChange={(event) => {
                          setProof((p) => ({
                            ...p,
                            declaration: event.target.checked,
                          }));
                          setErrors((e) => ({ ...e, declaration: "" }));
                        }}
                        aria-invalid={Boolean(errors.declaration)}
                        aria-describedby={
                          errors.declaration ? "declaration-error" : undefined
                        }
                      />
                      {requirement.label}
                      {!requirement.required && " (optional)"}
                    </label>
                  ) : requirement.type === "text" ? (
                    <>
                      <label htmlFor="proof-text">
                        {requirement.label}
                        {!requirement.required && " (optional)"}
                      </label>
                      <textarea
                        id="proof-text"
                        rows={3}
                        maxLength={2000}
                        value={proof.text ?? ""}
                        onChange={(event) => {
                          setProof((p) => ({ ...p, text: event.target.value }));
                          setErrors((e) => ({ ...e, text: "" }));
                        }}
                        placeholder="A few words about your contribution…"
                        aria-invalid={Boolean(errors.text)}
                        aria-describedby={
                          errors.text ? "text-error" : undefined
                        }
                      />
                    </>
                  ) : (
                    <>
                      <label htmlFor="proof-image">
                        <ImagePlus size={17} /> {requirement.label}
                        {!requirement.required && " (optional)"}
                      </label>
                      <input
                        id="proof-image"
                        type="file"
                        accept={requirement.acceptedTypes.join(",")}
                        onChange={(event) => {
                          setProof((p) => ({
                            ...p,
                            image: event.target.files?.[0],
                          }));
                          setErrors((e) => ({ ...e, image: "" }));
                        }}
                        aria-invalid={Boolean(errors.image)}
                        aria-describedby="image-help image-error"
                      />
                      <p id="image-help" className="field-help">
                        JPEG, PNG or WebP · Max{" "}
                        {Math.round(requirement.maxBytes / 1024 / 1024)} MB
                        {proof.image && ` · ${proof.image.name}`}
                      </p>
                    </>
                  )}
                  {errors[requirement.type] && (
                    <p id={`${requirement.type}-error`} className="field-error">
                      {errors[requirement.type]}
                    </p>
                  )}
                </div>
              ))}
            </fieldset>
            {mutation.isError && (
              <p className="form-error" role="alert">
                {errorMessage(mutation.error)}
              </p>
            )}
            <button
              className="button button-primary"
              disabled={mutation.isPending}
              type="submit"
            >
              {mutation.isPending ? (
                <>
                  <LoaderCircle className="spin" size={17} /> Adding your
                  contribution…
                </>
              ) : (
                <>
                  Complete action <ArrowRight size={17} />
                </>
              )}
            </button>
            {apiConfig.useMock && (
              <p className="modal-demo-note">
                Demo proof is approved instantly. Photo files aren&apos;t
                retained in this browser demo.
              </p>
            )}
          </form>
        </>
      )}
    </dialog>
  );
}
