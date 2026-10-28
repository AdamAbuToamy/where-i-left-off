import type { ControlPlan } from "../assistant/controlContract";
export interface SessionAssistantPort {
  context(): Record<string, unknown>;
  planBatch(values: Record<string, unknown>[]): ControlPlan;
  apply(plan: ControlPlan): Promise<{ pending: boolean }>;
}
