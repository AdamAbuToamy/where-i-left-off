import type { Language } from "../translations";
import LoadingScreenView from "./loadingScreenView";
import "./LoadingScreen.css";
/** Presentation only; the same view is pre-rendered into the bootstrap HTML. */
export default function LoadingScreen(props: {
  language: Language;
  status: string;
}) {
  return <LoadingScreenView {...props} />;
}
