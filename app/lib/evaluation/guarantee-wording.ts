/**
 * ถ้อยคำเกี่ยวกับวงเงินค้ำประกันใน Front Office
 *
 * ตัวเลขฐานค้ำประกันที่คำนวณได้ในขั้นนี้ยังไม่ใช่วงเงินที่อนุมัติ จึงต้องไม่ถูกเรียกว่า
 * "Eligible Guaranteed Amount" ซึ่งอ่านได้เหมือนผ่านการอนุมัติแล้ว
 *
 * สี่จำนวนนี้เป็นคนละความหมาย แม้บางกรณีตัวเลขจะเท่ากัน:
 *   Vehicle Price
 *   ≠ Illustrative Loan Amount
 *   ≠ Indicative Guarantee-Eligible Base
 *   ≠ Final Child E-LG Amount  (อยู่ใน System B ไม่มีใน repository นี้)
 */
export const GUARANTEE_COPY = {
  label: "Indicative Guarantee-Eligible Base",
  labelTh: "วงเงินฐานอ้างอิงที่อาจเข้าเกณฑ์การค้ำประกัน",
  disclaimer:
    "เป็นค่าประมาณก่อนการตัดสินสินเชื่อขั้นสุดท้ายของสถาบันการเงิน ไม่ใช่วงเงินค้ำประกันที่ บสย. อนุมัติแล้ว",
  vehiclePriceLabel: "ราคารถ",
  loanAmountLabel: "วงเงินสินเชื่อโดยประมาณ (Illustrative Loan Amount)",
  zeroDownNote: "เงินดาวน์ผู้ขับ 0% — 0% Down ≠ 100% Guarantee"
} as const;

export type GuaranteeBaseInput = {
  vehiclePrice: number;
  illustrativeLoanAmount: number;
  indicativeGuaranteeEligibleBase: number;
};

export type GuaranteeBase = GuaranteeBaseInput & {
  label: string;
  labelTh: string;
  disclaimer: string;
};

/** ผูกคำอธิบายไว้กับตัวเลขเสมอ เพื่อไม่ให้หน้าจอไหนแสดงจำนวนเงินลอย ๆ โดยไม่มีข้อความกำกับ */
export function guaranteeBaseOf(input: GuaranteeBaseInput): GuaranteeBase {
  return {
    vehiclePrice: input.vehiclePrice,
    illustrativeLoanAmount: input.illustrativeLoanAmount,
    indicativeGuaranteeEligibleBase: input.indicativeGuaranteeEligibleBase,
    label: GUARANTEE_COPY.label,
    labelTh: GUARANTEE_COPY.labelTh,
    disclaimer: GUARANTEE_COPY.disclaimer
  };
}
