"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Info,
  MapPin,
  Sprout,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import type {
  PostcodeCommunity,
  PostcodeIndicator,
  Task,
} from "@/types/domain";
import { indicatorStatus } from "@/lib/scoring";
import { weakestIndicator } from "@/lib/tasks";
import { dateLabel } from "@/lib/utils";
import { IndicatorIcon } from "@/components/ui";

export type SidebarView = "overview" | "actions" | { indicatorId: string };
interface SidebarProps {
  community: PostcodeCommunity;
  own: boolean;
  view: SidebarView;
  tasks: Task[];
  completedTaskIds: string[];
  tasksLoading: boolean;
  tasksError?: string;
  onRetryTasks: () => void;
  onView: (view: SidebarView) => void;
  onTask: (task: Task) => void;
  onHome: () => void;
  onLeaderboard: () => void;
}

export function CommunitySidebar(props: SidebarProps) {
  const { community, view, tasks, own } = props;
  const selected =
    typeof view === "object"
      ? community.indicators.find((i) => i.id === view.indicatorId)
      : undefined;
  const focus = weakestIndicator(community.indicators);
  const available = tasks.filter((t) => !props.completedTaskIds.includes(t.id));
  const dailyAction = tasks[0];
  const dailyCompleted = Boolean(
    dailyAction && props.completedTaskIds.includes(dailyAction.id),
  );
  const recommended = dailyCompleted ? undefined : dailyAction;
  return (
    <>
      <div className="sidebar-topline">
        <span className="eyebrow">
          <MapPin size={13} /> {own ? "YOUR POSTCODE" : "MEET THE NEIGHBOURS"}
        </span>
        <span className="live-tag">
          <span />{" "}
          {community.indicators.some((i) => i.provenance === "mock")
            ? "Demo"
            : "Community"}
        </span>
      </div>
      <div className="sidebar-identity">
        <h2>{community.postcode}</h2>
        <p>
          {own
            ? community.name
            : [community.city, "Neighbouring community"]
                .filter(Boolean)
                .join(" · ")}
        </p>
      </div>
      <button
        className="button button-secondary leaderboard-trigger"
        onClick={props.onLeaderboard}
        aria-haspopup="dialog"
        aria-controls="community-leaderboard-dialog"
      >
        <Trophy size={17} /> My community leaderboard <ChevronRight size={16} />
      </button>
      {view !== "overview" && (
        <button
          className="back-link sidebar-back"
          onClick={() => props.onView("overview")}
        >
          <ArrowLeft size={15} /> Postcode overview
        </button>
      )}
      {selected ? (
        <IndicatorDetails
          indicator={selected}
          community={community}
          tasks={available.filter((t) =>
            t.targetIndicators.includes(selected.id),
          )}
          own={own}
          onTask={props.onTask}
          onHome={props.onHome}
          tasksLoading={props.tasksLoading}
          tasksError={props.tasksError}
          onRetry={props.onRetryTasks}
        />
      ) : view === "actions" ? (
        <>
          <div className="sidebar-section-heading">
            <span className="eyebrow">SMALL STEPS, BIG TOGETHER</span>
            <h3>Find your next good thing.</h3>
            <p>
              {community.indicators.length
                ? "Actions inspired by your community’s environmental indicators."
                : "Explore the actions available for your community."}
            </p>
          </div>
          {!own && <NeighbourNote onHome={props.onHome} />}
          {props.tasksLoading ? (
            <p className="muted" role="status">
              Finding your actions…
            </p>
          ) : props.tasksError ? (
            <TaskError
              message={props.tasksError}
              onRetry={props.onRetryTasks}
            />
          ) : !tasks.length ? (
            <p className="empty-note">
              No actions are available yet. Check back soon.
            </p>
          ) : (
            <div className="all-tasks">
              {tasks.map((task) => (
                <ActionCard
                  key={task.id}
                  task={task}
                  indicators={community.indicators}
                  own={own}
                  completed={props.completedTaskIds.includes(task.id)}
                  onTask={props.onTask}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {community.progress.scoreAvailable === false ? (
            <div className="score-card score-pending">
              <Sprout size={30} />
              <div>
                <strong>Green Score pending</strong>
                <p>Community scores aren’t available yet.</p>
              </div>
            </div>
          ) : (
            <ScoreCard
              score={community.progress.score}
              change={community.progress.monthlyChange}
            />
          )}
          <div className="indicator-heading">
            <h3>How&apos;s your neighbourhood?</h3>
            <span title="Environmental data and community contributions are tracked separately">
              <Info size={15} />
            </span>
          </div>
          <p className="indicator-subtitle">
            Data from public sources, updated periodically.
          </p>
          {community.indicators.length ? (
            <div className="indicator-list">
              {community.indicators.map((indicator) => (
                <button
                  className="indicator-row"
                  key={indicator.id}
                  onClick={() => props.onView({ indicatorId: indicator.id })}
                >
                  <span className={`indicator-icon icon-${indicator.type}`}>
                    <IndicatorIcon type={indicator.type} size={19} />
                  </span>
                  <span className="indicator-name">{indicator.label}</span>
                  <span
                    className={`indicator-status ${indicatorStatus[indicator.status].className}`}
                  >
                    {indicatorStatus[indicator.status].label}
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-note">
              Environmental indicators aren&apos;t available for this postcode
              yet.
            </p>
          )}
          {community.indicators.some((i) => i.provenance === "mock") && (
            <p className="data-note">
              Illustrative environmental data, not live measurements.
            </p>
          )}
          <div className="focus-card">
            <div className="focus-card-top">
              <span className="eyebrow">TODAY&apos;S LITTLE GOOD THING</span>
              <span className="focus-flower">
                <Sprout size={19} />
              </span>
            </div>
            {props.tasksLoading ? (
              <p role="status">Finding an action for you…</p>
            ) : props.tasksError ? (
              <TaskError
                message={props.tasksError}
                onRetry={props.onRetryTasks}
              />
            ) : recommended ? (
              <>
                <span className="focus-label">
                  {focus && recommended.targetIndicators.includes(focus.id)
                    ? `${focus.label} could use a little love`
                    : "Keep your community growing"}
                </span>
                <h3>{recommended.title}</h3>
                <p>
                  {focus && recommended.targetIndicators.includes(focus.id)
                    ? `One of ${own ? "your" : "this"} postcode's focus areas. Here's a small step that can help.`
                    : recommended.whyItMatters}
                </p>
                {recommended.points !== undefined ? (
                  <div className="task-meta">
                    {recommended.points}{" "}
                    {recommended.points === 1 ? "point" : "points"}
                  </div>
                ) : (
                  <div className="task-meta">
                    <Clock3 size={13} /> {recommended.estimatedTime}
                    <span>·</span>
                    {recommended.effort}
                  </div>
                )}
                <button
                  className="button button-primary"
                  onClick={() =>
                    own ? props.onTask(recommended) : props.onHome()
                  }
                >
                  {own
                    ? recommended.completionAvailable === false
                      ? "View action"
                      : "Take this action"
                    : "Find actions for my postcode"}
                  <ArrowRight size={17} />
                </button>
                {recommended.targetIndicators.length > 0 && (
                  <div className="helps-tags">
                    <span>Helps</span>
                    {recommended.targetIndicators.map((id) => (
                      <span key={id} className="helps-tag">
                        <IndicatorIcon type={id} size={12} />{" "}
                        {community.indicators.find((i) => i.id === id)?.label ??
                          id.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h3>
                  {dailyCompleted
                    ? "You've done good today."
                    : "A little pause in the growing."}
                </h3>
                <p>
                  {dailyCompleted
                    ? "Today's suggested action is complete. Explore other actions, or come back tomorrow for a new contribution."
                    : "No suggested action is available right now. Check back soon."}
                </p>
                {dailyCompleted && <Check size={24} />}
              </>
            )}
          </div>
          <button
            className="explore-actions"
            onClick={() => props.onView("actions")}
          >
            Explore all actions <ArrowRight size={16} />
          </button>
          {community.progress.stats.length > 0 && (
            <div className="community-stats">
              <span className="eyebrow">WE&apos;RE GROWING THIS TOGETHER</span>
              <div className="stats-grid">
                {community.progress.stats.map((stat) => (
                  <div key={stat.key}>
                    <span className="stat-icon">
                      {stat.icon === "users" ? (
                        <Users size={17} />
                      ) : (
                        <IndicatorIcon type={stat.icon ?? stat.key} size={17} />
                      )}
                    </span>
                    <strong>
                      {stat.value}
                      {stat.unit && <small> {stat.unit}</small>}
                    </strong>
                    <span>{stat.label}</span>
                    {stat.supportingText && (
                      <small>{stat.supportingText}</small>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <p className="sidebar-footnote">
        Your actions grow community progress. Environmental measurements update
        from their sources.
      </p>
    </>
  );
}

function ScoreCard({ score, change }: { score: number; change?: number }) {
  const [display, setDisplay] = useState(score);
  const from = useRef(score);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => {
        setDisplay(score);
        from.current = score;
      });
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    const initial = from.current;
    let frame: number;
    function tick(now: number) {
      const fraction = Math.min(1, (now - start) / 600);
      const next = Math.round(initial + (score - initial) * fraction);
      setDisplay(next);
      from.current = next;
      if (fraction < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);
  return (
    <div className="score-card">
      <div className="score-ring">
        <svg viewBox="0 0 116 116" aria-hidden="true">
          <circle cx="58" cy="58" r="49" className="score-track" />
          <circle
            cx="58"
            cy="58"
            r="49"
            className="score-fill"
            pathLength="100"
            strokeDasharray={`${score} 100`}
          />
        </svg>
        <div>
          <strong>{display}</strong>
          <span>OUT OF 100</span>
        </div>
      </div>
      <div className="score-copy">
        <span className="score-title">
          Green Score <Sprout size={16} />
        </span>
        <p>
          Small actions.
          <br />A growing community.
        </p>
        {change !== undefined && (
          <span className="score-change">
            <TrendingUp size={13} /> {change >= 0 ? "+" : ""}
            {change} this month
          </span>
        )}
        <span className="score-disclaimer">Our community progress metric</span>
      </div>
    </div>
  );
}

function IndicatorDetails({
  indicator,
  community,
  tasks,
  own,
  onTask,
  onHome,
  tasksLoading,
  tasksError,
  onRetry,
}: {
  indicator: PostcodeIndicator;
  community: PostcodeCommunity;
  tasks: Task[];
  own: boolean;
  onTask: (task: Task) => void;
  onHome: () => void;
  tasksLoading: boolean;
  tasksError?: string;
  onRetry: () => void;
}) {
  const [now] = useState(() => Date.now());
  const stale =
    indicator.updatedAt &&
    now - new Date(indicator.updatedAt).getTime() > 90 * 24 * 60 * 60 * 1000;
  return (
    <div className="indicator-detail">
      <div className="detail-title">
        <span className="detail-icon">
          <IndicatorIcon type={indicator.type} size={30} />
        </span>
        <h3>{indicator.label}</h3>
        <span
          className={`indicator-status ${indicatorStatus[indicator.status].className}`}
        >
          {indicatorStatus[indicator.status].label}
        </span>
      </div>
      <div className="measurement-card">
        <span className="eyebrow">
          {indicator.provenance === "mock"
            ? "ILLUSTRATIVE ENVIRONMENTAL VALUE"
            : indicator.provenance === "measured"
              ? "PUBLISHED ENVIRONMENTAL VALUE"
              : "DERIVED ENVIRONMENTAL VALUE"}
        </span>
        <strong>{indicator.displayValue}</strong>
        {indicator.score !== undefined && (
          <span className="muted">
            Normalized indicator score: {indicator.score}/100
          </span>
        )}
        {indicator.description && <p>{indicator.description}</p>}
      </div>
      <dl className="indicator-context">
        {indicator.trend && (
          <div>
            <dt>Trend</dt>
            <dd>
              <ArrowUpRight size={15} />{" "}
              {indicator.trend.interpretation ??
                `${indicator.trend.direction === "flat" ? "Unchanged" : indicator.trend.direction === "up" ? "Increasing" : "Decreasing"}${indicator.trend.change !== undefined ? ` (${indicator.trend.change})` : ""}`}
              {indicator.trend.period && (
                <small>Compared with {indicator.trend.period}</small>
              )}
            </dd>
          </div>
        )}
        {indicator.source && (
          <div>
            <dt>Source</dt>
            <dd>{indicator.source}</dd>
          </div>
        )}
        {indicator.coverage && (
          <div>
            <dt>Coverage</dt>
            <dd>{indicator.coverage.description ?? indicator.coverage.type}</dd>
          </div>
        )}
        {indicator.updatedAt && (
          <div>
            <dt>Updated</dt>
            <dd>
              {dateLabel(indicator.updatedAt)}
              {stale && (
                <small className="stale-note">
                  This data is over 90 days old; check the source for its
                  reporting schedule.
                </small>
              )}
            </dd>
          </div>
        )}
      </dl>
      <div className="activity-card">
        <Sprout size={22} />
        <div>
          <strong>
            {community.progress.activityByIndicator[indicator.id] ?? 0}
          </strong>
          <p>Related community actions this month</p>
          <small>Platform activity, separate from environmental data.</small>
        </div>
      </div>
      <div className="sidebar-section-heading">
        <span className="eyebrow">A LITTLE ACTION GOES A LONG WAY</span>
        <h3>Ways to lend a hand</h3>
      </div>
      {!own && <NeighbourNote onHome={onHome} />}
      {tasksLoading ? (
        <p role="status">Finding related actions…</p>
      ) : tasksError ? (
        <TaskError message={tasksError} onRetry={onRetry} />
      ) : tasks.length ? (
        tasks.map((task) => (
          <ActionCard
            key={task.id}
            task={task}
            indicators={community.indicators}
            own={own}
            onTask={onTask}
          />
        ))
      ) : (
        <p className="empty-note">
          No related actions are available right now.
        </p>
      )}
    </div>
  );
}

function NeighbourNote({ onHome }: { onHome: () => void }) {
  return (
    <div className="neighbour-note">
      <p>
        You&apos;re exploring a neighbouring postcode. Your actions contribute
        to your own community.
      </p>
      <button className="text-button" onClick={onHome}>
        Back to my postcode <ArrowRight size={14} />
      </button>
    </div>
  );
}
function TaskError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="form-error">
      <p role="alert">{message}</p>
      <button className="text-button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
function ActionCard({
  task,
  indicators,
  own,
  completed = false,
  onTask,
}: {
  task: Task;
  indicators: PostcodeIndicator[];
  own: boolean;
  completed?: boolean;
  onTask: (task: Task) => void;
}) {
  return (
    <button
      className={`action-card ${completed ? "action-completed" : ""}`}
      onClick={() => onTask(task)}
      disabled={!own || completed}
    >
      <div>
        <span className="task-category">
          <IndicatorIcon type={task.targetIndicators[0]} size={15} />{" "}
          {task.category}
        </span>
        {completed ? <Check size={16} /> : <ArrowRight size={16} />}
      </div>
      <h4>{task.title}</h4>
      <p>{task.whyItMatters}</p>
      {task.points !== undefined ? (
        <span className="task-meta">
          {task.points} {task.points === 1 ? "point" : "points"}
        </span>
      ) : (
        <span className="task-meta">
          <Clock3 size={13} /> {task.estimatedTime} ·{" "}
          {completed ? "Completed" : task.effort}
        </span>
      )}
      {task.targetIndicators.length > 0 && (
        <span className="action-targets">
          Helps:{" "}
          {task.targetIndicators
            .map(
              (id) =>
                indicators.find((i) => i.id === id)?.label ??
                id.replaceAll("_", " "),
            )
            .join(" · ")}
        </span>
      )}
    </button>
  );
}
