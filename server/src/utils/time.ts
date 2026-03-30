export function nowIso() {
  return new Date().toISOString();
}

export function sortByNewest<T>(items: T[], key: keyof T) {
  return [...items].sort((a, b) => {
    const leftValue = a[key];
    const rightValue = b[key];
    const left = typeof leftValue === "string" ? Date.parse(leftValue) : 0;
    const right = typeof rightValue === "string" ? Date.parse(rightValue) : 0;
    return right - left;
  });
}

const INDIA_TIMEZONE = "Asia/Kolkata";

export function getIndiaDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE
  }).format(date);
}

export function getIndiaHour(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: INDIA_TIMEZONE,
      hour: "numeric",
      hour12: false
    }).format(date)
  );
}

export function getTimeBasedGreeting(date = new Date()) {
  const hour = getIndiaHour(date);
  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  if (hour < 21) {
    return "Good evening";
  }

  return "Good night";
}

export function addMinutesIso(baseIso: string, minutes: number) {
  return new Date(Date.parse(baseIso) + minutes * 60_000).toISOString();
}

export function addSecondsIso(baseIso: string, seconds: number) {
  return new Date(Date.parse(baseIso) + seconds * 1_000).toISOString();
}
