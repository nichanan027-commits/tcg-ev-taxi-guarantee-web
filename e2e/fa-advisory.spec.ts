import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * F.A Readiness Advisory บนเบราว์เซอร์
 *
 * บริการนี้เป็นทางออกของเส้นทางที่ยังไม่ควรเพิ่มหนี้
 * สิ่งที่ต้องพิสูจน์คือผู้สมัครเดินไปถึงได้จริง ได้เลขที่คำขอจริง
 * และระบบไม่พาไปเข้าใจว่านี่คือการแก้หนี้หรือทางลัดสู่การอนุมัติ
 */
async function openDemo(page: Page, caseId: "A" | "B" | "C" | "D"): Promise<string> {
  const response = await page.request.post(`/api/demo/${caseId}`, {
    headers: { accept: "application/json" }
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { applicationId: string };
  await page.goto(`/apply/${body.applicationId}`);
  return body.applicationId;
}

const EXPLANATION =
  "คำขอนี้เป็นการขอคำปรึกษาเพื่อพัฒนาความพร้อมก่อนเข้าสู่กระบวนการสินเชื่อ ไม่ใช่การปรับโครงสร้างหนี้ และไม่ใช่กระบวนการแก้ไขหนี้หลังอนุมัติ";

test.describe("A — BUILD READINESS เปิดคำขอคำปรึกษาได้", () => {
  test("จากหน้าผลลัพธ์ เลือกบ่าย + LINE แล้วได้เลขที่คำขอ", async ({ page }) => {
    const applicationId = await openDemo(page, "B");
    await expect(page.locator('[data-role="route-hero"]')).toHaveText(/BUILD READINESS/);

    await page.locator('[data-role="cta-fa-advisory"]').click();
    await expect(page).toHaveURL(`/apply/${applicationId}/advisory`);

    // ขอบเขตของบริการต้องอยู่บนหน้าตั้งแต่ก่อนกดส่ง
    await expect(page.locator('[data-role="advisory-explanation"]')).toHaveText(EXPLANATION);

    await page.getByRole("radio", { name: /ช่วงบ่าย/ }).check();
    await page.getByRole("radio", { name: "LINE" }).check();
    await page.locator('[data-role="fa-submit"]').click();

    await expect(page.locator('[data-role="fa-case-id"]')).toHaveText(/^FA-C26-\d{6}$/, { timeout: 30_000 });
    await expect(page.locator('[data-role="fa-case-confirmed"]')).toContainText("ไม่ใช่การยื่นขอสินเชื่อ");
  });
});

test.describe("B — NO NEW DEBT เปิดคำขอคำปรึกษาได้", () => {
  test("เส้นทางที่ยังไม่ควรเพิ่มหนี้มีทางไปต่อ ไม่ใช่ทางตัน", async ({ page }) => {
    const applicationId = await openDemo(page, "C");
    await expect(page.locator('[data-role="route-hero"]')).toHaveText(/ยังไม่พร้อมสำหรับสินเชื่อใหม่/);

    await page.locator('[data-role="cta-fa-advisory"]').click();
    await expect(page).toHaveURL(`/apply/${applicationId}/advisory`);
    await expect(page.locator('[data-role="advisory-route"]')).toContainText("ยังไม่พร้อมสำหรับสินเชื่อใหม่");

    await page.locator('[data-role="fa-submit"]').click();
    await expect(page.locator('[data-role="fa-case-id"]')).toHaveText(/^FA-C26-\d{6}$/, { timeout: 30_000 });

    // เคสต้องผูกกับผลการประเมินจริงของใบสมัครนี้
    const listed = await (await page.request.get(`/api/applications/${applicationId}/fa-request`)).json();
    expect(listed.cases).toHaveLength(1);
    expect(listed.cases[0].route).toBe("NO NEW DEBT");
    expect(listed.cases[0].status).toBe("NEW");
  });
});

test.describe("C — คำขอซ้ำถูกปฏิเสธ", () => {
  test("เมื่อมีคำขอที่ยังดำเนินการอยู่ คำขอที่สองถูกปฏิเสธด้วย 409", async ({ page }) => {
    const applicationId = await openDemo(page, "B");
    await page.goto(`/apply/${applicationId}/advisory`);
    await page.locator('[data-role="fa-submit"]').click();
    await expect(page.locator('[data-role="fa-case-id"]')).toBeVisible({ timeout: 30_000 });

    const duplicate = await page.request.post(`/api/applications/${applicationId}/fa-request`, {
      headers: { "content-type": "application/json" },
      data: { preferredContactTime: "MORNING", preferredChannel: "PHONE" }
    });
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json()).error).toBe("มีคำขอคำปรึกษาที่กำลังดำเนินการอยู่แล้ว");

    // กลับมาที่หน้าเดิมต้องเห็นคำขอเดิม ไม่ใช่ฟอร์มเปล่าให้กดซ้ำ
    await page.reload();
    await expect(page.locator('[data-role="fa-case-confirmed"]')).toBeVisible();
    await expect(page.locator('[data-role="fa-advisory-form"]')).toHaveCount(0);
  });
});

test.describe("D — READY ไม่เสนอคำปรึกษาเป็นขั้นตอนหลัก", () => {
  test("ขั้นตอนหลักของ READY ยังเป็นรายงานความพร้อมแล้วไปเปรียบเทียบสถาบันการเงิน", async ({ page }) => {
    const applicationId = await openDemo(page, "A");
    await expect(page.locator('[data-role="route-hero"]')).toHaveText(/READY FOR FI/);

    await expect(page.locator('[data-role="cta-fa-advisory"]')).toHaveCount(0);
    await expect(page.locator('[data-role="cta-readiness-report"]')).toBeVisible();
    await expect(page.locator('[data-role="cta-fi-match"]')).toBeVisible();

    // เปิด URL ตรงก็ยังไม่ให้เปิดคำขอ เพราะเส้นทางนี้ไม่ใช่กลุ่มเป้าหมาย
    await page.goto(`/apply/${applicationId}/advisory`);
    await expect(page.locator('[data-role="advisory-not-eligible"]')).toBeVisible();
    await expect(page.locator('[data-role="fa-advisory-form"]')).toHaveCount(0);

    const rejected = await page.request.post(`/api/applications/${applicationId}/fa-request`, {
      headers: { "content-type": "application/json" },
      data: { preferredContactTime: "MORNING", preferredChannel: "PHONE" }
    });
    expect(rejected.status()).toBe(409);
  });
});

test.describe("E — สัญญาของ API", () => {
  test("ใบสมัครที่ไม่มีอยู่ตอบ 404 และค่าติดต่อที่ไม่รู้จักตอบ 422", async ({ page }) => {
    const missing = await page.request.post("/api/applications/RTO-C26-999999/fa-request", {
      headers: { "content-type": "application/json" },
      data: { preferredContactTime: "MORNING", preferredChannel: "PHONE" }
    });
    expect(missing.status()).toBe(404);

    const applicationId = await openDemo(page, "B");
    for (const payload of [
      { preferredContactTime: "MIDNIGHT", preferredChannel: "PHONE" },
      { preferredContactTime: "MORNING", preferredChannel: "SMS" },
      { preferredContactTime: 5, preferredChannel: "PHONE" }
    ]) {
      const invalid = await page.request.post(`/api/applications/${applicationId}/fa-request`, {
        headers: { "content-type": "application/json" },
        data: payload
      });
      expect(invalid.status(), `payload ${JSON.stringify(payload)} ควรถูกปฏิเสธ`).toBe(422);
    }

    // ไม่มีเคสใดถูกสร้างจากคำขอที่ไม่ผ่าน
    const listed = await (await page.request.get(`/api/applications/${applicationId}/fa-request`)).json();
    expect(listed.cases).toHaveLength(0);
  });
});
