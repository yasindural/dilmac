import { describe, expect, it } from "vitest";
import { estimatePaddleNetUsd, isGmailAddress, PADDLE_STANDARD_FEE, planShapes } from "./billing";

describe("fiyat ve Paddle kesintisi", () => {
  it("istenen brüt USD fiyatlarını ve dakikaları tek kaynaktan verir", () => {
    expect(planShapes.find((plan) => plan.id === "pro")).toMatchObject({ basePriceUsd: 14.37, minutes: 100 });
    expect(planShapes.find((plan) => plan.id === "business")).toMatchObject({ basePriceUsd: 30, minutes: 250 });
  });

  it("standart 5% + 50 cent kesintiyi brüt tutardan hesaplar", () => {
    expect(PADDLE_STANDARD_FEE).toEqual({ percent: 0.05, fixedUsd: 0.5 });
    expect(estimatePaddleNetUsd(14.37)).toBe(13.15);
    expect(estimatePaddleNetUsd(30)).toBe(28);
  });

  it("ödeme formunda yalnızca geçerli Gmail adresini kabul eder", () => {
    expect(isGmailAddress("ornek@gmail.com")).toBe(true);
    expect(isGmailAddress("  ORNEK+pro@gmail.com ")).toBe(true);
    expect(isGmailAddress("ornek@googlemail.com")).toBe(false);
    expect(isGmailAddress("ornek@example.com")).toBe(false);
    expect(isGmailAddress("@gmail.com")).toBe(false);
  });
});
