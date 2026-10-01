// Scène `contour-field` (brief « Strates », §5.5 B3, annexe A) : le champ de
// courbes de niveau de l'accueil, en capacité C2 seulement (ailleurs, un SVG
// statique tient lieu de champ). Deux vues l'utilisent : le fond du héros, qui
// s'ouvre en fin de pin (`reveal` animé par la chorégraphie), et le fond du
// chapitre 01 (déjà ouvert). Elles lisent le même relief en coordonnées page :
// la couture entre les deux est invisible.
//
// La scène ne dessine qu'un quad plein cadre ; viewport, scissor et fond sont
// déjà posés par le Stage. Rendu à la demande : pas d'animation propre.
import { Mesh, OrthographicCamera, PlaneGeometry, Scene, Vector2 } from "three";
import type { ContourFieldProps } from "@/components/home/stage-props";
import {
  acquireHeightTexture,
  createFieldMaterial,
  releaseHeightTexture,
  type FieldMaterial,
} from "../materials/field-material";
import type { StageContext, StageScene, StageTheme } from "../types";

export interface ContourFieldController {
  /** 0 = rien, 1 = tout le champ : cercle qui s'ouvre depuis `anchor`. */
  reveal: number;
}

// Vitesse de défilement (px/frame) au-delà de laquelle le resserrement est maximal.
const FULL_SPEED = 60;

const create = (
  ctx: StageContext,
): StageScene<ContourFieldProps, ContourFieldController> => {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let field: FieldMaterial | null = null;
  let quad: Mesh | null = null;
  let props!: ContourFieldProps;
  let theme: StageTheme | null = null;
  let reveal = 1;
  let held = false;
  const size = new Vector2();

  const controller: ContourFieldController = {
    get reveal() {
      return reveal;
    },
    set reveal(value) {
      reveal = Math.min(1, Math.max(0, value));
      ctx.invalidate();
    },
  };

  function applyTheme(next: StageTheme) {
    theme = next;
    field?.setTheme(next);
    // Le thème efface la teinte : on la repose.
    field?.setTint(props.tint);
  }

  return {
    controller,
    mount(_ctx, view) {
      props = view.props;
      reveal = props.reveal;
      field = createFieldMaterial(acquireHeightTexture());
      held = true;
      quad = new Mesh(new PlaneGeometry(2, 2), field.material);
      quad.frustumCulled = false;
      scene.add(quad);
      field.setTint(props.tint);
      applyTheme(ctx.theme);
    },

    update(next) {
      props = next;
      field?.setTint(next.tint);
      ctx.invalidate();
    },

    render(c, frame) {
      if (!field) return false;
      if (c.theme !== theme) applyTheme(c.theme);
      c.renderer.getSize(size);
      const { rect } = frame;
      const u = field.uniforms;
      u.uCanvasH.value = size.y;
      u.uDpr.value = frame.dpr;
      u.uScroll.value = frame.scrollY;
      u.uSpeed.value = Math.min(1, Math.abs(frame.velocity) / FULL_SPEED);
      u.uReveal.value = reveal;
      const cx = rect.left + props.anchor[0] * rect.width;
      const cy = rect.top + props.anchor[1] * rect.height;
      u.uCenter.value = [cx, cy];
      // Rayon qui atteint le coin le plus lointain : reveal = 1 couvre la vue.
      u.uMaxR.value =
        Math.hypot(
          Math.max(cx - rect.left, rect.right - cx),
          Math.max(cy - rect.top, rect.bottom - cy),
        ) + 160;
      if (reveal <= 0.001) return false;
      c.renderer.render(scene, camera);
      return false;
    },

    dispose() {
      quad?.geometry.dispose();
      field?.dispose();
      if (held) releaseHeightTexture();
      held = false;
      scene.clear();
    },
  };
};

export default create;
