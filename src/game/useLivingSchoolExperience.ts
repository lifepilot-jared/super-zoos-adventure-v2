import { useEffect } from "react";

const WORLD_CLASS = "living-school-world-v10";
const ZONES = ["oval", "court", "playground", "canteen"] as const;
type SchoolZone = (typeof ZONES)[number];
type Side = "left" | "right";
type PropKind =
  | "gum-tree"
  | "fence-panel"
  | "school-sign"
  | "bench"
  | "basketball-hoop"
  | "play-tower"
  | "shade-sail"
  | "drink-fountain";

type MotionState = {
  distance: number;
  lastTime: number;
  zone: SchoolZone;
};

const motionStates = new WeakMap<Element, MotionState>();

function makeElement(className: string, text?: string): HTMLDivElement {
  const element = document.createElement("div");
  element.className = className;
  if (text) element.textContent = text;
  element.setAttribute("aria-hidden", "true");
  return element;
}

function addCampusBuilding(layer: HTMLElement, className: string, label: string): void {
  const building = makeElement(`campus-building-v10 ${className}`);
  building.append(
    makeElement("campus-roof-v10"),
    makeElement("campus-windows-v10"),
    makeElement("campus-label-v10", label),
  );
  layer.append(building);
}

function propLabel(kind: PropKind, side: Side, index: number): string | undefined {
  if (kind !== "school-sign") return undefined;
  const labels = side === "left"
    ? ["OVAL", "CANTEEN", "LIBRARY"]
    : ["PLAYGROUND", "COURT", "HALL"];
  return labels[index % labels.length];
}

function addPassingRoute(layer: HTMLElement, side: Side): void {
  const sequence: PropKind[] = [
    "gum-tree",
    "fence-panel",
    "school-sign",
    "bench",
    "gum-tree",
    "basketball-hoop",
    "shade-sail",
    "play-tower",
    "drink-fountain",
    "fence-panel",
    "gum-tree",
    "school-sign",
  ];

  sequence.forEach((kind, index) => {
    const prop = makeElement(
      `route-prop-v10 prop-${kind}-v10 route-${side}-v10`,
      propLabel(kind, side, index),
    );
    prop.dataset.routeSide = side;
    prop.dataset.routePhase = String(index / sequence.length + (side === "right" ? 0.04 : 0));
    layer.append(prop);
  });
}

function buildWorld(stage: Element): void {
  if (stage.querySelector(`.${WORLD_CLASS}`)) return;

  stage.querySelectorAll("[class*='living-school-world-v0']").forEach((node) => node.remove());

  const world = makeElement(WORLD_CLASS);

  const sky = makeElement("campus-sky-v10");
  sky.append(
    makeElement("cloud-bank-v10 cloud-bank-one-v10"),
    makeElement("cloud-bank-v10 cloud-bank-two-v10"),
    makeElement("school-flag-v10"),
  );

  const far = makeElement("campus-layer-v10 campus-far-v10");
  addCampusBuilding(far, "campus-canteen-v10", "CANTEEN");
  addCampusBuilding(far, "campus-hall-v10", "SCHOOL HALL");
  addCampusBuilding(far, "campus-library-v10", "LIBRARY");
  far.append(
    makeElement("oval-scoreboard-v10", "SUPER ZOOS OVAL"),
    makeElement("distant-gums-v10 distant-gums-left-v10"),
    makeElement("distant-gums-v10 distant-gums-right-v10"),
  );

  const mid = makeElement("campus-layer-v10 campus-mid-v10");
  mid.append(
    makeElement("court-zone-v10"),
    makeElement("court-hoop-v10"),
    makeElement("playground-zone-v10"),
    makeElement("playground-tower-v10"),
    makeElement("playground-slide-v10"),
    makeElement("shade-sails-v10"),
    makeElement("oval-fence-left-v10"),
    makeElement("oval-fence-right-v10"),
  );

  const ground = makeElement("campus-layer-v10 campus-ground-v10");
  ground.append(
    makeElement("oval-grass-v10"),
    makeElement("oval-lane-grid-v10"),
    makeElement("oval-edge-v10 oval-edge-left-v10"),
    makeElement("oval-edge-v10 oval-edge-right-v10"),
    makeElement("foreground-blur-v10 foreground-blur-left-v10"),
    makeElement("foreground-blur-v10 foreground-blur-right-v10"),
  );

  const route = makeElement("campus-layer-v10 campus-route-v10");
  addPassingRoute(route, "left");
  addPassingRoute(route, "right");

  const eventLayer = makeElement("campus-layer-v10 campus-event-v10");
  eventLayer.append(
    makeElement("school-zone-label-v11", "SCHOOL OVAL"),
    makeElement("winnie-action-banner-v10", "THUNDER WINNIE MADE A RED RIPPLE!"),
  );

  world.append(sky, far, mid, ground, route, eventLayer);
  stage.prepend(world);
  stage.classList.add("school-route-v10-active", "school-zone-v11-oval", "school-motion-v12");
  stage.setAttribute("data-school-zone", "oval");
  motionStates.set(stage, { distance: 0, lastTime: performance.now(), zone: "oval" });
}

function applyZone(stage: Element, zone: SchoolZone): void {
  ZONES.forEach((name) => stage.classList.remove(`school-zone-v11-${name}`));
  stage.classList.add(`school-zone-v11-${zone}`);
  stage.setAttribute("data-school-zone", zone);

  const label = stage.querySelector<HTMLElement>(".school-zone-label-v11");
  if (label) {
    label.textContent = {
      oval: "SCHOOL OVAL",
      court: "BASKETBALL COURT",
      playground: "PLAYGROUND RUN",
      canteen: "CANTEEN & HALL",
    }[zone];
    label.classList.remove("zone-label-show-v12");
    void label.offsetWidth;
    label.classList.add("zone-label-show-v12");
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function readPlayerLane(stage: Element): number {
  const runner = stage.querySelector<HTMLElement>(".hero-runner");
  const left = Number.parseFloat(runner?.style.left ?? "50");
  return clamp((left - 50) / 25.5, -1, 1);
}

function updateStageMotion(stage: Element, now: number): void {
  const state = motionStates.get(stage) ?? { distance: 0, lastTime: now, zone: "oval" as SchoolZone };
  const playing = Boolean(stage.querySelector(".pause-button")) && !stage.querySelector(".overlay");
  const deltaSeconds = Math.min(0.05, Math.max(0, (now - state.lastTime) / 1000));
  state.lastTime = now;

  stage.classList.toggle("school-motion-running-v12", playing);

  if (playing) {
    // Distance is the single source of truth for scenery, route zones and ground flow.
    state.distance += deltaSeconds * 0.235;
  }

  const zoneIndex = Math.floor(state.distance / 2.15) % ZONES.length;
  const zone = ZONES[zoneIndex];
  if (zone !== state.zone) {
    state.zone = zone;
    applyZone(stage, zone);
  }

  const world = stage.querySelector<HTMLElement>(`.${WORLD_CLASS}`);
  const route = stage.querySelector<HTMLElement>(".campus-route-v10");
  const ground = stage.querySelector<HTMLElement>(".campus-ground-v10");
  const lane = readPlayerLane(stage);

  const zoneCamera = {
    oval: { x: 0, rotate: 0, scale: 1 },
    court: { x: 2.7, rotate: 0.72, scale: 1.018 },
    playground: { x: -2.7, rotate: -0.72, scale: 1.018 },
    canteen: { x: 0, rotate: 0, scale: 1.03 },
  }[zone];

  if (world) {
    const laneBank = lane * -1.15;
    world.style.transform = `translateX(${zoneCamera.x + laneBank}%) rotateZ(${zoneCamera.rotate - lane * 0.22}deg) scale(${zoneCamera.scale})`;
  }
  if (route) route.style.transform = `translateX(${-lane * 0.8}%)`;
  if (ground) ground.style.transform = `translateX(${-lane * 0.45}%) skewX(${lane * 0.35}deg)`;

  stage.querySelectorAll<HTMLElement>(".route-prop-v10").forEach((prop) => {
    const basePhase = Number.parseFloat(prop.dataset.routePhase ?? "0");
    const phase = (state.distance + basePhase) % 1;
    const side = prop.dataset.routeSide === "left" ? -1 : 1;
    const approach = Math.pow(phase, 1.58);
    const x = 50 + side * (7 + approach * 51);
    const y = 38 + Math.pow(phase, 1.72) * 65;
    const scale = 0.15 + Math.pow(phase, 1.78) * 2.95;
    const fadeIn = clamp(phase / 0.08, 0, 1);
    const fadeOut = clamp((1 - phase) / 0.13, 0, 1);

    prop.style.left = `${x}%`;
    prop.style.top = `${y}%`;
    prop.style.opacity = String(Math.min(fadeIn, fadeOut));
    prop.style.transform = `translate(-50%, -100%) scale(${scale})`;
    prop.style.zIndex = String(Math.round(6 + phase * 20));
  });

  const groundOffset = Math.round((state.distance * 980) % 760);
  stage.querySelectorAll<HTMLElement>(".oval-lane-grid-v10, .oval-edge-v10, .foreground-blur-v10").forEach((element) => {
    element.style.backgroundPositionY = `${groundOffset}px`;
  });

  const hasWinnie = Boolean(stage.querySelector(".doctor-winnie-cameo"));
  stage.classList.toggle("winnie-event-active-v10", hasWinnie);
  motionStates.set(stage, state);
}

export function useLivingSchoolExperience(): void {
  useEffect(() => {
    function refresh(): void {
      document.querySelectorAll(".school-stage").forEach((stage) => buildWorld(stage));
    }

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });

    let frame = 0;
    function animate(now: number): void {
      document.querySelectorAll(".school-stage.school-route-v10-active").forEach((stage) => updateStageMotion(stage, now));
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
}
