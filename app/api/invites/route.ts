import { ensureDatabase, getD1 } from "@/db";
import { generateInviteCode, getSessionUser, sha256 } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    const result = await getD1().prepare(
      "SELECT id, label, max_uses, used_count, expires_at, created_at, disabled_at FROM invite_codes WHERE created_by = ? ORDER BY created_at DESC",
    ).bind(user.id).all();
    return jsonOk({ invites: result.results });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");
    const body = await readJsonObject(request);
    const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 32) : "好友邀请";
    const maxUses = typeof body?.maxUses === "number" ? Math.round(body.maxUses) : 1;
    const expiresDays = typeof body?.expiresDays === "number" ? Math.round(body.expiresDays) : 7;
    if (maxUses < 1 || maxUses > 10 || expiresDays < 1 || expiresDays > 30) {
      return jsonError(400, "BAD_REQUEST", "邀请码次数或有效期超出范围");
    }

    await ensureDatabase();
    const code = generateInviteCode();
    const now = Date.now();
    const invite = {
      id: crypto.randomUUID(),
      label,
      maxUses,
      usedCount: 0,
      expiresAt: now + expiresDays * 24 * 60 * 60 * 1000,
      createdAt: now,
    };
    await getD1().prepare(
      "INSERT INTO invite_codes (id, code_hash, label, max_uses, used_count, expires_at, created_by, created_at, disabled_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL)",
    ).bind(invite.id, await sha256(code), label, maxUses, invite.expiresAt, user.id, now).run();
    return jsonOk({ invite: { ...invite, code } }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
