import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Tour, { isTourDone, resetTour, type TourStep } from "./Tour";

const steps: TourStep[] = [
  { target: "#a", tone: "mic", emoji: "🎤", title: "Mikrofon", body: "Basın ve konuşun." },
  { target: "#b", tone: "lang", emoji: "🌍", title: "Diller", body: "Dilinizi seçin." },
];

describe("öğretici tur", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<button id="a">a</button><button id="b">b</button>';
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      top: 100, left: 40, width: 120, height: 48, bottom: 148, right: 160, x: 40, y: 100, toJSON: () => ({}),
    })) as never;
  });
  afterEach(() => { resetTour(); });

  it("ilk gelişte önce izin ister", () => {
    render(<Tour steps={steps} mode="ask" onFinish={() => {}} />);
    expect(screen.getByRole("heading", { name: /tur atalım mı/i })).toBeInTheDocument();
  });

  it("hayır denince tur bir daha sorulmaz", () => {
    const onFinish = vi.fn();
    render(<Tour steps={steps} mode="ask" onFinish={onFinish} />);
    fireEvent.click(screen.getByRole("button", { name: /gerek yok/i }));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(isTourDone()).toBe(true);
  });

  it("evet denince adımları sırayla gezer ve görev tamamlandı ile biter", () => {
    render(<Tour steps={steps} mode="ask" onFinish={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /evet, göster/i }));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /mikrofon/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sonraki" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /diller/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bitir" }));
    expect(screen.getByRole("heading", { name: /görev tamamlandı/i })).toBeInTheDocument();
  });
});
