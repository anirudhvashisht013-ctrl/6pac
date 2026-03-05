export type DataEventSource =
  | "logs"
  | "meals"
  | "schedules"
  | "sessions"
  | "measurements"
  | "reminders"
  | "targets"
  | "workouts"
  | "exercises";

export type DataEvent = {
  uid: string;
  source: DataEventSource;
  at: number;
};

const listeners = new Set<(event: DataEvent) => void>();

export function emitDataEvent(uid: string, source: DataEventSource): void {
  const event: DataEvent = {
    uid,
    source,
    at: Date.now(),
  };

  listeners.forEach((listener) => listener(event));
}

export function subscribeDataEvents(listener: (event: DataEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
