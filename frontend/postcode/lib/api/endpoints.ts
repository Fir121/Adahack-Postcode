export const endpoints = {
  login: "/auth/login",
  signup: "/auth/signup",
  logout: "/auth/logout",
  me: "/users/me",
  supportedPostcodes: "/postcodes/supported",
  communities: "/postcodes",
  community: (id: string) => `/postcodes/${encodeURIComponent(id)}`,
  tasks: "/tasks",
  completions: "/completions",
};
