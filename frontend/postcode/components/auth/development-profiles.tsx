"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getUsers } from "@/lib/api/users";
import { selectDevelopmentProfile } from "@/lib/api/auth";
import { queryKeys } from "@/hooks/queries";
import { ErrorState, LoadingState } from "@/components/ui";
import { errorMessage } from "@/lib/utils";

export function DevelopmentProfiles({ supported }: { supported?: string[] }) {
  const users = useQuery({
    queryKey: ["development-profiles"],
    queryFn: getUsers,
  });
  const [selected, setSelected] = useState("");
  const router = useRouter();
  const client = useQueryClient();
  const choose = useMutation({
    mutationFn: selectDevelopmentProfile,
    onSuccess: ({ user }) => {
      client.clear();
      client.setQueryData(queryKeys.user, user);
      router.replace("/");
    },
  });
  if (users.isPending)
    return <LoadingState message="Loading development profiles…" />;
  if (users.isError)
    return (
      <ErrorState
        message={errorMessage(users.error)}
        retry={() => {
          void users.refetch();
        }}
      />
    );
  if (!users.data.length)
    return (
      <p className="empty-note">
        No profiles yet. Join your neighbours to create one.
      </p>
    );
  const id =
    selected ||
    users.data.find((user) => supported?.includes(user.postcode))?.id ||
    users.data[0].id;
  const user = users.data.find((item) => item.id === id);
  const available = Boolean(user && supported?.includes(user.postcode));
  return (
    <div className="development-profiles">
      <label htmlFor="development-profile">Development profile</label>
      <select
        id="development-profile"
        value={id}
        onChange={(event) => {
          setSelected(event.target.value);
          choose.reset();
        }}
      >
        {users.data.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name} · {profile.postcode}
          </option>
        ))}
      </select>
      {supported && !available && (
        <p className="field-help">
          This profile’s postcode is not available in the API. Create a profile
          with a supported postcode.
        </p>
      )}
      {choose.isError && (
        <p className="form-error" role="alert">
          {errorMessage(choose.error)}
        </p>
      )}
      <button
        className="button button-primary auth-submit"
        disabled={choose.isPending || !available}
        onClick={() => choose.mutate(id)}
      >
        {choose.isPending ? "Loading profile…" : "Continue with profile"}{" "}
        <ArrowRight size={19} />
      </button>
    </div>
  );
}
