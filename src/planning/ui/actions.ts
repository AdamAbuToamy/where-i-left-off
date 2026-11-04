import { createContext, useContext } from "react";
type PlanningUiActions = {
  editNote: (id: string, text: string) => void;
  remove: (id: string) => void;
  convertNote?: (id: string) => void;
  open: (id: string) => void;
};
export const PlanningActions = createContext<PlanningUiActions | null>(null);
export function usePlanningActions() {
  const actions = useContext(PlanningActions);
  if (!actions) throw new Error("planning-ui-missing");
  return actions;
}
