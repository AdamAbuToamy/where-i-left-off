import { expect } from "@playwright/test";
import type { Page, APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prepareUniversityPilot } from "./universityFixture";
import { normalizedProject } from "../../src/lib/workspaceModel";
const project = "demo-where-i-left-off";
function encode(value: unknown): unknown {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number")
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(encode) } };
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, encode(v)]),
      ),
    },
  };
}
export async function seed(
  request: APIRequestContext,
  path: string,
  value: Record<string, unknown>,
) {
  const response = await request.patch(
    `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/${path}`,
    {
      headers: { Authorization: "Bearer owner" },
      data: {
        fields: Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, encode(v)]),
        ),
      },
    },
  );
  if (!response.ok())
    throw new Error("Emulator seed failed: " + response.status());
}
export async function pilot(
  page: Page,
  request: APIRequestContext,
  names: string[],
) {
  const c = await prepareUniversityPilot(request),
    cards = names.map((name, i) =>
      normalizedProject(randomUUID(), {
        name,
        nextStep: "Next " + name,
        status: "later",
        rank: i * 1024,
        revision: 0,
        activityAt: Date.now() - 60 * 86400000,
        dueDate: "2027-02-03",
      }),
    );
  for (const card of cards) {
    const { id, ...data } = card;
    await seed(request, "users/" + c.uid + "/projects/" + id, {
      ...data,
      mutationId: "fixture_" + id,
    });
  }
  await page.addInitScript((uid) => {
    localStorage.setItem("language", "en");
    localStorage.setItem("welcome-tour:v2:" + uid, "done");
  }, c.uid);
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(c.email);
  await page.getByLabel("Password", { exact: true }).fill(c.password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".workspace-command-bar")).toBeVisible({
    timeout: 15000,
  });
  return { ...c, cards };
}
export async function hub(page: Page, tab: string) {
  await page.getByRole("button", { name: "Work hub", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Work hub", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: tab, exact: true }).click();
  return dialog;
}
export async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
export async function studySeed(request: APIRequestContext, uid: string) {
  const id = randomUUID(),
    course = {
      id,
      name: "Pilot networks " + id.slice(0, 6),
      url: "https://example.com/course",
      notes: "Existing course notes",
      requires: [],
      x: 0,
      y: 0,
    };
  await seed(request, "users/" + uid + "/studyRecords/courses_" + id, {
    kind: "courses",
    id,
    payload: JSON.stringify(course),
    deleted: false,
    revision: 0,
    mutationId: "fixture",
  });
  const lesson = {
    id: randomUUID(),
    courseId: id,
    day: 3,
    start: "10:00",
    end: "12:00",
    room: "101",
    sessionType: "lecture",
  };
  await seed(request, "users/" + uid + "/studyRecords/lessons_" + lesson.id, {
    kind: "lessons",
    id: lesson.id,
    payload: JSON.stringify(lesson),
    deleted: false,
    revision: 0,
    mutationId: "fixture",
  });
  return course;
}
