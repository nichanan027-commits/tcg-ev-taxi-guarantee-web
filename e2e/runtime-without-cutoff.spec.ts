import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Front Office ต้องใช้งานได้โดยไม่ต้องมี COMPETITION_CUTOFF_AT
 *
 * วันสิ้นสุดการแข่งขันเป็นเรื่องของงานลบข้อมูลเบื้องหลังเท่านั้น
 * ผู้สมัครที่กำลังกรอกใบสมัครไม่ควรเจอหน้าขาวเพราะตัวแปรของงานที่ไม่เกี่ยวกับเขาเลย
 *
 * เซิร์ฟเวอร์ที่รันชุดเทสต์นี้ไม่ได้ตั้ง COMPETITION_CUTOFF_AT ไว้
 * ทุกอย่างที่ผ่านในไฟล์นี้จึงผ่านภายใต้เงื่อนไข "ไม่มี cutoff" โดยอัตโนมัติ
 */
async function openDemo(page: Page, caseId: "A" | "B" | "C" | "D"): Promise<string> {
  const response = await page.request.post(`/api/demo/${caseId}`, {
    headers: { accept: "application/json" }
  });
  expect(response.status()).toBe(201);
  return (await response.json()).applicationId;
}

test("เส้นทางหลักทั้งหมดทำงานได้เมื่อไม่มี COMPETITION_CUTOFF_AT", async ({ page }) => {
  // หน้าแรกและการสร้างใบสมัคร
  await page.goto("/");
  await expect(page.getByRole("button", { name: "ทดลองสมัคร Route to Own" })).toBeVisible();

  // ลงทะเบียน ความยินยอม และการประเมิน
  await page.getByRole("button", { name: "ทดลองสมัคร Route to Own" }).click();
  await expect(page).toHaveURL(/\/apply\/RTO-C26-\d{6}$/);
  await expect(page.locator('[data-role="registration-wizard"]')).toBeVisible();

  // ผลการประเมิน รายงาน และการเปรียบเทียบสถาบันการเงิน
  const ready = await openDemo(page, "D");
  await page.goto(`/apply/${ready}`);
  await expect(page.locator('[data-role="route-hero"]')).toHaveText(/READY FOR FI/);
  await expect(page.getByRole("button", { name: /ดาวน์โหลด/ })).toBeVisible();

  await page.goto(`/apply/${ready}/fi`);
  await expect(page.locator('[data-role="fi-option"]').first()).toBeVisible();

  // การประเมินซ้ำตามเงื่อนไขของสถาบันการเงิน ความยินยอม และการเตรียมส่งต่อ
  const toggle = (fiId: string) =>
    page.locator(`[data-role="fi-option"][data-fi-id="${fiId}"] [data-role="fi-select-toggle"]`);
  await toggle("IBANK_GREEN_LIFE").click();
  await toggle("KKP_EV").click();
  await page.locator('[data-role="fi-save-selections"]').click();
  await expect(page).toHaveURL(`/apply/${ready}/handoff`, { timeout: 30_000 });
  await expect(page.locator('[data-role="fi-handoff-card"]')).toHaveCount(2);

  const consented = await page.request.post(`/api/applications/${ready}/fi-consents`, {
    headers: { "content-type": "application/json" },
    data: { fiId: "IBANK_GREEN_LIFE" }
  });
  expect(consented.status()).toBe(201);

  const handoff = await page.request.post(`/api/applications/${ready}/fi-handoff`, {
    headers: { "content-type": "application/json" },
    data: { fiId: "IBANK_GREEN_LIFE" }
  });
  expect(handoff.status()).toBe(201);

  // คำปรึกษาเพื่อสร้างความพร้อม
  const build = await openDemo(page, "B");
  await page.goto(`/apply/${build}/advisory`);
  await page.locator('[data-role="fa-submit"]').click();
  await expect(page.locator('[data-role="fa-case-id"]')).toHaveText(/^FA-C26-\d{6}$/, { timeout: 30_000 });

  // Secure Verification
  await page.goto(`/apply/${ready}/verification`);
  await page.locator('[data-role="verification-input-nationalId"]').fill("1234567890123");
  await expect(page.locator('[data-role="verification-input-nationalId"]')).toHaveValue("1234567890123");
  await page.locator('[data-role="verification-role-FI_STAFF"]').click();
  await expect(page.locator('[data-role="verification-input-nationalId"]')).toHaveValue("");
});

test("ไม่มีหน้าใดรายงานข้อผิดพลาดของเซิร์ฟเวอร์เมื่อไม่มี cutoff", async ({ page }) => {
  const applicationId = await openDemo(page, "A");

  for (const path of [
    "/",
    `/apply/${applicationId}`,
    `/apply/${applicationId}/fi`,
    `/apply/${applicationId}/handoff`,
    `/apply/${applicationId}/advisory`,
    `/apply/${applicationId}/verification`
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} ต้องตอบ 200`).toBe(200);

    const text = await page.locator("body").innerText();
    for (const marker of ["COMPETITION_CUTOFF_AT", "Internal Server Error", "Application error"]) {
      expect(text, `${path} ต้องไม่แสดง ${marker}`).not.toContain(marker);
    }
  }
});
