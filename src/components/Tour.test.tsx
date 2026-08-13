import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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
  // vitest globals kapalı olduğu için RTL otomatik temizlik yapmıyor;
  // önceki testin bileşeni asılı kalırsa gövde kilidi de asılı kalıyor.
  afterEach(() => { cleanup(); resetTour(); document.body.removeAttribute("style"); });

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

  // Kaydırma html+body overflow ile durdurulur (gövde sabitlenmez);
  // tur bitince ikisi de eski hâline dönmeli.
  it("tur açıkken sayfayı gerçekten kilitler, kapanınca serbest bırakır", () => {
    const onFinish = vi.fn();
    render(<Tour steps={steps} mode="ask" onFinish={onFinish} />);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.classList.contains("tour-open")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /gerek yok/i }));
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.classList.contains("tour-open")).toBe(false);
  });

  it("kilitlemeden önce sayfayı anlık olarak en üste alır", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {
      // scrollTo çağrıldığı anda yumuşak kaydırma kapalı olmalı, yoksa
      // sayfa animasyonun ortasında kilitlenir.
      expect(document.documentElement.style.scrollBehavior).toBe("auto");
    });
    render(<Tour steps={steps} mode="ask" onFinish={() => {}} />);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
  });

  it("mode prop'u sonradan değişince turu başlatır", () => {
    const { rerender } = render(<Tour steps={steps} mode="off" onFinish={() => {}} />);
    expect(screen.queryByText("1 / 2")).toBeNull();
    rerender(<Tour steps={steps} mode="run" onFinish={() => {}} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("adım kartının arkasına dokunuşu yutan katman koyar", () => {
    const { container } = render(<Tour steps={steps} mode="run" onFinish={() => {}} />);
    expect(container.querySelector(".tour-block")).not.toBeNull();
  });
});
