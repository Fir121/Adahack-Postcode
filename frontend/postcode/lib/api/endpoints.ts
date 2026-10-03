export const endpoints = {
  coordinates: "/coordinates/",
  coordinate: (postcode: string) =>
    "/coordinates/" + encodeURIComponent(postcode),
  activities: (userId: string) => "/activities/" + encodeURIComponent(userId),
  tasks: "/tasks",
  task: (id: string) => "/tasks/" + encodeURIComponent(id),
  leaderboard: (postcode: string) =>
    "/postcodes/" + encodeURIComponent(postcode) + "/leaderboard",
  users: "/users",
  user: (id: string) => "/users/" + encodeURIComponent(id),
};
