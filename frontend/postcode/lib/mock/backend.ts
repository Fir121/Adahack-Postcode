import type {
  AuthResponse,
  CompletionInput,
  CompletionResponse,
  LoginInput,
  SignupInput,
  TaskCompletion,
  User,
} from "@/types/domain";
import { ApiError } from "@/lib/api/client";
import { demoInfo, mockTasks } from "./fixtures";
import { readDatabase, writeDatabase, type MockDatabase } from "./store";
import { isPostcodeFormat, normalizePostcode } from "@/lib/utils";
import { greenLevel } from "@/lib/scoring";
import { isTaskAvailable, validateProof } from "@/lib/tasks";

function requireUser(db: MockDatabase): User {
  const user = db.accounts.find((a) => a.user.id === db.sessionUserId)?.user;
  if (!user) throw new ApiError("Please sign in to continue.", 401);
  return user;
}

async function seededDatabase(): Promise<MockDatabase> {
  const db = readDatabase();
  if (!db.accounts.some((a) => a.user.email === demoInfo.email)) {
    const user: User = {
      id: "demo-resident",
      name: "Alex Green",
      email: demoInfo.email,
      postcode: demoInfo.postcode,
      communityId: "eh3-9gd",
    };
    // Re-read so concurrent first-load requests don't overwrite changes.
    const latest = readDatabase();
    if (!latest.accounts.some((a) => a.user.email === demoInfo.email)) {
      latest.accounts.push({ user });
      const previousDay = new Date();
      previousDay.setDate(previousDay.getDate() - 1);
      latest.completions.push({
        id: "demo-history",
        userId: user.id,
        communityId: user.communityId,
        taskId: "recycle-right",
        taskTitle: "Sort it out",
        category: "Recycling",
        targetIndicators: ["recycling"],
        completedAt: previousDay.toISOString(),
        status: "approved",
        proofStatus: "approved",
      });
      writeDatabase(latest);
    }
    return readDatabase();
  }
  return db;
}

export async function mockLogin(input: LoginInput): Promise<AuthResponse> {
  const db = await seededDatabase();
  const account = db.accounts.find(
    (a) =>
      a.user.email.trim().toLowerCase() === input.email.trim().toLowerCase(),
  );
  if (!account)
    throw new ApiError(
      "No account was found for that email. Join us to create one.",
      404,
      { email: "No account found for this email." },
    );
  const latest = readDatabase();
  latest.sessionUserId = account.user.id;
  writeDatabase(latest);
  return { user: account.user };
}

export async function mockSignup(input: SignupInput): Promise<AuthResponse> {
  await seededDatabase();
  const postcode = normalizePostcode(input.postcode);
  const email = input.email.trim().toLowerCase();
  if (!input.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ApiError("Check your name and email address.", 422);
  if (!isPostcodeFormat(postcode))
    throw new ApiError("Enter a UK postcode in the correct format.", 422, {
      postcode: "Try a format like EH3 9GD.",
    });
  const db = readDatabase();
  const community = db.communities.find((c) => c.postcode === postcode);
  if (!community)
    throw new ApiError(
      "This postcode isn't part of the demo yet. Choose one of the supported postcodes.",
      422,
      { postcode: "Please use a supported demo postcode." },
    );
  if (db.accounts.some((a) => a.user.email === email))
    throw new ApiError(
      "There's already an account with this email. Try signing in.",
      409,
      { email: "This email is already registered." },
    );
  const latest = readDatabase();
  if (latest.accounts.some((a) => a.user.email === email))
    throw new ApiError("This email is already registered.", 409);
  const user: User = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email,
    postcode,
    communityId: community.id,
  };
  latest.accounts.push({ user });
  latest.sessionUserId = user.id;
  writeDatabase(latest);
  return { user };
}

export async function mockCurrentUser(): Promise<User | null> {
  const db = await seededDatabase();
  return db.accounts.find((a) => a.user.id === db.sessionUserId)?.user ?? null;
}
export async function mockLogout(): Promise<void> {
  const db = readDatabase();
  db.sessionUserId = null;
  writeDatabase(db);
}
export async function mockCommunities() {
  const db = await seededDatabase();
  requireUser(db);
  return db.communities;
}
export async function mockCommunity(id: string) {
  const community = (await mockCommunities()).find((c) => c.id === id);
  if (!community)
    throw new ApiError(
      "We don't have community data for this postcode yet.",
      404,
    );
  return community;
}
export async function mockSupportedPostcodes(): Promise<string[]> {
  return readDatabase().communities.map((c) => c.postcode);
}
export async function mockGetTasks() {
  requireUser(await seededDatabase());
  return mockTasks;
}
export async function mockHistory(): Promise<TaskCompletion[]> {
  const db = await seededDatabase();
  const user = requireUser(db);
  return db.completions
    .filter((c) => c.userId === user.id)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export async function mockCompleteTask(
  input: CompletionInput,
): Promise<CompletionResponse> {
  await seededDatabase();
  const db = readDatabase();
  const user = requireUser(db);
  if (user.communityId !== input.communityId)
    throw new ApiError(
      "Your actions contribute to your own postcode. Return home to take an action.",
      403,
    );
  const community = db.communities.find((c) => c.id === input.communityId);
  const task = mockTasks.find((t) => t.id === input.taskId);
  if (!community || !task)
    throw new ApiError("This action or community is no longer available.", 404);
  const history = db.completions.filter((c) => c.userId === user.id);
  if (!isTaskAvailable(task, history, community.id))
    throw new ApiError(
      "You've already completed this action. Choose another, or come back tomorrow for daily actions.",
      409,
    );
  const errors = validateProof(task, input.proof);
  if (Object.keys(errors).length)
    throw new ApiError("Check your proof before submitting.", 422, errors);
  const completion: TaskCompletion = {
    id: crypto.randomUUID(),
    userId: user.id,
    communityId: community.id,
    taskId: task.id,
    taskTitle: task.title,
    category: task.category,
    targetIndicators: task.targetIndicators,
    completedAt: new Date().toISOString(),
    status: "approved",
    proofStatus: "approved",
  };
  db.completions.unshift(completion);
  // Only platform activity and gamified progress change; environmental measurements stay untouched.
  const progress = community.progress;
  progress.totalActions += 1;
  progress.score = Math.min(100, progress.score + 1);
  progress.level = greenLevel(progress.score);
  progress.monthlyChange = (progress.monthlyChange ?? 0) + 1;
  for (const id of task.targetIndicators)
    progress.activityByIndicator[id] =
      (progress.activityByIndicator[id] ?? 0) + 1;
  const actionStat = progress.stats.find((s) => s.key === "actions");
  if (actionStat) actionStat.value = progress.totalActions;
  if (
    !db.completions.some(
      (c) =>
        c.userId === user.id &&
        c.id !== completion.id &&
        c.communityId === community.id &&
        c.status === "approved",
    )
  ) {
    const participants = progress.stats.find((s) => s.key === "participants");
    if (participants && typeof participants.value === "number")
      participants.value += 1;
  }
  const index = community.decorations.filter((d) =>
    d.id.startsWith("action-"),
  ).length;
  const angle = index * 2.4;
  const decoration = {
    id: `action-${completion.id}`,
    type: task.decorationType,
    longitude: community.centroid.longitude + Math.cos(angle) * 0.00065,
    latitude: community.centroid.latitude + Math.sin(angle) * 0.0004,
    animation: "grow" as const,
    minGreenLevel: 0,
    indicator: task.targetIndicators[0],
  };
  community.decorations.push(decoration);
  writeDatabase(db);
  return { completion, progress, decoration };
}
