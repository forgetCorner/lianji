import { ensureDatabase, getD1 } from "@/db";
import {
  bootstrapInviteCode,
  createSession,
  hashPassword,
  normalizeInviteCode,
  normalizeUsername,
  publicUser,
  sha256,
  validatePassword,
} from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";

type InviteRow = { id: string; max_uses: number; used_count: number; expires_at: number | null; disabled_at: number | null };

export async function POST(request: Request): Promise<Response> {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;

  try {
    const body = await readJsonObject(request);
    if (!body) return jsonError(400, "BAD_REQUEST", "注册信息格式不正确");

    const username = normalizeUsername(body.username);
    const password = body.password;
    const inviteCode = normalizeInviteCode(body.inviteCode);
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (!username) return jsonError(400, "BAD_REQUEST", "用户名需为 3–24 位中文、字母、数字或下划线");
    if (!validatePassword(password)) return jsonError(400, "BAD_REQUEST", "密码需为 8–128 位");
    if (!inviteCode) return jsonError(400, "BAD_REQUEST", "请输入有效邀请码");
    if (displayName.length > 32) return jsonError(400, "BAD_REQUEST", "显示名称不能超过 32 位");

    await ensureDatabase();
    const database = getD1();
    const existing = await database.prepare("SELECT id FROM users WHERE username = ?").bind(username).first<{ id: string }>();
    if (existing) return jsonError(409, "CONFLICT", "这个用户名已被使用");

    const countRow = await database.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
    const isFirstUser = Number(countRow?.count ?? 0) === 0;
    const now = Date.now();
    let invite: InviteRow | null = null;

    if (isFirstUser) {
      const bootstrapCode = bootstrapInviteCode();
      if (!bootstrapCode || (await sha256(bootstrapCode)) !== (await sha256(inviteCode))) {
        return jsonError(403, "FORBIDDEN", "首位用户邀请码无效");
      }
    } else {
      invite = await database.prepare(
        "SELECT id, max_uses, used_count, expires_at, disabled_at FROM invite_codes WHERE code_hash = ?",
      ).bind(await sha256(inviteCode)).first<InviteRow>();
      if (!invite || invite.disabled_at || (invite.expires_at && invite.expires_at <= now) || invite.used_count >= invite.max_uses) {
        return jsonError(403, "FORBIDDEN", "邀请码无效、已过期或已被使用");
      }
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const inserts = [
      database.prepare(
        "INSERT INTO users (id, username, display_name, password_hash, failed_login_count, locked_until, created_at) VALUES (?, ?, ?, ?, 0, NULL, ?)",
      ).bind(userId, username, displayName || username, passwordHash, now),
    ];
    if (invite) inserts.push(database.prepare("UPDATE invite_codes SET used_count = used_count + 1 WHERE id = ? AND used_count < max_uses").bind(invite.id));
    await database.batch(inserts);

    const cookie = await createSession(userId, request);
    return jsonOk(
      { user: publicUser({ id: userId, username, display_name: displayName || username, created_at: now }) },
      { status: 201, headers: { "set-cookie": cookie } },
    );
  } catch (error) {
    return serverError(error);
  }
}
