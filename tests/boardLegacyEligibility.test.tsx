import { it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mock = vi.hoisted(() => ({
  user: {
    uid: "ordinary",
    email: "ordinary@example.test",
    emailVerified: true,
  },
  create: vi.fn(() => ({ view: { state: { relations: [] } }, start: vi.fn() })),
}));
vi.mock("../src/lib/firebase", () => ({
  auth: {
    get currentUser() {
      return mock.user;
    },
  },
}));
vi.mock("../src/productivity/browserRepository", () => ({
  createExperienceRepository: mock.create,
}));
import Provider from "../src/productivity/Provider";
import { ADMIN_EMAIL } from "../src/lib/admin";
it("ordinary board users never instantiate the admin legacy repository", () => {
  mock.create.mockClear();
  mock.user = {
    uid: "ordinary",
    email: "ordinary@example.test",
    emailVerified: true,
  };
  expect(
    renderToStaticMarkup(
      <Provider uid="ordinary">
        <span>Board</span>
      </Provider>,
    ),
  ).toContain("Board");
  expect(mock.create).not.toHaveBeenCalled();
  mock.user = { uid: "admin", email: ADMIN_EMAIL, emailVerified: true };
  expect(
    renderToStaticMarkup(
      <Provider uid="admin">
        <span>Legacy board</span>
      </Provider>,
    ),
  ).toContain("Legacy board");
  expect(mock.create).toHaveBeenCalledTimes(1);
  mock.create.mockClear();
  renderToStaticMarkup(
    <Provider uid="another">
      <span>Another</span>
    </Provider>,
  );
  expect(mock.create).not.toHaveBeenCalled();
});
