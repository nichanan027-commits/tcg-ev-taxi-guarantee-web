import { expect, test } from "@playwright/test";
import type { Page, Request } from "@playwright/test";

/**
 * Secure Verification บนเบราว์เซอร์
 *
 * สิ่งที่ต้องพิสูจน์คือสิ่งที่ไม่เกิดขึ้น จึงดักที่ระดับเครือข่ายและที่เก็บของเบราว์เซอร์จริง
 * ไม่ใช่ดูแค่ว่าหน้าจอแสดงอะไร
 */
const SECRET_ID = "1234567890123";
const SECRET_ACCOUNT = "9876543210";

async function openDemo(page: Page, caseId: "A" | "B" | "C" | "D"): Promise<string> {
  const response = await page.request.post(`/api/demo/${caseId}`, {
    headers: { accept: "application/json" }
  });
  expect(response.status()).toBe(201);
  return (await response.json()).applicationId;
}

/** เก็บทุก request ที่ออกจากหน้า พร้อม body เพื่อตรวจว่ามีค่าอ่อนไหวปนไปหรือไม่ */
function recordRequests(page: Page) {
  const seen: { url: string; method: string; body: string }[] = [];
  page.on("request", (request: Request) => {
    let body = "";
    try {
      body = request.postData() ?? "";
    } catch {
      body = "";
    }
    seen.push({ url: request.url(), method: request.method(), body });
  });
  return seen;
}

test.describe("1 — ค่าอ่อนไหวอยู่ในหน่วยความจำเท่านั้น", () => {
  test("พิมพ์ค่าและเลือกไฟล์ แล้วรีเฟรช ค่าหายทั้งหมด", async ({ page }) => {
    const applicationId = await openDemo(page, "A");
    await page.goto(`/apply/${applicationId}/verification`);

    await expect(page.locator('[data-role="verification-not-persisted"]')).toHaveText(
      "ข้อมูลส่วนนี้ไม่ถูกบันทึกหรือส่งออกจากอุปกรณ์ในระบบการแข่งขัน"
    );

    const nationalId = page.locator('[data-role="verification-input-nationalId"]');
    await nationalId.fill(SECRET_ID);
    await expect(nationalId).toHaveValue(SECRET_ID);

    // เลือกไฟล์ในเครื่อง — ต้องเห็นชื่อไฟล์ แต่ไม่มีการอัปโหลด
    await page.locator('[data-role="verification-file-idCard"]').setInputFiles({
      name: "id-card-demo.png",
      mimeType: "image/png",
      buffer: Buffer.from("demo-bytes-never-read")
    });
    await expect(page.locator('[data-role="verification-filename-idCard"]')).toContainText("id-card-demo.png");
    await expect(page.locator('[data-role="verification-file-notice"]').first()).toHaveText(
      "ไฟล์นี้ยังไม่ถูกอัปโหลดหรือส่งออกจากอุปกรณ์"
    );

    // ไม่มีอะไรถูกเก็บไว้ในที่เก็บของเบราว์เซอร์
    const stored = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
      cookie: document.cookie
    }));
    expect(stored.local).not.toContain(SECRET_ID);
    expect(stored.session).not.toContain(SECRET_ID);
    expect(stored.cookie).not.toContain(SECRET_ID);

    await page.reload();
    await expect(page.locator('[data-role="verification-input-nationalId"]')).toHaveValue("");
    await expect(page.locator('[data-role="verification-filename-idCard"]')).toHaveCount(0);
  });
});

test.describe("2 — สลับบทบาทแล้วค่าถูกล้าง", () => {
  test("ค่าที่บทบาท บสย. กรอกไว้ ไม่ตกไปถึงบทบาทสถาบันการเงิน", async ({ page }) => {
    const applicationId = await openDemo(page, "A");
    await page.goto(`/apply/${applicationId}/verification`);

    await page.locator('[data-role="verification-input-nationalId"]').fill(SECRET_ID);
    await page.locator('[data-role="verification-file-driverLicense"]').setInputFiles({
      name: "license-demo.png",
      mimeType: "image/png",
      buffer: Buffer.from("demo")
    });
    await expect(page.locator('[data-role="verification-filename-driverLicense"]')).toBeVisible();

    await page.locator('[data-role="verification-role-FI_STAFF"]').click();

    // สนามร่วมต้องว่าง และไฟล์ของบทบาทเดิมต้องหายไปพร้อมบทบาท
    await expect(page.locator('[data-role="verification-input-nationalId"]')).toHaveValue("");
    await expect(page.locator('[data-role="verification-filename-driverLicense"]')).toHaveCount(0);

    // ไม่มีค่าเดิมหลงเหลืออยู่ที่ใดในหน้าเลย
    expect(await page.locator("main").innerText()).not.toContain(SECRET_ID);

    // กลับมาบทบาทเดิมก็ต้องไม่เห็นของเก่า
    await page.locator('[data-role="verification-input-bankAccount"]').fill(SECRET_ACCOUNT);
    await page.locator('[data-role="verification-role-TCG_STAFF"]').click();
    expect(await page.locator("main").innerText()).not.toContain(SECRET_ACCOUNT);
    await expect(page.locator('[data-role="verification-input-nationalId"]')).toHaveValue("");
  });
});

test.describe("3 — ไม่มีอำนาจตัดสินใด ๆ", () => {
  test("ใช้ Secure Verification แล้ว Snapshot เส้นทาง คะแนน และสิทธิ์ทั้งหมดเท่าเดิม", async ({ page }) => {
    const applicationId = await openDemo(page, "A");

    const before = await (await page.request.get(`/api/applications/${applicationId}/evaluate`)).json();
    const consentsBefore = await (await page.request.get(`/api/applications/${applicationId}/fi-consents`)).json();
    const handoffBefore = await (await page.request.get(`/api/applications/${applicationId}/fi-handoff`)).json();
    const faBefore = await (await page.request.get(`/api/applications/${applicationId}/fa-request`)).json();

    await page.goto(`/apply/${applicationId}/verification`);
    await page.locator('[data-role="verification-input-nationalId"]').fill(SECRET_ID);
    await page.locator('[data-role="verification-file-idCard"]').setInputFiles({
      name: "id.png",
      mimeType: "image/png",
      buffer: Buffer.from("demo")
    });
    await page.locator('[data-role="verification-role-FI_STAFF"]').click();
    await page.locator('[data-role="verification-input-bankAccount"]').fill(SECRET_ACCOUNT);
    await page.locator('[data-role="verification-clear"]').click();

    await page.goto(`/apply/${applicationId}`);
    await expect(page.locator('[data-role="route-hero"]')).toBeVisible();

    const after = await (await page.request.get(`/api/applications/${applicationId}/evaluate`)).json();
    const consentsAfter = await (await page.request.get(`/api/applications/${applicationId}/fi-consents`)).json();
    const handoffAfter = await (await page.request.get(`/api/applications/${applicationId}/fi-handoff`)).json();
    const faAfter = await (await page.request.get(`/api/applications/${applicationId}/fa-request`)).json();

    expect(after.evaluation.snapshotId).toBe(before.evaluation.snapshotId);
    expect(after.evaluation.route).toBe(before.evaluation.route);
    expect(after.evaluation.preScore).toBe(before.evaluation.preScore);
    expect(after.evaluation.tier).toBe(before.evaluation.tier);
    expect(after.evaluation.financialPassport).toEqual(before.evaluation.financialPassport);
    expect(after.evaluation.affordability).toEqual(before.evaluation.affordability);
    expect(after.evaluation.basicEligibility).toEqual(before.evaluation.basicEligibility);

    expect(consentsAfter.consents).toHaveLength(consentsBefore.consents.length);
    expect(handoffAfter.statuses).toHaveLength(handoffBefore.statuses.length);
    expect(faAfter.cases).toHaveLength(faBefore.cases.length);
  });
});

test.describe("4 — ไม่มี request ใดพาค่าอ่อนไหวออกไป", () => {
  test("ดักทุก request จากหน้านี้ ไม่มี body หรือ URL ใดมีค่าที่กรอก", async ({ page }) => {
    const applicationId = await openDemo(page, "A");
    await page.goto(`/apply/${applicationId}/verification`);

    // เริ่มดักหลังหน้าโหลดเสร็จ เพื่อให้ทุก request ที่เหลือเป็นผลจากการกรอกเท่านั้น
    const requests = recordRequests(page);

    await page.locator('[data-role="verification-input-nationalId"]').fill(SECRET_ID);
    await page.locator('[data-role="verification-file-idCard"]').setInputFiles({
      name: "id-card.png",
      mimeType: "image/png",
      buffer: Buffer.from("sensitive-bytes-that-must-never-leave")
    });
    await page.locator('[data-role="verification-role-FI_STAFF"]').click();
    await page.locator('[data-role="verification-input-bankAccount"]').fill(SECRET_ACCOUNT);
    await page.waitForTimeout(500);

    for (const request of requests) {
      expect(request.url, `พบค่าอ่อนไหวใน URL: ${request.url}`).not.toContain(SECRET_ID);
      expect(request.url).not.toContain(SECRET_ACCOUNT);
      expect(request.body, `พบค่าอ่อนไหวใน body ของ ${request.method} ${request.url}`).not.toContain(SECRET_ID);
      expect(request.body).not.toContain(SECRET_ACCOUNT);
      expect(request.body).not.toContain("sensitive-bytes-that-must-never-leave");
      expect(request.body).not.toContain("id-card.png");
    }

    // ไม่มีการอัปโหลดใด ๆ เกิดขึ้นเลย
    const uploads = requests.filter(
      (request) => request.method === "POST" || request.method === "PUT" || request.method === "PATCH"
    );
    expect(uploads, `ไม่ควรมี request เขียนข้อมูล แต่พบ ${JSON.stringify(uploads)}`).toHaveLength(0);
  });
});

test.describe("5 — ถ้อยคำและขอบเขต", () => {
  test("แสดงสถานะตามโหมดการแข่งขัน และไม่มีคำที่อ้างว่าตรวจผ่านแล้ว", async ({ page }) => {
    const applicationId = await openDemo(page, "A");
    await page.goto(`/apply/${applicationId}/verification`);

    await expect(page.locator('[data-role="verification-identity-state"]')).toHaveText(
      "Identity verification deferred — Competition Mode"
    );
    await expect(page.locator('[data-role="verification-phone-state"]')).toHaveText(
      "Not required — Competition Mode"
    );
    await expect(page.locator('[data-role="verification-bureau-context"]')).toHaveText(
      "ดำเนินการภายใต้ความยินยอมและช่องทางที่สถาบันการเงินหรือผู้ให้บริการที่เกี่ยวข้องกำหนด"
    );
    await expect(page.locator('[data-role="verification-no-decision"]')).toContainText("ไม่มีผลต่อผลการประเมิน");

    const text = await page.locator("main").innerText();
    for (const forbidden of [
      "Identity Verified",
      "KYC Passed",
      "Credit Bureau Passed",
      "Loan Approved",
      "Guarantee Approved"
    ]) {
      expect(text, `ต้องไม่แสดงสถานะ ${forbidden}`).not.toContain(forbidden);
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
