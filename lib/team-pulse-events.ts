export const OPEN_TEAM_PULSE_EVENT = "bharatmeet:open-team-pulse";
export const OPEN_TEAM_CATCHUP_EVENT = "bharatmeet:open-team-catchup";

export function openTeamPulse() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_TEAM_PULSE_EVENT));
}

export function openTeamCatchUp() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_TEAM_CATCHUP_EVENT));
}
