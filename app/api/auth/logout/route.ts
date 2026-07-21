import { clearSessionCookie, deleteSession } from "@/lib/server/auth";
import { jsonOk, serverError, validateMutationRequest } from "@/lib/server/http";

export async function POST(request: Request): Promise<Response> {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  try {
    await deleteSession(request);
    return jsonOk({ ok: true }, { headers: { "set-cookie": clearSessionCookie(request) } });
  } catch (error) {
    return serverError(error);
  }
}
