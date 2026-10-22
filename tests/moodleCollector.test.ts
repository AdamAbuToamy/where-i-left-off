import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { parseSnapshot } from "../src/university/model";
const code = readFileSync("src/university/moodleCollector.mjs", "utf8").replace(
  "export async function",
  "async function",
);
async function collect(authenticated = true, calendarFails = false) {
  const dom = new JSDOM("<body></body>", {
    url: "https://moodle.bgu.ac.il/moodle/local/mydashboard/",
  });
  const calls: {
      name: string;
      args: Record<string, unknown>;
      credentials: string;
    }[] = [],
    downloads: string[] = [],
    alerts: string[] = [];
  dom.window.HTMLAnchorElement.prototype.click = function () {};
  const context = {
    document: dom.window.document,
    location: dom.window.location,
    URL: Object.assign(class extends URL {}, {
      createObjectURL: (blob: Blob) => {
        void blob.text().then((s) => downloads.push(s));
        return "blob:local";
      },
      revokeObjectURL: () => {},
    }),
    Blob,
    AbortSignal,
    alert: (s: string) => alerts.push(s),
    setTimeout: () => 0,
    M: authenticated
      ? { cfg: { userid: 100, sesskey: "DO_NOT_EXPORT_THIS" } }
      : undefined,
    fetch: async (
      url: string,
      options: { body: string; credentials: string },
    ) => {
      expect(url).toMatch(
        /^https:\/\/moodle.bgu.ac.il\/moodle\/lib\/ajax\/service.php/,
      );
      const request = JSON.parse(options.body)[0];
      calls.push({
        name: request.methodname,
        args: request.args,
        credentials: options.credentials,
      });
      if (request.methodname.includes("enrolled"))
        return new Response(
          JSON.stringify([
            {
              data: {
                courses:
                  request.args.offset === 0
                    ? [
                        {
                          id: 42,
                          fullname: "<span>Algorithms</span>",
                          viewurl:
                            "https://moodle.bgu.ac.il/moodle/course/view.php?id=42",
                        },
                      ]
                    : [],
                nextoffset: 1,
              },
            },
          ]),
        );
      return new Response(
        JSON.stringify(
          calendarFails
            ? [{ error: true }]
            : [
                {
                  data: {
                    events: [
                      {
                        id: 91,
                        course: { id: 42 },
                        name: "Homework",
                        modulename: "assign",
                        timestart: 1793000000,
                        url: "https://moodle.bgu.ac.il/moodle/mod/assign/view.php?id=91&sesskey=SHOULD_BE_REMOVED",
                      },
                      {
                        id: 92,
                        course: { id: 999 },
                        name: "Not my course",
                        timestart: 1793000000,
                      },
                    ],
                  },
                },
              ],
        ),
      );
    },
  };
  const ctx = vm.createContext(context);
  await vm.runInContext(code + "; collectMoodle()", ctx);
  await Promise.resolve();
  return { calls, downloads, alerts };
}
it("reads only current courses and the calendar; exports no session credentials", async () => {
  const r = await collect();
  expect(r.calls.map((c) => c.name)).toEqual([
    "core_course_get_enrolled_courses_by_timeline_classification",
    "core_course_get_enrolled_courses_by_timeline_classification",
    "core_calendar_get_calendar_upcoming_view",
  ]);
  expect(r.calls.every((c) => c.credentials === "same-origin")).toBe(true);
  expect(r.downloads).toHaveLength(1);
  expect(r.downloads[0]).not.toMatch(
    /DO_NOT_EXPORT_THIS|SHOULD_BE_REMOVED|sesskey/,
  );
  const snapshot = parseSnapshot(JSON.parse(r.downloads[0]));
  expect(snapshot.courses[0].name).toBe("Algorithms");
  expect(snapshot.events).toHaveLength(1);
});
it("reports a partial export when the calendar is unavailable", async () => {
  const r = await collect(true, true),
    snapshot = parseSnapshot(JSON.parse(r.downloads[0]));
  expect(snapshot.courses).toHaveLength(1);
  expect(snapshot.events).toHaveLength(0);
  expect(snapshot.warnings.join(" ")).toContain("تعذر قراءة التقويم");
});
it("does not request private data without a signed-in Moodle session", async () => {
  const r = await collect(false);
  expect(r.calls).toHaveLength(0);
  expect(r.downloads).toHaveLength(0);
  expect(r.alerts).toHaveLength(1);
});
