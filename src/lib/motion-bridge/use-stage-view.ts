// Enregistre un élément DOM comme vue du Stage (brief « Strates », §4.4, §4.5).
// Le composant hôte (StageView) rend un conteneur transparent qui couvre sa
// section, avec son poster SSR en enfant `.s3d-poster` : ce hook ne fait que
// déclarer la vue au pont. Le Stage (chargé à part, s'il y a au moins une vue,
// une capacité ≥ C1 et aucun contexte perdu) la prend en charge, pose
// data-stage-ready="true" sur l'élément à sa première frame (le poster
// s'efface en CSS) et le retire s'il est libéré. Sans Stage, rien ne change :
// le poster reste, c'est l'état C0.
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { motionBridge } from "./store";
import type { SceneId, StageViewDescriptor } from "./types";

type ViewOptions = Pick<
  StageViewDescriptor,
  "clear" | "liveRect" | "bakeWhenIdle" | "interactive" | "priority"
>;

export function useStageView<P>(
  ref: React.RefObject<HTMLElement | null>,
  scene: SceneId,
  props: P,
  opts?: Partial<ViewOptions>,
): { id: string; ready: boolean } {
  const id = useId();
  // Dernières props validées, pour un (ré)enregistrement sans dépendre
  // d'elles : les changements passent par views.update, qui n'émet que si
  // l'objet change (instantané immuable).
  const propsRef = useRef(props);

  const clear = opts?.clear ?? "transparent";
  const liveRect = opts?.liveRect ?? false;
  const bakeWhenIdle = opts?.bakeWhenIdle ?? false;
  const interactive = opts?.interactive ?? false;
  const priority = opts?.priority ?? 0;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Sélecteur des règles CSS du poster (§2.5), si l'hôte ne l'a pas posé.
    if (!element.hasAttribute("data-stage-view"))
      element.setAttribute("data-stage-view", scene);
    motionBridge.views.register({
      id,
      scene,
      element,
      props: propsRef.current,
      clear,
      liveRect,
      bakeWhenIdle,
      interactive,
      priority,
    });
    return () => motionBridge.views.unregister(id);
  }, [id, ref, scene, clear, liveRect, bakeWhenIdle, interactive, priority]);

  useEffect(() => {
    propsRef.current = props;
    motionBridge.views.update(id, props);
  }, [id, props]);

  const ready = useSyncExternalStore(
    motionBridge.views.subscribeReady,
    () => motionBridge.views.isReady(id),
    () => false,
  );
  return { id, ready };
}
