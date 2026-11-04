export function openWorkHub(uid: string, tab: string, card = "") {
  window.dispatchEvent(
    new CustomEvent("experience-open", { detail: { uid, tab, card } }),
  );
}
