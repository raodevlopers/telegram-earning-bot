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
