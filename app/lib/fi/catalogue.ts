import type { FiSourceStatus } from "../config/competition.ts";

/**
 * FI Product Catalogue — ชั้นข้อมูลอ้างอิงเท่านั้น
 *
 * ไฟล์นี้ไม่ใช่กติกาผลิตภัณฑ์ของ Route to Own และไม่มีผลต่อการให้คะแนนหรือการจัดเส้นทาง
 * อัตราดอกเบี้ย ระยะเวลา และโปรโมชันที่ระบุไว้เป็นข้อมูลอ้างอิงสำหรับ "ประมาณการ" เท่านั้น
 * เงื่อนไขจริงเป็นอำนาจของสถาบันการเงินแต่ละแห่ง
 *
 * ที่มาของข้อมูล: เอกสาร "ข้อมูลสินเชื่อรถยนต์ไฟฟ้า (EV) ใหม่ป้ายแดง ปี 2569"
 * ซึ่งรวมทั้งเว็บไซต์ทางการของธนาคาร สื่อ โซเชียล และการสังเคราะห์ด้วย AI ไว้ด้วยกัน
 * จึงถูกใช้เป็น candidate seed เท่านั้น และไม่มีรายการใดถูกกำกับว่า VERIFIED_BY_FI
 * จนกว่าสถาบันการเงินจะยืนยันกลับมาเอง
 */
/**
 * ความสอดคล้องกับโครงสร้างโครงการ Route to Own
 *
 * แยกจาก sourceStatus โดยเจตนา: sourceStatus บอกว่าข้อมูลผลิตภัณฑ์มาจากไหน
 * ส่วนสถานะนี้บอกว่าสถาบันการเงินยืนยันการเข้าร่วมโครงสร้างโครงการหรือยัง
 * การมีข้อมูลสาธารณะไม่ได้พิสูจน์ว่าเข้าร่วมโครงการ จึงห้ามอนุมานข้ามกัน
 */
export type RouteToOwnCompatibilityStatus = "VERIFIED_PARTNER" | "COMPETITION_ASSUMPTION" | "NOT_CONFIRMED";

export const ROUTE_TO_OWN_COMPATIBILITY_COPY: Record<RouteToOwnCompatibilityStatus, string> = {
  VERIFIED_PARTNER: "สถาบันการเงินยืนยันการเข้าร่วมโครงสร้างโครงการแล้ว",
  COMPETITION_ASSUMPTION:
    "สถานการณ์จำลองสำหรับการแข่งขัน (Competition Illustration) ไม่ใช่การยืนยันการเข้าร่วมโครงการหรือเงื่อนไขสินเชื่อจริงของสถาบันการเงิน",
  NOT_CONFIRMED:
    "ยังไม่ยืนยันความสอดคล้องกับโครงสร้างโครงการ แสดงเป็นข้อมูลอ้างอิงตลาดเพื่อเปรียบเทียบเท่านั้น"
};

export type FiProduct = {
  id: string;
  fiName: string;
  productName: string;
  /** ประเภทรถที่ผลิตภัณฑ์รองรับ */
  vehicleFit: string[];
  minFinance: number | null;
  maxFinance: number | null;
  termMonths: number[];
  /** อัตราอ้างอิงสำหรับการประมาณการ ไม่ใช่อัตราที่เสนอจริง */
  indicativeRatePct: number;
  downPaymentNote: string;
  documentNotes: string;
  sourceStatus: FiSourceStatus;
  sourceLabel: string;
  checkedAt: string;
  enabled: boolean;
  /**
   * สถานะการเข้าร่วมโครงสร้างโครงการ — ไม่ได้อนุมานจาก sourceStatus
   * ผลิตภัณฑ์ที่ประกาศต่อสาธารณะว่าต้องมีเงินดาวน์ 10–20% จะเป็น NOT_CONFIRMED
   * และแสดงเป็น Market / Reference Scenario เท่านั้น
   */
  routeToOwnCompatibilityStatus: RouteToOwnCompatibilityStatus;
  compatibilityNote: string;
};

/**
 * เสนอเป็นตัวเลือกส่งต่อได้หรือไม่
 * ต้องยืนยันแล้ว หรืออยู่ในสถานการณ์จำลองที่ติดป้ายกำกับชัดเจนเท่านั้น
 */
export function isRouteToOwnSelectable(fi: Pick<FiProduct, "routeToOwnCompatibilityStatus">): boolean {
  return (
    fi.routeToOwnCompatibilityStatus === "VERIFIED_PARTNER" ||
    fi.routeToOwnCompatibilityStatus === "COMPETITION_ASSUMPTION"
  );
}

const CHECKED_AT = "2026-09-09";

export const FI_CATALOGUE: FiProduct[] = [
  {
    id: "GSB_EV_SOFTLOAN",
    fiName: "ธนาคารออมสิน (GSB)",
    productName: "สินเชื่อเพื่อการจัดซื้อยานยนต์ไฟฟ้า (EV) ป้ายแดง — Soft Loan",
    vehicleFit: ["EV ใหม่ป้ายแดง"],
    minFinance: null,
    maxFinance: 1_000_000,
    termMonths: [60, 72, 84],
    indicativeRatePct: 3.5,
    downPaymentNote: "ผลิตภัณฑ์สาธารณะระบุเงินดาวน์ 10–20% ตามรูปแบบหลักประกัน",
    documentNotes: "โครงการยื่นได้ถึง 31 มีนาคม 2570 ตามข้อมูลที่เผยแพร่",
    sourceStatus: "PUBLIC_SOURCE_REFERENCE",
    sourceLabel: "เว็บไซต์ธนาคารออมสินและข่าวประชาสัมพันธ์โครงการ Soft Loan",
    checkedAt: CHECKED_AT,
    enabled: true,
    routeToOwnCompatibilityStatus: "NOT_CONFIRMED",
    compatibilityNote:
      "ผลิตภัณฑ์สาธารณะกำหนดเงินดาวน์ 10–20% จึงยังไม่ใช่ตัวเลือกส่งต่อแบบเงินดาวน์ 0% ต้องตกลงเงื่อนไขเฉพาะโครงการกับธนาคารก่อน"
  },
  {
    id: "IBANK_GREEN_LIFE",
    fiName: "ธนาคารอิสลามแห่งประเทศไทย (iBank)",
    productName: "สินเชื่อ “ชีวิตติดกรีน”",
    vehicleFit: ["EV ใหม่ป้ายแดง"],
    minFinance: null,
    maxFinance: null,
    termMonths: [60, 72, 84],
    indicativeRatePct: 4.5,
    downPaymentNote: "ข้อมูลที่เผยแพร่ระบุวงเงินสูงสุด 100% ของราคารถ",
    documentNotes: "เงื่อนไขเฉพาะรายต้องยืนยันกับธนาคาร",
    sourceStatus: "PUBLIC_SOURCE_REFERENCE",
    sourceLabel: "ข่าวประชาสัมพันธ์แคมเปญของธนาคาร",
    checkedAt: CHECKED_AT,
    enabled: true,
    routeToOwnCompatibilityStatus: "COMPETITION_ASSUMPTION",
    compatibilityNote: "ข้อมูลที่เผยแพร่ระบุวงเงินได้ถึง 100% จึงสอดคล้องกับแบบเงินดาวน์ผู้ขับ 0%"
  },
  {
    id: "KLEASING_EV",
    fiName: "ลีสซิ่งกสิกรไทย (KLeasing)",
    productName: "สินเชื่อรถยนต์ใหม่ป้ายแดง — กลุ่ม EV",
    vehicleFit: ["EV ใหม่ป้ายแดง"],
    minFinance: null,
    maxFinance: null,
    termMonths: [48, 60, 72, 84],
    indicativeRatePct: 5.2,
    downPaymentNote: "เงื่อนไขเงินดาวน์ขึ้นกับรุ่นรถและแคมเปญที่ร่วมรายการ",
    documentNotes: "บัตรประชาชน ทะเบียนบ้าน และเอกสารแสดงรายได้ตามที่ธนาคารกำหนด",
    sourceStatus: "PUBLIC_SOURCE_REFERENCE",
    sourceLabel: "เว็บไซต์ธนาคารกสิกรไทย",
    checkedAt: CHECKED_AT,
    enabled: true,
    routeToOwnCompatibilityStatus: "COMPETITION_ASSUMPTION",
    compatibilityNote: "รองรับการตกลงเงื่อนไขเฉพาะโครงการได้ ต้องยืนยันวงเงินและเงินดาวน์กับธนาคาร"
  },
  {
    id: "KRUNGSRI_AUTO_EV",
    fiName: "กรุงศรี ออโต้ (Krungsri Auto)",
    productName: "สินเชื่อรถยนต์ไฟฟ้าใหม่ป้ายแดง",
    vehicleFit: ["EV ใหม่ป้ายแดง"],
    minFinance: null,
    maxFinance: null,
    termMonths: [48, 60, 72, 84],
    indicativeRatePct: 5.0,
    downPaymentNote: "เงื่อนไขเงินดาวน์ขึ้นกับรุ่นรถและผลการพิจารณา",
    documentNotes:
      "อายุ 20–65 ปี มีถิ่นพำนักในประเทศไทย อายุงานปัจจุบันอย่างน้อย 1 ปี พร้อมเอกสารแสดงรายได้ย้อนหลัง 3–6 เดือน",
    sourceStatus: "PUBLIC_SOURCE_REFERENCE",
    sourceLabel: "เว็บไซต์กรุงศรี ออโต้",
    checkedAt: CHECKED_AT,
    enabled: true,
    routeToOwnCompatibilityStatus: "COMPETITION_ASSUMPTION",
    compatibilityNote: "ผ่อนได้สูงสุด 84 เดือน รองรับการตกลงเงื่อนไขเฉพาะโครงการ"
  },
  {
    id: "TTB_DRIVE_EV",
    fiName: "ทีทีบีไดรฟ์ (ttb Drive)",
    productName: "สินเชื่อรถยนต์ใหม่ป้ายแดง",
    vehicleFit: ["EV ใหม่ป้ายแดง"],
    minFinance: null,
    maxFinance: null,
    termMonths: [48, 60, 72, 84],
    indicativeRatePct: 5.4,
    downPaymentNote: "เงื่อนไขเงินดาวน์ขึ้นกับผลการพิจารณา",
    documentNotes: "เอกสารแสดงรายได้ตามที่ธนาคารกำหนด",
    sourceStatus: "PUBLIC_SOURCE_REFERENCE",
    sourceLabel: "เว็บไซต์ธนาคารทหารไทยธนชาต",
    checkedAt: CHECKED_AT,
    enabled: true,
    routeToOwnCompatibilityStatus: "COMPETITION_ASSUMPTION",
    compatibilityNote: "ผ่อนได้สูงสุด 84 เดือน ต้องยืนยันเงื่อนไขเฉพาะโครงการกับธนาคาร"
  },
  {
    id: "TISCO_EV",
    fiName: "ธนาคารทิสโก้ (TISCO)",
    productName: "สินเชื่อรถยนต์ใหม่ป้ายแดง",
    vehicleFit: ["EV ใหม่ป้ายแดง"],
    minFinance: null,
    maxFinance: null,
    termMonths: [48, 60, 72, 84],
    indicativeRatePct: 5.6,
    downPaymentNote: "โครงสร้างการผ่อนยืดหยุ่นตามผลการพิจารณา",
    documentNotes: "เอกสารแสดงรายได้ตามที่ธนาคารกำหนด",
    sourceStatus: "COMPETITION_ILLUSTRATION",
    sourceLabel: "สรุปจากบทความสื่อยานยนต์ — ยังไม่ได้ตรวจสอบกับธนาคารโดยตรง",
    checkedAt: CHECKED_AT,
    enabled: true,
    routeToOwnCompatibilityStatus: "COMPETITION_ASSUMPTION",
    compatibilityNote: "ข้อมูลอ้างอิงจากสื่อ ต้องยืนยันเงื่อนไขกับธนาคารก่อนใช้จริง"
  },
  {
    id: "KKP_EV",
    fiName: "ธนาคารเกียรตินาคินภัทร (KKP)",
    productName: "สินเชื่อรถยนต์ไฟฟ้า — แคมเปญร่วมกับค่ายรถ",
    vehicleFit: ["EV ใหม่ป้ายแดง"],
    minFinance: null,
    maxFinance: null,
    termMonths: [48, 60, 72],
    indicativeRatePct: 5.8,
    downPaymentNote: "แคมเปญที่เผยแพร่ระบุดอกเบี้ยพิเศษและเงินดาวน์ต่ำในบางรุ่น",
    documentNotes: "เงื่อนไขขึ้นกับแคมเปญของค่ายรถที่ร่วมรายการ",
    sourceStatus: "COMPETITION_ILLUSTRATION",
    sourceLabel: "สรุปจากบทความสื่อยานยนต์ — ยังไม่ได้ตรวจสอบกับธนาคารโดยตรง",
    checkedAt: CHECKED_AT,
    enabled: true,
    routeToOwnCompatibilityStatus: "COMPETITION_ASSUMPTION",
    compatibilityNote: "ข้อมูลอ้างอิงจากสื่อ ต้องยืนยันเงื่อนไขกับธนาคารก่อนใช้จริง"
  }
];

export function listEnabledFi(): FiProduct[] {
  return FI_CATALOGUE.filter((fi) => fi.enabled);
}

export function getFiProduct(fiId: string): FiProduct | null {
  return FI_CATALOGUE.find((fi) => fi.id === fiId) ?? null;
}

/** ระยะเวลาผ่อนของ FI ที่ใกล้เคียงกับที่ผู้สมัครใช้ประเมินไว้มากที่สุด */
export function nearestTermFor(fi: Pick<FiProduct, "termMonths">, preferredTermMonths: number): number {
  if (!fi.termMonths || fi.termMonths.length === 0) return preferredTermMonths;
  return fi.termMonths.reduce((best, term) =>
    Math.abs(term - preferredTermMonths) < Math.abs(best - preferredTermMonths) ? term : best
  );
}
