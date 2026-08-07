import { describe, expect, it } from "vitest";
import { getSpeechErrorMessage } from "./useSpeech";

describe("getSpeechErrorMessage", () => {
  it("explains microphone permission errors", () => {
    expect(getSpeechErrorMessage("not-allowed")).toContain("Mikrofon izni verilmedi");
  });

  it("explains same-device recognition interruptions", () => {
    expect(getSpeechErrorMessage("aborted")).toContain("başka bir Dilmaç sekmesi");
  });

  it("keeps an actionable fallback for unknown errors", () => {
    expect(getSpeechErrorMessage("network")).toBe("Mikrofon hatası: network");
  });
});
