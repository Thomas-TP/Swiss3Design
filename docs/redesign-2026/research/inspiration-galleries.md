# Inspiration galleries: motion-design e-commerce and product sites, 2025-2026

Research notes for the Swiss3Design redesign on `claude/redesign-2026`.
Researched 2026-09-27. Sources: Awwwards (SOTD, SOTY/annuals, e-commerce honors, WebGL/3D listings), The FWA (live list), Siteinspire, Codrops (tutorials and case studies with code), studio blogs (Lusion, OFF+BRAND, Instrument, Vide Infra), plus direct inspection of live sites in a browser to confirm the stack.

> **Scope note:** the catalog favours sites that sell **physical objects**, use **WebGL product presentation**, tell a **material or colour** story, or turn a **manufacturing process** into a scroll story. There are 22 sites below; about 12 of them match that brief closely.

---

## 0. TL;DR for Swiss3Design

1. **The winners commit to one hard idea and one hero object** (Utsubo's 2026 review, Oryzo, Aether 1, iyO). We should pick one signature mechanic, "the object prints itself as you scroll", and make it excellent. We should not stack twelve effects.
2. **Award-level e-commerce in 2025-26 is scroll storytelling followed by a configurator-style shop** (Scout Motors, E-commerce of the Year 2025; Opal Tadpole, 2024; iyO; Qudrix). The story sells, and the PDP becomes a configurator with the live 3D model.
3. **The loader is part of the story.** On Oryzo, a CAD-style Bézier sketch becomes the photoreal cork coaster (I checked this on the live site). For us, the loader goes from slicer wireframe → toolpath → printed object.
4. **Material truth beats spec sheets.** iyO rebuilt 27 real finishes (dichroic coating included), and a colour change ripples through the model "like a sound wave". Oryzo scanned real cork (180 photos in RealityScan). For us: macro-scanned PLA-silk, matte and translucent textures, with visible layer lines.
5. **The production stack has converged:** Three.js (WebGPU/TSL with a WebGL fallback) + GSAP (now 100% free, including SplitText, ScrollSmoother and MorphSVG) + Lenis + baked Blender/Houdini assets (Draco + KTX2) + device tiers + a reduced-motion route.
6. **Direct peers leave the lane open.** Gantri (3D-printed lamps, Next.js), Nagami (3D-printed furniture, Shopify theme + video) and Zellerfeld (3D-printed shoes, Nuxt) are all conventional. I checked all three live: no canvas and no WebGL storytelling. No 3D-printing brand has an award-level motion site, so Swiss3Design can be the first.
7. **Red on ink is a winning e-commerce palette right now.** Serotoninn (SOTD 2026) uses #ED3833 + #000, Stenger Bike (Locomotive SOTD) uses #E82525 + #FFF, and Zellerfeld uses orange-red on black. Our #E5231C over warm ink/paper fits this trend, and the warm paper tone sets us apart.

---

## 1. Site catalog

Legend: **Stack** = what I confirmed or what is documented. **Idea for us** = how the idea transfers to a multicolour 3D-print shop.

### A. Physical products + WebGL (highest relevance)

#### 1. iyO One — audio computer (pre-order e-commerce)

- URL: https://iyo.com — case study: https://www.awwwards.com/iyo-case-study-selling-the-worlds-first-audio-computer.html
- Awards: Awwwards SOTD + Developer, FWA of the Day, CSSDA.
- Why notable: it sells a physical object nobody has touched, through experience rather than specs.
- Techniques:
  - **Scroll-driven exploded view.** CAD with thousands of parts was retopologised down to the customer-visible components, with detail baked into textures, shipped as Draco glTF.
  - **27 real materials recreated**, including a dichroic "dusk" coating that shifts colour with the light.
  - **Configurator shop.** A glassmorphic side panel (connectivity, colour, fit), an infinite slider of renders, and a toggle to a live 360° model. A colourway change **propagates through the 3D model in concentric ripples**.
  - **GPGPU particles**, 1.6 M on strong devices and 400 k on old phones. A slightly lower DPR on retina cut the shader load by about 44%.
  - **Stack:** Webflow + TypeScript, Three.js, GSAP, Lenis, Taxi.js transitions (with listener cleanup), Shopify via Storesynk, Vercel.
- **Idea for us:** the filament-colour picker. When a colour is picked, it flows along the layer lines from the nozzle outward. We could also offer an exploded view of multi-part or multicolour prints (each colour region separates on scroll) and a "render ↔ live 3D" toggle on the PDP.

#### 2. Aether 1 — earbuds (fictional product, OFF+BRAND)

- URL: https://aether1.ai — Codrops: https://tympanus.net/codrops/2025/08/06/building-aether-1-sound-without-boundaries/
- Awards: Awwwards SOTD + E-commerce Honors + Developer (Jul 2025), FWA, CSSDA.
- Techniques:
  - **Infinite loop scroll on Lenis**, controlled by hand: `scrollTo`/`stop`/`start`. The built-in `infinite: true` proved unreliable. There are 7 anchors with 200 keyframes between each, and dual scene instances swap to hide the loop seam.
  - **Camera paths baked in Blender** (from C4D). Blender "empties" animate position and scale to fire events in sync with the baked timeline.
  - **GPGPU flow-field particles** (Simplex 4D). The fluid sim runs at **7.5% of screen resolution**.
  - Cheap effects:
    - Artificial DoF: `smoothstep` on view depth inside the particle shader.
    - Artificial bloom: a pre-rendered bloom billboard.
    - Glass: `MeshStandardMaterial` + a glass matcap through `onBeforeCompile` + Fresnel.
  - **Fluid-masked Fresnel pass** that reveals the internals on hover. Raycasting uses low-poly proxies. Web Audio adds a low-pass filter on hover and makes the waves audio-reactive.
  - **60 fps on an iPhone SE 2020**, plus a separate **reduced-motion route**.
- **Idea for us:** reveal the internal infill (gyroid/honeycomb) under the cursor with a fluid mask. Use the cheap-effect recipes (fake DoF and bloom, matcap PLA-silk) to stay inside our bundle and CPU budget. Ship a real reduced-motion route.

#### 3. Oryzo AI — a cork coaster launched as an "AI product" (Lusion)

- URL: https://oryzo.ai — BTS: https://blog.lusion.co/oryzo-bts-part-1-7-concept-and-creative-direction (parts 2 and 3 cover 3D/motion and UX/UI)
- Awards: Awwwards **Site of the Month, April 2026** + Developer.
- Stack I confirmed live: **Astro + Three.js r178 "modified by Lusion"**, 6 canvases, a scroll height of about 42,000 px, font Halyard Display variable, WebGPU available.
- Techniques:
  - **The preloader is an orange CAD/Bézier sketch** (handles, construction lines) on a green cutting mat, and it **resolves into the photoreal cork object**.
  - One hero object with **inertia and weight** (physics-like easing), and a camera that travels through real Z depth.
  - **Hybrid assets:**
    - Gaussian splats: Houdini renders from many angles → Jawset Postshot → WebGL.
    - Orthographic texture passes, with 90% of texture resolution spent in the focal area.
    - Real cork scanned from 180 photos in RealityScan, plus procedural VDB noise.
  - **4-colour palette** (cream, near-black, muted olive, orange) and as few typefaces as possible.
  - **Classic product IA** (hero, benefits, usage, specs, reviews, comparison, buy), dressed with humour. Midjourney was used only for mood; the production 3D contains no AI.
- **Idea for us:** our loader draws the product as a slicer toolpath on the print bed, then it "solidifies" into the real render. Scan a real Swiss3Design print (RealityScan or Polycam, both free) for a true layer-line texture. Keep the product-page skeleton simple and put the craft into it.

#### 4. Scout Motors — EV brand (Locomotive)

- URL: https://www.scoutmotors.com — https://locomotive.ca/en/work/scout-motors
- Awards: **Awwwards E-commerce of the Year 2025**, SOTD, Developer.
- Techniques: a cinematic, full-screen, scroll-driven heritage story _before_ any pre-order CTA, then 3D exploration and configurator paths.
- **Idea for us:** the homepage tells the story (Swiss atelier, multicolour, made to order) and only then opens the shop. Configurator paths run from the story into the product and into a custom quote.

#### 5. Opal Tadpole — webcam (Claudio Guglieri / Opal)

- Awards: **Awwwards E-commerce of the Year 2024**.
- Status: opalcamera.com now redirects to **op.al** ("Opal Electronics", a new Next.js + Turbopack site with Die Grotesk C type). The Tadpole page is archived.
- Techniques: many playful scroll-choreographed feature demos, studio and lifestyle photography mixed with 3D, and a box concept. Frontend.fyi rebuilt its text reveals in **pure CSS scroll-driven animations** (`view-timeline`, `animation-range`, a `@property` percentage, and `background-clip: text` on sticky elements).
- **Idea for us:** for cheap, CSP-safe reveals, use CSS `animation-timeline: view()`, which needs no JS and no nonce. Keep the JS budget for the WebGL hero.

#### 6. Qudrix — modular living cubes (O0 / ozero.design)

- URL: https://qudrix.com — https://www.ozero.design/works/qudrix
- Awards: Awwwards SOTD + **E-commerce Honors** + Developer (Jan 2025).
- Techniques: a **3D wizard / configurator** where you "sculpt your own space", big titles and lots of space, cubes placed in natural landscapes, Webflow + JS + **Stripe**. The founder: "our site became a powerful sales tool".
- **Idea for us:** rethink our custom-quote flow (`/custom`) as a 3D wizard. Upload an STL → preview it on a virtual print bed → pick colours per region → live estimate. We already have Stripe and R2.

#### 7. Telepathic Instruments — Orchid synth (Love + Money)

- URL: https://telepathicinstruments.com
- Awards: Awwwards SOTD (2025). The first 1,000 units sold out in 3 minutes.
- Stack I confirmed live: **Shopify, no canvas, 6 videos**. Type: Suisse Intl + Suisse Intl Mono + Editorial Old Ultralight.
- Techniques: art direction carries everything. A 70s cosmic/retro look, the product glowing like a thought above a face, a two-colour palette (#C25233 terracotta, #D5CDBA paper), video loops and editorial serif + mono.
- **Idea for us:** proof that a strong art direction + video + a grotesk/mono/serif trio can win without WebGL. This is our **fallback tier and our category pages**. Their paper tone is close to ours.

#### 8. Oura Ring (Instrument)

- URL: https://ouraring.com — https://www.instrument.com/work/oura-smart-ring
- Awards: Awwwards E-commerce Honors (Apr 2025), Webby honoree 2025.
- Techniques: **progressive disclosure** as the core of the design system (layers of information, animation and micro-interactions), CGI + lifestyle photography + in-app UI + data-viz. **Finish storytelling** (black PVD, brushed silver, rose, stealth DLC).
- **Idea for us:** finish storytelling for filaments (matte, silk, marble, translucent, glow). Use progressive disclosure on the PDP: layer height, material, print time and care, one tap at a time.

#### 9. Cartier Watches & Wonders 2025 / 2026 (Immersive Garden) + Cartier "Le Chœur des Pierres" (makemepulse)

- URLs: https://www.cartier.com/en-us/watchesandwonders — https://www.cartier.com/en-fr/lechoeurdespierres
- Awards: W&W 2025 SOTD (2026 edition also SOTD). Le Chœur des Pierres is an FWA of the Day and Awwwards nominee (Sep 2026).
- Techniques:
  - W&W: **six self-contained 3D "alcoves"**, one per watch, scrolled like museum rooms. Drifting horizons, water and mirrors, hidden gestures, a Web Audio score as a narrative layer. Three.js + Blender + GSAP + Lenis.
  - Le Chœur: **gemstone → gouache sketch → jewel**, a craftsmanship reveal on scroll in WebGL.
- **Idea for us:** "one room per collection", for example an alcove per product family, each with its own light and colour mood. The gouache-to-jewel reveal becomes CAD-sketch-to-print.

#### 10. KAI Design Dept. — 117-year-old Japanese blade maker (mount inc.)

- URL: https://www.kai-group.com/global/design — Codrops: https://tympanus.net/codrops/2025/11/20/behind-the-kai-design-dept-experience-webgl-line-blur-video-scrubbing-and-3d-animation/
- Techniques:
  - Craftsmanship told as gesture: "touchable video".
  - **Scroll-scrubbed video** re-encoded with ffmpeg: `-g 12` keyframe interval, baseline profile, level 3.1, `+faststart`. The **mediabunny** (WebCodecs) fallback covers Firefox.
  - **WebGL line DoF** (two FBOs, blur radius in a channel, separable Gaussian, foreground/background passes).
  - Line trajectories animated in Blender and exported as JSON cues.
- **Idea for us:** the **ffmpeg recipe for scrubbable video** of real prints (timelapse of the nozzle at work) is directly reusable. The Blender-animated lines as JSON cues map to animated toolpaths.

#### 11. Aardvark Book Club (FUTURE THREE®)

- URL: https://aardvarkbookclub.com
- Awards: Awwwards SOTD (30 Aug 2026) + E-commerce Honors (Jul 2026).
- Techniques: a **scroll-driven 3D book reveal**, hover genre discovery, **buttons with audio feedback**, Barba page transitions, Webflow + GSAP. The brief: "interactions that make every page feel like an unboxing".
- **Idea for us:** the "unboxing" feeling for every product page, with the object coming out of Swiss3Design packaging. Subtle, opt-in click sounds.

#### 12. Pixel Vault (Karan Chouhan)

- URL: https://www.pixelvault.fit
- Awards: Awwwards E-commerce Honors / HM (Mar 2026).
- Techniques: "a marketplace from earth 2047". Three.js + Vue, **360° product viewing**, shop grid + collections gallery with WebGL transitions, a "Playground" section, black-only palette.
- **Idea for us:** a "Playground" or "Atelier" page where visitors toy with materials, colours and physics on prints without buying pressure. It is a good shareable asset.

#### 13. Lando Norris (OFF+BRAND)

- URL: https://landonorris.com — https://www.itsoffbrand.com/our-work/lando-norris
- Awards: **Awwwards Site of the Year 2025** + Users' Choice, SOTM, FWA.
- Techniques: a **rotating 3D helmet that tracks your reading** position, cinematic scroll sequences, **Rive** state-machine motion graphics, custom PBR + HDRI, Webflow, and heavy lazy-loading.
- **Idea for us:** one persistent 3D object that follows the reader through the whole homepage and changes pose and colour per section. Rive (free tier) could drive the UI micro-animations (cart, filters).

#### 14. Messenger / Igloo Inc (abeto)

- URLs: https://messenger.abeto.co — https://www.igloo.inc — Awwwards case study: https://www.awwwards.com/igloo-inc-case-study.html
- Awards: Messenger won **Developer Site of the Year 2025**. Igloo was a 2024 SOTY finalist.
- Techniques (Igloo):
  - **Procedurally grown ice crystals** and a UI rendered fully in WebGL: text glitch via SDF texture-offset swaps, with no DOM relayout.
  - A custom **VDB → browser volume exporter** drives the particle footer, smaller than a typical image.
  - Three.js + Svelte + GSAP + Houdini + Blender.
- **Idea for us:** a procedural "growth" effect, where a product _grows_ layer by layer the way a crystal grows. Do not render the UI in WebGL: it hurts accessibility and conflicts with next-intl.

### B. Physical-product e-commerce: motion without heavy 3D (benchmarks for the shop UI)

#### 15. Outfit — ++hellohello merch store

- URL: https://outfit.hellohello.is
- Awards: Awwwards SOTD + Developer (May 2026), E-commerce Honors (Apr 2026). **Animations/Transitions 8.2 and WPO 8.2**, so it is fast and animated.
- Stack: React + Shopify + GSAP. Standout elements: an **empty-bag visualisation**, product hover animations, the home animation.
- **Idea for us:** reference for the cart drawer, empty-cart state and card hovers, animated while staying fast.

#### 16. Drop Edition (Square43 Studio)

- URL: https://dropedition.com
- Awards: E-commerce Honors (Mar 2026), community score 8.27.
- Stack: **Next.js + GSAP + Shopify**, the closest to our stack. Minimal, parallax, hero animation, PDP with video demos, palette #B9C7CC + white.
- **Idea for us:** proof that Next.js + GSAP e-commerce scores well. Use video demos on the PDP for articulated or flexible prints.

#### 17. Serotoninn (BL/S®)

- URL: https://serotoninn.com
- Awards: SOTD + E-commerce Honors + Developer (Jul 2026).
- Techniques: **red #ED3833 + black** only, an animated preloader, a best-seller card slider, category filtering, campaign video, custom 404. WordPress + GSAP + Swiper.
- **Idea for us:** a direct palette precedent for red on ink. Use it to show the owner how far a disciplined two-colour system goes.

#### 18. Decathlon Yestalgia (index)

- URL: https://decathlonyestalgia.com
- Awards: SOTD + Developer (28 Aug 2026).
- Techniques: a 90s capsule collection, an animated lookbook with video gallery, illustrated characters, scroll effects, black + pink #F3AFCC, GSAP.
- **Idea for us:** capsule "drops" as mini-sites for seasonal collections (Noël, Alpine edition).

#### 19. Zellerfeld — 3D-printed shoes (direct peer)

- URL: https://www.zellerfeld.com
- Stack I confirmed live: Nuxt, no canvas, 4 videos. Fonts: Exposure, Phonic mono, Lateral.
- Techniques: dark UI, an **orange-red CTA accent**, a mono font for data, **raffle drops with a live countdown** (for example AIRMAX 1000.3 with Nike), "Create" for designers.
- **Idea for us:** **limited print runs with a countdown** ("Édition 03 — 50 pièces"). Use mono type for fabrication data. It also shows that the peer category has no WebGL at all.

#### 20. Gantri — 3D-printed designer lamps (direct peer)

- URL: https://www.gantri.com
- Stack I confirmed live: Next.js, Söhne. Headlines: "Digitally made in California", "Made to order", "Plant-based", "Every step with intention".
- Techniques: **manufacturing-process storytelling in words and photos** (made to order, plant-based material, packaging), designer/creator features and a "Create" program.
- **Idea for us:** the story beats are right (made to order, material origin, packaging). Their execution is static, and our WebGL process story would be the upgrade.

#### 21. Nagami — 3D-printed furniture from recycled plastic (direct peer)

- URL: https://nagami.design
- Stack I confirmed live: a Shopify theme, video hero, Inter. Collaborations with Zaha Hadid Architects, Dior, Cartier and Patricia Urquiola.
- **Idea for us:** "Del residuo a una nueva vida" (from waste to a new life), i.e. material-origin storytelling. The site shows how collaboration credits can build credibility.

#### 22. Weekend Max Mara — "The Tuscan Journey Begins" (MONOGRID)

- URL: https://weekend-mm-2026-pasticcino-bag-master.monogrid.io/en/
- Awards: Awwwards SOTD (13 Sep 2026).
- Techniques: Italian bag craftsmanship turned into a gesture-based WebGL journey, a single-colour palette (#465016), sound, Vue + GSAP + WebGL.
- **Idea for us:** "Swiss journey": a regional or craft narrative (atelier → Alps → your home) with gesture interactions.

### Honourable mentions (worth a look)

- **Shopify Editions Spring '26** (https://www.shopify.com/editions/spring2026). Point clouds extracted from video (VGGT) in a custom quantised `.mdpc` format decoded in Web Workers. Volumetric light raymarched from KTX2 array textures. Scroll drives shader uniforms, not React renders. Device tiers 0-3 plus a shared `FluidField`. Codrops write-up: https://tympanus.net/codrops/2026/06/26/engineering-the-web-experience-behind-shopifys-spring-26-edition-everywhere/
- **Forged.build** (Michael Modena, ex-Active Theory). Custom WebGPU, "fake tracing" (baked diffuse + a real-time microfacet specular), movement on one axis per scene, film cuts, a 3-tier quality fallback. https://tympanus.net/codrops/2025/10/20/from-garage-to-browser-forged-build-and-the-webgpu-revolution/
- **INK Games (ToyFight)**. **One canvas for the whole Next.js site**: drei `<View>` scissor rendering, and the frame loop runs only when 3D is visible, scrolling or resizing (ScrollTrigger `onToggle`). https://tympanus.net/codrops/2025/11/21/one-canvas-to-rule-them-all-how-ink-games-new-site-handles-complex-3d/
- **Ceramic Beats** (Zui Chen, FWA of the Day 22 Sep 2026). 144 Met ceramics become a sequencer: nine fired-body materials give nine tracks, with ElevenLabs-generated strike sounds tuned by density and firing temperature. https://ceramic-beats.zui.ooo — material → sound mapping.
- **Agrumea Farm** (Studio K95, FWA of the Day 27 Sep 2026). A Sicilian heritage farm journey in Three.js + Nuxt + GSAP + Lenis.
- **Stenger Bike** (Locomotive, SOTD 2024). Shopify, **red #E82525 + white**.
- **Insta360 Luna Ultra** (Awwwards nominee, Aug 2026). Chaptered hardware transitions (AI chip, detachable screen, Leica filters). https://www.insta360.com/product/insta360-luna-ultra
- **Zaptec** (Good Morning, Norway). An interactive WebGL product section for EV chargers.
- **Camp Suha 3D Van Builder** (Outside Digital). A 3D configurator e-commerce build.
- **CANCAN Furnishings** (360&5, E-commerce Honors Oct 2025). Shopify + Contentful, architectural furniture, #171717 + white.

---

## 2. Codrops (and related) tutorials we could adapt, with code

Grouped by the Swiss3Design use case. All use Three.js/GSAP unless noted.

### Hero: the object prints or forms itself

| Tutorial                                                                                                                                                                     | Demo / code                                                                                                                 | How we adapt it                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sliced Model Shader**, Three.js Journey (fragment `discard` with `three-custom-shader-material` on `MeshStandardMaterial`; the Citrix x Red Bull site used it)             | https://threejs-journey.com/lessons/sliced-model-shader                                                                     | Core of the "print-on-scroll" hero. Discard fragments above `uPrintHeight` and add a glowing rim at the cut (the "nozzle line"). Quantise the height into 0.2 mm steps so it advances layer by layer.   |
| **Houdini VAT → Three.js** (crumpled paper, Sep 2026). Vertex animation baked into an EXR (1024×200 float RGBA, 1.7 MB) plus FBX; playback is scrubbable by fractional frame | https://tympanus.net/codrops/2026/09/19/crumbled-paper-houdini-vat-threejs/                                                 | Bake a real deposition sim (the extruded bead flowing) or an articulated print unfolding. Scroll scrubs the frame. **Watch the size:** host the EXR/KTX2 files in R2 or `public/`, never in the bundle. |
| **Crafting a Dreamy Particle Effect (GPGPU)**. Particles sampled on the mesh surface, mouse repulsion via three-mesh-bvh, MotionBloom                                        | https://tympanus.net/Tutorials/DreamyParticles — https://github.com/DGFX/codrops-dreamy-particles                           | "Filament dust" condenses into the product, and the cursor scatters it.                                                                                                                                 |
| **Particles Morphing Shader**, Three.js Journey                                                                                                                              | https://threejs-journey.com/lessons/particles-morphing-shader                                                               | Morph between products (vase → lamp → figurine) in the homepage product rail.                                                                                                                           |
| **Animating 160,000 cubes (InstancedMesh + per-instance attributes, GPU-only animation)**                                                                                    | https://tympanus.net/Tutorials/VisualizingDitheringThreejs/ — https://github.com/damarberlari/visualizing-dithering-codrops | Voxel or layer build-up of the brand peak (logo = stacked layers). Colour regions switch per instance for the multicolour story.                                                                        |
| **WebGPU Scanning Effect with Depth Maps** (TSL, R3F, scan line + cell-noise dot grid)                                                                                       | https://tympanus.net/Development/ScanEffect — https://github.com/d3adrabbit/ScanningEffectWithDepthMap                      | Treat photos as "scanning" plus a depth pass over product photography for category heroes, with no 3D model needed.                                                                                     |

### Material, colour and inside structure

| Tutorial                                                                                                                                      | Demo / code                                                                                                                       | How we adapt it                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dual-Scene Fluid X-Ray Reveal** (two scenes, ping-pong fluid mask with FBM, TSL/WebGPU, Draco)                                              | https://tympanus.net/Tutorials/SkeletonFluidReveal/ — https://github.com/cullenwebber/three-skull                                 | Scene A = finished print, scene B = the same print with visible **gyroid infill** or a wireframe toolpath. The cursor wipes away the shell. |
| **Mouse-Following Square Lens** (CC-Lens distortion, radial RGB shift, fragment only)                                                         | https://tympanus.net/Tutorials/PointerSquareLensDistortion — https://github.com/tomoyukinakata/mouse-following-square-lens-effect | A "layer-line loupe" over macro photos on the PDP, with the RGB shift turned off for honest detail.                                         |
| **Volatile Nexus: glass, caustics, cubes and sound** (Aug 2026)                                                                               | https://tympanus.net/codrops/2026/08/31/volatile-nexus-tinkering-with-glass-caustics-cubes-and-sound-in-three-js/                 | Translucent PETG and "glass-like" filament material studies with caustics on the table.                                                     |
| **Building an Infinite Loom / "Unwoven"**: images split into 26 ribbons that unravel with smoothstep edge "tear" (single HTML file, no build) | https://tympanus.net/Development/Unwoven/ — https://github.com/clementgrellier/unwoven                                            | **The filament transition.** Product cards unravel into filament strands as they leave the viewport and re-weave into the next product.     |
| **Interactive WebGL Backgrounds: Bayer dithering**                                                                                            | https://tympanus.net/codrops/2025/07/30/interactive-webgl-backgrounds-a-quick-guide-to-bayer-dithering/                           | A lightweight brand background (warm paper + red dithering) for non-3D pages.                                                               |

### Scroll camera, chapters and process story

| Tutorial                                                                                                                                                                                | Demo / code                                                                                                                                                        | How we adapt it                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Scroll-driven 3D gallery using a Blender camera path** (Python export to JSON, Z-up → Y-up, `CatmullRomCurve3`, `gsap.quickTo` on a proxy `t`, GSAP Observer)                         | https://tympanus.net/Tutorials/CurveGallery/ — https://github.com/gaspoorf/curve-gallery                                                                           | An author-directed camera flight through the "atelier" scene (CAD → slicer → printer → post-process → packaging) straight from Blender. |
| **How to Build Cinematic 3D Scroll Experiences with GSAP** (Nov 2025; OGL cylinder + particles; R3F waypoint camera + SplitText chapters + progress bar)                                | https://tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap/ — https://github.com/JosephASG/codrops-cinematic-scroll-animations | Chaptered process storytelling with a progress indicator of "layers printed".                                                           |
| **Shader.se scroll-driven WebGPU pipeline** (one FBO per section, skip inactive passes, reverse-order texture passing, a Lenis → cumulative progress config array, a pre-render window) | https://tympanus.net/codrops/2026/05/19/80s-business-tech-seamless-scene-transitions-inside-shader-ses-scroll-driven-webgpu-pipeline/                              | The architecture for our homepage chapters, so we don't pay for scenes that aren't on screen.                                           |
| **KAI: video scrubbing + line DoF** (ffmpeg `-g 12`, baseline 3.1, faststart; mediabunny fallback)                                                                                      | https://tympanus.net/codrops/2025/11/20/behind-the-kai-design-dept-experience-webgl-line-blur-video-scrubbing-and-3d-animation/                                    | Scroll-scrub real timelapses of our printers. This is the cheap, truthful manufacturing-story tier.                                     |
| **Building a Layered Zoom Scroll Effect (ScrollSmoother + ScrollTrigger)**                                                                                                              | https://tympanus.net/codrops/2025/10/29/building-a-layered-zoom-scroll-effect-with-gsap-scrollsmoother-and-scrolltrigger/                                          | A zoom from the Alps into the atelier and then onto the nozzle, a "zoom into the layer" intro.                                          |
| **Creating 3D scroll-driven text animations with CSS and GSAP**                                                                                                                         | https://tympanus.net/codrops/2025/11/04/creating-3d-scroll-driven-text-animations-with-css-and-gsap/                                                               | Kinetic FR/DE/IT/EN headlines. Take care with translation lengths.                                                                      |

### Shop UI (grid, PDP, transitions)

| Tutorial                                                                                                                                                                           | Demo / code                                                                                                                         | How we adapt it                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recreating Palmer's draggable product grid** (GSAP Draggable + Inertia, Flip into detail, SplitText)                                                                             | https://tympanus.net/Tutorials/PalmerDraggableGrid/ — https://github.com/joffreysp/draggable-grid                                   | A "table of objects" shop view you can pan like a print bed covered in parts, with Flip into the PDP.                                                                |
| **Animated product grid preview with GSAP & clip-path**                                                                                                                            | https://tympanus.net/codrops/2025/05/27/animated-product-grid-preview-with-gsap-clip-path/                                          | Quick-view overlay on `/shop`.                                                                                                                                       |
| **Scroll-revealed WebGL gallery (Astro + Three + GSAP ScrollSmoother + Barba + Flip)** (`uProgress` reveal shader, DOM ↔ plane sync via `getBoundingClientRect` on `gsap.ticker`)  | https://pixelimageeffect.pages.dev/ — https://github.com/J0SUKE/gsap-threejs-codrops                                                | Product photo reveals on scroll. In Next 16, replace Barba with the **View Transitions API** / React `<ViewTransition>` plus a persistent canvas in the root layout. |
| **Seamless 3D transitions (Webflow + GSAP + Three + Barba)**: a persistent canvas outside the swapped container, and per-page namespaces mapped to camera X ("pen", "cup" objects) | https://page-transitions-webflow-gsap-threejs.webflow.io/                                                                           | Exactly our pattern: one canvas in `app/[locale]/layout.tsx`, and each product page is a camera "station" beside the object.                                         |
| **Progressively enhanced WebGL lens refraction, 14islands r3f-scroll-rig** (`GlobalCanvas` + `UseCanvas` tunnel, meshes track DOM elements, semantic HTML first)                   | https://tympanus.net/codrops/2023/10/10/progressively-enhanced-webgl-lens-refraction/ — https://github.com/14islands/r3f-scroll-rig | The **best-fitting architecture for Next.js + i18n + SEO**: the HTML is the source of truth and WebGL enhances it.                                                   |
| **Magnetic commerce (Dash Creative)**: a video-texture hero distortion that keeps going in the drag direction (radius 0.41, amplitude 0.082, momentum decay 0.86)                  | https://tympanus.net/codrops/2026/07/21/magnetic-commerce-building-the-dash-creative-website/                                       | A tactile hero behind the headline: the cursor "pulls" a molten-filament video texture.                                                                              |
| **Exploring the HTML-in-Canvas proposal** (`layoutsubtree`, `drawElementImage()`, Chrome flag only)                                                                                | https://html-in-canvas.vercel.app/ — https://github.com/motiontx/html-in-canvas                                                     | Watch list only. Not production-ready in 2026 and behind a flag.                                                                                                     |

---

## 3. Trends 2025-2026 (what the juries reward)

1. **One hero object, one hard idea.** The best Three.js sites of 2026 commit to a single mechanic (Oryzo, iyO, Aether, Lando).
2. **Physically weighted motion.** Inertia, damping and momentum that continues after input (Oryzo, Dash's momentum decay 0.86, GSAP `quickTo`/Inertia).
3. **Story first, then a configurator-style shop** (Scout, Opal, iyO, Qudrix). The PDP is a configurator with a live model; checkout stays conventional.
4. **CAD-truthful 3D.** Real CAD down-rezzed (iyO), real material scans (Oryzo cork), real finishes (27 materials at iyO; Oura finishes).
5. **Preloaders that narrate**, from sketch/CAD to the real object (Oryzo), instead of a spinner.
6. **Baked production assets.**
   - Blender camera paths as JSON and Blender empties as event triggers.
   - Houdini VAT / Vellum / VDB volumes.
   - Baked AO/lightmaps + dynamic specular ("fake tracing").
   - Draco + KTX2 everywhere.
7. **Capture-based 3D:** Gaussian splats (Postshot) and point clouds from video (VGGT) in Oryzo and Shopify Editions.
8. **WebGPU + TSL with a WebGL fallback and explicit device tiers (0-3)**, DPR clamping and particle counts scaled per device (iyO 1.6 M → 400 k; Shopify tiers; Forged 3-tier).
9. **A single persistent canvas** with DOM sync (drei `<View>`, r3f-scroll-rig) and **render-on-demand** (only while visible or scrolling).
10. **Cheap fakes over expensive passes:** fake DoF, pre-baked bloom billboards, matcap glass, and fluid sims at 7.5% resolution.
11. **GSAP everywhere, and now free** (SplitText, ScrollSmoother, MorphSVG and Inertia included since the Webflow acquisition). Lenis is the default smooth scroll. **CSS scroll-driven animations** (`animation-timeline: view()`) handle lightweight reveals.
12. **Scrubbed video and image sequences are back**, often **AI-generated** (Higgsfield, which has an MCP and aggregates Veo/Kling/Sora/Seedance, plus Runway). Pipeline: ffmpeg → WebP frames (120 frames ≈ 5-8 MB) or an all-intra-ish MP4 (`-g 12`).
13. **Sound as a narrative layer:** Cartier's score, Aether's audio-reactive waves and low-pass on hover, Aardvark's button sounds, Ceramic Beats' material sounds. Always opt-in.
14. **Restrained palettes** of 2-4 colours, and a type trio of grotesk + mono (for data) + editorial serif (Telepathic, Zellerfeld, Oryzo).
15. **Red + ink e-commerce** (Serotoninn, Stenger, Zellerfeld accents).
16. **Personality and humour** (Oryzo's satire) and "Playground" pages (Pixel Vault) built for social sharing.
17. **Accessibility as a feature:** reduced-motion routes (Aether) and HTML-first progressive enhancement (14islands).
18. **Commerce platforms:** Shopify/Webflow dominate winners, but **Next.js + GSAP** winners exist (Drop Edition, INK Games, Opal's new site, Gantri). Our stack is not a handicap.
19. **Limited drops with countdowns** (Zellerfeld raffles) and capsule mini-sites (Decathlon Yestalgia) to build urgency for physical goods.

---

## 4. Signature ideas for Swiss3Design (bold, concrete, buildable)

1. **"Imprimé sous vos yeux" hero (printed before your eyes).** The hero object (for example a multicolour vase) is **printed layer by layer as you scroll**. Mechanics:
   - A sliced-model `discard` above `uPrintHeight`, quantised to 0.2 mm, so it advances in visible layers.
   - A glowing red "nozzle line" at the cut and a small extruder head riding the rim.
   - Colour changes happen at real layer indices (AMS-style), with a brief purge-blob animation.
   - At 100% the slicer-preview colours cross-fade into the real PBR material.

   Budget: a single glTF (Draco) + KTX2, lazy-loaded via the existing `next/dynamic({ ssr:false })` pattern.

2. **Loader = toolpath.** Like Oryzo's CAD sketch, the brand peak (our layered logo) is drawn as a **G-code toolpath** (perimeter lines, then infill hatching) on a warm-paper print bed, then solidifies into the red raster mark.
3. **Couches = courbes de niveau (layers = contour lines).** Our logo is a layered alpine peak, and every print is literally a topography. Use a Swiss-topo **isoline shader** (contours from world-Y) on products and backgrounds, tying "stacked print layers" to the Alps. It gives the brand a unique visual signature.
4. **Filament-colour ripple configurator.** When a filament colour is chosen on the PDP, the new colour **propagates up the layer lines from the bed like a wave** (iyO's ripple, but along Y). Multicolour products expose each colour region as its own swatch with an exploded view on scroll (iyO).
5. **Real fabrication data as motion.** Each PDP shows _truthful_ counters that animate on reveal: "14 h 32 min d'impression", "412 couches", "38 m de filament", "4 couleurs", "0,2 mm". Parse them from the slicer/G-code metadata we already have for the products. It is honest, unique and fits Swiss precision.
6. **X-ray infill lens.** A cursor or finger fluid mask (dual-scene reveal) wipes the shell away to show the **gyroid infill** and inner toolpaths. It explains why a print is strong and light.
7. **"L'atelier" process chapter.** A Blender-authored camera path flies through our real atelier, captured as **Gaussian splats** (Postshot, or Polycam/Luma for capture) or as a scrubbed timelapse (KAI's ffmpeg recipe). Six stops: design → slicing → printing → post-processing → quality check → packaging, then La Poste to your door in Switzerland.
8. **Unravel-to-filament transitions.** Page transitions between products use the "Unwoven" ribbon shader: the current product's image **unspools into filament threads** that re-weave into the next product (View Transitions + persistent canvas).
9. **"Table d'impression" shop view.** A draggable, inertial grid styled as a print bed with a build-plate texture, where products sit like freshly printed parts (Palmer grid + Flip into PDP). The classic list view stays one toggle away for usability and SEO.
10. **Limited "Éditions" with countdown.** Numbered small batches ("Édition Alpine — 50 pièces, 12 restantes") with a live countdown and progress-bar layers, following Zellerfeld raffles and Decathlon capsule mini-sites. This needs a stock/`edition` field (Postgres, `uncached` reads).
11. **Custom-quote 3D wizard** (Qudrix). Upload an STL to R2 → render it on a virtual print bed → orient/scale → pick colours per region → live price estimate → Stripe. It turns `/custom` from a form into the site's most distinctive tool.
12. **Material sounds, opt-in** (Ceramic Beats, Aardvark). Hovering a filament swatch (PLA mat, silk, PETG, TPU) plays a short, distinct "tap" sound, generated once with ElevenLabs SFX and served from `public/`. It is muted by default with a visible toggle, which also respects the Swiss audience.
13. **Layer-line loupe.** A square lens over macro product photography shows real 0.12-0.2 mm layer texture (Codrops lens without RGB shift). It turns a perceived defect into proof of craft.
14. **Playground page ("Labo").** A physics toy where visitors drop, stack and recolour prints (a cannon-es or Rapier-wasm lazy chunk). It is shareable, keeps the shop calm, and is the place for the wildest shaders.

---

## 5. Constraints to respect (mapping inspiration to our stack)

- **Bundle cap and cold start** (golden rule 10). Every Three/GSAP/Lenis import stays client-only behind `next/dynamic({ ssr:false })`, and no binary asset may go through Next file conventions. 3D assets (glb/ktx2/exr/splats/frames) live in **R2 or `public/`** (static assets, outside the Worker bundle).
- **CSP nonce** (golden rule 4). Prefer bundled modules over inline scripts. CSS scroll-driven animations need no script at all. Web Workers used for decoding (Shopify's `.mdpc` pattern) must be allowed by CSP `worker-src`.
- **No Barba in the App Router.** Use a persistent canvas in `app/[locale]/layout.tsx` + React/Next View Transitions + GSAP Flip.
- **Motion 13 is already installed.** Use it for React UI micro-interactions (cart, drawers, filters). Use GSAP (free) for ScrollTrigger/SplitText/Flip timelines, and Lenis for smooth scroll (sync `lenis.raf` with `gsap.ticker`).
- **Device tiers + reduced motion from day one.** Tier 0 = static images + CSS reveals (Telepathic-style art direction still looks premium). Tier 1 = video scrubbing. Tier 2 = WebGL hero. Tier 3 = WebGPU extras.
- **i18n.** Kinetic type must survive DE compound words and IT/FR length. Test SplitText with the German strings.
- **Accounts or tools the owner may need:**
  - **Higgsfield** (AI video, has an MCP) or Runway for generated b-roll.
  - **Jawset Postshot** (Gaussian splats, paid) or **Polycam/Luma** (capture).
  - **RealityScan** (free photogrammetry of our own prints).
  - **Blender** (free).
  - **Houdini Indie** (paid; Apprentice is non-commercial only) if we want VAT sims.
  - **ElevenLabs** (SFX).
  - **Rive** (UI state-machine animation, free tier).

---

## 6. Sources

Awards and galleries

- Awwwards annual winners 2025: https://www.awwwards.com/annual-awards/winners
- Awwwards Sites of the Year: https://www.awwwards.com/websites/sites_of_the_year/
- Awwwards e-commerce winners: https://www.awwwards.com/websites/winner_category_ecommerce/
- Awwwards e-commerce listing: https://www.awwwards.com/websites/e-commerce/
- Awwwards WebGL listing: https://www.awwwards.com/websites/webgl/
- Awwwards 3D listing: https://www.awwwards.com/websites/3d/
- Individual Awwwards pages:
  - https://www.awwwards.com/sites/outfit
  - https://www.awwwards.com/sites/drop-edition
  - https://www.awwwards.com/sites/serotoninn
  - https://www.awwwards.com/sites/pixel-vault
  - https://www.awwwards.com/sites/cancan-furnishings
  - https://www.awwwards.com/sites/decathlon-yestalgia
  - https://www.awwwards.com/sites/cartier-le-choeur-des-pierres
  - https://www.awwwards.com/sites/the-tuscan-journey-begins
  - https://www.awwwards.com/sites/aardvark-book-club
  - https://www.awwwards.com/sites/insta360-luna-ultra
  - https://www.awwwards.com/sites/aether-1
  - https://www.awwwards.com/sites/qudrix
  - https://www.awwwards.com/sites/telepathic-instruments
  - https://www.awwwards.com/sites/oryzo-ai
  - https://www.awwwards.com/sites/scout-motors
  - https://www.awwwards.com/sites/stenger-bike
- iyO case study: https://www.awwwards.com/iyo-case-study-selling-the-worlds-first-audio-computer.html
- Igloo case study: https://www.awwwards.com/igloo-inc-case-study.html
- The FWA (live list, 27 Sep 2026): https://thefwa.com/
- Siteinspire e-commerce: https://www.siteinspire.com/websites?categories=ecommerce
- motionsites.ai (a gallery of AI-generated templates, not real brands): https://motionsites.ai/
- Roundups:
  - https://www.utsubo.com/blog/best-threejs-websites-2026
  - https://www.hontran.dev/blog/best-award-winning-websites-2026
  - https://metabole.studio/en/blog/immersive-website-examples

Studio case studies

- Lusion Oryzo BTS:
  - https://blog.lusion.co/oryzo-bts-part-1-7-concept-and-creative-direction
  - https://blog.lusion.co/oryzo-bts-part-2-7-3d-design-and-motion-graphics
  - https://blog.lusion.co/oryzo-bts-part-3-7-website-ux-ui-and-illustrations
- OFF+BRAND: https://www.itsoffbrand.com/our-work/aether1
- Locomotive: https://locomotive.ca/en/work/scout-motors
- Instrument: https://www.instrument.com/work/oura-smart-ring
- O0: https://www.ozero.design/works/qudrix
- Claudio Guglieri: https://guglieri.com/work/tadpole
- Frontend.fyi: https://www.frontend.fyi/tutorials/rebuilding-opal-tadpoles-website-with-modern-css
- Vide Infra: https://videinfra.com/blog/case-study-a-triple-site-of-the-day-winner-powered-by-webgl
- Cartier W&W (webgpu.com): https://www.webgpu.com/showcase/cartier-watches-and-wonders-immersive-garden/

Codrops

- WebGL tag, pages 1-2: https://tympanus.net/codrops/tag/webgl/
- 2025 year in review: https://tympanus.net/codrops/2025/12/29/2025-a-very-special-year-in-review/
- The tutorial URLs are in the section 2 tables.

AI video pipeline

- https://www.mindstudio.ai/blog/animated-3d-websites-claude-code-ai-video-generation
- https://higgsfield.ai/
- https://www.builder.io/blog/3d-gsap

Live-site inspection (in my own browser tab; I clicked nothing and accepted no cookies)

- oryzo.ai, telepathicinstruments.com, op.al (formerly opalcamera.com), nagami.design, gantri.com, zellerfeld.com
