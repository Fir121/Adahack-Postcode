export const endpoints = {
  coordinates: "/coordinates/",
  coordinate: (postcode: string) =>
    "/coordinates/" + encodeURIComponent(postcode),
  activities: "/activities",
  activity: (date: string, userId: string, taskId: string) =>
    ["/activities", date, userId, taskId]
      .map((part, index) => (index ? encodeURIComponent(part) : part))
      .join("/"),
  metrics: "/metrics/",
  metric: (postcode: string) => "/metrics/" + encodeURIComponent(postcode),
  tasks: "/tasks",
  task: (id: string) => "/tasks/" + encodeURIComponent(id),
  users: "/users",
  user: (id: string) => "/users/" + encodeURIComponent(id),
};
