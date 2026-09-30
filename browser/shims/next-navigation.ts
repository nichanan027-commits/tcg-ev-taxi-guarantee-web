/**
 * next/navigation สำหรับรุ่นที่รันในเบราว์เซอร์
 *
 * RegistrationWizard เรียก router.refresh() เพื่อให้เซิร์ฟเวอร์เรนเดอร์หน้าใหม่
 * ในรุ่นนี้ไม่มีเซิร์ฟเวอร์ ตัวจัดเส้นทางจึงอ่านข้อมูลใหม่จากชั้นเก็บข้อมูลแล้วเรนเดอร์ซ้ำ
 */
import { navigate, refresh } from "../router.ts";

export function useRouter() {
  return {
    refresh,
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    prefetch: () => undefined
  };
}

export function usePathname(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}
