import { evaluate, PRODUCT_STATUS } from "../route2own.ts";
import { getApplication, setStatus } from "../registration/application-service.ts";
import { revenueAssessmentOf, toEngineInput } from "../registration/validation.ts";
import { basicEligibilityOf } from "../eligibility/types.ts";
import { financingScenarioOf } from "../financing/estimate.ts";
import { vehicleScenarioOf } from "../financing/vehicle-catalogue.ts";
import { rowId } from "../db/schema.ts";
import type { CanonicalRoute } from "../config/competition.ts";
import type { EvaluationSnapshot, ReasonCode } from "../registration/types.ts";
import { countSnapshots, insertSnapshot } from "./snapshot.ts";

export { getLatestEvaluationSnapshot, getSnapshotById, listEvaluationSnapshots } from "./snapshot.ts";

export const SPEC_VERSION = "RTO-COMP-REG-1.0";

/**
 * ตัวเชื่อมระหว่างข้อมูลใบสมัครกับ Frozen Route to Own Engine
 *
 * หน้าที่ของไฟล์นี้มีเพียงสามอย่าง: แปลง input, เรียก evaluate() ของ engine,
 * แล้วเก็บผลเป็น Snapshot ที่แก้ไม่ได้
 * ห้ามคำนวณเส้นทาง คะแนน หรือค่าธรรมเนียมเองแม้แต่บรรทัดเดียว
 * เส้นทางที่ได้จึงเป็นค่าที่ engine ตัดสิน คะแนนสูงไม่มีทางเปิดเคสที่ Affordability ไม่ผ่านกลับมาได้
 */
export async function evaluateApplication(applicationId: string): Promise<EvaluationSnapshot> {
  const application = await getApplication(applicationId);
  if (!application) throw new Error(`ไม่พบใบสมัคร ${applicationId}`);
  if (!application.financial || !application.profile) {
    throw new Error("ยังไม่มีข้อมูลรายได้และค่าใช้จ่ายเพียงพอสำหรับการประเมิน");
  }

  if (!application.eligibility) {
    throw new Error("ยังไม่มีข้อมูลคุณสมบัติเบื้องต้นสำหรับการประเมิน");
  }

  const financial = application.financial;
  const registration = {
    profile: application.profile,
    eligibility: application.eligibility,
    financial
  };
  // หลักฐานรายได้ถูกประเมินก่อน แล้วจึงส่งสัดส่วนที่มีหลักฐานจริงให้ engine
  const revenue = revenueAssessmentOf(registration);
  const engineResult = evaluate(toEngineInput(registration, revenue));
  const calc = engineResult.calc;
  const readiness = engineResult.readiness;

  const vehicleScenario = vehicleScenarioOf(financial.vehicleId, financial.vehiclePrice);
  const financingScenario = financingScenarioOf({
    vehiclePrice: vehicleScenario.vehiclePrice,
    // เงินดาวน์ผู้ขับ 0% จึงกู้เต็มราคารถ — 0% Down ≠ 100% Guarantee
    loanAmount: vehicleScenario.vehiclePrice,
    annualRatePct: financial.annualRatePct,
    termMonths: financial.termMonths,
    workingDaysPerMonth: financial.workingDaysPerMonth
  });

  const route = readiness.route as CanonicalRoute;
  // Tier เสนอได้เฉพาะเคสที่พร้อมส่งต่อ FI เท่านั้น
  const tier = route === "READY FOR FI" ? (readiness.tier ?? null) : null;

  const snapshot: EvaluationSnapshot = {
    id: rowId("snap"),
    applicationId,
    inputVersion: (await countSnapshots(applicationId)) + 1,
    basicEligibility: basicEligibilityOf(application.eligibility),
    revenue: {
      declaredDailyRevenue: revenue.declaredDailyRevenue,
      assessmentDailyRevenue: revenue.assessmentDailyRevenue,
      verifiedDailyRevenue: revenue.verifiedDailyRevenue,
      evidenceStatus: revenue.evidenceStatus
    },
    vehicleScenario,
    financingScenario,
    assessmentRevenue: calc.verified,
    eligibleOpEx: calc.dailyOpEx,
    protectedCash: calc.protectedDaily,
    availableCash: calc.availableCash,
    // ภาระรายวันที่นำไปเทียบกับ Available Cash บนหน้าจอ
    estimatedObligation: calc.paydTarget + calc.customerRbpDay + calc.reserveContributionPreview,
    residual: calc.residualCash,
    affordabilityGap: calc.affordabilityGap,
    affordabilityPassed: calc.affordabilityPassed,
    principalSustainabilityPassed: calc.principalSustainabilityPassed,
    incomeEvidenceReliability: readiness.incomeEvidenceReliability,
    activityEvidenceStatus: readiness.activityEvidenceStatus,
    preScore: readiness.readinessScore,
    tier,
    route,
    reasonCodes: reasonCodesOf(engineResult),
    rbpTier: tier,
    rbpRate: tier ? calc.rbpRate : null,
    indicativeGuaranteeEligibleBase: calc.eligibleGuaranteedAmount,
    engineStatus: PRODUCT_STATUS,
    specVersion: SPEC_VERSION,
    evaluatedAt: new Date().toISOString()
  };

  await insertSnapshot(snapshot);
  await setStatus(applicationId, "ROUTED", `ประเมินแล้ว: ${route}`);

  return snapshot;
}

/**
 * แปลงเหตุผลจาก engine เป็น reason code ที่มีรหัสและระดับความรุนแรง
 * ข้อความยังมาจาก engine ทั้งหมด ที่นี่เพียงจัดหมวดเพื่อให้หน้าจอและ PDF ใช้ร่วมกันได้
 */
function reasonCodesOf(result: ReturnType<typeof evaluate>): ReasonCode[] {
  const calc = result.calc;
  const readiness = result.readiness;
  const codes: ReasonCode[] = [];

  if (!calc.affordabilityPassed) {
    codes.push({
      code: "AFFORDABILITY_FAILED",
      severity: "BLOCKER",
      message: "กระแสเงินสดต่อวันยังไม่พอรองรับภาระผ่อนตามเกณฑ์ DSCR ขั้นต่ำ"
    });
  }
  if (!calc.principalSustainabilityPassed) {
    codes.push({
      code: "PRINCIPAL_NOT_SUSTAINABLE",
      severity: "BLOCKER",
      message: "ประมาณการแล้วเงินต้นยังปิดไม่ได้ภายในระยะสัญญา"
    });
  }
  if (calc.affordabilityGap > 0) {
    codes.push({
      code: "AFFORDABILITY_GAP",
      severity: "BLOCKER",
      message: `ยังขาดกระแสเงินสดอีก ${Math.round(calc.affordabilityGap).toLocaleString("th-TH")} บาท/วัน`
    });
  }
  if (calc.cashShortfallBeforeObligations > 0) {
    codes.push({
      code: "CASH_SHORTFALL_BEFORE_OBLIGATIONS",
      severity: "BLOCKER",
      message: `รายได้ที่ตรวจสอบได้ยังไม่ครอบคลุมค่าเดินรถและเงินกันครัวเรือน ขาดอีก ${Math.round(
        calc.cashShortfallBeforeObligations
      ).toLocaleString("th-TH")} บาท/วัน`
    });
  }
  if (readiness.incomeEvidenceReliability === "LOW") {
    codes.push({
      code: "INCOME_EVIDENCE_LOW",
      severity: "WATCH",
      message: "สัดส่วนรายได้ที่ตรวจสอบย้อนกลับได้ยังต่ำ ควรเพิ่มการรับเงินผ่านช่องทางที่มีหลักฐาน"
    });
  } else if (readiness.incomeEvidenceReliability === "MEDIUM") {
    codes.push({
      code: "INCOME_EVIDENCE_MEDIUM",
      severity: "WATCH",
      message: "หลักฐานรายได้อยู่ระดับปานกลาง เพิ่มความต่อเนื่องได้จะช่วยยกระดับความพร้อม"
    });
  }
  if (readiness.activityEvidenceStatus === "REVIEW" || readiness.activityEvidenceStatus === "LIMITED") {
    codes.push({
      code: "ACTIVITY_EVIDENCE_REVIEW",
      severity: "WATCH",
      message: "ข้อมูลกิจกรรมการวิ่งยังไม่สม่ำเสมอพอ ใช้เป็นการตรวจสอบไขว้เท่านั้น ไม่ใช่รายได้"
    });
  }

  // เหตุผลเชิงอธิบายจาก engine ใส่ไว้เป็นข้อมูลประกอบเสมอ
  for (const [index, reason] of result.reasons.entries()) {
    codes.push({ code: `ENGINE_NOTE_${index + 1}`, severity: "INFO", message: reason });
  }

  return codes;
}
