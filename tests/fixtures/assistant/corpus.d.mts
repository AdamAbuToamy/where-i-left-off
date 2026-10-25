/** Type contract for the authored .mjs fixture used by Node and the browser test lab. */
export type AssistantAcceptanceAction = {
  target: string;
  action: string;
  id: string;
  scope?: string;
  values?: Record<string, unknown>;
};
export type AssistantAcceptanceControl = {kind: string; values: Record<string, unknown>};
export type AssistantAcceptanceCase = {
  id: string;
  sourceId?: string;
  language: 'ar' | 'en' | 'he';
  message: string;
  actions: AssistantAcceptanceAction[];
  controls: AssistantAcceptanceControl[];
  intents: unknown[];
};
export declare function acceptanceContext(id?: string): unknown;
export declare const acceptanceCases: AssistantAcceptanceCase[];
