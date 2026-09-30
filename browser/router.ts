/**
 * ตัวจัดเส้นทางในหน้าเดียว
 *
 * ที่อยู่จริงของหน้าถูกเก็บไว้หลัง # เพราะ artifact เสิร์ฟหน้าเดียว
 * ถ้าใช้ path ตรง ๆ การกดรีเฟรชหรือแชร์ลิงก์จะได้หน้าที่ไม่มีอยู่
 *
 * เส้นทางที่รองรับตรงกับโครงไฟล์ของแอปจริงหนึ่งต่อหนึ่ง
 *   /                                   → หน้าเริ่มต้น
 *   /apply/{id}                         → ลงทะเบียน หรือผลการประเมิน
 *   /apply/{id}/fi                      → เปรียบเทียบสถาบันการเงิน
 *   /apply/{id}/handoff                 → เตรียมส่งต่อข้อมูล
 *   /apply/{id}/advisory                → ขอคำปรึกษาเพื่อสร้างความพร้อม
 *   /apply/{id}/verification            → Secure Verification
 */
type Listener = (path: string) => void;

const listeners = new Set<Listener>();

export function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, "");
  return raw.startsWith("/") ? raw : "/";
}

export function navigate(href: string, options: { replace?: boolean } = {}): void {
  const path = href.startsWith("#") ? href.slice(1) : href;
  const target = `#${path}`;
  if (options.replace) window.history.replaceState(null, "", target);
  else window.history.pushState(null, "", target);
  window.scrollTo(0, 0);
  emit();
}

export function refresh(): void {
  emit();
}

function emit(): void {
  const path = currentPath();
  for (const listener of listeners) listener(path);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * รับการย้ายหน้าที่โค้ดสั่งด้วย window.location.href
 *
 * ตัวแปรนี้คือปลายทางที่ขั้นตอน build ชี้ให้ ดูคำอธิบายใน browser/build.mjs
 * และเป็นตัวเดียวกับที่ Navigation API เรียกเมื่อเบราว์เซอร์รองรับ
 */
export function installNavigationInterception(): void {
  (window as unknown as { __route2ownNavigate: typeof navigate }).__route2ownNavigate = navigate;

  window.addEventListener("popstate", emit);
  window.addEventListener("hashchange", emit);

  // ตาข่ายรองสำหรับการย้ายหน้าที่หลุดรอดไป เบราว์เซอร์ที่ไม่มี Navigation API จะข้ามส่วนนี้
  const nav = (window as unknown as { navigation?: EventTarget }).navigation;
  if (!nav) return;
  nav.addEventListener("navigate", (event) => {
    const e = event as Event & { destination?: { url: string }; canIntercept?: boolean; intercept?: (o: { handler: () => Promise<void> }) => void };
    if (!e.canIntercept || !e.destination || !e.intercept) return;
    const url = new URL(e.destination.url);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname) return; // การเปลี่ยนเฉพาะ # จัดการที่อื่นแล้ว
    e.intercept({
      handler: async () => {
        navigate(url.pathname + url.search);
      }
    });
  });
}
