"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Leaf,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Sprout,
} from "lucide-react";
import { login, resetDemo, signup } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  queryKeys,
  useCurrentUser,
  useDemoInfo,
  useSupportedPostcodes,
} from "@/hooks/queries";
import { errorMessage, isPostcodeFormat, normalizePostcode } from "@/lib/utils";
import { Wordmark } from "@/components/ui";
import type { LoginInput, SignupInput } from "@/types/domain";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const signingUp = mode === "signup";
  const router = useRouter();
  const client = useQueryClient();
  const user = useCurrentUser();
  const demo = useDemoInfo();
  const supported = useSupportedPostcodes();
  const [fields, setFields] = useState({
    name: "",
    email: "",
    postcode: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
  const mutation = useMutation({
    mutationFn: (input: SignupInput | LoginInput) =>
      signingUp ? signup(input as SignupInput) : login(input),
    onSuccess: ({ user: currentUser }) => {
      client.clear();
      client.setQueryData(queryKeys.user, currentUser);
      router.replace("/");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.fields) setErrors(error.fields);
    },
  });
  useEffect(() => {
    if (user.data) router.replace("/");
  }, [user.data, router]);

  const changeField = (name: string, value: string) => {
    setFields((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: "" }));
    mutation.reset();
  };
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
      next.email = "Enter a valid email address.";
    if (fields.password.length < (signingUp ? 8 : 1))
      next.password = signingUp
        ? "Use at least 8 characters."
        : "Enter your password.";
    if (signingUp) {
      if (!fields.name.trim()) next.name = "Tell us your name.";
      if (!isPostcodeFormat(fields.postcode))
        next.postcode = "Enter a UK postcode, for example EH3 9GD.";
      else if (!supported.data?.includes(normalizePostcode(fields.postcode)))
        next.postcode = "Choose a supported postcode listed below.";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(Object.keys(next)[0])?.focus();
      return;
    }
    mutation.mutate({
      ...fields,
      email: fields.email.trim(),
      postcode: normalizePostcode(fields.postcode),
    });
  }

  async function reset() {
    setResetting(true);
    setResetError("");
    try {
      await resetDemo();
      client.clear();
      mutation.reset();
      setErrors({});
      await client.invalidateQueries();
    } catch (error) {
      setResetError(errorMessage(error));
    } finally {
      setResetting(false);
    }
  }

  return (
    <main id="main-content" className="auth-page">
      <header className="auth-header">
        <Wordmark />
        <span className="auth-independent">
          An independent community project
        </span>
      </header>
      <div className="auth-layout">
        <section className="auth-story">
          <span className="eyebrow">
            <span className="small-dot" /> A LITTLE LOCAL LOVE
          </span>
          <h1>
            A greener postcode
            <br />
            starts with <span>you.</span>
          </h1>
          <p>
            Small actions add up. Find out how your neighbourhood is doing, lend
            a hand, and watch your community grow.
          </p>
          <div className="auth-illustration" aria-hidden="true">
            <div className="illustration-sun" />
            <Image
              src="/map-assets/tree.svg"
              width={160}
              height={200}
              className="illustration-tree tree-left"
              alt=""
            />
            <Image
              src="/map-assets/house.svg"
              width={220}
              height={200}
              className="illustration-house"
              alt=""
            />
            <Image
              src="/map-assets/tree.svg"
              width={160}
              height={200}
              className="illustration-tree tree-right"
              alt=""
            />
            <Image
              src="/map-assets/plant.svg"
              width={90}
              height={90}
              className="illustration-plant"
              alt=""
            />
            <span className="illustration-ground" />
            <span className="illustration-label">
              <Sprout size={17} /> Good things grow together.
            </span>
          </div>
          <div className="auth-steps">
            <span>
              <MapPin size={18} /> Your postcode
            </span>
            <ArrowRight size={16} />
            <span>
              <Leaf size={18} /> Your actions
            </span>
            <ArrowRight size={16} />
            <span>
              <Sprout size={18} /> Our progress
            </span>
          </div>
        </section>
        <section className="auth-card" aria-labelledby="auth-title">
          <span className="card-kicker">LET’S GROW SOMETHING GOOD</span>
          <h2 id="auth-title">
            {signingUp ? "Join your neighbours." : "Welcome back."}
          </h2>
          <p className="auth-subtitle">
            {signingUp
              ? "Your small actions can make a big difference."
              : "Your greener neighbourhood is waiting."}
          </p>
          <form onSubmit={submit} noValidate>
            {signingUp && (
              <Field
                name="name"
                label="Your name"
                value={fields.name}
                autoComplete="name"
                onChange={changeField}
                error={errors.name}
              />
            )}
            <Field
              name="email"
              label="Email address"
              type="email"
              value={fields.email}
              autoComplete="email"
              onChange={changeField}
              error={errors.email}
            />
            {signingUp && (
              <>
                <Field
                  name="postcode"
                  label="Your postcode"
                  value={fields.postcode}
                  autoComplete="postal-code"
                  onChange={changeField}
                  error={errors.postcode}
                  placeholder="EH3 9GD"
                />
                <div className="postcode-options">
                  <p>Available in this demo:</p>
                  {supported.isPending ? (
                    <span>Loading postcodes…</span>
                  ) : supported.isError ? (
                    <p role="alert">
                      Couldn’t load postcodes.{" "}
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          void supported.refetch();
                        }}
                      >
                        Try again
                      </button>
                    </p>
                  ) : (
                    supported.data?.map((postcode) => (
                      <button
                        type="button"
                        className="postcode-chip"
                        key={postcode}
                        onClick={() => changeField("postcode", postcode)}
                      >
                        {postcode}
                      </button>
                    ))
                  )}
                  <p className="field-help">
                    Format alone doesn’t verify that a postcode exists.
                  </p>
                </div>
              </>
            )}
            <Field
              name="password"
              label="Password"
              type="password"
              value={fields.password}
              autoComplete={signingUp ? "new-password" : "current-password"}
              onChange={changeField}
              error={errors.password}
            />
            {signingUp && <p className="field-help">At least 8 characters.</p>}
            {mutation.isError && (
              <p className="form-error" role="alert">
                {errorMessage(mutation.error)}
              </p>
            )}
            <button
              type="submit"
              className="button button-primary auth-submit"
              disabled={
                mutation.isPending || (signingUp && !supported.data?.length)
              }
            >
              {mutation.isPending ? (
                <>
                  <LoaderCircle className="spin" size={18} />{" "}
                  {signingUp ? "Creating your account…" : "Signing you in…"}
                </>
              ) : (
                <>
                  {signingUp ? "Let’s grow together" : "Sign in"}
                  <ArrowRight size={19} />
                </>
              )}
            </button>
          </form>
          <p className="auth-switch">
            {signingUp
              ? "Already part of the community?"
              : "New to the neighbourhood?"}{" "}
            <Link href={signingUp ? "/login" : "/signup"}>
              {signingUp ? "Sign in" : "Join us"} <ArrowUp />
            </Link>
          </p>
          {demo.data && (
            <div className="demo-login">
              <span>
                <Check size={15} /> Just exploring?
              </span>
              {signingUp ? (
                <Link href="/login" className="button button-secondary">
                  Try the demo <ArrowRight size={17} />
                </Link>
              ) : (
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      email: demo.data!.email,
                      password: demo.data!.password,
                    })
                  }
                >
                  Try the demo <ArrowRight size={17} />
                </button>
              )}
              <p>Sample data · {demo.data.postcode}</p>
            </div>
          )}
          {demo.data && (
            <button
              type="button"
              className="text-button reset-link"
              disabled={resetting || mutation.isPending}
              onClick={reset}
            >
              <RotateCcw size={13} />{" "}
              {resetting ? "Resetting…" : "Reset saved demo"}
            </button>
          )}
          {(resetError || user.isError) && (
            <p className="form-error" role="alert">
              {resetError || errorMessage(user.error)}
            </p>
          )}
        </section>
      </div>
      <footer className="auth-footer">
        Made for your neighbourhood. Built for a greener tomorrow.
      </footer>
    </main>
  );
}

function ArrowUp() {
  return <ArrowRight size={13} />;
}

function Field({
  name,
  label,
  type = "text",
  value,
  autoComplete,
  error,
  placeholder,
  onChange,
}: {
  name: string;
  label: string;
  type?: string;
  value: string;
  autoComplete: string;
  error?: string;
  placeholder?: string;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(name, event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        required
      />
      {error && (
        <p id={`${name}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
