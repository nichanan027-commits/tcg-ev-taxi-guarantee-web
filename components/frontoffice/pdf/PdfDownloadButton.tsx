"use client";

import { useState } from "react";

/**
 * ปุ่มดาวน์โหลดรายงาน
 *
 * ใช้ html2pdf ที่ vendored ไว้แล้ว โหลดแบบ on-demand
 * และ rasterise ทีละ .report-sheet เพื่อล็อกจำนวนหน้า
 * ไม่มีการคำนวณตัวเลขใด ๆ ที่นี่ — เอกสารถูกประกอบจาก Snapshot ไปแล้ว
 */
type JsPdf = {
  addPage: () => void;
  addImage: (data: string, fmt: string, x: number, y: number, w: number, h: number) => void;
  save: (name: string) => void;
  internal: { getNumberOfPages: () => number };
};

type Html2PdfLike = {
  set: (options: unknown) => Html2PdfLike;
  from: (element: HTMLElement) => Html2PdfLike;
  toCanvas: () => Html2PdfLike;
  toPdf: () => Html2PdfLike;
  get(kind: "canvas"): Promise<HTMLCanvasElement>;
  get(kind: "pdf"): Promise<JsPdf>;
};

declare global {
  interface Window {
    html2pdf?: () => Html2PdfLike;
  }
}

function loadHtml2Pdf(): Promise<() => Html2PdfLike> {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/html2pdf.bundle.min.js";
    const timer = setTimeout(() => reject(new Error("โหลดตัวสร้าง PDF ไม่สำเร็จ")), 20000);
    script.onload = () => {
      clearTimeout(timer);
      window.html2pdf ? resolve(window.html2pdf) : reject(new Error("โหลดตัวสร้าง PDF ไม่สำเร็จ"));
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("โหลดตัวสร้าง PDF ไม่สำเร็จ"));
    };
    document.head.appendChild(script);
  });
}

export function PdfDownloadButton({ fileName }: { fileName: string }) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function download() {
    setState("working");
    try {
      const html2pdf = await loadHtml2Pdf();
      const sheets = [...document.querySelectorAll<HTMLElement>("#reportArea .report-sheet")];
      if (sheets.length === 0) throw new Error("ไม่พบเนื้อหารายงาน");

      /*
       * ถ่ายทีละหน้าแล้วประกอบเป็นไฟล์เดียว
       * ปล่อยให้ library หาจุดตัดเองจะได้จำนวนหน้าไม่แน่นอน เพราะความสูงข้อความไทย
       * ต่างกันตามฟอนต์ของเครื่องผู้ใช้ — วิธีนี้ทำให้หนึ่ง sheet คือหนึ่งหน้าเสมอ
       */
      const options = {
        margin: 0,
        filename: fileName,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, width: 794, windowWidth: 794 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: [] }
      };

      // A4 เต็มหน้า ไม่มีขอบ เพราะ .report-sheet มี padding ของตัวเองอยู่แล้ว
      const pageW = 210;
      const pageH = 297;

      let pdf: JsPdf | null = null;
      for (const [index, sheet] of sheets.entries()) {
        if (index === 0) {
          pdf = await html2pdf().set(options).from(sheet).toCanvas().toPdf().get("pdf");
        } else {
          const canvas = await html2pdf().set(options).from(sheet).toCanvas().get("canvas");
          pdf!.addPage();
          pdf!.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pageW, pageH);
        }
      }

      if (!pdf) throw new Error("สร้างเอกสารไม่สำเร็จ");
      pdf.save(fileName);
      setState("idle");
    } catch {
      // ผลการประเมินยังอยู่ครบ ผู้ใช้กดใหม่ได้โดยไม่ต้องประเมินซ้ำ
      setState("error");
    }
  }

  return (
    <div className="fo-pdf-actions">
      <button type="button" className="fo-cta" onClick={download} disabled={state === "working"}>
        {state === "working" ? "กำลังสร้างรายงาน…" : "ดาวน์โหลดรายงานความพร้อม (PDF)"}
      </button>
      {state === "error" ? (
        <p className="fo-error" role="status">
          สร้าง PDF ไม่สำเร็จ กรุณาลองอีกครั้ง — ผลการประเมินของคุณยังถูกบันทึกไว้
        </p>
      ) : null}
    </div>
  );
}
