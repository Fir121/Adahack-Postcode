"use client";

import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { queryKeys } from "@/hooks/queries";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => {
          if (
            error instanceof ApiError &&
            error.status === 401 &&
            query.queryKey[0] !== queryKeys.user[0]
          )
            queryClient.setQueryData(queryKeys.user, null);
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: (count, error) =>
            !(
              error instanceof ApiError &&
              error.status >= 400 &&
              error.status < 500
            ) && count < 1,
          refetchOnWindowFocus: true,
        },
      },
    });
    return queryClient;
  });
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries();
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
