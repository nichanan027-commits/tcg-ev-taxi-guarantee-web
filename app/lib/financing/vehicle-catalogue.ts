import type { VehicleScenario } from "../registration/types.ts";
import type { VehicleId } from "../registration/types.ts";
import type { VehicleCatalogueItem } from "./types.ts";

/**
 * แคตตาล็อกรถของโหมดการแข่งขัน
 *
 * ราคาที่ใส่ไว้เป็นค่าตั้งต้นเพื่อให้ผู้สมัครเริ่มกรอกได้เร็ว ไม่ใช่ราคาขายที่ยืนยันแล้ว
 * ทุกรายการจึงถูกกำกับด้วย sourceStatus และผู้สมัครแก้ราคาเองได้เสมอ
 * ค่าเหล่านี้ไม่ใช่กติกาผลิตภัณฑ์ และไม่มีผลต่อการให้คะแนนหรือการจัดเส้นทาง
 */
export const VEHICLE_CATALOGUE: VehicleCatalogueItem[] = [
  {
    id: "AION_ES",
    name: "AION ES",
    segment: "Sedan — ใช้งานเชิงพาณิชย์/แท็กซี่",
    referencePrice: 800_000,
    rangeKm: 442,
    sourceLabel: "ราคาอ้างอิงตั้งต้นของโครงการ ปรับได้ตามใบเสนอราคาจริง",
    sourceStatus: "COMPETITION_ILLUSTRATION",
    configurable: true
  },
  {
    id: "AION_Y_PLUS",
    name: "AION Y Plus",
    segment: "Compact SUV",
    referencePrice: 900_000,
    rangeKm: 490,
    sourceLabel: "ราคาอ้างอิงตั้งต้นของโครงการ ปรับได้ตามใบเสนอราคาจริง",
    sourceStatus: "COMPETITION_ILLUSTRATION",
    configurable: true
  },
  {
    id: "AION_UT",
    name: "AION UT",
    segment: "Hatchback",
    referencePrice: 700_000,
    rangeKm: 420,
    sourceLabel: "ราคาอ้างอิงตั้งต้นของโครงการ ปรับได้ตามใบเสนอราคาจริง",
    sourceStatus: "COMPETITION_ILLUSTRATION",
    configurable: true
  },
  {
    id: "AION_V",
    name: "AION V",
    segment: "SUV",
    referencePrice: 1_100_000,
    rangeKm: 510,
    sourceLabel: "ราคาอ้างอิงตั้งต้นของโครงการ ปรับได้ตามใบเสนอราคาจริง",
    sourceStatus: "COMPETITION_ILLUSTRATION",
    configurable: true
  },
  {
    id: "OTHER",
    name: "รถรุ่นอื่น (ระบุราคาเอง)",
    segment: "กำหนดเอง",
    referencePrice: 800_000,
    rangeKm: null,
    sourceLabel: "ผู้สมัครระบุราคาเอง",
    sourceStatus: "COMPETITION_ILLUSTRATION",
    configurable: true
  }
];

export const DEFAULT_VEHICLE = VEHICLE_CATALOGUE[0];

export function getVehicle(vehicleId: string): VehicleCatalogueItem {
  return (
    VEHICLE_CATALOGUE.find((vehicle) => vehicle.id === vehicleId) ??
    VEHICLE_CATALOGUE[VEHICLE_CATALOGUE.length - 1]
  );
}

/**
 * สร้าง Vehicle Scenario สำหรับเก็บลง Evaluation Snapshot
 * เงินดาวน์ผู้ขับเป็น 0 เสมอตามแบบผลิตภัณฑ์หลัก — 0% Down ≠ 100% Guarantee
 */
export function vehicleScenarioOf(vehicleId: string, vehiclePrice: number): VehicleScenario {
  const vehicle = getVehicle(vehicleId);
  return {
    vehicleId: vehicle.id as VehicleId,
    vehicleName: vehicle.name,
    vehiclePrice: vehiclePrice > 0 ? vehiclePrice : vehicle.referencePrice,
    borrowerDownPayment: 0,
    sourceStatus: vehicle.sourceStatus
  };
}
