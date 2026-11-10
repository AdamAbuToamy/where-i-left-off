import { it, expect } from "vitest";
import { signedInLanding } from "../src/lib/navigation";
it("opens personal cards by default and recovers inaccessible admin routes after account switches", () => {
  for (const hash of ["", "#", "#/", "#/admin", "#/logs"])
    expect(signedInLanding(false, hash, "")).toBe("personal");
  expect(signedInLanding(true, "#/admin", "")).toBeNull();
});
it("preserves deliberate owned page links and group invitation flows", () => {
  for (const hash of [
    "#/personal",
    "#/resume",
    "#/university?courseId=example",
    "#/settings",
    "#/notifications",
    "#/api-docs",
  ])
    expect(signedInLanding(false, hash, "")).toBeNull();
  expect(signedInLanding(false, "#/admin", "?groupInvite=example")).toBe(
    "groups",
  );
});
