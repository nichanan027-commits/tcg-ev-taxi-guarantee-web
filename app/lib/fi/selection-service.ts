import { competitionConfig, canHandoffToFi } from "../config/competition.ts";
import { evaluateApplicationForFi } from "../evaluation/evaluate-application.ts";
import { estimateFinancing } from "../financing/estimate.ts";
import { hasMaterialFinancingChange, materialChangeReport } from "../financing/material-change.ts";
import type { EvaluationSnapshot, FinancingScenario } from "../registration/types.ts";
import { getFiProduct, isRouteToOwnSelectable, nearestTermFor } from "./catalogue.ts";
import type { FiProduct } from "./catalogue.ts";

export const MAX_FI_SELECTIONS = competitionConfig.maxFiSelections;

type FiLike = Pick<FiProduct, "id" | "indicativeRatePct" | "termMonths"> &
  Partial<Pick<FiProduct, "routeToOwnCompatibilityStatus">>;

/**
 * ประมาณการค่างวดภายใต้เงื่อนไขอ้างอิงของ FI แต่ละแห่ง
 *
 * ตัวเลขนี้เป็นการประมาณการ ไม่ใช่ข้อเสนอที่ FI อนุมัติจริง
 * เงินดาวน์ผู้ขับยังเป็น 0% ตามแบบผลิตภัณฑ์ จึงกู้เต็มราคารถ
 */
export function fiFinancingScenarioFor(fi: FiLike, snapshot: EvaluationSnapshot): FinancingScenario {
  const loanAmount = snapshot.vehicleScenario.vehiclePrice;
  const termMonths = nearestTermFor(fi, snapshot.financingScenario.termMonths);
  const workingDaysPerMonth = snapshot.financingScenario.workingDaysPerMonth;

  const estimate = estimateFinancing({
    vehiclePrice: loanAmount,
    loanAmount,
    annualRatePct: fi.indicativeRatePct,
    termMonths,
    workingDaysPerMonth
  });

  return {
    loanAmount,
    termMonths,
    annualRatePct: fi.indicativeRatePct,
    estimatedMonthlyInstallment: estimate.estimatedMonthlyInstallment,
    dailyEquivalentBurden: estimate.dailyEquivalentBurden,
    workingDaysPerMonth,
    label: "ILLUSTRATIVE_FINANCING_ESTIMATE"
  };
}

/**
 * เงื่อนไขของ FI ต่างจากที่ประเมินไว้มากพอที่ต้องประเมินใหม่หรือไม่
 *
 * READY ภายใต้เงื่อนไขอ้างอิงหนึ่ง ไม่ได้แปลว่า READY ภายใต้เงื่อนไขของ FI ทุกแห่ง
 */
export function shouldReevaluateForFi(fi: FiLike, snapshot: EvaluationSnapshot): boolean {
  return hasMaterialFinancingChange(snapshot.financingScenario, fiFinancingScenarioFor(fi, snapshot));
}

/**
 * ตรวจว่าเลือก FI ชุดนี้ได้หรือไม่
 *
 * ด่านนี้อยู่ฝั่งเซิร์ฟเวอร์ ฝั่งหน้าจอมีการปิดปุ่มด้วยอีกชั้นหนึ่ง
 * แต่การตัดสินใจจริงต้องเกิดที่นี่เสมอ เพื่อไม่ให้ client ข้ามเงื่อนไขได้
 */
export function assertSelectionAllowed(snapshot: EvaluationSnapshot, fiIds: string[]): void {
  if (!canHandoffToFi(snapshot.route)) {
    throw new Error("เลือกสถาบันการเงินเพื่อส่งต่อได้เฉพาะเมื่อผลประเมินล่าสุดเป็น READY FOR FI");
  }

  if (fiIds.length > MAX_FI_SELECTIONS) {
    throw new Error(`เลือกสถาบันการเงินได้สูงสุด ${MAX_FI_SELECTIONS} แห่ง`);
  }

  if (new Set(fiIds).size !== fiIds.length) {
    throw new Error("เลือกสถาบันการเงินซ้ำกันไม่ได้");
  }

  for (const fiId of fiIds) {
    const fi = getFiProduct(fiId);
    if (!fi) throw new Error(`ไม่พบสถาบันการเงิน ${fiId}`);
    if (!fi.enabled) throw new Error(`${fi.fiName} ไม่ได้เปิดให้เลือกในรอบนี้`);
    if (!isRouteToOwnSelectable(fi)) {
      throw new Error(
        `${fi.fiName} ยังไม่ยืนยันความสอดคล้องกับโครงสร้างโครงการ (เงินดาวน์ผู้ขับ 0%) จึงเลือกเพื่อส่งต่อไม่ได้`
      );
    }
  }
}

export type FiEvaluationOutcome = {
  fiId: string;
  materialChange: boolean;
  changedFields: string[];
  financingScenario: FinancingScenario;
  /** Snapshot ที่ใช้ตัดสิน FI รายนี้ — ใหม่เมื่อเงื่อนไขเปลี่ยน, เดิมเมื่อไม่เปลี่ยน */
  snapshot: EvaluationSnapshot;
  reusedExistingSnapshot: boolean;
};

/**
 * ประเมินใบสมัครภายใต้เงื่อนไขของ FI รายหนึ่ง
 *
 * ถ้าเงื่อนไขต่างอย่างมีนัยสำคัญ จะเรียก Frozen Engine ประเมินใหม่และได้ Snapshot ใหม่
 * Snapshot เดิมไม่ถูกแก้ ทำให้ตรวจย้อนได้ว่าเคยได้ผลอะไรภายใต้เงื่อนไขใด
 *
 * เงื่อนไขของ FI ถูกส่งเป็น override ของการเรียกครั้งนั้น ไม่ได้เขียนลงใบสมัคร
 * จึงไม่มีช่วงเวลาใดที่ใบสมัครถือเงื่อนไขของ FI แห่งอื่นค้างไว้
 * และการประเมินของแต่ละแห่งไม่ขึ้นต่อกันหรือต่อลำดับการเรียก
 */
export async function evaluateForFi(
  applicationId: string,
  fi: FiLike,
  referenceSnapshot: EvaluationSnapshot
): Promise<FiEvaluationOutcome> {
  const financingScenario = fiFinancingScenarioFor(fi, referenceSnapshot);
  const report = materialChangeReport(referenceSnapshot.financingScenario, financingScenario);

  if (!report.requiresReevaluation) {
    return {
      fiId: fi.id,
      materialChange: false,
      changedFields: [],
      financingScenario,
      snapshot: referenceSnapshot,
      reusedExistingSnapshot: true
    };
  }

  const snapshot = await evaluateApplicationForFi({
    applicationId,
    referenceSnapshotId: referenceSnapshot.id,
    fiId: fi.id,
    financingOverride: {
      annualRatePct: financingScenario.annualRatePct,
      termMonths: financingScenario.termMonths,
      loanAmount: financingScenario.loanAmount
    }
  });

  return {
    fiId: fi.id,
    materialChange: true,
    changedFields: report.changedFields,
    financingScenario,
    snapshot,
    reusedExistingSnapshot: false
  };
}

export type HandoffDecision = { allowed: boolean; reason: string };

/**
 * ตัดสินว่าส่งต่อ FI รายนี้ได้หรือไม่
 *
 * ต้องดูจาก Snapshot ที่ผูกกับ FI รายนั้นเท่านั้น
 * Snapshot READY ของ FI อีกแห่ง หรือ Snapshot READY เก่าก่อนเปลี่ยนเงื่อนไข
 * ใช้อนุมัติแทนกันไม่ได้ เพราะภาระต่อวันคนละตัวเลข
 */
export function handoffDecisionFor(
  snapshot: EvaluationSnapshot,
  context: { consented: boolean; staleSnapshot?: EvaluationSnapshot }
): HandoffDecision {
  if (!canHandoffToFi(snapshot.route)) {
    return {
      allowed: false,
      reason:
        "ผลประเมินล่าสุดภายใต้เงื่อนไขของสถาบันการเงินแห่งนี้ไม่ใช่ READY FOR FI จึงยังส่งต่อไม่ได้"
    };
  }

  if (!context.consented) {
    return { allowed: false, reason: "ต้องให้ความยินยอมสำหรับสถาบันการเงินแห่งนี้ก่อนจึงจะส่งต่อได้" };
  }

  return { allowed: true, reason: "ผลประเมินล่าสุดของสถาบันการเงินแห่งนี้เป็น READY FOR FI และได้รับความยินยอมแล้ว" };
}
