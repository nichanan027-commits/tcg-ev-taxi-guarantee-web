import { GOVERNANCE_COPY, canHandoffToFi } from "../config/competition.ts";
import { ROUTES } from "../route2own.ts";
import type { EvaluationSnapshot } from "../registration/types.ts";
import { listEnabledFi, nearestTermFor } from "./catalogue.ts";
import type { FiProduct } from "./catalogue.ts";
import { fiFinancingScenarioFor } from "./selection-service.ts";

/**
 * FI Matching — อธิบายความสอดคล้อง ไม่ทำนายโอกาสอนุมัติ
 *
 * ระบบนี้ไม่จัดอันดับว่าที่ไหน "อนุมัติง่ายกว่า" เพราะการอนุมัติเป็นอำนาจของสถาบันการเงิน
 * และการเดาโอกาสอนุมัติจะทำให้ผู้สมัครเข้าใจผิดว่าได้รับคำมั่นบางอย่างไปแล้ว
 *
 * ทุกค่าที่ใช้ตัดสินความสอดคล้องอ่านจาก Evaluation Snapshot ไม่มีการประเมินใหม่ที่นี่
 */
export type FiFitDimensions = {
  vehicleFit: boolean;
  financingFit: boolean;
  affordabilityFit: boolean;
  eligibilityFit: boolean;
  routeToOwnCompatibility: boolean;
};

export type FiMatchOption = {
  id: string;
  fiName: string;
  productName: string;
  indicativeRatePct: number;
  termMonths: number[];
  downPaymentNote: string;
  documentNotes: string;
  sourceStatus: FiProduct["sourceStatus"];
  sourceLabel: string;
  checkedAt: string;
  compatibilityNote: string;

  fit: FiFitDimensions;
  fitNotes: string[];

  /** ตัวเลขของผู้สมัครเองภายใต้เงื่อนไขอ้างอิงของ FI รายนี้ */
  applicantEstimatedMonthlyInstallment: number;
  applicantDailyBurden: number;
  financingNote: string;

  /** ROUTE_TO_OWN_PARTICIPATING = เสนอเป็นทางเลือกส่งต่อได้, MARKET_REFERENCE = ดูเพื่อเปรียบเทียบเท่านั้น */
  presentation: "ROUTE_TO_OWN_PARTICIPATING" | "MARKET_REFERENCE";
  selectableForHandoff: boolean;
};

export function fiFitFor(fi: FiProduct, snapshot: EvaluationSnapshot): FiFitDimensions {
  const scenario = fiFinancingScenarioFor(fi, snapshot);
  const loanAmount = snapshot.vehicleScenario.vehiclePrice;

  const withinMin = fi.minFinance === null || loanAmount >= fi.minFinance;
  const withinMax = fi.maxFinance === null || loanAmount <= fi.maxFinance;

  return {
    vehicleFit: fi.vehicleFit.length > 0,
    financingFit: withinMin && withinMax,
    // อ่านจาก Snapshot: เงินที่พร้อมรองรับภาระต้องครอบคลุมภาระของ FI รายนี้
    affordabilityFit: snapshot.affordabilityPassed && snapshot.availableCash >= scenario.dailyEquivalentBurden,
    eligibilityFit: snapshot.basicEligibility !== null,
    routeToOwnCompatibility: fi.routeToOwnZeroDownCompatible
  };
}

function fitNotesFor(fi: FiProduct, fit: FiFitDimensions, snapshot: EvaluationSnapshot): string[] {
  const notes: string[] = [];

  notes.push(fit.vehicleFit ? "รองรับรถ EV ใหม่ป้ายแดงตามข้อมูลที่เผยแพร่" : "ยังไม่มีข้อมูลว่ารองรับรถประเภทนี้");
  notes.push(
    fit.financingFit
      ? "วงเงินที่ต้องใช้อยู่ในช่วงที่ผลิตภัณฑ์รองรับ"
      : "วงเงินที่ต้องใช้อยู่นอกช่วงที่ผลิตภัณฑ์ระบุไว้"
  );
  notes.push(
    fit.affordabilityFit
      ? "เงินที่พร้อมรองรับภาระของคุณครอบคลุมภาระโดยประมาณของผลิตภัณฑ์นี้"
      : "ภาระโดยประมาณของผลิตภัณฑ์นี้สูงกว่าเงินที่พร้อมรองรับภาระของคุณ"
  );
  notes.push(fit.eligibilityFit ? "มีข้อมูลคุณสมบัติเบื้องต้นครบสำหรับเตรียมส่งต่อ" : "ยังไม่มีข้อมูลคุณสมบัติเบื้องต้น");
  notes.push(fi.compatibilityNote);

  if (snapshot.revenue.verifiedDailyRevenue === null) {
    notes.push("รายได้ที่ใช้ประเมินยังไม่มีหลักฐานธุรกรรมรองรับ สถาบันการเงินอาจขอเอกสารเพิ่ม");
  }

  return notes;
}

/**
 * รายชื่อสถาบันการเงินที่สอดคล้องกับข้อมูลของผู้สมัคร
 *
 * NO NEW DEBT จะไม่ได้รับรายการใดเลย เพราะสถานะนี้ยังไม่เหมาะกับการเพิ่มภาระหนี้
 * BUILD ดูเปรียบเทียบได้ แต่เลือกเพื่อส่งต่อไม่ได้
 */
export function matchFi(snapshot: EvaluationSnapshot): FiMatchOption[] {
  if (snapshot.route === ROUTES.NO_NEW_DEBT) return [];

  const readyToSelect = canHandoffToFi(snapshot.route);

  return listEnabledFi().map((fi) => {
    const fit = fiFitFor(fi, snapshot);
    const scenario = fiFinancingScenarioFor(fi, snapshot);

    return {
      id: fi.id,
      fiName: fi.fiName,
      productName: fi.productName,
      indicativeRatePct: fi.indicativeRatePct,
      termMonths: fi.termMonths,
      downPaymentNote: fi.downPaymentNote,
      documentNotes: fi.documentNotes,
      sourceStatus: fi.sourceStatus,
      sourceLabel: fi.sourceLabel,
      checkedAt: fi.checkedAt,
      compatibilityNote: fi.compatibilityNote,

      fit,
      fitNotes: fitNotesFor(fi, fit, snapshot),

      applicantEstimatedMonthlyInstallment: scenario.estimatedMonthlyInstallment,
      applicantDailyBurden: scenario.dailyEquivalentBurden,
      financingNote: GOVERNANCE_COPY.illustrativeFinancingLong,

      presentation: fi.routeToOwnZeroDownCompatible
        ? ("ROUTE_TO_OWN_PARTICIPATING" as const)
        : ("MARKET_REFERENCE" as const),
      // เลือกเพื่อส่งต่อได้เฉพาะเมื่อเส้นทางเป็น READY และผลิตภัณฑ์รองรับเงินดาวน์ 0%
      selectableForHandoff: readyToSelect && fi.routeToOwnZeroDownCompatible
    };
  });
}

export { nearestTermFor };
