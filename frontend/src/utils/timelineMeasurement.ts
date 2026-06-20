export interface TimelineMeasurement {
  containerHeight: number;
  positions: Record<string, { top: number }>;
}

export function areTimelineMeasurementsEqual(
  current: TimelineMeasurement,
  next: TimelineMeasurement,
): boolean {
  if (current.containerHeight !== next.containerHeight) return false;

  const currentIds = Object.keys(current.positions);
  const nextIds = Object.keys(next.positions);
  if (currentIds.length !== nextIds.length) return false;

  for (const id of currentIds) {
    if (current.positions[id]?.top !== next.positions[id]?.top) {
      return false;
    }
  }

  return true;
}

export function keepPreviousTimelineMeasurementIfEqual(
  current: TimelineMeasurement,
  next: TimelineMeasurement,
): TimelineMeasurement {
  return areTimelineMeasurementsEqual(current, next) ? current : next;
}
