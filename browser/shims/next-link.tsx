/**
 * next/link สำหรับรุ่นที่รันในเบราว์เซอร์
 *
 * ทำหน้าที่เท่าเดิมคือลิงก์ แต่ให้ตัวจัดเส้นทางในหน้าเดียวรับช่วงต่อ
 * เพื่อไม่ให้เบราว์เซอร์ออกไปโหลดหน้าใหม่จากเซิร์ฟเวอร์ที่ไม่มีอยู่
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";

import { navigate } from "../router.ts";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode };

export default function Link({ href, children, ...rest }: Props) {
  return (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        // ลิงก์ที่ออกไปนอกระบบ (เช่น Front Office รุ่น Frozen) ปล่อยให้ทำงานตามปกติ
        if (href.startsWith("http") || href.endsWith(".html")) return;
        event.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
