import { createContext, useContext } from "react";
export const DesignPreviewContext = createContext({ enabled: false });
export function useDesignPreview() {
  return useContext(DesignPreviewContext);
}
