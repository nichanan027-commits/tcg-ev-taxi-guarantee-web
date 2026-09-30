/**
 * ส่งคำขอ /api/* ไปยัง route handler ตัวจริงของแอป
 *
 * ไม่มีการเขียนกฎขึ้นใหม่แม้ข้อเดียว handler ที่ถูกเรียกคือไฟล์เดียวกับที่รันบนเซิร์ฟเวอร์
 * ดังนั้นรหัสสถานะทุกตัว (201 / 409 / 404 / 422) เพดานสองสถาบันการเงิน
 * และด่านที่ต้องเป็น READY FOR FI ก่อนให้ความยินยอม จึงเป็นของจริงทั้งหมด
 *
 * window.fetch ถูกครอบไว้ให้ component ฝั่งผู้ใช้เรียก fetch("/api/...") ได้ตามเดิม
 * ไม่ต้องแก้ component แม้บรรทัดเดียว
 */
import { POST as applicationsPost } from "../app/api/applications/route.ts";
import { GET as applicationGet, PUT as applicationPut } from "../app/api/applications/[applicationId]/route.ts";
import { POST as consentPost } from "../app/api/applications/[applicationId]/consent/route.ts";
import { POST as evaluatePost } from "../app/api/applications/[applicationId]/evaluate/route.ts";
import { POST as faRequestPost } from "../app/api/applications/[applicationId]/fa-request/route.ts";
import { POST as fiConsentsPost } from "../app/api/applications/[applicationId]/fi-consents/route.ts";
import { POST as fiHandoffPost } from "../app/api/applications/[applicationId]/fi-handoff/route.ts";
import {
  GET as fiSelectionsGet,
  PUT as fiSelectionsPut
} from "../app/api/applications/[applicationId]/fi-selections/route.ts";
import { POST as demoPost } from "../app/api/demo/[caseId]/route.ts";

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

type Route = {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
};

function route(method: string, path: string, handler: unknown): Route {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^${path.replace(/\{(\w+)\}/g, (_m, key) => {
      keys.push(key);
      return "([^/]+)";
    })}$`
  );
  return { method, pattern, keys, handler: handler as Handler };
}

const ROUTES: Route[] = [
  route("POST", "/api/applications", applicationsPost),
  route("GET", "/api/applications/{applicationId}", applicationGet),
  route("PUT", "/api/applications/{applicationId}", applicationPut),
  route("POST", "/api/applications/{applicationId}/consent", consentPost),
  route("POST", "/api/applications/{applicationId}/evaluate", evaluatePost),
  route("POST", "/api/applications/{applicationId}/fa-request", faRequestPost),
  route("POST", "/api/applications/{applicationId}/fi-consents", fiConsentsPost),
  route("POST", "/api/applications/{applicationId}/fi-handoff", fiHandoffPost),
  route("GET", "/api/applications/{applicationId}/fi-selections", fiSelectionsGet),
  route("PUT", "/api/applications/{applicationId}/fi-selections", fiSelectionsPut),
  route("POST", "/api/demo/{caseId}", demoPost)
];

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url, window.location.origin);
  for (const r of ROUTES) {
    if (r.method !== request.method.toUpperCase()) continue;
    const match = r.pattern.exec(url.pathname);
    if (!match) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1]);
    });
    return r.handler(request, { params: Promise.resolve(params) });
  }
  return new Response(JSON.stringify({ error: `ไม่มีปลายทาง ${request.method} ${url.pathname}` }), {
    status: 404,
    headers: { "content-type": "application/json" }
  });
}

/** ครอบ fetch ให้คำขอ /api/* เข้าสู่ handler ในหน้า ส่วนคำขออื่นปล่อยผ่านตามปกติ */
export function installFetchInterception(): void {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), window.location.origin), init);
    const path = new URL(request.url, window.location.origin).pathname;
    if (!path.startsWith("/api/")) return original(input as RequestInfo, init);
    return handleApiRequest(request);
  };
}
