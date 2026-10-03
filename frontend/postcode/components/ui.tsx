import Link from "next/link";
import {
  ArrowRight,
  LoaderCircle,
  Sprout,
  Wind,
  Zap,
  Trees,
  Bike,
  Recycle,
  Leaf,
  Users,
} from "lucide-react";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={`wordmark ${compact ? "wordmark-compact" : ""}`}
      aria-label="PL Green Together home"
    >
      <span className="brand-symbol">
        <Sprout size={26} strokeWidth={2.3} />
      </span>
      <span>
        <span className="wordmark-name">
          <span className="wordmark-pl">PL</span> Green Together
          <span className="brand-dot">.</span>
        </span>
        <span className="wordmark-caption">
          SMALL ACTIONS. GREENER POSTCODES.
        </span>
      </span>
    </Link>
  );
}

export function IndicatorIcon({
  type,
  size = 20,
}: {
  type: string;
  size?: number;
}) {
  const Icon =
    (
      {
        air_quality: Wind,
        energy: Zap,
        green_space: Trees,
        transport: Bike,
        recycling: Recycle,
        users: Users,
      } as Record<string, typeof Leaf>
    )[type] ?? Leaf;
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

export function LoadingState({
  message = "Growing your neighbourhood…",
}: {
  message?: string;
}) {
  return (
    <div className="state-panel" role="status">
      <LoaderCircle className="spin" size={28} />
      <p>{message}</p>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="state-panel">
      <span className="eyebrow">A LITTLE BUMP IN THE ROAD</span>
      <p role="alert">{message}</p>
      {retry && (
        <button className="button button-secondary" onClick={retry}>
          Try again <ArrowRight size={17} />
        </button>
      )}
    </div>
  );
}
