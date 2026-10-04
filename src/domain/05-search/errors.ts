export type SearchReason = "query-too-long";

export interface SearchError {
  kind: "search";
  reason: SearchReason;
}

export const searchError = (reason: SearchReason): SearchError => ({ kind: "search", reason });
