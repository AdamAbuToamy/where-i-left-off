import { expect, it, vi } from "vitest";
import { readPlanBackup } from "../src/university/readPlanBackup";
import { planBackup } from "../src/university/planImport";
import { emptyUniversity } from "../src/university/model";
it("accepts an exported JSON backup and validates the domain before previewing", async () => {
  const result = await readPlanBackup(
    new File([JSON.stringify(planBackup(emptyUniversity()))], "wilo.json", {
      type: "application/json",
    }),
  );
  expect(result.errors).toEqual([]);
  expect(result.courses).toEqual([]);
});
it("rejects oversized files before reading any content", async () => {
  const text = vi.fn();
  await expect(
    readPlanBackup({
      name: "wilo.json",
      type: "application/json",
      size: 4_000_001,
      text,
    }),
  ).rejects.toThrow("حجم الملف");
  expect(text).not.toHaveBeenCalled();
});
it("checks extension and MIME rather than trusting the file-picker accept attribute", async () => {
  for (const [name, type] of [
    ["payload.html", "text/html"],
    ["payload.json", "text/html"],
    ["payload.exe", "application/json"],
  ]) {
    const text = vi.fn();
    await expect(readPlanBackup({ name, type, size: 1, text })).rejects.toThrow(
      "JSON",
    );
    expect(text).not.toHaveBeenCalled();
  }
});
it("replaces native parser details with a safe explanation and leaves the import unapplied", async () => {
  await expect(
    readPlanBackup(
      new File(["{bad"], "backup.json", { type: "application/json" }),
    ),
  ).rejects.toThrow("ملف النسخة الاحتياطية غير صالح");
});
