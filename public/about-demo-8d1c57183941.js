// Only the fictional public card preview; no account, storage or network operations.
for (const shell of document.querySelectorAll(".about-card-example .envelope-shell")) {
  const summary = shell.querySelector(".envelope-summary");
  const content = shell.querySelector(".envelope-content");
  const open = shell.querySelector(".envelope-expand");
  const close = shell.querySelector(".envelope-collapse");
  function setExpanded(expanded) {
    shell.classList.toggle("is-expanded", expanded);
    summary.hidden = expanded;
    content.hidden = !expanded;
    content.inert = !expanded;
    open.setAttribute("aria-expanded", String(expanded));
    (expanded ? close : open).focus();
  }
  open.addEventListener("click", () => setExpanded(true));
  close.addEventListener("click", () => setExpanded(false));
  shell.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && shell.classList.contains("is-expanded")) {
      event.preventDefault();
      setExpanded(false);
    }
  });
}
