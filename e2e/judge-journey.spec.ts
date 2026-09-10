import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * เส้นทางที่กรรมการจะเดินจริงบนเบราว์เซอร์
 *
 * ทุกเทสต์เริ่มจากหน้าเว็บจริงและกดผ่าน UI เท่านั้น
 * ไม่มีการเขียนผลลัพธ์ลงฐานข้อมูลตรง ๆ และไม่มีการคำนวณซ้ำในเทสต์
 * สิ่งที่ตรวจคือ "ผู้ใช้เห็นอะไร" ไม่ใช่ "ฟังก์ชันคืนค่าอะไร"
 */

/** สร้างใบสมัครสาธิตผ่าน API เดียวกับปุ่มบนหน้าแรก แล้วเปิดหน้าผลลัพธ์ */
async function openDemo(page: Page, caseId: "A" | "B" | "C" | "D"): Promise<string> {
  const response = await page.request.post(`/api/demo/${caseId}`, {
    headers: { accept: "application/json" }
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { applicationId: string };
  await page.goto(`/apply/${body.applicationId}`);
  return body.applicationId;
}

/** กดเลือกสถาบันการเงินด้วยรหัส เพื่อไม่ให้เทสต์ผูกกับลำดับบนหน้าจอ */
async function selectFi(page: Page, fiId: string): Promise<void> {
  const toggle = page.locator(`[data-role="fi-option"][data-fi-id="${fiId}"] [data-role="fi-select-toggle"]`);
  await expect(toggle).toBeEnabled();
  await toggle.click();
}

test.describe("1 — หน้าแรกและโหมดสาธิต", () => {
  test("หน้าแรกมีปุ่มเริ่มสมัครและชุดข้อมูลสาธิตครบสี่เคส พร้อมป้ายกำกับ", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "ทดลองสมัคร Route to Own" })).toBeVisible();
    await expect(page.locator('[data-role="demo-badge"]')).toHaveText("Competition Demo Data");

    for (const caseId of ["A", "B", "C", "D"] as const) {
      await expect(page.locator(`[data-role="demo-case-${caseId}"]`)).toBeVisible();
    }

    // ข้อความกำกับขอบเขตต้องอยู่บนหน้าแรกเสมอ
    await expect(page.getByText("Competition Registration — ไม่ใช่การยื่นขอสินเชื่อจริง")).toBeVisible();
  });
});

test.describe("2 — แบบฟอร์มลงทะเบียน", () => {
  test("กรอกครบทุกขั้นแล้วได้ผลประเมินจากเซิร์ฟเวอร์", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "ทดลองสมัคร Route to Own" }).click();
    await expect(page).toHaveURL(/\/apply\/RTO-C26-\d{6}$/);

    const wizard = page.locator('[data-role="registration-wizard"]');
    await expect(wizard).toBeVisible();

    // ขั้นที่ 1 — ความยินยอม
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "ยินยอมและดำเนินการต่อ" }).click();

    // ขั้นที่ 2 — ข้อมูลผู้สมัคร
    await page.getByLabel("ชื่อ").fill("ผู้สมัครทดสอบ");
    await page.getByLabel("เบอร์โทรศัพท์").fill("0812345678");
    await page.locator('[data-role="wizard-next"]').click();

    // ขั้นที่ 3 — สถานะอาชีพ
    await page.locator('[data-role="wizard-next"]').click();

    // ขั้นที่ 4 — รายได้: ยอดรวมที่แสดงต้องเป็นการบวกเลขของผู้สมัครเอง
    const amounts = page.locator('[data-role="registration-wizard"] input[type="number"]');
    await expect(page.locator('[data-role="wizard-declared"]')).toContainText("฿");
    await expect(page.locator('[data-role="wizard-evidenced"]')).toContainText("฿");
    await amounts.first().fill("2200");
    await expect(page.locator('[data-role="wizard-declared"]')).toContainText("2,850");
    await page.locator('[data-role="wizard-next"]').click();

    // ขั้นที่ 5–8
    for (let step = 0; step < 4; step += 1) {
      await page.locator('[data-role="wizard-next"]').click();
    }

    // ขั้นที่ 9 — ตรวจสอบแล้วส่งประเมิน
    await page.locator('[data-role="submit-evaluate"]').click();

    await expect(page.locator('[data-role="route-hero"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-role="registration-wizard"]')).toHaveCount(0);
  });
});

test.describe("3 — หน้าจอรายได้", () => {
  test("ไม่มีช่องให้ผู้สมัครกรอกสัดส่วนรายได้ที่ตรวจสอบแล้วเอง", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "ทดลองสมัคร Route to Own" }).click();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "ยินยอมและดำเนินการต่อ" }).click();
    await page.getByLabel("ชื่อ").fill("ผู้สมัครทดสอบ");
    await page.getByLabel("เบอร์โทรศัพท์").fill("0812345678");
    await page.locator('[data-role="wizard-next"]').click();
    await page.locator('[data-role="wizard-next"]').click();

    const body = await page.locator('[data-role="registration-wizard"]').innerText();
    expect(body).not.toContain("verifiedPct");
    expect(body).not.toContain("% ที่ตรวจสอบแล้ว");
    // ข้อมูลการวิ่งต้องถูกอธิบายว่าไม่ใช่รายได้
    expect(body).toContain("Activity Data ≠ Income");
  });
});

test.describe("4 — Financial Passport และหน้าผลลัพธ์", () => {
  test("แสดงรายได้สามชั้นแยกกัน และเรียงลำดับ Route ก่อน Pre-Score", async ({ page }) => {
    await openDemo(page, "A");

    await expect(page.locator('[data-role="route-hero"]')).toHaveText(/READY FOR FI/);
    await expect(page.locator('[data-role="route-title-th"]')).toHaveText(
      "พร้อมเข้าสู่การพิจารณาของสถาบันการเงิน"
    );

    // ชั้นรายได้ต้องไม่ถูกยุบรวมเป็นตัวเลขเดียว
    const passport = page.locator(".fo-passport");
    await expect(passport).toContainText("รายได้ที่ผู้สมัครระบุ");
    await expect(passport).toContainText("รายได้ที่ใช้ในการประเมินรอบทดลอง");
    await expect(passport).toContainText("เงินที่พร้อมรองรับภาระ");

    // ห้ามใช้คำที่สื่อว่ารับประกันเต็มจำนวนหรืออนุมัติแล้ว
    const text = await page.locator("main").innerText();
    expect(text).not.toContain("Eligible Guaranteed Amount");
    expect(text).toContain("วงเงินฐานอ้างอิงที่อาจเข้าเกณฑ์การค้ำประกัน");

    // Route ต้องเป็นหัวเรื่องระดับสูงสุด และคะแนนต้องเล็กกว่า
    const heroSize = await page
      .locator('[data-role="route-hero"]')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const scoreSize = await page
      .locator(".fo-gauge-score")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(scoreSize).toBeLessThan(heroSize);
  });

  test("เส้นทางที่ยังไม่พร้อมไม่เปิดทางเลือกส่งต่อสถาบันการเงิน", async ({ page }) => {
    await openDemo(page, "C");

    await expect(page.locator('[data-role="route-hero"]')).toHaveText(/ยังไม่พร้อมสำหรับสินเชื่อใหม่/);
    await expect(page.locator('[data-role="cta-fi-match"]')).toHaveCount(0);
  });
});

test.describe("5 — เปรียบเทียบสถาบันการเงิน", () => {
  test("เลือกได้สูงสุดสองแห่ง และแห่งที่ยังไม่ยืนยันความสอดคล้องเลือกไม่ได้", async ({ page }) => {
    const applicationId = await openDemo(page, "A");
    await page.locator('[data-role="cta-fi-match"]').click();
    await expect(page).toHaveURL(`/apply/${applicationId}/fi`);

    const options = page.locator('[data-role="fi-option"]');
    expect(await options.count()).toBeGreaterThan(2);

    // ทุกแห่งต้องบอกที่มาข้อมูลและสถานะความสอดคล้องกับโครงสร้างโครงการ
    await expect(options.first().locator('[data-role="fi-source"]')).toContainText("ที่มาข้อมูล");
    await expect(options.first().locator('[data-role="fi-compatibility-status"]')).not.toBeEmpty();

    // แห่งที่เป็นข้อมูลอ้างอิงตลาดล้วน ต้องกดเลือกไม่ได้
    const marketOnly = page.locator('[data-role="fi-option"][data-presentation="MARKET_REFERENCE"]');
    if ((await marketOnly.count()) > 0) {
      await expect(marketOnly.first().locator('[data-role="fi-select-toggle"]')).toBeDisabled();
    }

    const selectable = page.locator(
      '[data-role="fi-option"][data-presentation="ROUTE_TO_OWN_PARTICIPATING"] [data-role="fi-select-toggle"]'
    );
    await selectable.nth(0).click();
    await selectable.nth(1).click();
    await expect(page.locator('[data-role="fi-picked-count"]')).toContainText("2 / 2");

    // แห่งที่สามต้องถูกปฏิเสธพร้อมเหตุผล
    await selectable.nth(2).click();
    await expect(page.locator('[data-role="fi-error"]')).toContainText("สูงสุด 2 แห่ง");
    await expect(page.locator('[data-role="fi-picked-count"]')).toContainText("2 / 2");
  });
});

test.describe("6 — ผลเฉพาะของแต่ละสถาบันการเงิน", () => {
  test("เงื่อนไขที่ต่างกันทำให้ผลต่างกัน และระบบบอกว่าประเมินใหม่แล้ว", async ({ page }) => {
    const applicationId = await openDemo(page, "D");
    await page.goto(`/apply/${applicationId}/fi`);

    await selectFi(page, "KKP_EV");
    await page.locator('[data-role="fi-save-selections"]').click();

    await expect(page).toHaveURL(`/apply/${applicationId}/handoff`, { timeout: 30_000 });

    const card = page.locator('[data-role="fi-handoff-card"]').first();
    await expect(card.locator('[data-role="material-change-note"]')).toContainText("ประเมินใหม่");

    // เงื่อนไขที่ต่างออกไปทำให้เส้นทางเปลี่ยนจริง ไม่ใช่แค่ตัวเลขค่างวดขยับ
    await expect(card.locator('[data-role="route-changed-note"]')).toContainText("NO NEW DEBT");
    await expect(card.locator('[data-role="fi-specific-route"]')).toHaveText("NO NEW DEBT");

    // ตารางต้องแสดงทั้งผลอ้างอิงและผลเฉพาะแห่งนั้น พร้อม Snapshot คนละใบ
    const rows = card.locator('[data-role="comparison-row"][data-changed="true"]');
    expect(await rows.count()).toBeGreaterThan(0);

    const referenceSnapshot = await card
      .locator('[data-role="comparison-row"]')
      .last()
      .locator('[data-role="comparison-reference"]')
      .innerText();
    const fiSnapshot = await card
      .locator('[data-role="comparison-row"]')
      .last()
      .locator('[data-role="comparison-fi"]')
      .innerText();
    expect(referenceSnapshot).not.toBe(fiSnapshot);
  });
});

test.describe("7 — สองสถาบันการเงินถูกตัดสินแยกกัน", () => {
  test("ผล READY ของแห่งหนึ่งไม่เปิดสิทธิ์ส่งต่อให้อีกแห่ง", async ({ page }) => {
    const applicationId = await openDemo(page, "D");
    await page.goto(`/apply/${applicationId}/fi`);

    // เลือกด้วยรหัสสถาบันการเงิน ไม่ใช่ลำดับบนหน้าจอ
    // เพื่อให้เคสสาธิตนี้ชี้ไปที่คู่ที่เงื่อนไขต่างกันมากพอจะให้ผลต่างกันเสมอ
    await selectFi(page, "IBANK_GREEN_LIFE");
    await selectFi(page, "KKP_EV");
    await page.locator('[data-role="fi-save-selections"]').click();
    await expect(page).toHaveURL(`/apply/${applicationId}/handoff`, { timeout: 30_000 });

    const cards = page.locator('[data-role="fi-handoff-card"]');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('[data-role="handoff-independence-note"]')).toContainText("แยกกัน");

    // แต่ละแห่งอ้าง Snapshot ของตัวเอง
    const first = await cards.nth(0).locator('[data-role="fi-specific-route"]').innerText();
    const second = await cards.nth(1).locator('[data-role="fi-specific-route"]').innerText();
    expect(typeof first).toBe("string");
    expect(typeof second).toBe("string");

    // แห่งที่ผลไม่ใช่ READY ต้องไม่มีปุ่มให้ความยินยอมเลย
    let readyCount = 0;
    let blockedCount = 0;
    for (const index of [0, 1]) {
      const card = cards.nth(index);
      const route = (await card.locator('[data-role="fi-specific-route"]').innerText()).trim();
      if (route === "READY FOR FI") {
        readyCount += 1;
        await expect(card.locator('[data-role="fi-consent"]')).toBeVisible();
      } else {
        blockedCount += 1;
        await expect(card.locator('[data-role="fi-consent"]')).toHaveCount(0);
        await expect(card.locator('[data-role="fi-prepare-handoff"]')).toBeDisabled();
        await expect(card.locator('[data-role="handoff-not-ready"]')).toContainText(
          "ยังไม่สามารถให้ความยินยอมเพื่อส่งต่อข้อมูลได้"
        );
      }
    }

    // เคสสาธิตนี้ต้องแยกกันจริง — แห่งหนึ่งผ่าน อีกแห่งไม่ผ่าน
    expect(readyCount).toBe(1);
    expect(blockedCount).toBe(1);
  });

  test("เซิร์ฟเวอร์ปฏิเสธความยินยอมของแห่งที่ผลไม่ใช่ READY แม้เรียก API ตรง", async ({ page }) => {
    const applicationId = await openDemo(page, "D");
    await page.goto(`/apply/${applicationId}/fi`);

    // เลือกด้วยรหัสสถาบันการเงิน ไม่ใช่ลำดับบนหน้าจอ
    // เพื่อให้เคสสาธิตนี้ชี้ไปที่คู่ที่เงื่อนไขต่างกันมากพอจะให้ผลต่างกันเสมอ
    await selectFi(page, "IBANK_GREEN_LIFE");
    await selectFi(page, "KKP_EV");
    await page.locator('[data-role="fi-save-selections"]').click();
    await expect(page).toHaveURL(`/apply/${applicationId}/handoff`, { timeout: 30_000 });

    const statuses = await (await page.request.get(`/api/applications/${applicationId}/fi-handoff`)).json();

    for (const status of statuses.statuses) {
      const consent = await page.request.post(`/api/applications/${applicationId}/fi-consents`, {
        headers: { "content-type": "application/json" },
        data: { fiId: status.fiId }
      });
      // ด่านอยู่ที่เซิร์ฟเวอร์ ไม่ใช่ที่ปุ่มบนหน้าจอ
      if (status.route === "READY FOR FI") {
        expect(consent.status(), `${status.fiId} ควรให้ความยินยอมได้`).toBe(201);
      } else {
        expect(consent.status(), `${status.fiId} ไม่ควรให้ความยินยอมได้`).toBe(409);
        const body = await consent.json();
        expect(body.error).toContain("READY FOR FI");
      }
    }
  });
});

test.describe("8 — เตรียมส่งต่อและรายงาน PDF", () => {
  test("ต้องยินยอมรายแห่งก่อน จึงจะเตรียมชุดข้อมูลส่งต่อได้", async ({ page }) => {
    const applicationId = await openDemo(page, "A");
    await page.goto(`/apply/${applicationId}/fi`);

    await selectFi(page, "IBANK_GREEN_LIFE");
    await page.locator('[data-role="fi-save-selections"]').click();
    await expect(page).toHaveURL(`/apply/${applicationId}/handoff`, { timeout: 30_000 });

    const card = page.locator('[data-role="fi-handoff-card"]').first();
    await expect(card.locator('[data-role="fi-specific-route"]')).toHaveText("READY FOR FI");

    // ยังไม่ยินยอม → เซิร์ฟเวอร์ต้องปฏิเสธ
    await card.locator('[data-role="fi-prepare-handoff"]').click();
    await expect(card.locator('[data-role="handoff-blocked"]')).toContainText("ความยินยอม");

    // ยินยอมแล้ว → เตรียมได้
    await card.locator('[data-role="fi-consent"]').click();
    await expect(card.locator('[data-role="fi-consent"]')).toBeDisabled();
    await card.locator('[data-role="fi-prepare-handoff"]').click();
    await expect(card.locator('[data-role="handoff-ready"]')).toContainText(
      "พร้อมส่งข้อมูลประกอบเข้าสู่การพิจารณาของสถาบันการเงิน"
    );
  });

  test("ดาวน์โหลดรายงานความพร้อมได้จริงจากเบราว์เซอร์", async ({ page }) => {
    const applicationId = await openDemo(page, "A");

    const snapshotFooter = await page.locator(".fo-disclaimers").innerText();
    expect(snapshotFooter).toContain("Snapshot");

    const download = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByRole("button", { name: /ดาวน์โหลด/ }).click();
    const file = await download;

    // ชื่อไฟล์ต้องผูกกับเลขที่ใบสมัคร เพื่อให้ตรวจย้อนได้ว่ามาจากใบไหน
    expect(file.suggestedFilename()).toContain(applicationId);
    expect(file.suggestedFilename()).toMatch(/\.pdf$/);
  });
});

test.describe("9 — การแสดงผลบนจอเล็กและจอใหญ่", () => {
  test("ไม่มีการเลื่อนแนวนอนบนทุกหน้าในเส้นทางหลัก", async ({ page }) => {
    const applicationId = await openDemo(page, "A");
    await page.goto(`/apply/${applicationId}/fi`);

    await selectFi(page, "IBANK_GREEN_LIFE");
    await page.locator('[data-role="fi-save-selections"]').click();
    await expect(page).toHaveURL(`/apply/${applicationId}/handoff`, { timeout: 30_000 });

    for (const path of ["/", `/apply/${applicationId}`, `/apply/${applicationId}/fi`, `/apply/${applicationId}/handoff`]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `หน้า ${path} ล้นออกด้านข้าง`).toBeLessThanOrEqual(1);
    }
  });
});
