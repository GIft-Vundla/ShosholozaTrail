const NS = "http://www.w3.org/2000/svg";
const STYLE_ID = "st-localized-scenes-style";

const PHOTO_CREDITS = Object.freeze({
  pretoria: { author: "Paul Saad", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Jacaranda_Trees,_Becket_Street_Pretoria.jpg" },
  johannesburg: { author: "Andrew Moore", licence: "CC BY-SA 2.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/2.0", source: "https://commons.wikimedia.org/wiki/File:Johannesburg%27s_inner_city.jpg" },
  kimberley: { author: "Rudolph Botha", licence: "CC BY-SA 3.0", licenceUrl: "http://creativecommons.org/licenses/by-sa/3.0/", source: "https://commons.wikimedia.org/wiki/File:Big_Hole_Kimberley.jpg" },
  "de-aar": { author: "Graham Maclachlan", licence: "CC BY-SA 3.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:De_Aar,_South_Africa_-_panoramio.jpg" },
  "beaufort-west": { author: "Mike Peel", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0", source: "https://commons.wikimedia.org/wiki/File:Karoo_National_Park_2014_05.jpg" },
  matjiesfontein: { author: "Tottelme", licence: "CC BY-SA 3.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Matjiesfontein_1.JPG" },
  worcester: { author: "South African Tourism", licence: "CC BY 2.0", licenceUrl: "https://creativecommons.org/licenses/by/2.0", source: "https://commons.wikimedia.org/wiki/File:Hex_River_Valley_-_Western_Cape,_South_Africa_(3880658723).jpg" },
  "cape-town": { author: "Azral", licence: "CC BY-SA 3.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0", source: "https://commons.wikimedia.org/wiki/File:Cape_Town_-_view_from_Table_Mountain_2.jpg" },
});

const tags = {
  pretoriaRays: () => [225, 280, 340, 400, 460, 520, 575].map((x, i) => `<path class="scene-draw" style="--delay:${i * .13}s;--path-length:160" d="M400 270 Q${x} ${215 - i % 2 * 20} ${x} 122" fill="none" stroke="#f2b84b" stroke-width="4" stroke-linecap="round"/>`).join(""),
  dots: () => [150, 250, 350, 450, 550, 650].map((x) => `<circle cx="${x}" cy="312" r="4"/>`).join(""),
  writtenLines: () => [0, 1, 2, 3, 4].map((i) => `<path d="M94 ${86 + i * 28}h${140 + i * 18}"/>`).join(""),
  junctionLines: () => [62, 122, 182, 238, 298].map((y, i) => `<path class="scene-draw" style="--delay:${i * .16}s;--path-length:720" d="M45 ${y} C250 ${y}, 306 210, 530 210 S700 ${120 + i * 34}, 770 ${108 + i * 42}"/>`).join(""),
  lamps: () => [320, 670, 735].map((x, i) => `<g><path d="M${x} 315V184q0-24 22-24"/><circle class="scene-flicker scene-glow" style="--delay:${i * .6}s" cx="${x + 22}" cy="166" r="13" fill="#f0b958"/></g>`).join(""),
  publicMarkers: () => [[110, 159], [240, 219], [405, 209], [570, 195], [694, 230]].map(([x, y]) => `<circle class="scene-pulse" cx="${x}" cy="${y}" r="14"/>`).join(""),
  verticalStreets: () => [88, 176, 264, 352, 440, 528, 616, 704].map((x) => `<path d="M${x} 42v330"/>`).join(""),
  horizontalStreets: () => [74, 142, 210, 278, 346].map((y) => `<path d="M42 ${y}h716"/>`).join(""),
  memoryVoids: () => [[176, 142, 88, 68], [440, 74, 88, 136], [616, 210, 88, 68], [264, 278, 176, 68]].map(([x, y, w, h]) => `<rect class="scene-shift" x="${x}" y="${y}" width="${w}" height="${h}"/>`).join("")
};

export const LOCALIZED_SCENES = Object.freeze({
  pretoria: {
    title: "Jacarandas at departure",
    description: "A licensed Pretoria jacaranda photograph comes alive as an interpretive canopy blooms outward.",
    sourceIds: [],
    colors: ["#0d2035", "#f2b84b", "#f8f1df"],
    art: () => `
      <defs><radialGradient id="pt-glow"><stop stop-color="#f9d47c"/><stop offset="1" stop-color="#f2b84b" stop-opacity="0"/></radialGradient></defs>
      <rect width="800" height="420" fill="#0d2035"/>
      <circle class="scene-rise" cx="400" cy="265" r="118" fill="url(#pt-glow)"/>
      <circle class="scene-rise scene-glow" cx="400" cy="268" r="34" fill="#f2b84b"/>
      <path d="M135 310 Q400 102 665 310" fill="none" stroke="#f8f1df" stroke-opacity=".62" stroke-width="3"/>
      <g class="scene-bloom">${tags.pretoriaRays()}</g>
      <path d="M110 312 H690" stroke="#f8f1df" stroke-opacity=".3"/>
      <g fill="#f8f1df">${tags.dots()}</g>
    `
  },
  johannesburg: {
    title: "The city rises",
    description: "A licensed Johannesburg city photograph is layered with an interpretive skyline rising block by block.",
    sourceIds: [],
    colors: ["#111a29", "#f4bd4f", "#f8f2e8"],
    art: () => `
      <rect width="800" height="420" fill="#111a29" fill-opacity=".18"/>
      <g class="scene-skyline" fill="#f4bd4f" fill-opacity=".72">
        <rect x="88" y="238" width="70" height="122"/><rect x="174" y="174" width="76" height="186"/>
        <rect x="270" y="214" width="58" height="146"/><rect x="346" y="116" width="92" height="244"/>
        <rect x="456" y="196" width="68" height="164"/><rect x="544" y="146" width="82" height="214"/>
        <rect x="644" y="248" width="66" height="112"/>
      </g><path d="M60 360H740" stroke="#f8f2e8" stroke-width="4" opacity=".8"/>
    `
  },
  kimberley: {
    title: "Into Kimberley's Big Hole",
    description: "The licensed photograph stays in full view while the camera spirals toward the flooded crater. A small headgear silhouette adds mining context.",
    sourceIds: ["sol-plaatje", "big-hole"],
    colors: ["#24170f", "#df8d45", "#8bd6c7"],
    art: () => `
      <g transform="translate(626 35)">
        <g class="scene-kimberley-marker">
          <path d="M17 78V30h72v48M7 78h98M29 30L53 4l24 26M53 4v74M17 48h72M89 49l37 29"
            fill="none" stroke="#f8f2e8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="53" cy="4" r="4" fill="#f4bd4f"/>
        </g>
      </g>
      <g class="scene-kimberley-pulse" fill="none" stroke="#f4bd4f" stroke-width="3" opacity=".82">
        <circle cx="410" cy="254" r="12"/>
        <circle cx="410" cy="254" r="22" opacity=".42"/>
      </g>
    `
  },
  "de-aar": {
    title: "Lines from a junction",
    description: "The licensed De Aar photograph comes alive as rail lines converge and a letter travels toward a wider world.",
    sourceIds: ["schreiner-de-aar"],
    colors: ["#151c2b", "#e2bb67", "#72b7ce"],
    art: () => `
      <rect width="800" height="420" fill="#151c2b" fill-opacity=".12"/>
      <g fill="none" stroke="#72b7ce" stroke-width="5" stroke-linecap="round">
        ${tags.junctionLines()}
      </g>
      <circle class="scene-pulse scene-glow" cx="530" cy="210" r="14" fill="#e2bb67"/>
      <g class="scene-rise" transform="translate(520 118)">
        <rect width="116" height="78" rx="5" fill="#f8f1df"/>
        <path d="M4 7l54 42 54-42M5 72l38-35m68 35L73 37" fill="none" stroke="#b07b35" stroke-width="3"/>
      </g>
      <path d="M80 348H720" stroke="#e2bb67" stroke-width="2" stroke-dasharray="8 12"/>
    `
  },
  "beaufort-west": {
    title: "Reading the layers",
    description: "The licensed Karoo photograph moves through sunlit strata as a symbolic fossil trace emerges over the landscape.",
    sourceIds: ["sanparks-karoo"],
    colors: ["#241a18", "#d47d55", "#e8cf91"],
    art: () => `
      <rect width="800" height="420" fill="#241a18" fill-opacity=".12"/>
      <path d="M0 145Q170 90 315 145T610 135T800 130V420H0Z" fill="#604133"/>
      <path class="scene-weave-a" d="M-20 220Q180 178 365 220T820 205V420H-20Z" fill="#9a5945"/>
      <path class="scene-weave-b" d="M-20 278Q180 232 390 278T820 260V420H-20Z" fill="#c77a54"/>
      <path d="M-20 345Q165 306 360 350T820 326V420H-20Z" fill="#e8b171"/>
      <g class="scene-draw scene-glow" style="--path-length:900" transform="translate(400 278)" fill="none" stroke="#f4dfad" stroke-width="5" stroke-linecap="round">
        <path d="M-142 6C-96-38-41-40 2-3S88 39 148-12M-95-20l-31-34m58 21-15-50m46 63L-40-69M10 2l15-64m19 76 42-54m-6 71 57-24"/>
        <ellipse cx="-148" cy="9" rx="18" ry="13"/><path d="M-165 8l-32-12m22 20-25 15"/>
      </g>
      <text x="42" y="64" fill="#f4dfad" font-family="system-ui" font-size="18" letter-spacing="4">DISPLAY · EVIDENCE · LIVING LANDSCAPE</text>
    `
  },
  matjiesfontein: {
    title: "Uses across a lifetime",
    description: "The licensed Matjiesfontein photograph glides down the historic streetscape as station lamps illuminate one by one.",
    sourceIds: ["matjiesfontein-history"],
    colors: ["#101e27", "#f0b958", "#b4d0cc"],
    art: () => `
      <defs><linearGradient id="mj-sky" x2="0" y2="1"><stop stop-color="#142b39"/><stop offset="1" stop-color="#6f5545"/></linearGradient></defs>
      <rect width="800" height="420" fill="url(#mj-sky)" fill-opacity=".14"/>
      <g class="scene-draw" style="--path-length:1400" fill="none" stroke="#b4d0cc" stroke-width="4" stroke-linejoin="round">
        <path d="M85 315V178h205v137M105 178l82-78 83 78M132 315v-72h43v72m45 0v-72h43v72M365 315V148h264v167M350 148h294M404 148V94h188v54M428 315V204h60v111m73 0V204h43v111"/>
        <path d="M30 316H752M36 348h716"/>
      </g>
      <g stroke="#f0b958" stroke-width="4" fill="none">${tags.lamps()}</g>
      <path class="scene-draw" style="--path-length:700;--delay:1s" d="M22 365h756" stroke="#f0b958" stroke-width="5" stroke-dasharray="18 12"/>
    `
  },
  worcester: {
    title: "A route of public memory",
    description: "The licensed Hex River photograph opens through the valley as woven routes meet public heritage markers.",
    sourceIds: ["worcester-heritage"],
    colors: ["#17221f", "#e39a5c", "#6dc5a4"],
    art: () => `
      <rect width="800" height="420" fill="#17221f" fill-opacity=".12"/>
      <g fill="none" stroke-linecap="round" stroke-width="13">
        <path class="scene-draw scene-weave-a" style="--path-length:1000" d="M38 100C183 32 244 352 405 209S636 79 770 155" stroke="#e39a5c"/>
        <path class="scene-draw scene-weave-b" style="--path-length:1000;--delay:.4s" d="M35 286C198 364 256 65 421 211S642 344 772 265" stroke="#6dc5a4"/>
        <path class="scene-draw" style="--path-length:800;--delay:.8s" d="M74 202C221 126 273 304 416 207S622 131 728 208" stroke="#f1d6a0" stroke-width="5"/>
      </g>
      <g fill="#f1d6a0" stroke="#17221f" stroke-width="5">${tags.publicMarkers()}</g>
      <path d="M635 56h108v65H635z" fill="none" stroke="#f1d6a0" stroke-dasharray="6 7" opacity=".55"/>
      <text x="650" y="91" fill="#f1d6a0" font-family="system-ui" font-size="14">private</text>
    `
  },
  "cape-town": {
    title: "Streets remembered",
    description: "The licensed Cape Town photograph approaches the mountain as a District Six street grid returns in remembered fragments.",
    sourceIds: ["district-six"],
    colors: ["#12172a", "#efb14b", "#78b9d4"],
    art: () => `
      <rect width="800" height="420" fill="#12172a" fill-opacity=".12"/>
      <g class="scene-fade-memory" fill="none" stroke="#78b9d4" stroke-width="4">
        ${tags.verticalStreets()}
        ${tags.horizontalStreets()}
      </g>
      <g fill="#12172a">${tags.memoryVoids()}</g>
      <g class="scene-draw scene-glow" style="--path-length:1050" fill="none" stroke="#efb14b" stroke-width="7" stroke-linecap="round">
        <path d="M86 346V210h178V74h176v136h176V74h96"/>
      </g>
      <g fill="#f8f1df" font-family="serif" font-size="17" opacity=".8"><text x="104" y="128">streets</text><text x="290" y="250">memory</text><text x="487" y="326">retracing</text></g>
    `
  }
});

function ensureStylesheet() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = new URL("./localized-scenes.css", import.meta.url).href;
  document.head.append(link);
}

function normaliseHubId(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
}

export function getLocalizedScene(hubId) {
  return LOCALIZED_SCENES[normaliseHubId(hubId)] || null;
}

export function listLocalizedScenes() {
  return Object.entries(LOCALIZED_SCENES).map(([hubId, scene]) => ({
    hubId,
    title: scene.title,
    description: scene.description,
    photoId: hubId,
    sourceIds: [...new Set([...scene.sourceIds, `photo:${hubId}`])],
    colors: [...scene.colors],
    credit: { ...PHOTO_CREDITS[hubId] }
  }));
}

export function createLocalizedAnimation(hubId, options = {}) {
  if (typeof document === "undefined") throw new Error("Localized animations require a browser document.");
  const normalizedId = normaliseHubId(hubId);
  const scene = LOCALIZED_SCENES[normalizedId];
  if (!scene) throw new RangeError(`Unknown ShosholozaTrail hub: ${hubId}`);
  ensureStylesheet();

  const reduced = options.reducedMotion ?? matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.createElement("figure");
  const titleId = `st-scene-${normalizedId}-${Math.random().toString(36).slice(2)}-title`;
  const descId = `${titleId}-desc`;
  root.className = `st-local-scene st-local-scene--${normalizedId}`;
  root.dataset.hub = normalizedId;
  root.dataset.static = String(Boolean(reduced));
  root.dataset.paused = "false";
  root.dataset.intersecting = "true";
  root.style.setProperty("--scene-duration", `${Math.max(4, Number(options.durationSeconds) || 9)}s`);
  root.style.setProperty("--scene-ground", scene.colors[0]);
  root.style.setProperty("--scene-accent", scene.colors[1]);
  root.innerHTML = `<img class="st-local-scene__photo scene-photo" src="/assets/photos/${normalizedId}.webp" alt="" loading="lazy"><span class="st-local-scene__shade" aria-hidden="true"></span><svg viewBox="0 0 800 420" role="img" aria-labelledby="${titleId} ${descId}" preserveAspectRatio="xMidYMid slice"><title id="${titleId}">${scene.title}</title><desc id="${descId}">${scene.description}</desc>${scene.art()}</svg>`;

  const caption = document.createElement("figcaption");
  caption.className = "st-local-scene__caption";
  const copy = document.createElement("small");
  copy.textContent = `${scene.title} · ${scene.description}`;
  caption.append(copy);

  const credit = PHOTO_CREDITS[normalizedId];
  const creditLine = document.createElement("span");
  creditLine.className = "st-local-scene__credit";
  creditLine.append("Photo: ");
  const author = document.createElement("a");
  author.href = credit.source;
  author.target = "_blank";
  author.rel = "noopener noreferrer";
  author.textContent = credit.author;
  const licence = document.createElement("a");
  licence.href = credit.licenceUrl;
  licence.target = "_blank";
  licence.rel = "noopener noreferrer";
  licence.textContent = credit.licence;
  creditLine.append(author, " · ", licence, " · cropped, colour graded and animated");
  caption.append(creditLine);

  let manualPaused = false;
  let intersecting = true;
  let waiting = Boolean(options.waiting);
  let lowPower = document.body.classList.contains("low-power");
  let control = null;
  const applyPauseState = () => {
    const paused = manualPaused || !intersecting || document.hidden || waiting || lowPower;
    root.dataset.paused = String(paused);
    root.dataset.intersecting = String(intersecting);
    if (control) {
      control.textContent = manualPaused ? "Play" : "Pause";
      control.setAttribute("aria-label", `${manualPaused ? "Play" : "Pause"} ${scene.title} animation`);
    }
  };

  if (!reduced && options.controls !== false) {
    control = document.createElement("button");
    control.type = "button";
    control.className = "st-local-scene__control";
    control.textContent = "Pause";
    control.setAttribute("aria-label", `Pause ${scene.title} animation`);
    control.addEventListener("click", () => manualPaused ? controller.play() : controller.pause());
    caption.append(control);
  }
  root.append(caption);

  const onVisibility = () => applyPauseState();
  const observer = reduced || typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
    intersecting = Boolean(entries[0]?.isIntersecting);
    applyPauseState();
  }, { threshold: 0.08 });
  const bodyObserver = reduced || typeof MutationObserver === "undefined" ? null : new MutationObserver(() => {
    lowPower = document.body.classList.contains("low-power");
    applyPauseState();
  });

  const controller = {
    element: root,
    hubId: normalizedId,
    metadata: {
      title: scene.title,
      description: scene.description,
      photoId: normalizedId,
      sourceIds: [...new Set([...scene.sourceIds, `photo:${normalizedId}`])],
      credit: { ...credit }
    },
    play() { manualPaused = false; applyPauseState(); },
    pause() { manualPaused = true; applyPauseState(); },
    setWaiting(value) { waiting = Boolean(value); applyPauseState(); },
    restart() {
      root.dataset.restart = String(Number(root.dataset.restart || 0) + 1);
      this.play();
    },
    destroy() {
      observer?.disconnect();
      bodyObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.remove();
    }
  };

  document.addEventListener("visibilitychange", onVisibility);
  observer?.observe(root);
  bodyObserver?.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  applyPauseState();
  return controller;
}

export function mountLocalizedAnimation(target, hubId, options = {}) {
  const host = typeof target === "string" ? document.querySelector(target) : target;
  if (!(host instanceof Element)) throw new TypeError("Animation target must be an Element or a valid selector.");
  const controller = createLocalizedAnimation(hubId, options);
  if (options.replace !== false) host.replaceChildren(controller.element);
  else host.append(controller.element);
  return controller;
}
