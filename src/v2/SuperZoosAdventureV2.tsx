import { Text } from "@react-three/drei";
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
  short: string;
  good: boolean;
  score: number;
  color: string;
  ring: string;
  hint: string;
  jumpAvoidable?: boolean;
};

const BASE_PATH = import.meta.env.BASE_URL || "/";
const asset = (path: string) => `${BASE_PATH}${path.replace(/^\/+/, "")}`;

const LANE_X: Record<Lane, number> = { [-1]: -1.65, [0]: 0, [1]: 1.65 };
const SKY_PATTERN: Lane[] = [-1, 0, 1, 1, 0, -1, 0, 1, -1, 0];
const LANE_SEQUENCE: Lane[] = [0, -1, 1, 0, 1, -1, 0, -1, 1, 0, 1, -1];
const OBJECT_SEQUENCE: RunObjectKind[] = [
  "star", "meteor", "badge", "ice", "star", "thunder", "boost", "barrier", "star", "meteor", "badge", "ice",
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
  star: { label: "Star Gem", short: "GEM", good: true, score: 10, color: "#ffe35e", ring: "#ffe35e", hint: "COLLECT" },
  badge: { label: "Hero Badge", short: "BADGE", good: true, score: 20, color: "#2fa8ff", ring: "#86e8ff", hint: "POWER" },
  boost: { label: "Super Boost", short: "BOOST", good: true, score: 25, color: "#37f4db", ring: "#7dfcff", hint: "BOOST" },
  meteor: { label: "Meteor Rock", short: "ROCK", good: false, score: 4, color: "#d84b28", ring: "#ff2d21", hint: "JUMP", jumpAvoidable: true },
  thunder: { label: "Thunder Spark", short: "ZAP", good: false, score: 0, color: "#ff4545", ring: "#ff2222", hint: "DANGER" },
  ice: { label: "Ice Block", short: "ICE", good: false, score: 4, color: "#9feeff", ring: "#ff3a35", hint: "JUMP", jumpAvoidable: true },
  barrier: { label: "School Barrier", short: "BARRIER", good: false, score: 4, color: "#ff7c38", ring: "#ff2d21", hint: "JUMP", jumpAvoidable: true },
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
    superFrames: [asset("images/characters/animation/judy-super-run-01.png"), asset("images/characters/animation/judy-super-turn-01.png")],
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
  return Array.from({ length: 11 }, (_, id) => makeRunObject(id, -0.05 - id * 0.15, 0));
}

function makeLandingObjects(): RunObject[] {
  return Array.from({ length: 11 }, (_, id) => makeRunObject(id, 0.08 - id * 0.14, id + 2));
}

function recycleRunObject(object: RunObject): RunObject {
  const cycle = object.cycle + 1;
  return makeRunObject(object.id, -0.42 - (object.id % 4) * 0.045, cycle);
}

const makeSkyGems = (): GemState[] => SKY_PATTERN.map((lane, index) => ({ id: index, lane, progress: -index * 0.095, collected: false }));

function CameraRig({ lane, mode, jumping }: { lane: Lane; mode: TravelMode; jumping: boolean }) {
  const { camera } = useThree();
  const position = useRef(new Vector3());
  const lookAt = useRef(new Vector3());
  useFrame((_, delta) => {
    const sky = mode === "sky";
    const targetY = sky ? 5.7 : mode === "launch" ? 5.0 : mode === "landing" ? 4.45 : jumping ? 4.55 : 3.9;
    position.current.set(lane * -0.16, targetY, sky ? 10.3 : 10.1);
    camera.position.lerp(position.current, Math.min(1, delta * 7));
    lookAt.current.set(lane * 0.07, sky ? 2.1 : 0.45, sky ? -9 : -14.8);
    camera.lookAt(lookAt.current);
    camera.rotation.z += (lane * -0.005 - camera.rotation.z) * Math.min(1, delta * 7);
  });
  return null;
}

function SchoolProp({ x, z, kind, speed, zone }: { x: number; z: number; kind: "tree" | "building" | "fence" | "shade" | "hoop" | "bench" | "play"; speed: number; zone: SchoolZone }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.z += delta * speed;
    if (group.current.position.z > 16) group.current.position.z -= 110;
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
      if (marker.position.z > 9) marker.position.z -= 94;
    });
  });
  return <>{Array.from({ length: 28 }, (_, index) => [-1.32, 1.32].map((x, laneIndex) => <mesh
    key={`${index}-${laneIndex}`}
    ref={(node) => { if (node) refs.current[index * 2 + laneIndex] = node; }}
    position={[x, 0.028, -index * 3.35]}
    rotation={[-Math.PI / 2, 0, 0]}
  ><planeGeometry args={[0.08, 1.25]} /><meshStandardMaterial color="#f5f0df" transparent opacity={0.78} /></mesh>))}</>;
}

function LaneGuide() {
  return <>
    {([-1, 0, 1] as Lane[]).map((lane) => <mesh key={lane} rotation={[-Math.PI / 2, 0, 0]} position={[LANE_X[lane], 0.032, -29]}>
      <planeGeometry args={[1.54, 101]} />
      <meshStandardMaterial color={lane === 0 ? "#70838c" : "#667982"} transparent opacity={0.22} roughness={1} />
    </mesh>)}
  </>;
}

function Trampoline({ progress }: { progress: number }) {
  return <group position={[0, 0.16, -42 + progress * 49]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[2.18, 2.18, 0.18, 36]} /><meshStandardMaterial color="#257bd8" metalness={0.14} roughness={0.42} /></mesh>
    <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.82, 36]} /><meshStandardMaterial color="#ffda3f" emissive="#df7d00" emissiveIntensity={0.36} /></mesh>
    <Text position={[0, 1.0, 0]} rotation={[-0.12, 0, 0]} fontSize={0.42} color="#123a5a" anchorX="center" anchorY="middle">SKY RUN</Text>
  </group>;
}

function RunObjectMesh({ object }: { object: RunObject }) {
  if (object.handled || object.progress < -0.18) return null;
  const meta = OBJECT_META[object.kind];
  const x = LANE_X[object.lane];
  const z = -54 + object.progress * 63;
  const good = meta.good;
  const y = good ? 1.48 + Math.sin(object.progress * 9) * 0.12 : 0.48;
  return <group position={[x, y, z]}>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, good ? -0.72 : -0.45, 0]}>
      <torusGeometry args={[good ? 0.64 : 0.8, good ? 0.045 : 0.06, 8, 32]} />
      <meshStandardMaterial color={meta.ring} emissive={meta.ring} emissiveIntensity={good ? 0.45 : 0.72} transparent opacity={good ? 0.76 : 0.92} />
    </mesh>
    <Text position={[0, good ? 0.92 : 0.88, 0]} fontSize={0.34} color={good ? "#123a5a" : "#ffffff"} anchorX="center" anchorY="middle" outlineWidth={0.035} outlineColor={good ? "#ffffff" : "#9d170f"}>{meta.hint}</Text>
    {object.kind === "star" && <>
      <mesh rotation={[object.progress * 5, object.progress * 7, 0]} castShadow><octahedronGeometry args={[0.58, 0]} /><meshStandardMaterial color={meta.color} emissive="#ffaf18" emissiveIntensity={0.86} metalness={0.18} roughness={0.18} /></mesh>
      <pointLight color="#ffd45d" intensity={1.2} distance={3.4} />
    </>}
    {object.kind === "badge" && <>
      <mesh castShadow><cylinderGeometry args={[0.56, 0.56, 0.18, 6]} /><meshStandardMaterial color={meta.color} emissive="#1c73d2" emissiveIntensity={0.68} metalness={0.2} /></mesh>
      <Text position={[0, 0.14, 0.12]} fontSize={0.34} color="#ffffff" anchorX="center" anchorY="middle">P</Text>
      <pointLight color="#62cfff" intensity={1.15} distance={3.5} />
    </>}
    {object.kind === "boost" && <>
      <mesh rotation={[0, object.progress * 7, 0]} castShadow><coneGeometry args={[0.52, 1.02, 5]} /><meshStandardMaterial color={meta.color} emissive="#10a9df" emissiveIntensity={0.76} metalness={0.25} /></mesh>
      <mesh position={[0, -0.35, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.5, 0.06, 8, 24]} /><meshStandardMaterial color="#ffffff" emissive="#4be8ff" emissiveIntensity={0.62} /></mesh>
    </>}
    {object.kind === "meteor" && <>
      <mesh rotation={[0.5, object.progress * 8, 0.2]} castShadow><dodecahedronGeometry args={[0.62, 0]} /><meshStandardMaterial color="#8a3426" emissive={meta.color} emissiveIntensity={0.45} roughness={0.92} /></mesh>
      <mesh position={[0.18, 0.12, -0.1]}><sphereGeometry args={[0.2, 10, 8]} /><meshStandardMaterial color="#ffbd4d" emissive="#ff6c22" emissiveIntensity={0.85} /></mesh>
    </>}
    {object.kind === "thunder" && <>
      <mesh rotation={[0, 0, 0.62]} castShadow><boxGeometry args={[0.26, 1.18, 0.26]} /><meshStandardMaterial color="#ffdf3f" emissive="#ff342f" emissiveIntensity={0.76} /></mesh>
      <mesh rotation={[0, 0, -0.62]} position={[0.32, -0.07, 0]} castShadow><boxGeometry args={[0.26, 1.18, 0.26]} /><meshStandardMaterial color="#ff4c3d" emissive="#e8242e" emissiveIntensity={0.74} /></mesh>
      <pointLight color="#ff5a42" intensity={1.3} distance={3.7} />
    </>}
    {object.kind === "ice" && <>
      <mesh castShadow><boxGeometry args={[1.0, 0.9, 0.9]} /><meshStandardMaterial color={meta.color} emissive="#52c6e8" emissiveIntensity={0.34} roughness={0.18} transparent opacity={0.82} /></mesh>
      <mesh position={[0, 0.04, 0]}><boxGeometry args={[1.14, 0.08, 1.0]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.42} /></mesh>
    </>}
    {object.kind === "barrier" && <>
      <mesh position={[0, 0.15, 0]} castShadow><boxGeometry args={[1.44, 0.3, 0.36]} /><meshStandardMaterial color={meta.color} emissive="#b53320" emissiveIntensity={0.18} /></mesh>
      {[-0.5, 0.5].map((postX) => <mesh key={postX} position={[postX, -0.25, 0]}><boxGeometry args={[0.17, 0.72, 0.17]} /><meshStandardMaterial color="#ffffff" /></mesh>)}
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
  if (zone === "playground") return <><SchoolProp x={-12.0} z={-32} kind="shade" speed={speed * 0.82} zone={zone} /><SchoolProp x={12.1} z={-54} kind="play" speed={speed * 0.82} zone={zone} /></>;
  if (zone === "court") return <><SchoolProp x={-11.1} z={-32} kind="hoop" speed={speed * 0.9} zone={zone} /><SchoolProp x={11.1} z={-58} kind="hoop" speed={speed * 0.9} zone={zone} /></>;
  if (zone === "canteen" || zone === "entrance") return <><SchoolProp x={-13.0} z={-38} kind="building" speed={speed * 0.74} zone={zone} /><SchoolProp x={13.0} z={-66} kind="building" speed={speed * 0.74} zone={zone} /></>;
  return <><SchoolProp x={-11.4} z={-28} kind="fence" speed={speed} zone={zone} /><SchoolProp x={11.4} z={-54} kind="bench" speed={speed} zone={zone} /></>;
}

function Scene({ mode, lane, jumping, trampolineProgress, gems, zone, objects }: { mode: TravelMode; lane: Lane; jumping: boolean; trampolineProgress: number; gems: GemState[]; zone: SchoolZone; objects: RunObject[] }) {
  const speed = mode === "sky" ? 12.2 : 8.9;
  const roadColor = zone === "court" ? "#55707d" : zone === "playground" ? "#66615c" : "#4d5a62";
  return <>
    <CameraRig lane={lane} mode={mode} jumping={jumping} />
    <color attach="background" args={[mode === "sky" ? "#63c6ff" : "#8fd5ee"]} />
    <fog attach="fog" args={[mode === "sky" ? "#bceaff" : "#c8e1e8", 22, 80]} />
    <ambientLight intensity={1.14} />
    <directionalLight position={[7, 13, 8]} intensity={2.25} castShadow />
    <hemisphereLight color="#d8f4ff" groundColor="#49664d" intensity={0.7} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, -32]} receiveShadow><planeGeometry args={[26, 112]} /><meshStandardMaterial color="#3e7449" roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -32]} receiveShadow><planeGeometry args={[8.9, 112]} /><meshStandardMaterial color={roadColor} roughness={0.98} /></mesh>
    <LaneGuide />
    <RouteMarkers speed={speed} />
    {Array.from({ length: 12 }, (_, i) => <SchoolProp key={`lt-${i}`} x={-10.8 - (i % 2) * 1.15} z={-i * 7.8 - 5} kind="tree" speed={speed * 0.9} zone={zone} />)}
    {Array.from({ length: 12 }, (_, i) => <SchoolProp key={`rt-${i}`} x={10.8 + (i % 2) * 1.15} z={-i * 7.8 - 8} kind="tree" speed={speed * 0.9} zone={zone} />)}
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
    const timer = window.setInterval(() => setFrameIndex((value) => (value + 1) % frames.length), mode === "ground" ? 82 : 130);
    return () => window.clearInterval(timer);
  }, [frames, mode, celebrating]);
  useEffect(() => setSrc(celebrating ? visual.celebrationFrame : (frames[frameIndex] ?? frames[0])), [celebrating, frameIndex, frames, visual.celebrationFrame]);
  return <div className={`v2-character hero-${hero} travel-${mode} ${jumping ? "is-jumping" : ""} ${celebrating ? "is-celebrating" : ""} ${shielded ? "is-shielded" : ""}`} style={{ "--lane": lane, "--hero-accent": visual.accent } as CSSProperties} aria-label={`${visual.name} running`}>
    <div className="v2-character-glow" />
    <div className="v2-run-dust" />
    <img src={src} alt="" onError={() => setSrc(visual.fallback)} draggable={false} />
    <div className="v2-character-shadow" />
  </div>;
}

function StartScreen({ selectedHero, onSelectHero, onStart }: { selectedHero: HeroId; onSelectHero: (hero: HeroId) => void; onStart: () => void }) {
  return <div className="v2-start-screen">
    <div className="v2-start-panel">
      <span className="v2-start-kicker">SUPER ZOOS ADVENTURE</span>
      <h2>Choose your hero</h2>
      <p>Gold and blue are good. Red warning rings are danger. Stay in the road lanes and get ready for Sky Run.</p>
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
    feedbackTimer.current = window.setTimeout(() => setFeedback(""), 1200);
  }, []);

  const triggerShield = useCallback(() => {
    setShielded(true);
    shieldRef.current = true;
    if (shieldTimer.current) window.clearTimeout(shieldTimer.current);
    shieldTimer.current = window.setTimeout(() => {
      shieldRef.current = false;
      setShielded(false);
    }, 3900);
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
          const next = value + dt * 41;
          distanceRef.current = next;
          return next;
        });
        setTrampolineProgress((value) => {
          const next = value + dt * 0.037;
          if (next >= 0.985) {
            window.setTimeout(() => setMode("launch"), 0);
            return 0;
          }
          return next;
        });
        setObjects((current) => current.map((object) => {
          const speed = 0.19 + Math.min(distanceRef.current / 4600, 0.042);
          const nextProgress = object.progress + dt * speed;
          if (nextProgress > 1.24) return recycleRunObject(object);
          if (!object.handled && nextProgress >= 0.96 && nextProgress <= 1.12 && object.lane === laneRef.current) {
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
      setObjects(makeLandingObjects());
      showFeedback("Back to the school route!");
    }, 4900);
    return () => {
      window.clearTimeout(toSky);
      window.clearTimeout(toLanding);
      window.clearTimeout(toGround);
    };
  }, [mode, started, showFeedback]);

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
    jumpingRef.current = true;
    window.setTimeout(() => {
      jumpingRef.current = false;
      setJumping(false);
    }, 760);
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

  const restart = () => {
    resetRun();
    setStarted(true);
  };

  const chooseHero = () => {
    resetRun();
    setStarted(false);
  };

  const status = shielded ? "Shield On" : mode === "sky" ? "Sky Run" : mode === "launch" ? "Launch" : mode === "landing" ? "Landing" : started ? HEROES[hero].name : "Choose Hero";
  const transientMessage = feedback || (mode === "launch" ? `${HEROES[hero].superName.toUpperCase()} LAUNCH!` : mode === "landing" ? "Safe landing!" : "");

  return <main className={`v2-app mode-${mode} ${started ? "is-running" : "is-starting"} ${shielded ? "has-shield" : ""}`}>
    <header className="v2-hud">
      <div><span className="v2-kicker">SUPER ZOOS ADVENTURE V2.1C</span><h1>School Sky Rescue</h1></div>
      <div className="v2-hud-right">
        <span className="v2-zone">{ZONE_LABELS[zone]}</span>
        <span className="v2-hearts">{[0, 1, 2].map((heart) => <span key={heart} className={heart < hearts ? "" : "heart-off"}>♥</span>)}</span>
        <span className="v2-score">Gems {gemCount}</span>
        <span className="v2-score">Score {totalScore}</span>
        <span className="v2-status">{status}</span>
      </div>
    </header>
    <section className="v2-stage" onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={() => { gestureRef.current = null; }} aria-label="Swipe left or right to move. Swipe up or tap to jump.">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 3.9, 10.1], fov: 42 }}><Scene mode={mode} lane={lane} jumping={jumping} trampolineProgress={trampolineProgress} gems={gems} zone={zone} objects={objects} /></Canvas>
      {started && <CharacterOverlay hero={hero} lane={lane} mode={mode} jumping={jumping} celebrating={celebrating} shielded={shielded} />}
      {!started && !gameOver && <StartScreen selectedHero={hero} onSelectHero={setHero} onStart={startRun} />}
      {gameOver && <EndScreen hero={hero} score={totalScore} gems={gemCount} onRestart={restart} onChoose={chooseHero} />}
      {transientMessage && <div className="v2-message">{transientMessage}</div>}
      <div className="v2-help-strip"><span className="good">Gold/Blue = collect</span><span className="bad">Red ring = dodge or jump</span></div>
      <div className="v2-trampoline-meter" aria-hidden="true"><span style={{ width: `${trampolineProgress * 100}%` }} /></div>
    </section>
    <nav className="v2-controls" aria-label="Game controls" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => stepLane(-1)} disabled={!started}>Left</button>
      <button type="button" onClick={() => stepLane(1)} disabled={!started}>Right</button>
      <button type="button" className="jump" onClick={jump} disabled={!started || mode !== "ground"}>Jump</button>
      <button type="button" className="hero-switch" onClick={started ? restart : chooseHero}>{started ? "Restart" : "Choose"}</button>
    </nav>
  </main>;
}
