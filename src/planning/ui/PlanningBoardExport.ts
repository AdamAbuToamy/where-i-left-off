import { toPng } from "html-to-image";
export async function exportPlanningBoard(
  element: HTMLElement,
  format: "png" | "pdf",
  name: string,
) {
  const data = await toPng(element, {
    pixelRatio: 2,
    backgroundColor:
      getComputedStyle(document.documentElement)
        .getPropertyValue("--site-bg")
        .trim() || "#f0efe6",
    filter: (node) =>
      !node.classList?.contains("planning-zoom") &&
      !node.classList?.contains("planning-card-picker") &&
      !node.classList?.contains("plan-edge-tools") &&
      !node.classList?.contains("planning-empty"),
    skipFonts: true,
  });
  const filename =
    (name || "wilo-planning-board")
      .replace(/[<>:"/\\|?*]/g, "")
      .split("")
      .filter((char) => char.charCodeAt(0) >= 32)
      .join("")
      .slice(0, 100) || "wilo-planning-board";
  if (format === "png") {
    const a = document.createElement("a");
    a.href = data;
    a.download = filename + ".png";
    a.click();
    return;
  }
  const { jsPDF } = await import("jspdf");
  const width = element.clientWidth,
    height = element.clientHeight,
    documentPdf = new jsPDF({
      orientation: width >= height ? "landscape" : "portrait",
      unit: "px",
      format: [width, height],
    });
  documentPdf.addImage(data, "PNG", 0, 0, width, height);
  documentPdf.save(filename + ".pdf");
}
