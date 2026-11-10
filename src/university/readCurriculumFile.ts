/** Browser-only document adapter. Files stay on this device; no model or upload. */
export function inspectCurriculumArchive(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let total = 0,
    entries = 0;
  for (let i = 0; i + 46 <= view.byteLength; i++) {
    if (view.getUint32(i, true) !== 0x02014b50) continue;
    entries++;
    total += view.getUint32(i + 24, true);
    if (total > 40 * 1024 * 1024 || entries > 5000)
      throw new Error("الملف المضغوط كبير جدًا بعد فكّه؛ اختر نسخة أصغر");
    i +=
      45 +
      view.getUint16(i + 28, true) +
      view.getUint16(i + 30, true) +
      view.getUint16(i + 32, true);
  }
  if (!entries) throw new Error("ملف Office غير صالح أو محمي بكلمة مرور");
}
export async function readCurriculumFile(file: File): Promise<string[][]> {
  if (file.size > 8 * 1024 * 1024) throw new Error("الحد الأقصى للملف 8 MB");
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["xlsx", "docx", "pdf"].includes(ext || ""))
    throw new Error(
      "اختر XLSX أو DOCX أو PDF نصيًا؛ حوّل ملفات XLS وDOC القديمة أولًا",
    );
  const buffer = await file.arrayBuffer();
  const rows: string[][] = [];
  if (ext !== "pdf") inspectCurriculumArchive(buffer);
  if (ext === "xlsx") {
    const { default: read } = await import("read-excel-file/browser");
    const sheets = await read(buffer);
    for (const sheet of sheets) {
      rows.push([sheet.sheet]);
      for (const row of sheet.data)
        rows.push(row.map((v) => (v === null ? "" : String(v))));
    }
  } else if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml(
      { arrayBuffer: buffer },
      {
        convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
        externalFileAccess: false,
      },
    );
    // Read text from an inert template; never mount document HTML or execute it.
    const template = document.createElement("template");
    template.innerHTML = result.value;
    for (const element of template.content.querySelectorAll("p,h1,h2,h3,tr")) {
      if (element.tagName !== "TR" && element.closest("table")) continue;
      rows.push(
        element.tagName === "TR"
          ? Array.from(
              element.querySelectorAll("td,th"),
              (cell) => cell.textContent || "",
            )
          : [element.textContent || ""],
      );
    }
  } else {
    const pdf = await import("pdfjs-dist");
    pdf.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).href;
    const task = pdf.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    try {
      const doc = await task.promise;
      if (doc.numPages > 100) throw new Error("الحد الأقصى 100 صفحة");
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        const lines = new Map<number, { x: number; text: string }[]>();
        for (const item of content.items) {
          if (!("str" in item)) continue;
          const y = Math.round(item.transform[5] / 3) * 3;
          const line = lines.get(y) || [];
          line.push({ x: item.transform[4], text: item.str });
          lines.set(y, line);
        }
        for (const [, line] of [...lines].sort((a, b) => b[0] - a[0]))
          rows.push(
            line
              .sort((a, b) => a.x - b.x)
              .map((v) => v.text)
              .filter((v) => v.trim()),
          );
        page.cleanup();
      }
    } finally {
      await task.destroy();
    }
  }
  if (
    rows.length > 12000 ||
    rows.reduce((n, row) => n + row.join("").length, 0) > 500000
  )
    throw new Error("محتوى الملف أكبر من حد التحليل الآمن");
  if (!rows.some((row) => row.join("").trim()))
    throw new Error(
      "لا يوجد نص قابل للقراءة؛ ملف PDF المصوّر يحتاج OCR قبل الاستيراد",
    );
  return rows;
}
