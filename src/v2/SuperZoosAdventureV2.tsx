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
const LANE_X: Record<Lane, number> = { [-1]: -2.15, [0]: 0, [1]: 2.15 };
const SKY_PATTERN: Lane[] = [-1, 0, 1, 1, 0, -1, 0, 1, -1, 0];
const LANE_SEQUENCE: Lane[] = [-1, 0, 1, 0, -1, 1, 0, 1, -1];
const OBJECT_SEQUENCE: RunObjectKind[] = ["star", "meteor", "badge", "ice", "star", "thunder", "boost", "barrier", "star", "meteor", "badge", "ice"];
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

const makeSkyGems = (): GemState[] => SKY_PATTERN.map((lane, index) => ({ id: index, lane, progress: -index * 0.095, collected: false }));

const recycleRunObject = (object: RunObject): RunObject => {
  const nextCycle = object.cycle + 1;
  return {
    id: object.id,
    cycle: nextCycle,
    kind: OBJECT_SEQUENCE[(object.id + nextCycle) % OBJECT_SEQUENCE.length],
    lane: LANE_SEQUENCE[(object.id * 2 + nextCycle) % LANE_SEQUENCE.length],
    progress: -0.22 - ((object.id + nextCycle) % 5) * 0.17,
    handled: false,
  };
};

const makeRunObjects = (): RunObject[] => Array.from({ length: 10 }, (_, id) => ({
  id,
  cycle: 0,
  kind: OBJECT_SEQUENCE[id % OBJECT_SEQUENCE.length],
  lane: LANE_SEQUENCE[id % LANE_SEQUENCE.length],
  progress: -0.18 - id * 0.16,
  handled: false,
}));

function CameraRig({ lane, mode, jumping }: { lane: Lane; mode: TravelMode; jumping: boolean }) {
  const { camera } = useThree();
  const position = useRef(new Vector3());
  const lookAt = useRef(new Vector3());
  useFrame((_, delta) => {
    const sky = mode === "sky";
    const targetY = sky ? 5.9 : mode === "launch" ? 5.25 : mode === "landing" ? 4.7 : jumping ? 4.9 : 4.18;
    position.current.set(lane * -0.35, targetY, sky ? 10.4 : 10.25);
    camera.position.lerp(position.current, Math.min(1, delta * 6.5));
    lookAt.current.set(lane * 0.12, sky ? 2.2 : 0.6, sky ? -9 : -14.5);
    camera.lookAt(lookAt.current);
    camera.rotation.z += (lane * -0.009 - camera.rotation.z) * Math.min(1, delta * 7);
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
      <mesh position={[0, 1.2, 0]} castShadow><cylinderGeometry args={[0.16, 0.27, 2.4, 10]} /><meshStandardMaterial color="#765034" /></mesh>
      <mesh position={[0, 2.65, 0]} castShadow><sphereGeometry args={[1.02, 16, 12]} /><meshStandardMaterial color="#477f55" /></mesh>
      <mesh position={[0.62, 2.48, 0]} castShadow><sphereGeometry args={[0.68, 14, 10]} /><meshStandardMaterial color="#5b9965" /></mesh>
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
      <mesh position={[0, 0.78, 0]} castShadow><boxGeometry args={[2.4, 0.16, 0.48]} /><meshStandardMaterial color="#9b6a43" /></mesh>
      {[-0.82, 0.82].map((legX) => <mesh key={legX} position={[legX, 0.38, 0]}><boxGeometry args={[0.12, 0.72, 0.12]} /><meshStandardMaterial color="#5b6670" /></mesh>)}
    </group>}
    {kind === "play" && <group>
      <mesh position={[0, 1.9, 0]} castShadow><boxGeometry args={[2.3, 0.14, 1.55]} /><meshStandardMaterial color="#f0c846" /></mesh>
      {[-0.9, 0.9].map((postX) => <mesh key={postX} position={[postX, 0.95, 0]}><cylinderGeometry args={[0.08, 0.08, 1.9, 8]} /><meshStandardMaterial color="#2b81c7" /></mesh>)}
      <mesh position={[1.65, 0.62, 0]} rotation={[0.35, 0, 0]}><boxGeometry args={[0.82, 0.11, 2.4]} /><meshStandardMaterial color="#ef6f3c" /></mesh>
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
  return <>{Array.from({ length: 26 }, (_, index) => [-1.15, 1.15].map((x, laneIndex) => <mesh
    key={`${index}-${laneIndex}`}
    ref={(node) => { if (node) refs.current[index * 2 + laneIndex] = node; }}
    position={[x, 0.026, -index * 3.35]}
    rotation={[-Math.PI / 2, 0, 0]}
  ><planeGeometry args={[0.07, 1.2]} /><meshStandardMaterial color="#f5f0df" transparent opacity={0.72} /></mesh>))}</>;
}

function Trampoline({ progress }: { progress: number }) {
  return <group position={[0, 0.2, -34 + progress * 37]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[2.75, 2.75, 0.22, 36]} /><meshStandardMaterial color="#257bd8" metalness={0.14} roughness={0.42} /></mesh>
    <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.35, 36]} /><meshStandardMaterial color="#ffda3f" emissive="#df7d00" emissiveIntensity={0.36} /></mesh>
  </group>;
}

function RunObjectMesh({ object }: { object: RunObject }) {
  if (object.handled || object.progress < -0.2) return null;
  const x = LANE_X[object.lane];
  const z = -42 + object.progress * 50;
  const meta = OBJECT_META[object.kind];
  const good = meta.good;
  return <group position={[x, good ? 1.35 + Math.sin(object.progress * 8) * 0.14 : 0.45, z]}>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.42, 0]}>
      <torusGeometry args={[good ? 0.56 : 0.68, 0.035, 8, 28]} />
      <meshStandardMaterial color={good ? "#ffe36e" : "#ff4c3f"} emissive={good ? "#ffb200" : "#d82019"} emissiveIntensity={good ? 0.32 : 0.46} transparent opacity={0.72} />
    </mesh>
    {object.kind === "star" && <>
      <mesh rotation={[object.progress * 5, object.progress * 7, 0]} castShadow><octahedronGeometry args={[0.5, 0]} /><meshStandardMaterial color="#ffe25b" emissive="#ffaf18" emissiveIntensity={0.78} metalness={0.18} roughness={0.18} /></mesh>
      <pointLight color="#ffd45d" intensity={1.1} distance={3.3} />
    </>}
    {object.kind === "badge" && <>
      <mesh castShadow><cylinderGeometry args={[0.48, 0.48, 0.16, 6]} /><meshStandardMaterial color="#2f9df3" emissive="#1c73d2" emissiveIntensity={0.62} metalness={0.2} /></mesh>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.56, 0.055, 8, 28]} /><meshStandardMaterial color="#ffffff" emissive="#6fe0ff" emissiveIntensity={0.45} /></mesh>
      <pointLight color="#62cfff" intensity={1.05} distance={3.2} />
    </>}
    {object.kind === "boost" && <>
      <mesh rotation={[0, object.progress * 7, 0]} castShadow><coneGeometry args={[0.48, 0.95, 5]} /><meshStandardMaterial color="#46f0e0" emissive="#10a9df" emissiveIntensity={0.72} metalness={0.25} /></mesh>
      <mesh position={[0, -0.35, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.48, 0.05, 8, 24]} /><meshStandardMaterial color="#ffffff" emissive="#4be8ff" emissiveIntensity={0.62} /></mesh>
    </>}
    {object.kind === "meteor" && <>
      <mesh rotation={[0.5, object.progress * 8, 0.2]} castShadow><dodecahedronGeometry args={[0.58, 0]} /><meshStandardMaterial color="#9b3f2e" emissive="#ef5b2f" emissiveIntensity={0.35} roughness={0.9} /></mesh>
      <mesh position={[0.16, 0.13, -0.1]}><sphereGeometry args={[0.18, 10, 8]} /><meshStandardMaterial color="#ffb14a" emissive="#ff6c22" emissiveIntensity={0.75} /></mesh>
    </>}
    {object.kind === "thunder" && <>
      <mesh rotation={[0, 0, 0.62]} castShadow><boxGeometry args={[0.24, 1.05, 0.24]} /><meshStandardMaterial color="#ffdc45" emissive="#ff342f" emissiveIntensity={0.72} /></mesh>
      <mesh rotation={[0, 0, -0.62]} position={[0.28, -0.06, 0]} castShadow><boxGeometry args={[0.24, 1.05, 0.24]} /><meshStandardMaterial color="#ff5f3d" emissive="#e8242e" emissiveIntensity={0.7} /></mesh>
      <pointLight color="#ff5a42" intensity={1.25} distance={3.4} />
    </>}
    {object.kind === "ice" && <>
      <mesh castShadow><boxGeometry args={[0.95, 0.88, 0.86]} /><meshStandardMaterial color="#9eeaff" emissive="#52c6e8" emissiveIntensity={0.32} roughness={0.18} transparent opacity={0.78} /></mesh>
      <mesh position={[0, 0.04, 0]}><boxGeometry args={[1.08, 0.08, 0.98]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.38} /></mesh>
    </>}
    {object.kind === "barrier" && <>
      <mesh position={[0, 0.15, 0]} castShadow><boxGeometry args={[1.35, 0.28, 0.34]} /><meshStandardMaterial color="#f06b3b" emissive="#b53320" emissiveIntensity={0.15} /></mesh>
      {[-0.48, 0.48].map((postX) => <mesh key={postX} position={[postX, -0.25, 0]}><boxGeometry args={[0.16, 0.7, 0.16]} /><meshStandardMaterial color="#ffffff" /></mesh>)}
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
  if (zone === "playground") return <><SchoolProp x={-11.2} z={-30} kind="shade" speed={speed * 0.82} zone={zone} /><SchoolProp x={10.8} z={-50} kind="play" speed={speed * 0.82} zone={zone} /></>;
  if (zone === "court") return <><SchoolProp x={-10.2} z={-30} kind="hoop" speed={speed * 0.9} zone={zone} /><SchoolProp x={10.4} z={-54} kind="hoop" speed={speed * 0.9} zone={zone} /></>;
  if (zone === "canteen" || zone === "entrance") return <><SchoolProp x={-12.4} z={-36} kind="building" speed={speed * 0.76} zone={zone} /><SchoolProp x={12.4} z={-62} kind="building" speed={speed * 0.76} zone={zone} /></>;
  return <><SchoolProp x={-10.6} z={-25} kind="fence" speed={speed} zone={zone} /><SchoolProp x={10.6} z={-50} kind="bench" speed={speed} zone={zone} /></>;
}

function Scene({ mode, lane, jumping, trampolineProgress, gems, zone, objects }: { mode: TravelMode; lane: Lane; jumping: boolean; trampolineProgress: number; gems: GemState[]; zone: SchoolZone; objects: RunObject[] }) {
  const speed = mode === "sky" ? 12.2 : 8.6;
  const roadColor = zone === "court" ? "#55707d" : zone === "playground" ? "#655f5b" : "#4c5961";
  return <>
    <CameraRig lane={lane} mode={mode} jumping={jumping} />
    <color attach="background" args={[mode === "sky" ? "#63c6ff" : "#8fd5ee"]} />
    <fog attach="fog" args={[mode === "sky" ? "#bceaff" : "#c8e1e8", 21, 76]} />
    <ambientLight intensity={1.12} />
    <directionalLight position={[7, 13, 8]} intensity={2.2} castShadow />
    <hemisphereLight color="#d8f4ff" groundColor="#49664d" intensity={0.68} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -29]} receiveShadow><planeGeometry args={[24, 104]} /><meshStandardMaterial color="#3f7449" roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -29]} receiveShadow><planeGeometry args={[7.8, 104]} /><meshStandardMaterial color={roadColor} roughness={0.97} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.017, -29]}><planeGeometry args={[6.15, 104]} /><meshStandardMaterial color="#657883" roughness={0.96} transparent opacity={0.38} /></mesh>
    <RouteMarkers speed={speed} />
    {Array.from({ length: 12 }, (_, i) => <SchoolProp key={`lt-${i}`} x={-10.3 - (i % 2) * 1.25} z={-i * 7.7 - 4} kind="tree" speed={speed * 0.9} zone={zone} />)}
    {Array.from({ length: 12 }, (_, i) => <SchoolProp key={`rt-${i}`} x={10.3 + (i % 2) * 1.25} z={-i * 7.7 - 7} kind="tree" speed={speed * 0.9} zone={zone} />)}
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
      <p>Pick Peter or Judy, collect bright hero items, dodge danger, and launch into the sky run.</p>
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
          const next = value + dt * 38;
          distanceRef.current = next;
          return next;
        });
        setTrampolineProgress((value) => {
          const next = value + dt * 0.077;
          if (next >= 0.985) {
            window.setTimeout(() => setMode("launch"), 0);
            return 0;
          }
          return next;
        });
        setObjects((current) => current.map((object) => {
          const nextProgress = object.progress + dt * (0.18 + Math.min(distanceRef.current / 3200, 0.05));
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
              showFeedback("Shield blocked it! +6");
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
    showFeedback(`${HEROES[hero].superName} launch!`);
    const toSky = window.setTimeout(() => setMode("sky"), 600);
    const toLanding = window.setTimeout(() => setMode("landing"), 4100);
    const toGround = window.setTimeout(() => {
      setMode("ground");
      setTrampolineProgress(0);
      setGems(makeSkyGems());
      showFeedback("Safe landing!");
    }, 4900);
    return () => {
      window.clearTimeout(toSky);
      window.clearTimeout(toLanding);
      window.clearTimeout(toGround);
    };
  }, [mode, started, hero, showFeedback]);

  useEffect(() => () => {
    if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    if (shieldTimer.current) window.clearTimeout(shieldTimer.current);
  }, []);

  const stepLane = (direction: -1 | 1) => {
    if (!started || gameOver) return;
    setLane((current) => Math.max(-1, Math.min(1, current + direction)) as Lane);
  };

  const jump = () => {
    if (!started || gameOver || mode !== "ground" || jumping) return;
    setJumping(true);
    jumpingRef.current = true;
    window.setTimeout(() => {
      jumpingRef.current = false;
      setJumping(false);
    }, 760);
  };

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!started || gameOver) return;
    event.preventDefault();
    gestureRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Safari fallback */ }
  };

  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!started || gameOver) return;
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
      <div><span className="v2-kicker">SUPER ZOOS ADVENTURE V2.1</span><h1>School Sky Rescue</h1></div>
      <div className="v2-hud-right">
        <span className="v2-zone">{ZONE_LABELS[zone]}</span>
        <span className="v2-hearts" aria-label={`${hearts} hearts`}>{Array.from({ length: 3 }, (_, index) => <span key={index} className={index < hearts ? "heart-on" : "heart-off"}>♥</span>)}</span>
        <span className="v2-score">Gems {gemCount}</span>
        <span className="v2-score">Score {totalScore}</span>
        <span className="v2-status">{started ? (shielded ? "Shield" : mode === "sky" ? "Sky Run" : mode === "launch" ? "Launch" : mode === "landing" ? "Landing" : HEROES[hero].name) : gameOver ? "Try Again" : "Choose Hero"}</span>
      </div>
    </header>
    <section className="v2-stage" onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={() => { gestureRef.current = null; }} aria-label="Swipe left or right to move. Swipe up or tap to jump.">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 4.2, 10.25], fov: 45 }}><Scene mode={mode} lane={lane} jumping={jumping} trampolineProgress={trampolineProgress} gems={gems} zone={zone} objects={objects} /></Canvas>
      {started && !gameOver && <CharacterOverlay hero={hero} lane={lane} mode={mode} jumping={jumping} celebrating={celebrating} shielded={shielded} />}
      {!started && !gameOver && <StartScreen selectedHero={hero} onSelectHero={setHero} onStart={startRun} />}
      {gameOver && <EndScreen hero={hero} score={totalScore} gems={gemCount} onRestart={startRun} onChoose={() => { resetRun(); setGameOver(false); setStarted(false); }} />}
      {transientMessage && started && <div className="v2-message">{transientMessage}</div>}
      <div className="v2-trampoline-meter" aria-hidden="true"><span style={{ width: `${trampolineProgress * 100}%` }} /></div>
    </section>
    <nav className="v2-controls" aria-label="Game controls" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => stepLane(-1)} disabled={!started || gameOver}>Left</button>
      <button type="button" onClick={() => stepLane(1)} disabled={!started || gameOver}>Right</button>
      <button type="button" className="jump" onClick={jump} disabled={!started || gameOver || mode !== "ground"}>Jump</button>
      <button type="button" className="hero-switch" onClick={() => { resetRun(); setStarted(false); }} disabled={mode !== "ground" && started}>{started ? "Restart" : "Choose"}</button>
    </nav>
  </main>;
}
