import { getSessionUser } from "@/lib/server/auth";
import { jsonOk, serverError } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  try {
    return jsonOk({ user: await getSessionUser(request) });
  } catch (error) {
    return serverError(error);
  }
}
