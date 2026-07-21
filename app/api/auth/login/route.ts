import { ensureDatabase, getD1 } from "@/db";
import { createSession, normalizeUsername, publicUser, validatePassword, verifyPassword } from "@/lib/server/auth";
import { jsonError, jsonOk, readJsonObject, serverError, validateMutationRequest } from "@/lib/server/http";

type LoginRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  failed_login_count: number;
  locked_until: number | null;
  created_at: number;
};

const fakePasswordHash = "pbkdf2_sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function POST(request: Request): Promise<Response> {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;

  try {
    const body = await readJsonObject(request);
    const username = normalizeUsername(body?.username);
    const password = body?.password;
    if (!username || !validatePassword(password)) return jsonError(400, "BAD_REQUEST", "用户名或密码格式不正确");

    await ensureDatabase();
    const database = getD1();
    const user = await database.prepare(
      "SELECT id, username, display_name, password_hash, failed_login_count, locked_until, created_at FROM users WHERE username = ?",
    ).bind(username).first<LoginRow>();
    const now = Date.now();

    if (user?.locked_until && user.locked_until > now) {
      return jsonError(429, "RATE_LIMITED", "登录失败次数过多，请 15 分钟后再试");
    }

    const passwordMatches = await verifyPassword(password, user?.password_hash ?? fakePasswordHash);
    if (!user || !passwordMatches) {
      if (user) {
        const failedCount = user.failed_login_count + 1;
        const lockedUntil = failedCount >= 5 ? now + 15 * 60 * 1000 : null;
        await database.prepare("UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?").bind(failedCount, lockedUntil, user.id).run();
      }
      return jsonError(401, "UNAUTHORIZED", "用户名或密码不正确");
    }

    await database.prepare("UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ?").bind(user.id).run();
    const cookie = await createSession(user.id, request);
    return jsonOk({ user: publicUser(user) }, { headers: { "set-cookie": cookie } });
  } catch (error) {
    return serverError(error);
  }
}
