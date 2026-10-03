"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Leaf,
  LocateFixed,
  MapPin,
  Sprout,
  X,
} from "lucide-react";
import {
  queryKeys,
  useCommunities,
  useCommunity,
  useCurrentUser,
  useHistory,
  useTasks,
} from "@/hooks/queries";
import { errorMessage } from "@/lib/utils";
import { formatGreenScore } from "@/lib/scoring";
import { isTaskAvailable, recommendTasks } from "@/lib/tasks";
import { CommunitySidebar, type SidebarView } from "./community-sidebar";
import { LeaderboardModal } from "./leaderboard-modal";
import { CompletionModal } from "@/components/tasks/completion-modal";
import { ErrorState, LoadingState } from "@/components/ui";
import type {
  CompletionResponse,
  PostcodeCommunity,
  Task,
} from "@/types/domain";

const CommunityMap = dynamic(() => import("@/components/map/community-map"), {
  ssr: false,
  loading: () => <LoadingState message="Getting your map ready…" />,
});

export function Dashboard() {
  const user = useCurrentUser();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<SidebarView>("overview");
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [feedback, setFeedback] = useState<CompletionResponse | null>(null);
  const community = useCommunity(selectedId ?? user.data?.communityId ?? "");
  const communities = useCommunities();
  const tasks = useTasks();
  const history = useHistory(user.data?.id ?? "");
  const client = useQueryClient();

  function select(id: string) {
    setSelectedId(id);
    setView("overview");
    setFocusRequest((n) => n + 1);
  }
  const returnHome = () => {
    if (user.data) select(user.data.communityId);
  };
  async function completed(result: CompletionResponse) {
    if (result.completion.status !== "recorded")
      client.setQueryData<PostcodeCommunity>(
        queryKeys.community(result.completion.communityId),
        (current) =>
          current
            ? {
                ...current,
                progress: result.progress,
                decorations: result.decoration
                  ? [
                      ...current.decorations.filter(
                        (d) => d.id !== result.decoration!.id,
                      ),
                      result.decoration,
                    ]
                  : current.decorations,
              }
            : current,
      );
    setFeedback(result);
    document.getElementById("sidebar-content")?.scrollTo({ top: 0 });
    // Refetches reconcile backend totals, histories, and all visible communities without reloading.
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.communities }),
      client.invalidateQueries({
        queryKey: queryKeys.community(result.completion.communityId),
      }),
      client.invalidateQueries({ queryKey: queryKeys.history(user.data!.id) }),
      client.invalidateQueries({
        queryKey: queryKeys.leaderboard(user.data!.postcode),
      }),
    ]);
  }
  if (community.isPending || !user.data) return <LoadingState />;
  if (community.isError)
    return (
      <main id="main-content">
        <ErrorState
          message={errorMessage(community.error)}
          retry={() => {
            void community.refetch();
          }}
        />
        <button
          className="button button-secondary missing-home"
          onClick={returnHome}
        >
          Return to my postcode
        </button>
      </main>
    );
  const current = community.data;
  const own = user.data.communityId === current.id;
  const ordered = recommendTasks(tasks.data ?? [], current.indicators);
  const completedTaskIds = own
    ? ordered
        .filter((t) => !isTaskAvailable(t, history.data ?? [], current.id))
        .map((t) => t.id)
    : [];
  const mapCommunities = (communities.data ?? [current]).map((c) =>
    c.id === current.id ? current : c,
  );
  if (!mapCommunities.some((c) => c.id === current.id))
    mapCommunities.push(current);

  return (
    <main id="main-content" className="dashboard">
      <section className="dashboard-heading">
        <div>
          <h1>
            Take action <span>together.</span>
          </h1>
        </div>
        <div className="home-badge">
          <span className="home-badge-icon">
            <MapPin size={20} />
          </span>
          <div>
            <span>YOUR HOME POSTCODE</span>
            <strong>{user.data.postcode}</strong>
          </div>
          <button aria-label="Focus on my postcode" onClick={returnHome}>
            <LocateFixed size={17} />
          </button>
        </div>
      </section>
      <div className={`map-layout ${expanded ? "drawer-expanded" : ""}`}>
        <section className="map-region" aria-label="Your community map">
          <div className="map-toolbar">
            <div className="map-toolbar-title">
              <span className="toolbar-leaf">
                <Leaf size={16} />
              </span>
              <span>See what extraordinary things your postcode could do</span>
            </div>
            <label className="community-selector">
              <MapPin size={13} />
              <span className="sr-only">Explore a postcode</span>
              <select
                value={current.id}
                onChange={(event) => select(event.target.value)}
              >
                {mapCommunities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.postcode}
                    {c.id === user.data!.communityId ? " · Home" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
          <CommunityMap
            communities={mapCommunities}
            selected={current}
            ownCommunityId={user.data.communityId}
            onSelect={select}
            selectedIndicator={
              typeof view === "object" ? view.indicatorId : undefined
            }
            focusRequest={focusRequest}
          />
          <div className="map-bottom-story">
            <span className="story-sprout">
              <Sprout size={21} />
            </span>
            <div>
              <strong>
                Every action adds a little green to your community.
                <br />
                Green outcomes make your community stronger!
              </strong>
            </div>
          </div>
          {communities.isError && (
            <div className="neighbours-error" role="alert">
              Nearby communities couldn&apos;t load.{" "}
              <button
                className="text-button"
                onClick={() => {
                  void communities.refetch();
                }}
              >
                Try again
              </button>
            </div>
          )}
          {feedback && (
            <div className="contribution-toast" role="status">
              <span className="toast-check">
                <Check size={19} />
              </span>
              <div>
                <strong>
                  {feedback.completion.status === "recorded"
                    ? "Your action has been recorded."
                    : feedback.completion.status === "approved"
                      ? "A little greener, together."
                      : "Your action is awaiting review."}
                </strong>
                <span>
                  {feedback.completion.status === "recorded"
                    ? feedback.completion.points === undefined
                      ? "Added to your action history."
                      : `${feedback.completion.points} ${feedback.completion.points === 1 ? "point" : "points"} added to your recorded activities.`
                    : feedback.completion.status === "approved"
                      ? `Your community has ${feedback.progress.totalActions} actions this month.`
                      : "Check your account for its status."}
                </span>
              </div>
              <button
                aria-label="Dismiss contribution message"
                onClick={() => setFeedback(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </section>
        <aside
          className="community-sidebar"
          aria-label="Selected postcode details"
        >
          <button
            className="drawer-toggle"
            aria-expanded={expanded}
            aria-controls="sidebar-content"
            onClick={() => setExpanded((e) => !e)}
          >
            <span className="drawer-handle" />
            <span>
              {current.postcode} · Green Score{" "}
              {current.progress.scoreAvailable === false
                ? "pending"
                : formatGreenScore(current.progress.score)}
            </span>
            {expanded ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
          </button>
          <p className="drawer-hint">
            See how your neighbourhood is doing and find a little action to help
            it grow.
          </p>
          <div id="sidebar-content" className="sidebar-content">
            <CommunitySidebar
              community={current}
              own={own}
              view={view}
              tasks={ordered}
              completedTaskIds={completedTaskIds}
              tasksLoading={tasks.isPending || history.isPending}
              tasksError={
                tasks.isError
                  ? errorMessage(tasks.error)
                  : history.isError
                    ? errorMessage(history.error)
                    : undefined
              }
              onRetryTasks={() => {
                void tasks.refetch();
                void history.refetch();
              }}
              onRetryMetrics={() => {
                void community.refetch();
                void communities.refetch();
              }}
              onView={(next) => {
                setView(next);
                setExpanded(true);
                document
                  .getElementById("sidebar-content")
                  ?.scrollTo({ top: 0 });
              }}
              onTask={(selected) => {
                if (own) setTask(selected);
              }}
              onHome={returnHome}
              onLeaderboard={() => setLeaderboardOpen(true)}
            />
          </div>
        </aside>
      </div>
      <footer className="dashboard-footer">
        <span>
          Built by Team FlickFlack · Usage Data is for demonstration purposes
          only.
        </span>
      </footer>
      {leaderboardOpen && (
        <LeaderboardModal
          user={user.data}
          onClose={() => setLeaderboardOpen(false)}
        />
      )}
      {task && (
        <CompletionModal
          task={task}
          communityId={user.data.communityId}
          postcode={user.data.postcode}
          onClose={() => setTask(null)}
          onComplete={completed}
        />
      )}
    </main>
  );
}
