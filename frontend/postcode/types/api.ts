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

export interface ActivityInputDto {
  points?: number;
}
export interface ActivityDto extends ActivityInputDto {
  task_id: string;
  date: string;
  user_id: string;
  postcode?: string;
}
export interface PostcodeMetricDto {
  postcode: string;
  total_points: number;
}
export interface UserMetricDto {
  user_id: string;
  name: string;
  points: number;
}
export interface PostcodeDetailMetricDto {
  postcode: string;
  carbon_intensity?: number | null;
  air_quality?: number | null;
  users?: UserMetricDto[];
}
