import { createContext, useContext } from "react";
export const DesignPreviewContext = createContext({
  enabled: false,
  available: false,
  setEnabled: (value: boolean) => {
    void value;
  },
});
export function useDesignPreview() {
  return useContext(DesignPreviewContext);
}
