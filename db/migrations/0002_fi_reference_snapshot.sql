-- ผลอ้างอิงที่ใช้เทียบกับผลเฉพาะของสถาบันการเงินแต่ละแห่ง
--
-- ตอนเลือก FI ระบบจะจำ Snapshot ที่ผู้สมัครเห็นอยู่ ณ ขณะนั้นไว้ด้วย
-- เพื่อให้หน้าจอเทียบ "ผลอ้างอิง" กับ "ผลภายใต้เงื่อนไขของ FI แห่งนี้" ได้ตรงคู่
-- โดยไม่ต้องเดาจากลำดับเวลาของประวัติการประเมิน
alter table fi_selections
  add column if not exists reference_snapshot_id text references evaluation_snapshots (id);
