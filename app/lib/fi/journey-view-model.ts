import { GOVERNANCE_COPY, canHandoffToFi } from "../config/competition.ts";
import { getSnapshotById } from "../evaluation/snapshot.ts";
import { materialChangeReport } from "../financing/material-change.ts";
import type { EvaluationSnapshot } from "../registration/types.ts";
import { getFiProduct } from "./catalogue.ts";
import { FI_CONSENT_VERSION, listFiConsents, listFiSelections } from "./fi-repository.ts";
import { matchFi } from "./match.ts";
import { handoffDecisionFor } from "./selection-service.ts";

/**
 * View Model ของขั้นตอนสถาบันการเงิน
 *
 * ทุกตัวเลขอ่านจาก Evaluation Snapshot ที่บันทึกไว้แล้ว ไม่มีการประเมินใหม่ที่ชั้นแสดงผล
 * สิ่งเดียวที่คำนวณที่นี่คือ "ผลต่าง" ระหว่างสอง Snapshot ซึ่งเป็นการลบเลขเพื่อการอธิบาย
 *
 * สถานะของ FI แต่ละแห่งถูกตัดสินแยกกันจาก Snapshot ของตัวเอง
 * READY ของแห่งหนึ่งไม่ทำให้อีกแห่งส่งต่อได้
 */
const CHANGED_FIELD_COPY: Record<string, string> = {
  annualRatePct: "อัตราดอกเบี้ยที่ใช้ประมาณการ",
  termMonths: "ระยะเวลาผ่อน",
  loanAmount: "วงเงินสินเชื่อ",
  estimatedMonthlyInstallment: "ค่างวดโดยประมาณ",
  dailyEquivalentBurden: "ภาระเทียบต่อวัน",
  workingDaysPerMonth: "วันทำงานต่อเดือน"
};

export function changedFieldCopy(field: string): string {
  return CHANGED_FIELD_COPY[field] ?? field;
}

function outcomeOf(snapshot: EvaluationSnapshot) {
  return {
    snapshotId: snapshot.id,
    route: snapshot.route,
    termMonths: snapshot.financingScenario.termMonths,
    annualRatePct: snapshot.financingScenario.annualRatePct,
    estimatedMonthlyInstallment: snapshot.financingScenario.estimatedMonthlyInstallment,
    dailyEquivalentBurden: snapshot.financingScenario.dailyEquivalentBurden,
    availableCash: snapshot.availableCash,
    estimatedObligation: snapshot.estimatedObligation,
    residual: Math.max(0, snapshot.residual),
    affordabilityGap: Math.max(0, snapshot.affordabilityGap),
    affordabilityPassed: snapshot.affordabilityPassed,
    preScore: snapshot.preScore,
    tier: snapshot.tier,
    evaluatedAt: snapshot.evaluatedAt
  };
}

export type FiOutcomeView = ReturnType<typeof outcomeOf>;

export type FiSelectionView = {
  fiId: string;
  fiName: string;
  productName: string;
  slot: number;
  /** ผลอ้างอิงที่ผู้สมัครเห็นก่อนเลือกแห่งนี้ */
  reference: FiOutcomeView | null;
  /** ผลภายใต้เงื่อนไขของแห่งนี้โดยเฉพาะ */
  fiSpecific: FiOutcomeView | null;
  materialChange: boolean;
  changedFields: { field: string; label: string; from: unknown; to: unknown }[];
  routeChanged: boolean;
  consented: boolean;
  consentVersion: string | null;
  handoff: { allowed: boolean; reason: string };
};

export async function fiJourneyViewModel(applicationId: string, reference: EvaluationSnapshot) {
  const selections = await listFiSelections(applicationId, { activeOnly: true });
  const consents = await listFiConsents(applicationId);

  const views: FiSelectionView[] = [];
  for (const selection of selections) {
    const fi = getFiProduct(selection.fiId);
    const fiSnapshot = selection.evaluationSnapshotId
      ? await getSnapshotById(selection.evaluationSnapshotId)
      : null;
    const referenceSnapshot = selection.referenceSnapshotId
      ? await getSnapshotById(selection.referenceSnapshotId)
      : null;

    const report =
      referenceSnapshot && selection.financingScenario
        ? materialChangeReport(referenceSnapshot.financingScenario, selection.financingScenario)
        : null;

    const consented = consents.some((consent) => consent.fiId === selection.fiId && consent.accepted);

    views.push({
      fiId: selection.fiId,
      fiName: fi?.fiName ?? selection.fiId,
      productName: fi?.productName ?? "",
      slot: selection.slot,
      reference: referenceSnapshot ? outcomeOf(referenceSnapshot) : null,
      fiSpecific: fiSnapshot ? outcomeOf(fiSnapshot) : null,
      materialChange: selection.materialChange,
      changedFields: (report?.changedFields ?? []).map((field) => ({
        field,
        label: changedFieldCopy(field),
        from: referenceSnapshot?.financingScenario[field as keyof EvaluationSnapshot["financingScenario"]],
        to: selection.financingScenario?.[field as keyof EvaluationSnapshot["financingScenario"]]
      })),
      routeChanged: Boolean(referenceSnapshot && fiSnapshot && referenceSnapshot.route !== fiSnapshot.route),
      consented,
      consentVersion: consented ? FI_CONSENT_VERSION : null,
      handoff: fiSnapshot
        ? handoffDecisionFor(fiSnapshot, { consented })
        : { allowed: false, reason: "ยังไม่มีผลการประเมินสำหรับสถาบันการเงินแห่งนี้" }
    });
  }

  return {
    applicationId,
    heading: GOVERNANCE_COPY.fiMatchHeading,
    maxSelections: GOVERNANCE_COPY.fiMaxSelections,
    checkWithFi: GOVERNANCE_COPY.checkWithFi,
    fiOwnsDecision: GOVERNANCE_COPY.fiOwnsDecision,
    /** สิทธิ์มาจากเส้นทางของผลอ้างอิง ไม่ใช่จากสถานะบนหน้าจอ */
    canSelect: canHandoffToFi(reference.route),
    referenceSnapshotId: reference.id,
    referenceRoute: reference.route,
    options: matchFi(reference),
    selections: views
  };
}

export type FiJourneyViewModel = Awaited<ReturnType<typeof fiJourneyViewModel>>;
