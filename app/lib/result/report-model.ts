import { GOVERNANCE_COPY } from "../config/competition.ts";
import { GUARANTEE_COPY } from "../evaluation/guarantee-wording.ts";
import { REVENUE_ASSESSMENT_LABEL, REVENUE_VERIFIED_LABEL } from "../evidence/revenue-assessment.ts";
import { REVENUE_EVIDENCE_STATUS_COPY } from "../evidence/types.ts";
import { ROUTES } from "../route2own.ts";
import type { EvaluationSnapshot } from "../registration/types.ts";

/**
 * โมเดลของรายงานความพร้อม (PDF)
 *
 * อ่านจาก Evaluation Snapshot ชุดเดียวกับหน้าเว็บ ไม่คำนวณคะแนน ไม่คำนวณค่างวด
 * และไม่เรียก Frozen Engine ซ้ำ — ตัวเลขทุกตัวถูกตัดสินไปแล้วตอนประเมิน
 *
 * ห้ามใส่ข้อมูลอ่อนไหวลงในเอกสาร: เลขบัตรประชาชน เลขบัญชี statement
 * ภาพบัตร/ใบขับขี่ รายงานเครดิตบูโร และข้อมูลสุขภาพ ไม่มีอยู่ในระบบนี้ตั้งแต่ต้น
 */
const baht = (value: number) => `฿${Math.round(value).toLocaleString("th-TH")}`;

export function reportTitleFor(route: string): string {
  if (route === ROUTES.READY_FOR_FI) return "Route to Own — Pre-E-LG Readiness Report";
  if (route === ROUTES.BUILD_READINESS) return "Credit Readiness Improvement Report";
  return "สถานะ: ยังไม่พร้อมสำหรับสินเชื่อใหม่";
}

const ROUTE_FILE_CODE: Record<string, string> = {
  [ROUTES.READY_FOR_FI]: "READY",
  [ROUTES.BUILD_READINESS]: "BUILD",
  [ROUTES.NO_NEW_DEBT]: "NO-NEW-DEBT"
};

export function reportFileName(applicationId: string, route: string): string {
  return `Route-to-Own-${applicationId}-${ROUTE_FILE_CODE[route] ?? "REPORT"}.pdf`;
}

export type ReportRow = { label: string; value: string | number; note?: string };
export type ReportPage = {
  id: string;
  heading: string;
  rows: ReportRow[];
  notes: string[];
};

export function readinessReportModel(snapshot: EvaluationSnapshot) {
  const isReady = snapshot.route === ROUTES.READY_FOR_FI;
  const isBuild = snapshot.route === ROUTES.BUILD_READINESS;
  const hasGap = snapshot.affordabilityGap > 0;

  const passportRows: ReportRow[] = [
    { label: "รายได้ที่ผู้สมัครระบุ", value: `${baht(snapshot.revenue.declaredDailyRevenue)} / วัน` },
    {
      label: "สถานะหลักฐานรายได้",
      value: snapshot.revenue.evidenceStatus,
      note: REVENUE_EVIDENCE_STATUS_COPY[snapshot.revenue.evidenceStatus] ?? ""
    },
    { label: REVENUE_ASSESSMENT_LABEL, value: `${baht(snapshot.revenue.assessmentDailyRevenue)} / วัน` }
  ];

  // บรรทัดนี้มีได้เฉพาะเมื่อมีหลักฐานธุรกรรมจริงเท่านั้น
  if (snapshot.revenue.verifiedDailyRevenue !== null) {
    passportRows.push({
      label: REVENUE_VERIFIED_LABEL,
      value: `${baht(snapshot.revenue.verifiedDailyRevenue)} / วัน`
    });
  }

  passportRows.push(
    { label: "ต้นทุนในการทำงาน", value: `− ${baht(snapshot.eligibleOpEx)} / วัน` },
    { label: "เงินจำเป็นที่ต้องกันไว้", value: `− ${baht(snapshot.protectedCash)} / วัน` },
    { label: "เงินที่พร้อมรองรับภาระ", value: `${baht(snapshot.availableCash)} / วัน` },
    { label: "ภาระรถโดยประมาณ", value: `${baht(snapshot.estimatedObligation)} / วัน` },
    hasGap
      ? { label: "Affordability Gap — ยังขาด", value: `${baht(snapshot.affordabilityGap)} / วัน` }
      : { label: "Residual — เหลือหลังรับภาระ", value: `${baht(snapshot.residual)} / วัน` }
  );

  const pages: ReportPage[] = [
    {
      id: "executive",
      heading: "ผลการประเมินโดยสรุป",
      rows: [
        { label: "เลขที่ใบสมัคร", value: snapshot.applicationId },
        { label: "วันที่ประเมิน", value: snapshot.evaluatedAt.slice(0, 10) },
        { label: "รถที่ใช้ประเมิน", value: snapshot.vehicleScenario.vehicleName },
        { label: "เส้นทางที่เหมาะสม", value: snapshot.route },
        {
          label: "ความสามารถรับภาระ",
          value: hasGap
            ? `ยังขาด ${baht(snapshot.affordabilityGap)} / วัน`
            : `เหลือ ${baht(snapshot.residual)} / วัน`
        },
        { label: "ระดับความพร้อม", value: snapshot.tier ?? "—" },
        { label: "คะแนนความพร้อม", value: `${snapshot.preScore} / 100` }
      ],
      notes: [GOVERNANCE_COPY.preScoreDisclaimer, GOVERNANCE_COPY.competitionRegistration]
    },
    {
      id: "passport",
      heading: "Financial Passport",
      rows: passportRows,
      notes: [GOVERNANCE_COPY.activityNotIncome]
    },
    {
      id: "explainability",
      heading: "คำอธิบายผลความพร้อมทางเครดิต",
      rows: [
        { label: "สถานะอาชีพ", value: snapshot.basicEligibility?.taxiOccupationStatus ?? "—" },
        { label: "ใบขับขี่สาธารณะ", value: snapshot.basicEligibility?.publicDriverLicenseStatus ?? "—" },
        { label: "สถานะหลักฐานอาชีพ", value: snapshot.basicEligibility?.occupationalEvidenceStatus ?? "—" },
        { label: "ความสามารถรับภาระ", value: snapshot.affordabilityPassed ? "ผ่าน" : "ยังไม่ผ่าน" },
        {
          label: "ความสามารถปิดเงินต้น",
          value: snapshot.principalSustainabilityPassed ? "ผ่าน" : "ยังไม่ผ่าน"
        },
        { label: "ความน่าเชื่อถือของหลักฐานรายได้", value: snapshot.incomeEvidenceReliability },
        { label: "การตรวจสอบไขว้จากข้อมูลการวิ่ง", value: snapshot.activityEvidenceStatus },
        { label: "คะแนนความพร้อม", value: `${snapshot.preScore} / 100` },
        { label: "ระดับความพร้อม", value: snapshot.tier ?? "—" }
      ],
      notes: [
        snapshot.basicEligibility?.statusCopy ?? "",
        snapshot.basicEligibility?.identityState ?? "",
        ...snapshot.reasonCodes.map((reason) => `[${reason.severity}] ${reason.code} — ${reason.message}`)
      ].filter(Boolean)
    },
    {
      id: "financing",
      heading: "รถและประมาณการค่างวด",
      rows: [
        { label: "ราคารถ", value: baht(snapshot.vehicleScenario.vehiclePrice) },
        { label: "เงินดาวน์ผู้ขับ", value: "0%" },
        { label: "วงเงินสินเชื่อโดยประมาณ", value: baht(snapshot.financingScenario.loanAmount) },
        { label: "อัตราดอกเบี้ยที่ใช้ประมาณการ", value: `${snapshot.financingScenario.annualRatePct}% ต่อปี` },
        { label: "ระยะเวลาผ่อน", value: `${snapshot.financingScenario.termMonths} เดือน` },
        {
          label: "ค่างวดโดยประมาณ",
          value: `${baht(snapshot.financingScenario.estimatedMonthlyInstallment)} / เดือน`
        },
        {
          label: "ภาระเทียบต่อวันทำงาน",
          value: `${baht(snapshot.financingScenario.dailyEquivalentBurden)} / วัน`
        },
        {
          label: GUARANTEE_COPY.labelTh,
          value:
            snapshot.indicativeGuaranteeEligibleBase === null
              ? "—"
              : baht(snapshot.indicativeGuaranteeEligibleBase),
          note: `${GUARANTEE_COPY.label} — ${GUARANTEE_COPY.disclaimer}`
        }
      ],
      notes: [GOVERNANCE_COPY.illustrativeFinancingLong, GOVERNANCE_COPY.zeroDownNotGuarantee]
    },
    {
      id: "fi",
      heading: "สถาบันการเงิน",
      rows: [],
      notes: isReady
        ? ["FI Comparison — available after READY", GOVERNANCE_COPY.fiMaxSelections]
        : [
            "FI Comparison — available after READY",
            isBuild
              ? "ดูเงื่อนไขของสถาบันการเงินได้เพื่อประกอบการวางแผน แต่ยังส่งต่อไม่ได้ในสถานะนี้"
              : "สถานะนี้ยังไม่เหมาะกับการเพิ่มภาระหนี้ใหม่ จึงยังไม่มีขั้นตอนส่งต่อสถาบันการเงิน"
          ]
    },
    {
      id: "decision-rights",
      heading: "ขอบเขตอำนาจการตัดสิน",
      rows: [
        { label: "บสย. / Route to Own", value: "Basic Eligibility · Credit Readiness · Pre-Screen · Guarantee Readiness" },
        { label: "สถาบันการเงิน", value: "Underwriting · Final Credit Decision · Contractual Terms" }
      ],
      notes: [GOVERNANCE_COPY.readinessNotApproval, GOVERNANCE_COPY.preScoreNotApproval]
    }
  ];

  return {
    title: reportTitleFor(snapshot.route),
    subtitleTh: "รายงานความพร้อมก่อนเข้าสู่กระบวนการสินเชื่อและการค้ำประกัน",
    fileName: reportFileName(snapshot.applicationId, snapshot.route),

    applicationId: snapshot.applicationId,
    snapshotId: snapshot.id,
    inputVersion: snapshot.inputVersion,
    engineStatus: snapshot.engineStatus,
    specVersion: snapshot.specVersion,

    executive: {
      route: snapshot.route,
      preScore: snapshot.preScore,
      tier: snapshot.tier,
      availableCash: snapshot.availableCash,
      estimatedObligation: snapshot.estimatedObligation,
      residual: snapshot.residual,
      affordabilityGap: snapshot.affordabilityGap
    },

    /** ไม่มีข้อมูลย้อนหลังหลายวันจริง จึงต้องไม่วาดกราฟแนวโน้มปลอม */
    hasHistoricalSeries: false,
    showsFiSelection: isReady,
    showsImprovementGuidance: !isReady,
    blockingReasons: snapshot.reasonCodes.filter((reason) => reason.severity === "BLOCKER"),

    pages
  };
}

export type ReadinessReportModel = ReturnType<typeof readinessReportModel>;
