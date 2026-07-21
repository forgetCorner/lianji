import { getSessionUser } from "@/lib/server/auth";
import { jsonError, jsonOk, serverError } from "@/lib/server/http";
import { getActiveWorkout } from "@/lib/server/workouts";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    return jsonOk({ workout: await getActiveWorkout(user.id) });
  } catch (error) {
    return serverError(error);
  }
}
