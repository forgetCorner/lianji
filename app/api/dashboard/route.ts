import { getSessionUser } from "@/lib/server/auth";
import { buildDashboard } from "@/lib/server/dashboard";
import { jsonError, jsonOk, serverError } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    return jsonOk(await buildDashboard(user));
  } catch (error) {
    return serverError(error);
  }
}
