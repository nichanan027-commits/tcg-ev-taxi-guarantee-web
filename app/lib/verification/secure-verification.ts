/**
 * Secure Verification — โหมดการแข่งขันเท่านั้น
 *
 * หน้าที่ของส่วนนี้คือแสดงให้เห็นว่า "หน้าตาของการตรวจสอบข้อมูลอ่อนไหวจะเป็นอย่างไร"
 * โดยไม่รับความเสี่ยงของการถือข้อมูลจริง ค่าที่พิมพ์ลงไปอยู่ในหน่วยความจำของเบราว์เซอร์
 * เท่านั้น รีเฟรชแล้วหาย เปลี่ยนบทบาทแล้วหาย และไม่เคยออกจากเครื่องของผู้ใช้
 *
 * สิ่งที่ส่วนนี้ไม่ใช่: e-KYC จริง, การเชื่อมเครดิตบูโร, การรับไฟล์เดินบัญชี,
 * การอัปโหลดเอกสาร, การอนุมัติตัวตน, การพิจารณาสินเชื่อ
 *
 * ไฟล์นี้ตั้งใจไม่มีฟังก์ชันบันทึกใด ๆ เลย ไม่ใช่เพราะยังไม่ได้เขียน
 * แต่เพราะการมีอยู่ของฟังก์ชันเช่นนั้นคือความเสี่ยงในตัวมันเอง
 */
export const SECURE_VERIFICATION_NAME = "Secure Verification (Competition Mode)";

export const SECURE_VERIFICATION_COPY = {
  /** ต้องปรากฏบนหน้าจอเสมอ ไม่ใช่ซ่อนใน tooltip */
  notPersisted: "ข้อมูลส่วนนี้ไม่ถูกบันทึกหรือส่งออกจากอุปกรณ์ในระบบการแข่งขัน",
  identityState: "Identity verification deferred — Competition Mode",
  phoneVerification: "Not required — Competition Mode",
  fileNotUploaded: "ไฟล์นี้ยังไม่ถูกอัปโหลดหรือส่งออกจากอุปกรณ์",
  bureauContext:
    "ดำเนินการภายใต้ความยินยอมและช่องทางที่สถาบันการเงินหรือผู้ให้บริการที่เกี่ยวข้องกำหนด",
  clearedOnReload: "รีเฟรชหน้า เปลี่ยนบทบาท หรือออกจากหน้านี้ ค่าที่กรอกไว้จะหายทันที",
  noDecisionPower:
    "หน้านี้ไม่มีผลต่อผลการประเมิน เส้นทาง คะแนนความพร้อม ความยินยอม หรือการส่งต่อสถาบันการเงิน"
} as const;

export type SecureVerificationRoleId = "TCG_STAFF" | "FI_STAFF";

export type SecureVerificationRole = {
  id: SecureVerificationRoleId;
  label: string;
  description: string;
};

/**
 * สองบทบาทสำหรับสาธิต
 *
 * ทั้งสองเป็น "มุมมอง" ว่าใครเห็นอะไร ไม่ใช่ลำดับขั้นการอนุมัติ
 * การสลับบทบาทจึงไม่เปลี่ยนผลการประเมินหรือสิทธิ์ใด ๆ ของใบสมัคร
 */
export const SECURE_VERIFICATION_ROLES: SecureVerificationRole[] = [
  {
    id: "TCG_STAFF",
    label: "เจ้าหน้าที่ บสย.",
    description: "มุมมองของเจ้าหน้าที่ที่ดูแลความพร้อมและสิทธิ์ค้ำประกัน"
  },
  {
    id: "FI_STAFF",
    label: "เจ้าหน้าที่สถาบันการเงิน",
    description: "มุมมองของเจ้าหน้าที่สถาบันการเงินที่รับข้อมูลประกอบการพิจารณา"
  }
];

export type SecureVerificationField = {
  id: string;
  label: string;
  hint: string;
  kind: "TEXT" | "FILE";
  /** ค่าอยู่ในหน่วยความจำของเบราว์เซอร์เท่านั้น ไม่มีทางเลือกอื่น */
  retention: "MEMORY_ONLY";
  /** ไฟล์ถูกอ่านเนื้อหาหรือไม่ — ต้องเป็น false เสมอ */
  readsContent: false;
  roles: SecureVerificationRoleId[];
};

export const SECURE_VERIFICATION_FIELDS: SecureVerificationField[] = [
  {
    id: "nationalId",
    label: "เลขประจำตัวประชาชน",
    hint: "พิมพ์เพื่อดูหน้าตาของขั้นตอนเท่านั้น",
    kind: "TEXT",
    retention: "MEMORY_ONLY",
    readsContent: false,
    roles: ["TCG_STAFF", "FI_STAFF"]
  },
  {
    id: "bankAccount",
    label: "เลขที่บัญชีธนาคาร",
    hint: "ใช้สาธิตขั้นตอนตรวจสอบ ไม่มีการตรวจสอบกับธนาคารจริง",
    kind: "TEXT",
    retention: "MEMORY_ONLY",
    readsContent: false,
    roles: ["FI_STAFF"]
  },
  {
    id: "idCard",
    label: "ภาพบัตรประชาชน",
    hint: "เลือกไฟล์เพื่อดูชื่อไฟล์ในเครื่อง",
    kind: "FILE",
    retention: "MEMORY_ONLY",
    readsContent: false,
    roles: ["TCG_STAFF", "FI_STAFF"]
  },
  {
    id: "driverLicense",
    label: "ภาพใบขับขี่สาธารณะ",
    hint: "เลือกไฟล์เพื่อดูชื่อไฟล์ในเครื่อง",
    kind: "FILE",
    retention: "MEMORY_ONLY",
    readsContent: false,
    roles: ["TCG_STAFF"]
  },
  {
    id: "bankStatement",
    label: "เอกสารเดินบัญชี",
    hint: "เลือกไฟล์เพื่อดูชื่อไฟล์ในเครื่อง",
    kind: "FILE",
    retention: "MEMORY_ONLY",
    readsContent: false,
    roles: ["FI_STAFF"]
  }
];

export function fieldsForRole(roleId: SecureVerificationRoleId): SecureVerificationField[] {
  return SECURE_VERIFICATION_FIELDS.filter((field) => field.roles.includes(roleId));
}

export function roleById(roleId: string): SecureVerificationRole | null {
  return SECURE_VERIFICATION_ROLES.find((role) => role.id === roleId) ?? null;
}
