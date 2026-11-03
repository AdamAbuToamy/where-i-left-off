import { createContext, useContext } from "react";
export const DesignPreviewContext = createContext<{
  enabled: boolean;
  kitchenStudy?: boolean;
}>({ enabled: false, kitchenStudy: false });
export function useDesignPreview() {
  return useContext(DesignPreviewContext);
}
