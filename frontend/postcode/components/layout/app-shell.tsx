"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowUpRight, UserRound } from "lucide-react";
import { useCurrentUser } from "@/hooks/queries";
import { ErrorState, LoadingState, Wordmark } from "@/components/ui";
import { errorMessage } from "@/lib/utils";
import { GreenHourBanner, GreenHourProvider } from "./green-hour";

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (user.isSuccess && !user.data) router.replace("/login");
  }, [user.isSuccess, user.data, router]);
  if (user.isPending || (user.isSuccess && !user.data))
    return <LoadingState message="Loading your profile…" />;
  if (user.isError)
    return (
      <ErrorState
        message={errorMessage(user.error)}
        retry={() => {
          void user.refetch();
        }}
      />
    );
  return (
    <GreenHourProvider>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <GreenHourBanner />
      <header className="app-header">
        <nav className="navbar" aria-label="Main navigation">
          <a
            className="nav-lottery"
            href="https://www.postcodelottery.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Postcode Lottery</span>
            <ArrowUpRight size={15} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <Wordmark />
          <Link
            className={`nav-account ${pathname === "/account" ? "nav-active" : ""}`}
            href="/account"
            aria-label="My Account"
            aria-current={pathname === "/account" ? "page" : undefined}
          >
            <span>My Account</span>
            <span className="account-icon">
              <UserRound size={19} />
            </span>
          </Link>
        </nav>
      </header>
      {children}
    </GreenHourProvider>
  );
}
