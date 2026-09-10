import Link from "next/link";

import { SECURE_VERIFICATION_NAME } from "../../../lib/verification/secure-verification.ts";
import { getApplication } from "../../../lib/registration/application-service.ts";
import { SecureVerificationPanel } from "../../../../components/frontoffice/SecureVerificationPanel.tsx";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ applicationId: string }> };

/**
 * หน้า Secure Verification
 *
 * หน้านี้อ่านเพียงเลขที่ใบสมัครเพื่อแสดงบริบท ไม่อ่านผลการประเมิน
 * และไม่มีเส้นทางใดจากหน้านี้ที่เขียนอะไรลงฐานข้อมูลได้เลย
 */
export default async function VerificationPage({ params }: Props) {
  const { applicationId } = await params;
  const application = await getApplication(applicationId);

  if (!application) {
    return (
      <main className="fo-shell">
        <h1 className="fo-title">ไม่พบใบสมัคร</h1>
        <p>
          <Link href="/">กลับไปหน้าเริ่มต้น</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="fo-shell">
      <p className="fo-eyebrow">Route to Own by บสย. · {application.id}</p>
      <h1 className="fo-title">{SECURE_VERIFICATION_NAME}</h1>
      <p className="fo-lede">
        ตัวอย่างขั้นตอนการตรวจสอบข้อมูลอ่อนไหว สำหรับการนำเสนอในรอบการแข่งขัน
      </p>

      <SecureVerificationPanel />

      <footer className="fo-disclaimers">
        <p>
          ส่วนนี้เป็นการสาธิตประสบการณ์ใช้งานเท่านั้น ไม่ใช่การพิสูจน์ตัวตนจริง
          ไม่ใช่การเชื่อมต่อข้อมูลเครดิต และไม่ใช่การรับเอกสารเข้าสู่ระบบ
        </p>
        <p>
          <Link href={`/apply/${application.id}`}>กลับไปหน้าผลความพร้อม</Link>
        </p>
      </footer>
    </main>
  );
}
