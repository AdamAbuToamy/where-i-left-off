import { createContext, useContext } from "react";
type PlanningUiActions = {
  editNote: (id: string, text: string) => void;
  remove: (id: string) => void;
  open: (id: string) => void;
  editZone: (
    id: string,
    changes: {
      title?: string;
      width?: number;
      height?: number;
      x?: number;
      y?: number;
    },
  ) => void;
  convert?: (id: string, text: string) => Promise<void>;
};
export const PlanningActions = createContext<PlanningUiActions | null>(null);
export function usePlanningActions() {
  const actions = useContext(PlanningActions);
  if (!actions) throw new Error("planning-ui-missing");
  return actions;
}
