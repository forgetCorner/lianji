import { getSessionUser } from "@/lib/server/auth";
import {
  decodeWorkoutHistoryCursor,
  WorkoutHistoryCursorError,
} from "@/lib/server/workout-history-cursor";
import { getWorkoutHistoryPage } from "@/lib/server/workout-history";
import { jsonError, jsonOk, serverError } from "@/lib/server/http";
import { WORKOUT_HISTORY_PAGE_SIZE } from "@/lib/workout-history";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await getSessionUser(request);
    if (!user) return jsonError(401, "UNAUTHORIZED", "请先登录");

    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get("limit");
    const limit =
      rawLimit === null ? WORKOUT_HISTORY_PAGE_SIZE : Number(rawLimit);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > WORKOUT_HISTORY_PAGE_SIZE
    ) {
      return jsonError(
        400,
        "BAD_REQUEST",
        `每次最多加载 ${WORKOUT_HISTORY_PAGE_SIZE} 条训练记录`,
      );
    }

    const rawCursor = searchParams.get("cursor");
    const cursor =
      rawCursor === null ? null : decodeWorkoutHistoryCursor(rawCursor);
    return jsonOk(await getWorkoutHistoryPage(user.id, { limit, cursor }));
  } catch (error) {
    if (error instanceof WorkoutHistoryCursorError) {
      return jsonError(400, "BAD_REQUEST", error.message);
    }
    return serverError(error);
  }
}
