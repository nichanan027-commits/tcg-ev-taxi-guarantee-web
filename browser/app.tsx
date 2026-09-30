/**
 * โครงหน้าสำหรับรุ่นที่รันในเบราว์เซอร์
 *
 * หน้าแต่ละหน้าของแอปจริงเป็นฟังก์ชันที่คืน JSX ไฟล์นี้จึงไม่ประกอบหน้าขึ้นใหม่
 * แต่เรียกฟังก์ชันหน้าตัวจริงแล้วเรนเดอร์สิ่งที่มันคืนมา
 * เนื้อหา ลำดับหัวข้อ ข้อความกำกับ และ data-role ทุกตัวจึงเป็นของเดิมทั้งหมด
 *
 * สิ่งเดียวที่เพิ่มเข้ามาคือการรอผลแบบ async และการดักฟอร์ม
 * ซึ่งบนเซิร์ฟเวอร์เป็นหน้าที่ของ Next
 */
import { useEffect, useState, type ReactNode } from "react";

import HomePage from "../app/page.tsx";
import AdvisoryPage from "../app/apply/[applicationId]/advisory/page.tsx";
import ApplyPage from "../app/apply/[applicationId]/page.tsx";
import FiPage from "../app/apply/[applicationId]/fi/page.tsx";
import HandoffPage from "../app/apply/[applicationId]/handoff/page.tsx";
import VerificationPage from "../app/apply/[applicationId]/verification/page.tsx";

import { handleApiRequest } from "./api-router.ts";
import { currentPath, navigate, refresh, subscribe } from "./router.ts";

type PageFn = (props: { params: Promise<Record<string, string>> }) => ReactNode | Promise<ReactNode>;

type PageRoute = { pattern: RegExp; keys: string[]; page: PageFn };

function page(path: string, fn: unknown): PageRoute {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^${path.replace(/\{(\w+)\}/g, (_m, key) => {
      keys.push(key);
      return "([^/]+)";
    })}/?$`
  );
  return { pattern, keys, page: fn as PageFn };
}

// เรียงจากเจาะจงไปกว้าง เพื่อให้ /apply/{id}/fi ไม่ถูกจับด้วย /apply/{id}
const PAGES: PageRoute[] = [
  page("/apply/{applicationId}/fi", FiPage),
  page("/apply/{applicationId}/handoff", HandoffPage),
  page("/apply/{applicationId}/advisory", AdvisoryPage),
  page("/apply/{applicationId}/verification", VerificationPage),
  page("/apply/{applicationId}", ApplyPage),
  page("/", HomePage)
];

async function renderPath(path: string): Promise<ReactNode> {
  for (const route of PAGES) {
    const match = route.pattern.exec(path);
    if (!match) continue;
    const params: Record<string, string> = {};
    route.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1]);
    });
    return route.page({ params: Promise.resolve(params) });
  }
  return (
    <main className="fo-shell">
      <h1 className="fo-title">ไม่พบหน้านี้</h1>
      <p className="fo-lede">เส้นทาง {path} ไม่มีอยู่ในระบบ</p>
      <p>
        <a href="#/" onClick={() => navigate("/")}>
          กลับไปหน้าเริ่มต้น
        </a>
      </p>
    </main>
  );
}

export function App() {
  const [path, setPath] = useState(currentPath);
  const [tree, setTree] = useState<ReactNode>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => subscribe((next) => {
    setPath(next);
    setTick((value) => value + 1);
  }), []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    renderPath(path)
      .then((next) => {
        if (!cancelled) setTree(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  if (error) {
    return (
      <main className="fo-shell">
        <h1 className="fo-title">เกิดข้อผิดพลาด</h1>
        <p className="fo-lede">{error}</p>
      </main>
    );
  }

  if (!tree) {
    return (
      <main className="fo-shell">
        <p className="fo-lede">กำลังเตรียมข้อมูล…</p>
      </main>
    );
  }

  return <>{tree}</>;
}

/**
 * ดักการส่งฟอร์มที่ยิงไป /api/*
 *
 * หน้าเริ่มต้นใช้ฟอร์มธรรมดาเพื่อให้ใช้งานได้แม้ไม่มี JavaScript
 * ที่นี่จึงเรียก handler ตัวจริง แล้วเดินตาม redirect ที่ handler คืนมา
 * ไม่ได้เดาปลายทางเอง
 */
export function installFormInterception(): void {
  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.tagName !== "FORM") return;
      const action = form.getAttribute("action") ?? "";
      if (!action.startsWith("/api/")) return;

      event.preventDefault();
      const method = (form.getAttribute("method") ?? "GET").toUpperCase();
      const url = new URL(action, window.location.origin);
      const data = new FormData(form);
      const request = new Request(url, method === "GET" ? {} : { method, body: data });

      void handleApiRequest(request).then(async (response) => {
        const target = response.headers.get("location");
        if (target) {
          navigate(new URL(target, window.location.origin).pathname);
          return;
        }
        if (!response.ok) {
          const text = await response.text();
          window.alert(`ทำรายการไม่สำเร็จ: ${text}`);
          return;
        }
        refresh();
      });
    },
    true
  );
}
