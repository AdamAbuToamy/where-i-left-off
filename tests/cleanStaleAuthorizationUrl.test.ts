import { expect, it } from "vitest";
import { cleanStaleAuthorizationUrl } from "../src/lib/cleanStaleAuthorizationUrl";

it("removes abandoned codes and states, keeping routes and unrelated query data", () => {
  expect(
    cleanStaleAuthorizationUrl(
      "https://wilo.test/?code=synthetic&state=synthetic&groupInvite=invite&source=extension#/library?view=trash",
    ),
  ).toBe("/?groupInvite=invite&source=extension#/library?view=trash");
  expect(
    cleanStaleAuthorizationUrl(
      "https://wilo.test/?wilo_openrouter=1&code=one&code=two&state=synthetic#/personal",
    ),
  ).toBe("/#/personal");
  expect(
    cleanStaleAuthorizationUrl(
      "https://wilo.test/index.html?error=denied&error_description=synthetic&state=synthetic#/settings",
    ),
  ).toBe("/index.html#/settings");
});
it("does not intercept Firebase handlers, email actions or ordinary links", () => {
  for (const path of [
    "/__/auth/handler?code=synthetic&state=synthetic",
    "/?mode=resetPassword&oobCode=synthetic&apiKey=public&code=synthetic&state=synthetic",
    "/?mode=signIn&apiKey=public&code=synthetic&state=synthetic",
    "/?groupInvite=invite#/groups",
    "/?code=ordinary-value#/library",
    "/?state=ordinary-value#/library",
    "/about.html?code=synthetic&state=synthetic",
    "/#/university?course=one",
  ])
    expect(cleanStaleAuthorizationUrl("https://wilo.test" + path)).toBeNull();
});
