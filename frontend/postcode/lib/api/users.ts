import type { UserDto, UserInputDto } from "@/types/api";
import { apiRequest, ApiError } from "./client";
import { endpoints } from "./endpoints";
import { adaptUser, requireList } from "./adapters";
import { normalizePostcode } from "@/lib/utils";
import { getSupportedPostcodes } from "./postcodes";

export const getUsers = async () =>
  requireList(await apiRequest<UserDto[]>(endpoints.users)).map(adaptUser);
export const getUser = async (id: string) =>
  adaptUser(await apiRequest<UserDto>(endpoints.user(id)));
async function validatedInput(input: UserInputDto): Promise<UserInputDto> {
  const postcode = normalizePostcode(input.postcode);
  if (!(await getSupportedPostcodes()).includes(postcode))
    throw new ApiError("Choose a supported postcode.", 400, {
      postcode: "This postcode is not available yet.",
    });
  return { name: input.name.trim(), email: input.email.trim(), postcode };
}
export async function createUser(input: UserInputDto) {
  return adaptUser(
    await apiRequest<UserDto>(endpoints.users, {
      method: "POST",
      body: JSON.stringify(await validatedInput(input)),
    }),
  );
}
export async function updateUser(id: string, input: UserInputDto) {
  return adaptUser(
    await apiRequest<UserDto>(endpoints.user(id), {
      method: "PUT",
      body: JSON.stringify(await validatedInput(input)),
    }),
  );
}
export const deleteUser = (id: string) =>
  apiRequest<void>(endpoints.user(id), { method: "DELETE" });
