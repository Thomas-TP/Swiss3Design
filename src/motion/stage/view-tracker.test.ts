import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ViewTracker } from "./view-tracker";
import {
  anchorPlacement,
  getCanvasAnchor,
  setCanvasAnchor,
  type CanvasAnchor,
} from "./ticker";

// Rectangles des vues et canvas ancré au document (retour R16) : la partie
// arithmétique et les contrats entre tracker, boucle et stage-root. Le rendu
// réel (compositeur, défilement natif) se vérifie dans le navigateur.

class FakeRect {
  readonly right: number;
  readonly bottom: number;
  constructor(
    readonly left: number,
    readonly top: number,
    readonly width: number,
    readonly height: number,
  ) {
    this.right = left + width;
    this.bottom = top + height;
  }
}

class FakeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function fakeElement(rect: {
  left: number;
  top: number;
  w: number;
  h: number;
}) {
  const state = { ...rect };
  return {
    state,
    getBoundingClientRect: () =>
      new FakeRect(state.left, state.top, state.w, state.h),
  } as unknown as HTMLElement & { state: typeof state };
}

function anchor(offset: number) {
  const live: boolean[] = [];
  const fake: CanvasAnchor & { live: boolean[] } = {
    live,
    setLive: (on) => live.push(on),
    follow: () => {},
    offsetY: () => offset,
  };
  return fake;
}

describe("anchorPlacement", () => {
  it("place le canvas une marge au-dessus de la fenêtre", () => {
    expect(anchorPlacement(1000, 400, 1)).toEqual({ top: 600, offset: 400 });
  });

  it("arrondit au pixel physique et garde top + offset = scrollY", () => {
    for (const dpr of [1, 1.5, 2, 3]) {
      for (const scrollY of [0, 0.3, 17.49, 1234.567, -42.2]) {
        const { top, offset } = anchorPlacement(scrollY, 400, dpr);
        expect(top * dpr).toBeCloseTo(Math.round(top * dpr), 9);
        expect(top + offset).toBeCloseTo(scrollY, 9);
        // La marge ne bouge que d'un demi-pixel physique.
        expect(Math.abs(offset - 400)).toBeLessThanOrEqual(0.5 / dpr + 1e-9);
      }
    }
  });

  it("repasse à 1 un rapport de pixels absurde", () => {
    expect(anchorPlacement(100, 10, 0)).toEqual({ top: 90, offset: 10 });
  });
});

describe("ViewTracker · rectangles et canvas ancré", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      scrollX: 0,
      scrollY: 0,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    vi.stubGlobal("document", { documentElement: {}, fonts: undefined });
    vi.stubGlobal("ResizeObserver", FakeObserver);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    vi.stubGlobal("DOMRectReadOnly", FakeRect);
    vi.stubGlobal("queueMicrotask", (cb: () => void) => cb());
  });

  afterEach(() => {
    setCanvasAnchor(null);
    vi.unstubAllGlobals();
  });

  function track(live = false) {
    const tracker = new ViewTracker(() => {});
    // À 300 px de défilement, la vue est à 500 px dans la fenêtre : 800 dans le document.
    vi.stubGlobal("window", { scrollX: 0, scrollY: 300 });
    const element = fakeElement({ left: 40, top: 500, w: 600, h: 400 });
    tracker.add("v", element, live);
    return { tracker, element };
  }

  it("sans ancrage : docTop − scrollY, comme avant", () => {
    const { tracker } = track();
    const rect = tracker.rect("v", 0, 300);
    expect(rect?.top).toBe(500);
    expect(rect?.left).toBe(40);
    expect(rect?.height).toBe(400);
    expect(tracker.rect("v", 0, 800)?.top).toBe(0);
  });

  it("avec un canvas ancré : la fenêtre décalée de offsetY()", () => {
    const { tracker } = track();
    setCanvasAnchor(anchor(400));
    expect(tracker.rect("v", 0, 300)?.top).toBe(900);
    expect(tracker.rect("v", 0, 800)?.top).toBe(400);
  });

  it("une vue « live » relit son rectangle par frame, décalé de offsetY()", () => {
    const { tracker, element } = track(true);
    setCanvasAnchor(anchor(400));
    expect(tracker.rect("v", 0, 300)?.top).toBe(900);
    element.state.top = 120;
    expect(tracker.rect("v", 0, 300)?.top).toBe(520);
  });

  it("une vue sans surface n'a pas de rectangle", () => {
    const tracker = new ViewTracker(() => {});
    tracker.add("v", fakeElement({ left: 0, top: 0, w: 0, h: 200 }), false);
    expect(tracker.rect("v", 0, 0)).toBeNull();
    expect(tracker.rect("inconnue", 0, 0)).toBeNull();
  });

  it("signale au canvas qu'une vue live existe, puis qu'il n'y en a plus", () => {
    const fake = anchor(0);
    setCanvasAnchor(fake);
    const tracker = new ViewTracker(() => {});
    const a = fakeElement({ left: 0, top: 0, w: 10, h: 10 });
    const b = fakeElement({ left: 0, top: 0, w: 10, h: 10 });
    tracker.add("a", a, false);
    tracker.add("b", b, true);
    tracker.remove("b");
    tracker.remove("a");
    expect(fake.live).toEqual([false, true, false, false]);
    expect(getCanvasAnchor()).toBe(fake);
  });
});
