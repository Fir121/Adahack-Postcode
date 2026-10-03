"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  HandCoins,
  LogOut,
  MapPin,
  RotateCcw,
  Sprout,
  UserRound,
} from "lucide-react";
import { logout, resetDemo } from "@/lib/api/auth";
import { apiConfig } from "@/lib/api/config";
import {
  queryKeys,
  useCommunity,
  useCurrentUser,
  useHistory,
} from "@/hooks/queries";
import { dateLabel, dayKey, errorMessage } from "@/lib/utils";
import { ErrorState, IndicatorIcon, LoadingState } from "@/components/ui";
import { ActivityStreak } from "@/components/tasks/activity-streak";

export function AccountView() {
  const user = useCurrentUser();
  const history = useHistory(user.data?.id ?? "");
  const community = useCommunity(user.data?.communityId ?? "");
  const client = useQueryClient();
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  const mutation = useMutation({
    mutationFn: (reset: boolean) => (reset ? resetDemo() : logout()),
    onSuccess: () => {
      client.clear();
      client.setQueryData(queryKeys.user, null);
      router.replace("/login");
    },
  });
  if (!user.data) return <LoadingState message="Loading your account…" />;
  return (
    <main id="main-content" className="account-page">
      <Link href="/" className="back-link">
        <ArrowLeft size={16} /> Back to your neighbourhood
      </Link>
      <header className="account-heading">
        <h1>
          My Account<span className="brand-dot">.</span>
        </h1>
      </header>
      <div className="account-grid">
        <section className="profile-card">
          <span className="profile-avatar">
            <UserRound size={34} />
          </span>
          <h2>{user.data.name}</h2>
          <span className="membership-tag">
            <HandCoins size={14} /> Part of the Postcode Lottery
          </span>
          <br />
          <span className="membership-tag">
            <Sprout size={14} /> Part of the Patch community
          </span>
          <dl className="profile-fields">
            <div>
              <dt>Email address</dt>
              <dd>{user.data.email}</dd>
            </div>
            <div>
              <dt>Your postcode</dt>
              <dd>
                <MapPin size={16} /> {user.data.postcode}
              </dd>
            </div>
            <div>
              <dt>Community membership</dt>
              <dd>
                {user.data.postcode}
                {community.data?.city && ` · ${community.data.city}`}
              </dd>
              {community.isError && (
                <dd className="field-error" role="alert">
                  Community details couldn&apos;t load.{" "}
                  <button
                    className="text-button"
                    onClick={() => {
                      void community.refetch();
                    }}
                  >
                    Try again
                  </button>
                </dd>
              )}
            </div>
          </dl>
          <ActivityStreak userId={user.data.id} />
          <Link className="button button-primary" href="/">
            Visit your neighbourhood <ArrowRight size={17} />
          </Link>
          <button
            className="button button-secondary"
            onClick={() => mutation.mutate(false)}
            disabled={mutation.isPending}
          >
            <LogOut size={16} />{" "}
            {mutation.isPending ? "Please wait…" : "Sign out"}
          </button>
          {apiConfig.useMock && (
            <div className="reset-section">
              <p>Demo progress is saved in this browser.</p>
              {confirmReset ? (
                <>
                  <p>
                    Reset removes all saved demo accounts and progress in this
                    browser.
                  </p>
                  <button
                    className="text-button danger-text"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(true)}
                  >
                    Confirm reset
                  </button>
                  <button
                    className="text-button"
                    disabled={mutation.isPending}
                    onClick={() => setConfirmReset(false)}
                  >
                    Keep my progress
                  </button>
                </>
              ) : (
                <button
                  className="text-button"
                  onClick={() => setConfirmReset(true)}
                >
                  <RotateCcw size={13} /> Reset demo
                </button>
              )}
            </div>
          )}
          {mutation.isError && (
            <p className="form-error" role="alert">
              {errorMessage(mutation.error)}
            </p>
          )}
        </section>
        <section className="history-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">GOOD THINGS YOU&apos;VE DONE</span>
              <h2>Your action history</h2>
            </div>
            <span className="history-count">{history.data?.length ?? "—"}</span>
          </div>
          <p className="muted">
            Each action is a little contribution to your postcode.
          </p>
          {history.isPending ? (
            <LoadingState message="Gathering your contributions…" />
          ) : history.isError ? (
            <ErrorState
              message={errorMessage(history.error)}
              retry={() => {
                void history.refetch();
              }}
            />
          ) : !history.data.length ? (
            <div className="empty-history">
              <Sprout size={36} />
              <h3>Your first good thing is waiting.</h3>
              <p>Complete an action to start growing your history.</p>
              <Link href="/" className="button button-secondary">
                Find your first action <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <ol className="history-list">
              {history.data.map((completion) => (
                <li key={completion.id}>
                  <span className="history-check">
                    {completion.status === "approved" ? (
                      <Check size={19} />
                    ) : (
                      <IndicatorIcon
                        type={completion.targetIndicators[0]}
                        size={19}
                      />
                    )}
                  </span>
                  <div>
                    <span className="history-date">
                      {dayKey(completion.completedAt) === dayKey(new Date())
                        ? "Today"
                        : dateLabel(completion.completedAt)}
                    </span>
                    <h3>{completion.taskTitle}</h3>
                    <p>
                      {completion.category} ·{" "}
                      {completion.communityId === user.data!.communityId
                        ? user.data!.postcode
                        : "Previous community"}
                    </p>
                    <span className="completion-status">
                      {completion.status === "recorded"
                        ? "Action recorded"
                        : completion.status === "approved"
                          ? "Contribution approved"
                          : completion.status === "pending"
                            ? "Awaiting review"
                            : "Not approved"}
                      {completion.points !== undefined &&
                        ` · ${completion.points} ${completion.points === 1 ? "point" : "points"}`}
                      {completion.proofStatus &&
                        ` · Proof ${completion.proofStatus}`}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <p className="account-footnote">
        Built by Team FlickFlack · Usage Data is for demonstration purposes
        only.
      </p>
    </main>
  );
}
