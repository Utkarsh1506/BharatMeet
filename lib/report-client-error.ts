export type ClientErrorDetail = {
  title: string;
  message: string;
  details?: string;
};

export function reportClientError(error: ClientErrorDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ClientErrorDetail>("bharatmeet:error", { detail: error }));
}
