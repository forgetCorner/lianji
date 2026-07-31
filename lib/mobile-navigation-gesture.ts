export type GestureIntent = "pending" | "horizontal" | "vertical";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function nearestMenuIndex(
  centers: readonly number[],
  pointerX: number,
): number {
  if (!centers.length) return 0;

  let nearestIndex = 0;
  let nearestDistance = Math.abs(pointerX - centers[0]);

  for (let index = 1; index < centers.length; index += 1) {
    const distance = Math.abs(pointerX - centers[index]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  return nearestIndex;
}

export function gestureIntent(
  deltaX: number,
  deltaY: number,
  threshold = 6,
): GestureIntent {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (Math.max(horizontalDistance, verticalDistance) < threshold) {
    return "pending";
  }

  if (horizontalDistance > verticalDistance * 1.12) {
    return "horizontal";
  }

  if (verticalDistance > horizontalDistance * 1.12) {
    return "vertical";
  }

  return "pending";
}

export function menuIndexWithHysteresis(
  centers: readonly number[],
  pointerX: number,
  currentIndex: number,
  hysteresisPx = 7,
): number {
  if (!centers.length) return 0;
  if (currentIndex < 0 || currentIndex >= centers.length) {
    return nearestMenuIndex(centers, pointerX);
  }

  const nearestIndex = nearestMenuIndex(centers, pointerX);
  if (nearestIndex === currentIndex) return currentIndex;

  let nextIndex = currentIndex;

  if (nearestIndex > currentIndex) {
    for (let index = currentIndex + 1; index <= nearestIndex; index += 1) {
      const boundary = (centers[index - 1] + centers[index]) / 2 + hysteresisPx;
      if (pointerX < boundary) break;
      nextIndex = index;
    }
    return nextIndex;
  }

  for (let index = currentIndex - 1; index >= nearestIndex; index -= 1) {
    const boundary = (centers[index] + centers[index + 1]) / 2 - hysteresisPx;
    if (pointerX > boundary) break;
    nextIndex = index;
  }

  return nextIndex;
}

export function magnetizedX(
  pointerX: number,
  targetCenterX: number,
  minX: number,
  maxX: number,
  pull = 0.4,
): number {
  const normalizedPull = clamp(pull, 0, 1);
  const mixedPosition = pointerX * (1 - normalizedPull) + targetCenterX * normalizedPull;
  return clamp(mixedPosition, Math.min(minX, maxX), Math.max(minX, maxX));
}
