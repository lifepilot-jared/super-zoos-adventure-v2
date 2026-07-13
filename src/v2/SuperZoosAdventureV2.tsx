import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { Vector3, type Group, type Mesh } from "three";
import "./superZoosAdventureV2.css";

type Lane = -1 | 0 | 1;
type TravelMode = "ground" | "launch" | "sky" | "landing";
type HeroId = "peter" | "judy";
type SchoolZone = "entrance" | "oval" | "playground" | "court" | "canteen";
type GestureStart = { x: number; y: number; pointerId: number };
type GemState = { id: number; lane: Lane; progress: number; collected: boolean };
type RunObjectKind = "star" | "badge" | "boost" | "meteor" | "thunder" | "ice" | "barrier";
type RunObject = { id: number; kind: RunObjectKind; lane: Lane; progress: number; handled: boolean; cycle: number };

type HeroVisual = {
  name: string;
  superName: string;
  tagline: string;
  normalFrames: string[];
  superFrames: string[];
  celebrationFrame: string;
  cardFrame: string;
  fallback: string;
  accent: string;
};

type ObjectMeta = {
  label: string;
  good: boolean;
  score: number;
  jumpAvoidable?: boolean;
};

const BASE_PATH = import.meta.env.BASE_URL || "/";
const asset = (path: string) => `${BASE_PATH}${path.replace(/^\/+/, "")}`;
const LANE_X: Record<Lane, number> = { [-1]: -1.35, [0]: 0, [1]: 1.35 };
const SKY_PATTERN: Lane[] = [-1, 0, 1, 1, 0, -1, 0, 1, -1, 0];
const LANE_SEQUENCE: Lane[] = [0, -1, 1, 0, 1, -1, 0, -1, 1, 0, 1, -1];
const OBJECT_SEQUENCE: RunObjectKind[] = [
  "star",
  "meteor",
  "badge",
  "ice",
  "star",
  "thunder",
  "boost",
  "barrier",
  "star",
  "meteor",
  "badge",
  "ice",
];
const ZONES: SchoolZone[] = ["entrance", "oval", "playground", "court", "canteen"];
const ZONE_LABELS: Record<SchoolZone, string> = {
  entrance: "Front Entrance",
  oval: "School Oval",
  playground: "Adventure Playground",
  court: "Basketball Court",
  canteen: "Canteen & Hall",
};

const OBJECT_META: Record<RunObjectKind, ObjectMeta> = {
  star: { label: "Star Gem", good: true, score: 10 },
  badge: { label: "Hero Badge", good: true, score: 20 },
  boost: { label: "Super Boost", good: true, score: 25 },
  meteor: { label: "Meteor Rock", good: false, score: 4, jumpAvoidable: true },
  thunder: { label: "Thunder Spark", good: false, score: 0 },
  ice: { label: "Ice Block", good: false, score: 4, jumpAvoidable: true },
  barrier: { label: "School Barrier", good: false, score: 4, jumpAvoidable: true },
};

const HEROES: Record<HeroId, HeroVisual> = {
  peter: {
    name: "Peter",
    superName: "Super Peter",
    tagline: "Strong, brave and gentle",
    normalFrames: [1, 2, 3, 4].map((n) => asset(`images/characters/animation/peter-normal-run-0${n}.png`)),
    superFrames: [
      asset("images/characters/animation/peter-super-run-01.png"),
      asset("images/characters/animation/peter-super-turn-01.png"),
      asset("images/characters/animation/peter-super-turn-02.png"),
    ],
    celebrationFrame: asset("images/characters/animation/peter-super-run-01.png"),
    cardFrame: asset("images/characters/animation/peter-normal-run-01.png"),
    fallback: asset("images/characters/animation/peter-normal-run-01.png"),
    accent: "#2588ff",
  },
  judy: {
    name: "Judy",
    superName: "Super Judy",
    tagline: "Fast, funny and fearless",
    normalFrames: [1, 2, 3, 4].map((n) => asset(`images/characters/animation/judy-normal-run-0${n}.png`)),
    superFrames: [
      asset("images/characters/animation/judy-super-run-01.png"),
      asset("images/characters/animation/judy-super-turn-01.png"),
    ],
    celebrationFrame: asset("images/characters/animation/judy-super-run-01.png"),
    cardFrame: asset("images/characters/animation/judy-normal-run-01.png"),
    fallback: asset("images/characters/animation/judy-normal-run-01.png"),
    accent: "#f052a1",
  },
};

function makeRunObject(id: number, progress: number, cycle = 0): RunObject {
  const kind = OBJECT_SEQUENCE[(id + cycle) % OBJECT_SEQUENCE.length];
  const lane = LANE_SEQUENCE[(id * 2 + cycle) % LANE_SEQUENCE.length];
  return { id, kind, lane, progress, handled: false, cycle };
}

function makeRunObjects(): RunObject[] {
  return Array.from({ length: 10 }, (_, id) => makeRunObject(id, -0.08 - id * 0.18, 0));
}

function recycleRunObject(object: RunObject): RunObject {
  const cycle = object.cycle + 1;
  return makeRunObject(object.id, -0.36 - (object.id % 3) * 0.05, cycle);
}

const makeSkyGems = (): GemState[] => SKY_PATTERN.map((lane, index) => ({ id: index, lane, progress: -index * 0.095, collected: false }));

function CameraRig({ lane, mode, jumping }: { lane: Lane; mode: TravelMode; jumping: boolean }) {
  const { camera } = useThree();
  const position = useRef(new Vector3());
  const lookAt = useRef(new Vector3());
  useFrame((_, delta) => {
    const sky = mode === "sky";
    const targetY = sky ? 5.8 : mode === "launch" ? 5.15 : mode === "landing" ? 4.62 : jumping ? 4.7 : 4.05;
    position.current.set(lane * -0.2, targetY, sky ? 10.4 : 9.65);
    camera.position.lerp(position.current, Math.min(1, delta * 6.8));
    lookAt.current.set(lane * 0.08, sky ? 2.15 : 0.56, sky ? -9 : -13.8);
    camera.lookAt(lookAt.current);
    camera.rotation.z += (lane * -0.006 - camera.rotation.z) * Math.min(1, delta * 7);
  });
  return null;
}

function SchoolProp({ x, z, kind, speed, zone }: { x: number; z: number; kind: "tree" | "building" | "fence" | "shade" | "hoop" | "bench" | "play"; speed: number; zone: SchoolZone }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.z += delta * speed;
    if (group.current.position.z > 14) group.current.position.z -= 104;
  });
  const buildingColor = zone === "canteen" ? "#dfb36f" : zone === "entrance" ? "#d49a60" : "#d6aa70";
  return <group ref={group} position={[x, 0, z]}>
    {kind === "tree" && <>
      <mesh position={[0, 1.15, 0]} castShadow><cylinderGeometry args={[0.16, 0.27, 2.3, 10]} /><meshStandardMaterial color="#765034" /></mesh>
      <mesh position={[0, 2.52, 0]} castShadow><sphereGeometry args={[1.02, 16, 12]} /><meshStandardMaterial color="#477f55" /></mesh>
      <mesh position={[0.62, 2.38, 0]} castShadow><sphereGeometry args={[0.68, 14, 10]} /><meshStandardMaterial color="#5b9965" /></mesh>
    </>}
    {kind === "building" && <group>
      <mesh position={[0, 1.3, 0]} castShadow receiveShadow><boxGeometry args={[5.2, 2.6, 2.2]} /><meshStandardMaterial color={buildingColor} roughness={0.9} /></mesh>
      <mesh position={[0, 2.75, 0]} rotation={[0, 0, Math.PI / 4]} castShadow><boxGeometry args={[3.65, 3.65, 2.25]} /><meshStandardMaterial color="#a95a42" /></mesh>
      {[-1.65, -0.55, 0.55, 1.65].map((windowX) => <mesh key={windowX} position={[windowX, 1.4, 1.12]}><boxGeometry args={[0.62, 0.76, 0.05]} /><meshStandardMaterial color="#9ed6e6" /></mesh>)}
    </group>}
    {kind === "fence" && <group>
      {[-1.5, -0.9, -0.3, 0.3, 0.9, 1.5].map((postX) => <mesh key={postX} position={[postX, 0.7, 0]}><boxGeometry args={[0.1, 1.4, 0.1]} /><meshStandardMaterial color="#efe8d7" /></mesh>)}
      <mesh position={[0, 0.92, 0]}><boxGeometry args={[3.4, 0.1, 0.1]} /><meshStandardMaterial color="#efe8d7" /></mesh>
    </group>}
    {kind === "shade" && <group>
      <mesh position={[0, 2.5, 0]} rotation={[-0.12, 0, 0]}><boxGeometry args={[4.2, 0.12, 3]} /><meshStandardMaterial color="#ec7d3d" /></mesh>
      {[-1.7, 1.7].map((postX) => <mesh key={postX} position={[postX, 1.2, 0]}><cylinderGeometry args={[0.08, 0.08, 2.4, 8]} /><meshStandardMaterial color="#566573" /></mesh>)}
    </group>}
    {kind === "hoop" && <group>
      <mesh position={[0, 1.75, 0]}><cylinderGeometry args={[0.08, 0.08, 3.5, 8]} /><meshStandardMaterial color="#5b6670" /></mesh>
      <mesh position={[0, 3.25, 0.24]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.46, 0.07, 10, 24]} /><meshStandardMaterial color="#e65a2f" /></mesh>
      <mesh position={[0, 3.42, 0]}><boxGeometry args={[1.45, 0.86, 0.08]} /><meshStandardMaterial color="#f5f2e8" /></mesh>
    </group>}
    {kind === "bench" && <group>
      <mesh position={[0, 0.7, 0]}><boxGeometry args={[2.5, 0.18, 0.42]} /><meshStandardMaterial color="#a97045" /></mesh>
      {[-0.9, 0.9].map((postX) => <mesh key={postX} position={[postX, 0.32, 0]}><boxGeometry args={[0.16, 0.7, 0.16]} /><meshStandardMaterial color="#6c4a33" /></mesh>)}
    </group>}
    {kind === "play" && <group>
      <mesh position={[0, 1.1, 0]} rotation={[0.45, 0, 0]}><boxGeometry args={[2.3, 0.16, 2.8]} /><meshStandardMaterial color="#f0be45" /></mesh>
      <mesh position={[-1.2, 0.7, 0]}><cylinderGeometry args={[0.08, 0.08, 1.4, 8]} /><meshStandardMaterial color="#3e80c4" /></mesh>
      <mesh position={[1.2, 0.7, 0]}><cylinderGeometry args={[0.08, 0.08, 1.4, 8]} /><meshStandardMaterial color="#3e80c4" /></mesh>
    </group>}
  </group>;
}

function RouteMarkers({ speed }: { speed: number }) {
  const refs = useRef<Mesh[]>([]);
  useFrame((_, delta) => {
    refs.current.forEach((marker) => {
      marker.position.z += delta * speed;
      if (marker.position.z > 8) marker.position.z -= 86;
    });
  });
  return <>{Array.from({ length: 26 }, (_, index) => [-0.92, 0.92].map((x, laneIndex) => <mesh
    key={`${index}-${laneIndex}`}
    ref={(node) => { if (node) refs.current[index * 2 + laneIndex] = node; }}
    position={[x, 0.026, -index * 3.35]}
    rotation={[-Math.PI / 2, 0, 0]}
  ><planeGeometry args={[0.07, 1.2]} /><meshStandardMaterial color="#f5f0df" transparent opacity={0.72} /></mesh>))}</>;
}

function Trampoline({ progress }: { progress: number }) {
  return <group position={[0, 0.16, -38 + progress * 42]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[2.15, 2.15, 0.18, 36]} /><meshStandardMaterial color="#257bd8" metalness={0.14} roughness={0.42} /></mesh>
    <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.78, 36]} /><meshStandardMaterial color="#ffda3f" emissive="#df7d00" emissiveIntensity={0.36} /></mesh>
  </group>;
}

function RunObjectMesh({ object }: { object: RunObject }) {
  if (object.handled || object.progress < -0.15) return null;
  const x = LANE_X[object.lane];
  const z = -43 + object.progress * 51;
  const meta = OBJECT_META[object.kind];
  const good = meta.good;
  const y = good ? 1.35 + Math.sin(object.progress * 8) * 0.12 : 0.55;
  return <group position={[x, y, z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, good ? -1.05 : -0.48, 0]}>
      <torusGeometry args={[good ? 0.58 : 0.72, good ? 0.045 : 0.065, 8, 32]} />
      <meshStandardMaterial color={good ? "#ffe36e" : "#ff332e"} emissive={good ? "#ffb200" : "#d80f16"} emissiveIntensity={good ? 0.48 : 0.78} transparent opacity={good ? 0.72 : 0.86} />
    </mesh>
    {!good && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 0]}><circleGeometry args={[0.92, 36]} /><meshStandardMaterial color="#ff2a2a" emissive="#a30000" emissiveIntensity={0.34} transparent opacity={0.24} /></mesh>}
    {object.kind === "star" && <>
      <mesh rotation={[object.progress * 5, object.progress * 7, 0]} castShadow><octahedronGeometry args={[0.5, 0]} /><meshStandardMaterial color="#ffe25b" emissive="#ffaf18" emissiveIntensity={0.95} metalness={0.18} roughness={0.18} /></mesh>
      <pointLight color="#ffd45d" intensity={1.15} distance={3.4} />
    </>}
    {object.kind === "badge" && <>
      <mesh castShadow><cylinderGeometry args={[0.5, 0.5, 0.16, 6]} /><meshStandardMaterial color="#2f9df3" emissive="#1c73d2" emissiveIntensity={0.75} metalness={0.2} /></mesh>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.6, 0.055, 8, 28]} /><meshStandardMaterial color="#ffffff" emissive="#6fe0ff" emissiveIntensity={0.5} /></mesh>
      <pointLight color="#62cfff" intensity={1.1} distance={3.3} />
    </>}
    {object.kind === "boost" && <>
      <mesh rotation={[0, object.progress * 7, 0]} castShadow><coneGeometry args={[0.48, 0.95, 5]} /><meshStandardMaterial color="#46f0e0" emissive="#10a9df" emissiveIntensity={0.82} metalness={0.25} /></mesh>
      <mesh position={[0, -0.35, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.48, 0.05, 8, 24]} /><meshStandardMaterial color="#ffffff" emissive="#4be8ff" emissiveIntensity={0.68} /></mesh>
    </>}
    {object.kind === "meteor" && <>
      <mesh rotation={[0.5, object.progress * 8, 0.2]} castShadow><dodecahedronGeometry args={[0.62, 0]} /><meshStandardMaterial color="#8a352c" emissive="#ef5b2f" emissiveIntensity={0.52} roughness={0.9} /></mesh>
      <mesh position={[0.18, 0.13, -0.1]}><sphereGeometry args={[0.2, 10, 8]} /><meshStandardMaterial color="#ffb14a" emissive="#ff6c22" emissiveIntensity={0.9} /></mesh>
    </>}
    {object.kind === "thunder" && <>
      <mesh rotation={[0, 0, 0.62]} castShadow><boxGeometry args={[0.24, 1.12, 0.24]} /><meshStandardMaterial color="#ffdc45" emissive="#ff342f" emissiveIntensity={0.92} /></mesh>
      <mesh rotation={[0, 0, -0.62]} position={[0.3, -0.06, 0]} castShadow><boxGeometry args={[0.24, 1.12, 0.24]} /><meshStandardMaterial color="#ff5f3d" emissive="#e8242e" emissiveIntensity={0.88} /></mesh>
      <pointLight color="#ff5a42" intensity={1.3} distance={3.6} />
    </>}
    {object.kind === "ice" && <>
      <mesh castShadow><boxGeometry args={[0.95, 0.88, 0.86]} /><meshStandardMaterial color="#9eeaff" emissive="#52c6e8" emissiveIntensity={0.42} roughness={0.18} transparent opacity={0.78} /></mesh>
      <mesh position={[0, 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.56, 0.055, 8, 28]} /><meshStandardMaterial color="#ff332e" emissive="#d80f16" emissiveIntensity={0.8} /></mesh>
    </>}
    {object.kind === "barrier" && <>
      <mesh position={[0, 0.15, 0]} castShadow><boxGeometry args={[1.18, 0.28, 0.34]} /><meshStandardMaterial color="#f06b3b" emissive="#b53320" emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, 0.18, 0.18]}><boxGeometry args={[0.98, 0.08, 0.06]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.12} /></mesh>
      {[-0.44, 0.44].map((postX) => <mesh key={postX} position={[postX, -0.25, 0]}><boxGeometry args={[0.14, 0.7, 0.14]} /><meshStandardMaterial color="#ffffff" /></mesh>)}
    </>}
  </group>;
}

function GemMesh({ gem }: { gem: GemState }) {
  if (gem.collected) return null;
  return <group position={[LANE_X[gem.lane], 3.05 + Math.sin(gem.id * 0.9) * 0.42, -28 + gem.progress * 33]} rotation={[0, gem.progress * 5, gem.progress * 2]}>
    <mesh><torusGeometry args={[0.42, 0.13, 12, 28]} /><meshStandardMaterial color="#ffd73f" emissive="#ff9d00" emissiveIntensity={0.85} metalness={0.22} roughness={0.25} /></mesh>
    <pointLight color="#ffd45d" intensity={1.05} distance={3.2} />
  </group>;
}

function ZoneScenery({ zone, speed }: { zone: SchoolZone; speed: number }) {
  if (zone === "playground") return <><SchoolProp x={-11.6} z={-30} kind="shade" speed={speed * 0.82} zone={zone} /><SchoolProp x={11.3} z={-50} kind="play" speed={speed * 0.82} zone={zone} /></>;
  if (zone === "court") return <><SchoolProp x={-11.0} z={-30} kind="hoop" speed={speed * 0.9} zone={zone} /><SchoolProp x={11.0} z={-54} kind="hoop" speed={speed * 0.9} zone={zone} /></>;
  if (zone === "canteen" || zone === "entrance") return <><SchoolProp x={-13.0} z={-36} kind="building" speed={speed * 0.76} zone={zone} /><SchoolProp x={13.0} z={-62} kind="building" speed={speed * 0.76} zone={zone} /></>;
  return <><SchoolProp x={-11.2} z={-25} kind="fence" speed={speed} zone={zone} /><SchoolProp x={11.2} z={-50} kind="bench" speed={speed} zone={zone} /></>;
}

function Scene({ mode, lane, jumping, trampolineProgress, gems, zone, objects }: { mode: TravelMode; lane: Lane; jumping: boolean; trampolineProgress: number; gems: GemState[]; zone: SchoolZone; objects: RunObject[] }) {
  const speed = mode === "sky" ? 12.2 : 9.25;
  const roadColor = zone === "court" ? "#55707d" : zone === "playground" ? "#655f5b" : "#4c5961";
  return <>
    <CameraRig lane={lane} mode={mode} jumping={jumping} />
    <color attach="background" args={[mode === "sky" ? "#63c6ff" : "#8fd5ee"]} />
    <fog attach="fog" args={[mode === "sky" ? "#bceaff" : "#c8e1e8", 21, 76]} />
    <ambientLight intensity={1.14} />
    <directionalLight position={[7, 13, 8]} intensity={2.25} castShadow />
    <hemisphereLight color="#d8f4ff" groundColor="#49664d" intensity={0.68} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -30]} receiveShadow><planeGeometry args={[26, 108]} /><meshStandardMaterial color="#3f7449" roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -30]} receiveShadow><planeGeometry args={[6.2, 108]} /><meshStandardMaterial color={roadColor} roughness={0.97} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.25, 0.018, -30]}><planeGeometry args={[0.08, 108]} /><meshStandardMaterial color="#dce4e7" transparent opacity={0.5} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.25, 0.018, -30]}><planeGeometry args={[0.08, 108]} /><meshStandardMaterial color="#dce4e7" transparent opacity={0.5} /></mesh>
    <RouteMarkers speed={speed} />
    {Array.from({ length: 12 }, (_, i) => <SchoolProp key={`lt-${i}`} x={-10.8 - (i % 2) * 1.25} z={-i * 7.7 - 4} kind="tree" speed={speed * 0.9} zone={zone} />)}
    {Array.from({ length: 12 }, (_, i) => <SchoolProp key={`rt-${i}`} x={10.8 + (i % 2) * 1.25} z={-i * 7.7 - 7} kind="tree" speed={speed * 0.9} zone={zone} />)}
    <ZoneScenery zone={zone} speed={speed} />
    {mode === "ground" && objects.map((object) => <RunObjectMesh key={`${object.id}-${object.cycle}`} object={object} />)}
    {mode === "ground" && <Trampoline progress={trampolineProgress} />}
    {mode === "sky" && gems.map((gem) => <GemMesh key={gem.id} gem={gem} />)}
  </>;
}

function CharacterOverlay({ hero, lane, mode, jumping, celebrating, shielded }: { hero: HeroId; lane: Lane; mode: TravelMode; jumping: boolean; celebrating: boolean; shielded: boolean }) {
  const visual = HEROES[hero];
  const frames = mode === "ground" ? visual.normalFrames : visual.superFrames;
  const [frameIndex, setFrameIndex] = useState(0);
  const [src, setSrc] = useState(frames[0]);
  useEffect(() => {
    setFrameIndex(0);
    setSrc(frames[0]);
    if (celebrating) return;
    const timer = window.setInterval(() => setFrameIndex((value) => (value + 1) % frames.length), mode === "sky" ? 145 : 110);
    return () => window.clearInterval(timer);
  }, [frames, mode, celebrating]);
  useEffect(() => setSrc(celebrating ? visual.celebrationFrame : (frames[frameIndex] ?? frames[0])), [celebrating, frameIndex, frames, visual.celebrationFrame]);
  return <div className={`v2-character hero-${hero} travel-${mode} ${jumping ? "is-jumping" : ""} ${celebrating ? "is-celebrating" : ""} ${shielded ? "is-shielded" : ""}`} style={{ "--lane": lane, "--hero-accent": visual.accent } as CSSProperties} aria-label={`${visual.name} running`}>
    <div className="v2-character-glow" /><img src={src} alt="" onError={() => setSrc(visual.fallback)} draggable={false} /><div className="v2-character-shadow" />
  </div>;
}

function StartScreen({ selectedHero, onSelectHero, onStart }: { selectedHero: HeroId; onSelectHero: (hero: HeroId) => void; onStart: () => void }) {
  return <div className="v2-start-screen">
    <div className="v2-start-panel">
      <span className="v2-start-kicker">SUPER ZOOS ADVENTURE</span>
      <h2>Choose your hero</h2>
      <p>Gold and blue items are good. Red warning rings are danger. Stay on the road and rescue the school sky gems.</p>
      <div className="v2-hero-cards">
        {(Object.keys(HEROES) as HeroId[]).map((id) => {
          const hero = HEROES[id];
          const selected = id === selectedHero;
          return <button type="button" key={id} className={`v2-hero-card ${selected ? "is-selected" : ""}`} onClick={() => onSelectHero(id)} style={{ "--hero-accent": hero.accent } as CSSProperties}>
            <img src={hero.cardFrame} alt={hero.name} draggable={false} />
            <strong>{hero.name}</strong>
            <span>{hero.tagline}</span>
          </button>;
        })}
      </div>
      <button type="button" className="v2-start-button" onClick={onStart}>Start Adventure</button>
    </div>
  </div>;
}

function EndScreen({ hero, score, gems, onRestart, onChoose }: { hero: HeroId; score: number; gems: number; onRestart: () => void; onChoose: () => void }) {
  return <div className="v2-start-screen v2-end-screen">
    <div className="v2-start-panel">
      <span className="v2-start-kicker">GREAT TRY</span>
      <h2>{HEROES[hero].name} is ready again</h2>
      <p>Score {score} • Gems {gems}. Try another run and look for the blue hero badges.</p>
      <div className="v2-end-actions">
        <button type="button" className="v2-start-button" onClick={onRestart}>Try Again</button>
        <button type="button" className="v2-secondary-button" onClick={onChoose}>Choose Hero</button>
      </div>
    </div>
  </div>;
}

export function SuperZoosAdventureV2() {
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [hero, setHero] = useState<HeroId>("peter");
  const [lane, setLane] = useState<Lane>(0);
  const laneRef = useRef<Lane>(0);
  const [jumping, setJumping] = useState(false);
  const jumpingRef = useRef(false);
  const [mode, setMode] = useState<TravelMode>("ground");
  const [bonusScore, setBonusScore] = useState(0);
  const [gemCount, setGemCount] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [shielded, setShielded] = useState(false);
  const shieldRef = useRef(false);
  const [distance, setDistance] = useState(0);
  const distanceRef = useRef(0);
  const [trampolineProgress, setTrampolineProgress] = useState(0);
  const [objects, setObjects] = useState<RunObject[]>(makeRunObjects);
  const [gems, setGems] = useState<GemState[]>(makeSkyGems);
  const [celebrating, setCelebrating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const gestureRef = useRef<GestureStart | null>(null);
  const celebrationTimer = useRef<number | null>(null);
  const feedbackTimer = useRef<number | null>(null);
  const shieldTimer = useRef<number | null>(null);
  const zone = useMemo(() => ZONES[Math.floor(distance / 170) % ZONES.length] ?? "entrance", [distance]);
  const totalScore = Math.floor(distance / 5) + bonusScore;

  useEffect(() => { laneRef.current = lane; }, [lane]);
  useEffect(() => { jumpingRef.current = jumping; }, [jumping]);
  useEffect(() => { shieldRef.current = shielded; }, [shielded]);

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(""), 1100);
  }, []);

  const triggerShield = useCallback(() => {
    setShielded(true);
    shieldRef.current = true;
    if (shieldTimer.current) window.clearTimeout(shieldTimer.current);
    shieldTimer.current = window.setTimeout(() => {
      shieldRef.current = false;
      setShielded(false);
    }, 3600);
  }, []);

  const resetRun = useCallback(() => {
    setLane(0);
    laneRef.current = 0;
    setJumping(false);
    jumpingRef.current = false;
    setMode("ground");
    setBonusScore(0);
    setGemCount(0);
    setHearts(3);
    setShielded(false);
    shieldRef.current = false;
    setDistance(0);
    distanceRef.current = 0;
    setTrampolineProgress(0);
    setObjects(makeRunObjects());
    setGems(makeSkyGems());
    setCelebrating(false);
    setFeedback("");
    setGameOver(false);
    if (shieldTimer.current) window.clearTimeout(shieldTimer.current);
  }, []);

  const startRun = () => {
    resetRun();
    setStarted(true);
  };

  useEffect(() => {
    if (!started || gameOver) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.04, (now - previous) / 1000);
      previous = now;
      if (mode === "ground") {
        setDistance((value) => {
          const next = value + dt * 40;
          distanceRef.current = next;
          return next;
        });
        setTrampolineProgress((value) => {
          const next = value + dt * 0.052;
          if (next >= 0.985) {
            window.setTimeout(() => setMode("launch"), 0);
            return 0;
          }
          return next;
        });
        setObjects((current) => current.map((object) => {
          const speed = 0.205 + Math.min(distanceRef.current / 4200, 0.045);
          const nextProgress = object.progress + dt * speed;
          if (nextProgress > 1.12) return recycleRunObject(object);
          if (!object.handled && nextProgress >= 0.78 && nextProgress <= 0.96 && object.lane === laneRef.current) {
            const meta = OBJECT_META[object.kind];
            if (meta.good) {
              setBonusScore((value) => value + meta.score);
              setGemCount((value) => value + 1);
              setCelebrating(true);
              if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current);
              celebrationTimer.current = window.setTimeout(() => setCelebrating(false), 360);
              if (object.kind === "badge" || object.kind === "boost") triggerShield();
              showFeedback(`${meta.label} +${meta.score}`);
              return { ...object, progress: nextProgress, handled: true };
            }
            if (shieldRef.current) {
              setBonusScore((value) => value + 6);
              showFeedback("Shield blocked danger! +6");
              return { ...object, progress: nextProgress, handled: true };
            }
            if (meta.jumpAvoidable && jumpingRef.current) {
              setBonusScore((value) => value + meta.score);
              showFeedback(`Great jump +${meta.score}`);
              return { ...object, progress: nextProgress, handled: true };
            }
            showFeedback("Careful! Heart lost");
            setHearts((value) => {
              const next = Math.max(0, value - 1);
              if (next === 0) {
                setGameOver(true);
                setStarted(false);
              }
              return next;
            });
            return { ...object, progress: nextProgress, handled: true };
          }
          return { ...object, progress: nextProgress };
        }));
      } else if (mode === "sky") {
        setDistance((value) => {
          const next = value + dt * 58;
          distanceRef.current = next;
          return next;
        });
        setGems((current) => current.map((gem) => {
          if (gem.collected) return gem;
          const nextProgress = gem.progress + dt * 0.34;
          if (nextProgress >= 0.83 && nextProgress <= 0.99 && gem.lane === laneRef.current) {
            setBonusScore((value) => value + 10);
            setGemCount((value) => value + 1);
            setCelebrating(true);
            if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current);
            celebrationTimer.current = window.setTimeout(() => setCelebrating(false), 360);
            showFeedback("Sky gem +10");
            return { ...gem, progress: nextProgress, collected: true };
          }
          return { ...gem, progress: nextProgress, collected: nextProgress > 1.08 };
        }));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, started, gameOver, showFeedback, triggerShield]);

  useEffect(() => {
    if (!started || mode !== "launch") return;
    setGems(makeSkyGems());
    const toSky = window.setTimeout(() => setMode("sky"), 600);
    const toLanding = window.setTimeout(() => setMode("landing"), 4100);
    const toGround = window.setTimeout(() => {
      setMode("ground");
      setTrampolineProgress(0);
      setGems(makeSkyGems());
      setObjects(makeRunObjects());
    }, 4900);
    return () => {
      window.clearTimeout(toSky);
      window.clearTimeout(toLanding);
      window.clearTimeout(toGround);
    };
  }, [mode, started]);

  useEffect(() => () => {
    if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    if (shieldTimer.current) window.clearTimeout(shieldTimer.current);
  }, []);

  const stepLane = (direction: -1 | 1) => {
    if (!started) return;
    setLane((current) => Math.max(-1, Math.min(1, current + direction)) as Lane);
  };

  const jump = () => {
    if (!started || mode !== "ground" || jumping) return;
    setJumping(true);
    window.setTimeout(() => setJumping(false), 760);
  };

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!started) return;
    event.preventDefault();
    gestureRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Safari fallback */ }
  };

  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!started) return;
    event.preventDefault();
    const start = gestureRef.current;
    gestureRef.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 0.65) {
      stepLane(dx > 0 ? 1 : -1);
      return;
    }
    if (dy < -36 || Math.abs(dx) < 16) jump();
  };

  const transientMessage = feedback || (mode === "launch"
    ? `${HEROES[hero].superName.toUpperCase()} LAUNCH!`
    : mode === "landing"
      ? "Safe landing!"
      : "");

  return <main className={`v2-app mode-${mode} ${started ? "is-running" : "is-starting"} ${shielded ? "has-shield" : ""}`}>
    <header className="v2-hud">
      <div><span className="v2-kicker">SUPER ZOOS ADVENTURE V2.1B</span><h1>School Sky Rescue</h1></div>
      <div className="v2-hud-right">
        <span className="v2-zone">{ZONE_LABELS[zone]}</span>
        <span className="v2-hearts" aria-label={`${hearts} hearts`}>{[0, 1, 2].map((index) => <span key={index} className={index < hearts ? "" : "heart-off"}>♥</span>)}</span>
        <span className="v2-score">Gems {gemCount}</span>
        <span className="v2-score">Score {totalScore}</span>
        <span className="v2-status">{shielded ? "Shield" : started ? (mode === "sky" ? "Sky Run" : mode === "launch" ? "Launch" : mode === "landing" ? "Landing" : HEROES[hero].name) : "Choose Hero"}</span>
      </div>
    </header>
    <section className="v2-stage" onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={() => { gestureRef.current = null; }} aria-label="Swipe left or right to move. Swipe up or tap to jump.">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 4.05, 9.65], fov: 45 }}><Scene mode={mode} lane={lane} jumping={jumping} trampolineProgress={trampolineProgress} gems={gems} zone={zone} objects={objects} /></Canvas>
      {started && <CharacterOverlay hero={hero} lane={lane} mode={mode} jumping={jumping} celebrating={celebrating} shielded={shielded} />}
      {!started && !gameOver && <StartScreen selectedHero={hero} onSelectHero={setHero} onStart={startRun} />}
      {gameOver && <EndScreen hero={hero} score={totalScore} gems={gemCount} onRestart={startRun} onChoose={() => { resetRun(); setStarted(false); }} />}
      {transientMessage && <div className="v2-message">{transientMessage}</div>}
      <div className="v2-trampoline-meter" aria-hidden="true"><span style={{ width: `${trampolineProgress * 100}%` }} /></div>
    </section>
    <nav className="v2-controls" aria-label="Game controls" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => stepLane(-1)} disabled={!started}>Left</button>
      <button type="button" onClick={() => stepLane(1)} disabled={!started}>Right</button>
      <button type="button" className="jump" onClick={jump} disabled={!started || mode !== "ground"}>Jump</button>
      <button type="button" className="hero-switch" onClick={() => { resetRun(); setStarted(false); }}>{started ? "Restart" : "Choose"}</button>
    </nav>
  </main>;
}
