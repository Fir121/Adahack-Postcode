"use client";

import { useEffect, useRef } from "react";
import { RefreshCw, Trophy, X } from "lucide-react";
import type { User } from "@/types/domain";
import { useCommunityLeaderboard } from "@/hooks/queries";
import { errorMessage } from "@/lib/utils";
import { ErrorState, LoadingState } from "@/components/ui";

export function LeaderboardModal({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const leaderboard = useCommunityLeaderboard(user.postcode);
  const current = leaderboard.data?.entries.find(
    (entry) => entry.userId === user.id,
  );
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      id="community-leaderboard-dialog"
      className="completion-modal leaderboard-modal"
      aria-labelledby="leaderboard-title"
      aria-describedby="leaderboard-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== dialog.current) return;
        const rect = dialog.current.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <button
        className="modal-close"
        aria-label="Close leaderboard"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <span className="eyebrow leaderboard-kicker">
        <Trophy size={18} /> YOUR COMMUNITY
      </span>
      <h2 id="leaderboard-title">Community leaderboard</h2>
      <p id="leaderboard-description" className="leaderboard-subtitle">
        {user.postcode} · Every contribution counts.
      </p>
      {leaderboard.isPending ? (
        <LoadingState message="Loading your community leaderboard…" />
      ) : leaderboard.isError ? (
        <ErrorState
          message={errorMessage(leaderboard.error)}
          retry={() => {
            void leaderboard.refetch();
          }}
        />
      ) : !leaderboard.data.available ? (
        <div className="leaderboard-empty">
          <Trophy size={32} aria-hidden="true" />
          <h3>Leaderboard coming soon</h3>
          <p>
            Your community’s rankings will appear here once they’re available.
          </p>
        </div>
      ) : !leaderboard.data.entries.length ? (
        <div className="leaderboard-empty">
          <h3>No rankings yet</h3>
          <p>Your community leaderboard is waiting for its first entries.</p>
        </div>
      ) : (
        <>
          {current ? (
            <div className="leaderboard-position" role="status">
              <div>
                <span>Your rank</span>
                <strong>#{current.rank}</strong>
              </div>
              <div>
                <span>Your points</span>
                <strong>{current.points.toLocaleString("en-GB")}</strong>
              </div>
            </div>
          ) : (
            <p className="empty-note">
              Your position isn’t available yet. Your community’s rankings are
              shown below.
            </p>
          )}
          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <caption className="sr-only">
                Community leaderboard for {user.postcode}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Name</th>
                  <th scope="col">Points</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.data.entries.map((entry) => (
                  <tr
                    key={entry.userId}
                    className={
                      entry.userId === user.id
                        ? "leaderboard-current-user"
                        : undefined
                    }
                    aria-current={entry.userId === user.id ? "true" : undefined}
                  >
                    <td>#{entry.rank}</td>
                    <th scope="row">
                      {entry.name}
                      {entry.userId === user.id && (
                        <span className="leaderboard-you">You</span>
                      )}
                    </th>
                    <td>{entry.points.toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {leaderboard.data?.source === "mock" && (
        <p className="leaderboard-demo-note">
          Demo rankings use profiles and approved actions saved in this browser.
          Each approved action earns one point.
        </p>
      )}
      {!leaderboard.isPending && !leaderboard.isError && (
        <button
          className="button button-secondary leaderboard-refresh"
          disabled={leaderboard.isFetching}
          onClick={() => {
            void leaderboard.refetch();
          }}
        >
          <RefreshCw
            size={15}
            className={leaderboard.isFetching ? "spin" : undefined}
          />{" "}
          {leaderboard.isFetching ? "Refreshing…" : "Refresh rankings"}
        </button>
      )}
    </dialog>
  );
}
