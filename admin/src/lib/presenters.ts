export function formatUsername(username: string | null) {
  return username ? `@${username}` : "No username";
}
