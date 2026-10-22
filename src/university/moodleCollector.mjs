/** Self-contained: runs only when the student clicks their bookmark in a signed-in Moodle tab. */
export async function collectMoodle() {
  const origin = "https://moodle.bgu.ac.il",
    base = origin + "/moodle";
  if (location.origin !== origin || !location.pathname.startsWith("/moodle/")) {
    alert("افتح Moodle بن غوريون وسجّل الدخول أولًا.");
    return;
  }
  const warnings = [];
  const plain = (value) => {
    const d = document.createElement("div");
    d.innerHTML = String(value || "");
    return (d.textContent || "").trim();
  };
  const safeLink = (value) => {
    try {
      const u = new URL(value, base + "/");
      if (u.origin !== origin || !u.pathname.startsWith("/moodle/")) return "";
      for (const key of [...u.searchParams.keys()])
        if (!["id", "view", "time", "course"].includes(key))
          u.searchParams.delete(key);
      return u.href;
    } catch {
      return "";
    }
  };
  const cfg = globalThis.M?.cfg;
  if (!cfg?.sesskey || !cfg?.userid || String(cfg.userid) === "0") {
    alert("سجّل الدخول إلى Moodle ثم أعد الضغط على زر الاستيراد.");
    return;
  }
  if (globalThis.__wiloMoodleCollecting) return;
  globalThis.__wiloMoodleCollecting = true;
  const badge = document.createElement("div");
  badge.textContent = "WILO · جارٍ قراءة الكورسات والمواعيد…";
  badge.style.cssText =
    "position:fixed;z-index:2147483647;bottom:24px;left:24px;padding:18px;background:#203d34;color:white;border-radius:12px;font:16px system-ui";
  document.body.append(badge);
  async function read(methodname, args) {
    const response = await fetch(
      base + "/lib/ajax/service.php?sesskey=" + encodeURIComponent(cfg.sesskey),
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ index: 0, methodname, args }]),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) throw new Error("unavailable");
    const result = await response.json();
    if (!Array.isArray(result) || result[0]?.error || !result[0]?.data)
      throw new Error("unavailable");
    return result[0].data;
  }
  try {
    const courses = new Map(),
      events = new Map();
    // Pagination is bounded; the snapshot explicitly reports limits or endpoint failures.
    let offset = 0,
      finished = false;
    try {
      for (let page = 0; page < 20; page++) {
        const data = await read(
          "core_course_get_enrolled_courses_by_timeline_classification",
          { classification: "inprogress", limit: 50, offset, sort: "fullname" },
        );
        for (const c of data.courses || [])
          if (/^\d+$/.test(String(c.id)))
            courses.set(String(c.id), {
              id: String(c.id),
              name: plain(c.fullname || c.shortname),
              url: safeLink(c.viewurl || base + "/course/view.php?id=" + c.id),
            });
        if (
          !data.courses?.length ||
          !Number.isFinite(data.nextoffset) ||
          data.nextoffset <= offset
        ) {
          finished = true;
          break;
        }
        offset = data.nextoffset;
      }
      if (!finished)
        warnings.push("تم بلوغ حد صفحات الكورسات؛ قد تكون القائمة جزئية.");
    } catch {
      warnings.push(
        "تعذر استخدام قائمة الكورسات؛ جُمعت روابط الكورسات الظاهرة فقط. افتح لوحة كورساتك إذا كانت القائمة ناقصة.",
      );
    }
    if (!courses.size)
      for (const a of document.querySelectorAll("a[href]")) {
        try {
          const u = new URL(a.href);
          const id = u.searchParams.get("id");
          if (
            u.origin === origin &&
            u.pathname === "/moodle/course/view.php" &&
            /^\d+$/.test(id || "") &&
            plain(a.textContent)
          )
            courses.set(id, {
              id,
              name: plain(a.textContent),
              url: safeLink(u.href),
            });
        } catch {
          /* Unrelated link. */
        }
      }
    if (!courses.size)
      throw new Error(
        "لم تظهر كورسات. افتح لوحة الكورسات بعد تسجيل الدخول ثم حاول مجددًا.",
      );
    try {
      const data = await read("core_calendar_get_calendar_upcoming_view", {});
      for (const e of data.events || []) {
        const courseId = String(e.course?.id || e.courseid || "");
        if (!courses.has(courseId)) continue;
        const timestamp = Number(e.timestart);
        if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
        const title = plain(e.name);
        const kind =
          e.modulename === "assign"
            ? "assignment"
            : e.modulename === "quiz" || /מבחן|בחינה|exam|امتحان/i.test(title)
              ? "exam"
              : "task";
        const id = String(e.id);
        if (!/^\d+$/.test(id)) continue;
        events.set(id, {
          id,
          courseId,
          title,
          kind,
          due: new Date(timestamp * 1000).toISOString(),
          url: safeLink(
            e.action?.url ||
              e.url ||
              e.viewurl ||
              base + "/calendar/view.php?view=upcoming",
          ),
        });
      }
      warnings.push(
        "المواعيد هي الأحداث التي يعرضها تقويم Moodle القادم فقط؛ ليست مسحًا لكل الوظائف أو سجل التسليم. راجع Moodle عند نقص أي موعد.",
      );
    } catch {
      warnings.push(
        "تعذر قراءة التقويم. الكورسات متاحة، لكن أضف المواعيد يدويًا أو أعد المحاولة.",
      );
    }
    const snapshot = {
      format: "wilo-bgu-moodle-v1",
      exportedAt: new Date().toISOString(),
      courses: [...courses.values()],
      events: [...events.values()],
      warnings,
    };
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(snapshot, null, 2)], {
          type: "application/json",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download =
      "wilo-moodle-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    badge.textContent = `WILO · تم تصدير ${courses.size} كورس و${events.size} موعد. استورد الملف في صفحة الجامعة.`;
  } catch (e) {
    badge.textContent =
      e.message ===
      "لم تظهر كورسات. افتح لوحة الكورسات بعد تسجيل الدخول ثم حاول مجددًا."
        ? e.message
        : "تعذر الاستيراد؛ تأكد من تسجيل الدخول ثم حاول مجددًا.";
  } finally {
    globalThis.__wiloMoodleCollecting = false;
    setTimeout(() => badge.remove(), 15000);
  }
}
