// Positions et visibilité des vues du Stage (brief « Strates », §4.4).
//
// Aucune lecture de mise en page pendant le défilement : chaque vue garde sa
// position dans le document (getBoundingClientRect + scroll), recalculée
// seulement quand la mise en page bouge (ResizeObserver sur la vue et sur la
// page, redimensionnement, ScrollTrigger.refresh, polices chargées) ; par
// frame, top = docTop − scrollY. Exception : `liveRect` (vue dans une section
// pinnée ou transformée), relue par frame, pour une ou deux vues au plus.
// La visibilité vient d'un IntersectionObserver avec 25 % de marge : une vue
// proche de l'écran est déjà prête quand elle y entre.
import { onLayout } from "./ticker";

interface Tracked {
  element: HTMLElement;
  liveRect: boolean;
  docLeft: number;
  docTop: number;
  width: number;
  height: number;
  near: boolean;
}

export class ViewTracker {
  private readonly views = new Map<string, Tracked>();
  private readonly byElement = new Map<Element, string>();
  private readonly resize: ResizeObserver;
  private readonly intersect: IntersectionObserver;
  private readonly disposers: (() => void)[] = [];
  private measurePending = false;

  /** `onChange` : une position ou une visibilité a changé, il faut redessiner. */
  constructor(private readonly onChange: () => void) {
    this.resize = new ResizeObserver(() => this.measureAll());
    this.resize.observe(document.documentElement);
    this.intersect = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = this.byElement.get(entry.target);
          const view = id ? this.views.get(id) : undefined;
          if (view) view.near = entry.isIntersecting;
        }
        this.onChange();
      },
      { rootMargin: "25% 0px" },
    );
    const onResize = () => this.measureAll();
    window.addEventListener("resize", onResize, { passive: true });
    this.disposers.push(
      () => window.removeEventListener("resize", onResize),
      onLayout(() => this.measureAll()),
    );
    void document.fonts?.ready.then(() => this.measureAll());
  }

  add(id: string, element: HTMLElement, liveRect: boolean) {
    const previous = this.views.get(id);
    if (previous && previous.element !== element) this.remove(id);
    if (previous?.element === element) {
      previous.liveRect = liveRect;
      return;
    }
    const view: Tracked = {
      element,
      liveRect,
      docLeft: 0,
      docTop: 0,
      width: 0,
      height: 0,
      near: false,
    };
    this.views.set(id, view);
    this.byElement.set(element, id);
    this.measure(view);
    this.resize.observe(element);
    this.intersect.observe(element);
  }

  remove(id: string) {
    const view = this.views.get(id);
    if (!view) return;
    this.views.delete(id);
    this.byElement.delete(view.element);
    this.resize.unobserve(view.element);
    this.intersect.unobserve(view.element);
  }

  private measure(view: Tracked) {
    const r = view.element.getBoundingClientRect();
    view.docLeft = r.left + window.scrollX;
    view.docTop = r.top + window.scrollY;
    view.width = r.width;
    view.height = r.height;
  }

  /** Relit toutes les positions (une fois par frame au plus). */
  measureAll() {
    if (this.measurePending) return;
    this.measurePending = true;
    queueMicrotask(() => {
      this.measurePending = false;
      for (const view of this.views.values()) this.measure(view);
      this.onChange();
    });
  }

  isNear(id: string): boolean {
    return this.views.get(id)?.near ?? false;
  }

  anyNear(): boolean {
    for (const view of this.views.values()) if (view.near) return true;
    return false;
  }

  /** Rectangle dans la fenêtre (px CSS), ou null si la vue est vide ou inconnue. */
  rect(id: string, scrollX: number, scrollY: number): DOMRectReadOnly | null {
    const view = this.views.get(id);
    if (!view) return null;
    if (view.liveRect) {
      const r = view.element.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    }
    if (view.width <= 0 || view.height <= 0) return null;
    return new DOMRectReadOnly(
      view.docLeft - scrollX,
      view.docTop - scrollY,
      view.width,
      view.height,
    );
  }

  dispose() {
    for (const dispose of this.disposers.splice(0)) dispose();
    this.resize.disconnect();
    this.intersect.disconnect();
    this.views.clear();
    this.byElement.clear();
  }
}
