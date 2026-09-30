/**
 * next/server สำหรับรุ่นที่รันในเบราว์เซอร์
 *
 * Route handler ของ Next เป็นฟังก์ชันธรรมดาที่รับ Request และคืน Response
 * ทั้งสองอย่างเป็นของมาตรฐานเว็บ เบราว์เซอร์มีให้อยู่แล้ว
 * จึงเรียก handler ตัวจริงได้โดยไม่ต้องแก้ ขอเพียงมี NextResponse ให้ใช้
 *
 * ผลที่ได้คือกฎทุกข้อในชั้น API — 201/409/404/422 เพดานสองสถาบันการเงิน
 * ด่านความยินยอม — เป็นโค้ดชุดเดียวกับที่รันบนเซิร์ฟเวอร์ ไม่ใช่ของที่เขียนขึ้นใหม่
 */
export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit): NextResponse {
    return new NextResponse(JSON.stringify(body), {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
    });
  }

  static redirect(url: string | URL, status = 307): NextResponse {
    return new NextResponse(null, { status, headers: { location: String(url) } });
  }
}

export type NextRequest = Request;
