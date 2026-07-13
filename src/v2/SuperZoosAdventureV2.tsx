import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
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

const BASE_PATH = import.meta.env.BASE_URL || "/";
const asset = (path: string) => `${BASE_PATH}${path.replace(/^\/+/, "")}`;
const LANE_X: Record<Lane, number> = { [-1]: -1.9, [0]: 0, [1]: 1.9 };
const SKY_PATTERN: Lane[] = [-1, 0, 1, 1, 0, -1, 0, 1, -1, 0];
const ZONES: SchoolZone[] = ["entrance", "oval", "playground", "court", "canteen"];
const ZONE_LABELS: Record<SchoolZone, string> = {
  entrance: "Front Entrance",
  oval: "School Oval",
  playground: "Adventure Playground",
  court: "Basketball Court",
  canteen: "Canteen & Hall",
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

function CameraRig({ lane, mode, jumping }: { lane: Lane; mode: TravelMode; jumping: boolean }) {
  const { camera } = useThree();
  const position = useRef(new Vector3());
  const lookAt = useRef(new Vector3());
  useFrame((_, delta) => {
    const sky = mode === "sky";
    const targetY = sky ? 5.9 : mode === "launch" ? 5.25 : mode === "landing" ? 4.7 : jumping ? 4.85 : 4.2;
    position.current.set(lane * -0.34, targetY, sky ? 10.4 : 9.9);
    camera.position.lerp(position.current, Math.min(1, delta * 6.5));
    lookAt.current.set(lane * 0.14, sky ? 2.2 : 0.62, sky ? -9 : -13.5);
    camera.lookAt(lookAt.current);
    camera.rotation.z += (lane * -0.009 - camera.rotation.z) * Math.min(1, delta * 7);
  });
  return null;
}

function SchoolProp({ x, z, kind, speed, zone }: { x: number; z: number; kind: "tree" | "building" | "fence" | "shade" | "hoop"; speed: number; zone: SchoolZone }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.z += delta * speed;
    if (group.current.position.z > 13) group.current.position.z -= 96;
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
  </group>;
}

function RouteMarkers({ speed }: { speed: number }) {
  const refs = useRef<Mesh[]>([]);
  useFrame((_, delta) => {
    refs.current.forEach((marker) => {
      marker.position.z += delta * speed;
      if (marker.position.z > 8) marker.position.z -= 78;
    });
  });
  return <>{Array.from({ length: 24 }, (_, index) => [-0.95, 0.95].map((x, laneIndex) => <mesh
    key={`${index}-${laneIndex}`}
    ref={(node) => { if (node) refs.current[index * 2 + laneIndex] = node; }}
    position={[x, 0.024, -index * 3.25]}
    rotation={[-Math.PI / 2, 0, 0]}
  ><planeGeometry args={[0.065, 1.15]} /><meshStandardMaterial color="#f5f0df" transparent opacity={0.72} /></mesh>))}</>;
}

function Trampoline({ progress }: { progress: number }) {
  return <group position={[0, 0.2, -34 + progress * 37]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[2.75, 2.75, 0.22, 36]} /><meshStandardMaterial color="#257bd8" metalness={0.14} roughness={0.42} /></mesh>
    <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.35, 36]} /><meshStandardMaterial color="#ffda3f" emissive="#df7d00" emissiveIntensity={0.36} /></mesh>
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
  if (zone === "playground") return <><SchoolProp x={-9.2} z={-30} kind="shade" speed={speed * 0.82} zone={zone} /><SchoolProp x={9} z={-50} kind="shade" speed={speed * 0.82} zone={zone} /></>;
  if (zone === "court") return <><SchoolProp x={-8.2} z={-30} kind="hoop" speed={speed * 0.9} zone={zone} /><SchoolProp x={8.2} z={-54} kind="hoop" speed={speed * 0.9} zone={zone} /></>;
  if (zone === "canteen" || zone === "entrance") return <><SchoolProp x={-10.8} z={-36} kind="building" speed={speed * 0.76} zone={zone} /><SchoolProp x={10.8} z={-62} kind="building" speed={speed * 0.76} zone={zone} /></>;
  return <><SchoolProp x={-8.2} z={-25} kind="fence" speed={speed} zone={zone} /><SchoolProp x={8.2} z={-50} kind="fence" speed={speed} zone={zone} /></>;
}

function Scene({ mode, lane, jumping, trampolineProgress, gems, zone }: { mode: TravelMode; lane: Lane; jumping: boolean; trampolineProgress: number; gems: GemState[]; zone: SchoolZone }) {
  const speed = mode === "sky" ? 12.2 : 8.6;
  const roadColor = zone === "court" ? "#55707d" : zone === "playground" ? "#6c665f" : "#4b5157";
  return <>
    <CameraRig lane={lane} mode={mode} jumping={jumping} />
    <color attach="background" args={[mode === "sky" ? "#63c6ff" : "#8fd5ee"]} />
    <fog attach="fog" args={[mode === "sky" ? "#bceaff" : "#c8e1e8", 20, 70]} />
    <ambientLight intensity={1.1} />
    <directionalLight position={[7, 13, 8]} intensity={2.2} castShadow />
    <hemisphereLight color="#d8f4ff" groundColor="#49664d" intensity={0.65} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -27]} receiveShadow><planeGeometry args={[20, 94]} /><meshStandardMaterial color="#3f7449" roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -27]} receiveShadow><planeGeometry args={[6.8, 94]} /><meshStandardMaterial color={roadColor} roughness={0.97} /></mesh>
    <RouteMarkers speed={speed} />
    {Array.from({ length: 13 }, (_, i) => <SchoolProp key={`lt-${i}`} x={-8.1 - (i % 2) * 1.05} z={-i * 7.2 - 4} kind="tree" speed={speed * 0.9} zone={zone} />)}
    {Array.from({ length: 13 }, (_, i) => <SchoolProp key={`rt-${i}`} x={8.1 + (i % 2) * 1.05} z={-i * 7.2 - 7} kind="tree" speed={speed * 0.9} zone={zone} />)}
    <ZoneScenery zone={zone} speed={speed} />
    {mode === "ground" && <Trampoline progress={trampolineProgress} />}
    {mode === "sky" && gems.map((gem) => <GemMesh key={gem.id} gem={gem} />)}
  </>;
}

function CharacterOverlay({ hero, lane, mode, jumping, celebrating }: { hero: HeroId; lane: Lane; mode: TravelMode; jumping: boolean; celebrating: boolean }) {
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
  return <div className={`v2-character hero-${hero} travel-${mode} ${jumping ? "is-jumping" : ""} ${celebrating ? "is-celebrating" : ""}`} style={{ "--lane": lane, "--hero-accent": visual.accent } as CSSProperties} aria-label={`${visual.name} running`}>
    <div className="v2-character-glow" /><img src={src} alt="" onError={(event) => { event.currentTarget.onerror = null; setSrc(visual.fallback); }} draggable={false} /><div className="v2-character-shadow" />
  </div>;
}

function StartScreen({ selectedHero, onSelectHero, onStart }: { selectedHero: HeroId; onSelectHero: (hero: HeroId) => void; onStart: () => void }) {
  return <div className="v2-start-screen">
    <div className="v2-start-panel">
      <span className="v2-start-kicker">SUPER ZOOS ADVENTURE V2</span>
      <h2>Choose your hero</h2>
      <p>Pick Peter or Judy, then start the School Sky Rescue.</p>
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

const makeSkyGems = (): GemState[] => SKY_PATTERN.map((lane, index) => ({ id: index, lane, progress: -index * 0.095, collected: false }));

export function SuperZoosAdventureV2() {
  const [started, setStarted] = useState(false);
  const [hero, setHero] = useState<HeroId>("peter");
  const [lane, setLane] = useState<Lane>(0);
  const laneRef = useRef<Lane>(0);
  const [jumping, setJumping] = useState(false);
  const [mode, setMode] = useState<TravelMode>("ground");
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [trampolineProgress, setTrampolineProgress] = useState(0);
  const [gems, setGems] = useState<GemState[]>(makeSkyGems);
  const [celebrating, setCelebrating] = useState(false);
  const gestureRef = useRef<GestureStart | null>(null);
  const celebrationTimer = useRef<number | null>(null);
  const zone = useMemo(() => ZONES[Math.floor(distance / 170) % ZONES.length] ?? "entrance", [distance]);

  useEffect(() => { laneRef.current = lane; }, [lane]);

  useEffect(() => {
    if (!started) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.04, (now - previous) / 1000);
      previous = now;
      if (mode === "ground") {
        setDistance((value) => value + dt * 38);
        setTrampolineProgress((value) => {
          const next = value + dt * 0.092;
          if (next >= 0.985) {
            window.setTimeout(() => setMode("launch"), 0);
            return 0;
          }
          return next;
        });
      } else if (mode === "sky") {
        setDistance((value) => value + dt * 58);
        setGems((current) => current.map((gem) => {
          if (gem.collected) return gem;
          const nextProgress = gem.progress + dt * 0.34;
          if (nextProgress >= 0.83 && nextProgress <= 0.99 && gem.lane === laneRef.current) {
            setScore((value) => value + 10);
            setCelebrating(true);
            if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current);
            celebrationTimer.current = window.setTimeout(() => setCelebrating(false), 360);
            return { ...gem, progress: nextProgress, collected: true };
          }
          return { ...gem, progress: nextProgress, collected: nextProgress > 1.08 };
        }));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, started]);

  useEffect(() => {
    if (!started || mode !== "launch") return;
    setGems(makeSkyGems());
    const toSky = window.setTimeout(() => setMode("sky"), 600);
    const toLanding = window.setTimeout(() => setMode("landing"), 4100);
    const toGround = window.setTimeout(() => {
      setMode("ground");
      setTrampolineProgress(0);
      setGems(makeSkyGems());
    }, 4900);
    return () => {
      window.clearTimeout(toSky);
      window.clearTimeout(toLanding);
      window.clearTimeout(toGround);
    };
  }, [mode, started]);

  useEffect(() => () => {
    if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current);
  }, []);

  const resetRun = () => {
    setLane(0);
    setJumping(false);
    setMode("ground");
    setScore(0);
    setDistance(0);
    setTrampolineProgress(0);
    setGems(makeSkyGems());
    setCelebrating(false);
  };

  const startRun = () => {
    resetRun();
    setStarted(true);
  };

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

  const transientMessage = mode === "launch"
    ? `${HEROES[hero].superName.toUpperCase()} LAUNCH!`
    : mode === "landing"
      ? "Safe landing!"
      : "";

  return <main className={`v2-app mode-${mode} ${started ? "is-running" : "is-starting"}`}>
    <header className="v2-hud">
      <div><span className="v2-kicker">SUPER ZOOS ADVENTURE V2</span><h1>School Sky Rescue</h1></div>
      <div className="v2-hud-right"><span className="v2-zone">{ZONE_LABELS[zone]}</span><span className="v2-score">Gems {score}</span><span className="v2-status">{started ? (mode === "sky" ? "Sky Run" : mode === "launch" ? "Launch" : mode === "landing" ? "Landing" : HEROES[hero].name) : "Choose Hero"}</span></div>
    </header>
    <section className="v2-stage" onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={() => { gestureRef.current = null; }} aria-label="Swipe left or right to move. Swipe up or tap to jump.">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 4.2, 9.9], fov: 45 }}><Scene mode={mode} lane={lane} jumping={jumping} trampolineProgress={trampolineProgress} gems={gems} zone={zone} /></Canvas>
      {started && <CharacterOverlay hero={hero} lane={lane} mode={mode} jumping={jumping} celebrating={celebrating} />}
      {!started && <StartScreen selectedHero={hero} onSelectHero={setHero} onStart={startRun} />}
      {transientMessage && <div className="v2-message">{transientMessage}</div>}
      <div className="v2-trampoline-meter" aria-hidden="true"><span style={{ width: `${trampolineProgress * 100}%` }} /></div>
    </section>
    <nav className="v2-controls" aria-label="Game controls" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => stepLane(-1)} disabled={!started}>Left</button>
      <button type="button" onClick={() => stepLane(1)} disabled={!started}>Right</button>
      <button type="button" className="jump" onClick={jump} disabled={!started || mode !== "ground"}>Jump</button>
      <button type="button" className="hero-switch" onClick={() => setStarted(false)}>{started ? HEROES[hero].name : "Choose"}</button>
    </nav>
  </main>;
}
