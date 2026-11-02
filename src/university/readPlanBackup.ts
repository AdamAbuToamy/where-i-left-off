import { parsePlanBackup } from "./planImport";
import type { PlanPreview } from "./planImport";
type BackupFile = Pick<File, "name" | "type" | "size" | "text">;
/** Client screening complements the existing domain and Firestore validators. */
export async function readPlanBackup(file: BackupFile): Promise<PlanPreview> {
  if (file.size > 4_000_000) throw new Error("حجم الملف أكبر من المسموح");
  if (
    !/\.json$/i.test(file.name) ||
    !["", "application/json", "text/json", "text/plain"].includes(
      file.type.toLowerCase(),
    )
  )
    throw new Error("اختر ملف نسخة احتياطية بصيغة JSON");
  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error(
      "ملف النسخة الاحتياطية غير صالح. اختر نسخة JSON صدّرتها من ويلو.",
    );
  }
  return parsePlanBackup(value);
}
