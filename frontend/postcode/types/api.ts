// Transport DTOs from docs/backend-swagger.json, separate from UI models.
export interface CoordinatesDto {
  postcode: string;
  latitude: number;
  longitude: number;
}
export interface TaskDto {
  task_id: string;
  name: string;
  description: string;
  points: number;
}
export interface UserDto {
  user_id: string;
  name: string;
  email: string;
  postcode: string;
}
export interface UserInputDto {
  name: string;
  email: string;
  postcode: string;
}

// Proposed contract: GET /postcodes/{postcode}/leaderboard.
export interface CommunityLeaderboardDto {
  postcode: string;
  entries: { user_id: string; name: string; rank: number; points: number }[];
}

export interface ActivityInputDto {
  task_id: string;
  date: string;
}
export interface ActivityDto extends ActivityInputDto {
  user_id: string;
  points: number;
}
