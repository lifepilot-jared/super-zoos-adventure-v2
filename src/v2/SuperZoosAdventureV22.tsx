import { Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Vector3, type Group, type Mesh } from "three";
import "./superZoosAdventureV22.css";

type Lane = -1 | 0 | 1;
type HeroId = "peter" | "judy";
type Mode = "ground" | "launch" | "sky" | "landing" | "grind";
type Kind = "star" | "badge" | "skateboard" | "meteor" | "ice" | "barrier" | "zap";
type RunItem = { id: number; lane: Lane; kind: Kind; progress: number; handled: boolean; cycle: number };
type SkyGem = { id: number; lane: Lane; progress: number; collected: boolean };
type Gesture = { x: number; y: number; id: number };

type Hero = {
  name: string;
  tagline: string;
  normal: string[];
  superFrames: string[];
  card: string;
  accent: string;
};

const BASE = import.meta.env.BASE_URL || "/";
const asset = (path: string) => `${BASE}${path.replace(/^\/+/, "")}`;
const LANE_X: Record<Lane, number> = { [-1]: -1.62, [0]: 0, [1]: 1.62 };
const LANES: Lane[] = [0, -1, 1, 0, 1, -1, 0, -1, 1, 0, 1, -1];
const KINDS: Kind[] = ["star", "meteor", "badge", "ice", "star", "barrier", "skateboard", "zap", "star", "meteor", "badge", "ice"];
const SKY: Lane[] = [-1, 0, 1, 1, 0, -1, 0, 1, -1, 0, 1, 0];

const HEROES: Record<HeroId, Hero> = {
  peter: {
    name: "Peter",
    tagline: "Strong, brave and gentle",
    normal: [1, 2, 3, 4].map((n) => asset(`images/characters/animation/peter-normal-run-0${n}.png`)),
    superFrames: [
      asset("images/characters/animation/peter-super-run-01.png"),
      asset("images/characters/animation/peter-super-turn-01.png"),
      asset("images/characters/animation/peter-super-turn-02.png"),
    ],
    card: asset("images/characters/animation/peter-normal-run-01.png"),
    accent: "#2588ff",
  },
  judy: {
    name: "Judy",
    tagline: "Fast, funny and fearless",
    normal: [1, 2, 3, 4].map((n) => asset(`images/characters/animation/judy-normal-run-0${n}.png`)),
    superFrames: [asset("images/characters/animation/judy-super-run-01.png"), asset("images/characters/animation/judy-super-turn-01.png")],
    card: asset("images/characters/animation/judy-normal-run-01.png"),
    accent: "#f052a1",
  },
};

const META: Record<Kind, { good: boolean; label: string; hint: string; score: number; color: string }> = {
  star: { good: true, label: "STAR", hint: "COLLECT", score: 10, color: "#ffdc39" },
  badge: { good: true, label: "HERO", hint: "POWER", score: 20, color: "#27a8ff" },
  skateboard: { good: true, label: "BOARD", hint: "SKATE", score: 25, color: "#39e6d2" },
  meteor: { good: false, label: "ROCK", hint: "JUMP", score: 4, color: "#d94c2b" },
  ice: { good: false, label: "ICE", hint: "JUMP", score: 4, color: "#a9edff" },
  barrier: { good: false, label: "BARRIER", hint: "JUMP", score: 4, color: "#ff7b33" },
  zap: { good: false, label: "ZAP", hint: "DODGE", score: 0, color: "#ff394f" },
};

function makeItem(id: number, progress: number, cycle = 0): RunItem {
  return {
    id,
    lane: LANES[(id * 2 + cycle) % LANES.length],
    kind: KINDS[(id + cycle) % KINDS.length],
    progress,
    handled: false,
    cycle,
  };
}

const makeItems = (landing = false) => Array.from({ length: 12 }, (_, id) => makeItem(id, (landing ? 0.06 : -0.02) - id * 0.145, landing ? id + 2 : 0));
const recycle = (item: RunItem) => makeItem(item.id, -0.48 - (item.id % 4) * 0.05, item.cycle + 1);
const makeSky = (): SkyGem[] => SKY.map((lane, id) => ({ id, lane, progress: -id * 0.09, collected: false }));

function CameraRig({ lane, mode, jumping }: { lane: Lane; mode: Mode; jumping: boolean }) {
  const { camera } = useThree();
  const target = useRef(new Vector3());
  const look = useRef(new Vector3());
  useFrame((_, dt) => {
    const sky = mode === "sky";
    const y = sky ? 5.7 : mode === "launch" ? 5.0 : mode === "landing" ? 4.3 : jumping ? 4.35 : 3.82;
    target.current.set(lane * -0.12, y, sky ? 10.2 : 10.45);
    camera.position.lerp(target.current, Math.min(1, dt * 7.5));
    look.current.set(lane * 0.05, sky ? 2.1 : 0.42, sky ? -9 : -15.5);
    camera.lookAt(look.current);
  });
  return null;
}

function MovingMarkers({ speed }: { speed: number }) {
  const refs = useRef<Mesh[]>([]);
  useFrame((_, dt) => {
    refs.current.forEach((mesh) => {
      mesh.position.z += dt * speed;
      if (mesh.position.z > 10) mesh.position.z -= 102;
    });
  });
  return <>{Array.from({ length: 30 }, (_, i) => [-1.33, 1.33].map((x, j) => (
    <mesh key={`${i}-${j}`} ref={(n) => { if (n) refs.current[i * 2 + j] = n; }} position={[x, 0.03, -i * 3.4]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.08, 1.25]} /><meshStandardMaterial color="#f4efe0" transparent opacity={0.82} />
    </mesh>
  )))}</>;
}

function SchoolProp({ x, z, kind, speed }: { x: number; z: number; kind: "tree" | "building" | "fence" | "hoop" | "shade" | "play"; speed: number }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position.z += dt * speed;
    if (ref.current.position.z > 17) ref.current.position.z -= 118;
  });
  return <group ref={ref} position={[x, 0, z]}>
    {kind === "tree" && <><mesh position={[0, 1.2, 0]} castShadow><cylinderGeometry args={[0.18, 0.3, 2.4, 10]} /><meshStandardMaterial color="#765039" /></mesh><mesh position={[0, 2.7, 0]} castShadow><sphereGeometry args={[1.05, 14, 12]} /><meshStandardMaterial color="#3f8152" /></mesh><mesh position={[0.7, 2.48, 0]} castShadow><sphereGeometry args={[0.7, 12, 10]} /><meshStandardMaterial color="#5a9b66" /></mesh></>}
    {kind === "building" && <><mesh position={[0, 1.45, 0]} castShadow><boxGeometry args={[6.2, 2.9, 2.7]} /><meshStandardMaterial color="#d7a05f" /></mesh><mesh position={[0, 3.1, 0]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[4.25, 4.25, 2.75]} /><meshStandardMaterial color="#a84e39" /></mesh>{[-2,-1,0,1,2].map((v)=><mesh key={v} position={[v,1.5,1.37]}><boxGeometry args={[0.65,0.8,0.07]} /><meshStandardMaterial color="#9ed8ea" /></mesh>)}</>}
    {kind === "fence" && <><mesh position={[0,0.75,0]}><boxGeometry args={[5,0.12,0.12]} /><meshStandardMaterial color="#f2eee0" /></mesh>{[-2,-1,0,1,2].map((v)=><mesh key={v} position={[v,0.65,0]}><boxGeometry args={[0.11,1.3,0.11]} /><meshStandardMaterial color="#f2eee0" /></mesh>)}</>}
    {kind === "hoop" && <><mesh position={[0,1.8,0]}><cylinderGeometry args={[0.08,0.08,3.6,8]} /><meshStandardMaterial color="#667078" /></mesh><mesh position={[0,3.3,0.25]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.48,0.07,10,24]} /><meshStandardMaterial color="#ea5c2d" /></mesh></>}
    {kind === "shade" && <><mesh position={[0,2.65,0]} rotation={[-0.12,0,0]}><boxGeometry args={[4.8,0.12,3.4]} /><meshStandardMaterial color="#f28b3f" /></mesh>{[-2,2].map(v=><mesh key={v} position={[v,1.3,0]}><cylinderGeometry args={[0.08,0.08,2.6,8]} /><meshStandardMaterial color="#58636d" /></mesh>)}</>}
    {kind === "play" && <><mesh position={[0,1.2,0]} rotation={[0.45,0,0]}><boxGeometry args={[2.8,0.18,3.3]} /><meshStandardMaterial color="#f0bd42" /></mesh><mesh position={[0,0.5,1.3]}><boxGeometry args={[3.2,0.2,0.45]} /><meshStandardMaterial color="#3f85c9" /></mesh></>}
  </group>;
}

function ItemMesh({ item }: { item: RunItem }) {
  if (item.handled || item.progress < -0.16) return null;
  const meta = META[item.kind];
  const z = -44 + item.progress * 46;
  const y = meta.good ? 1.32 + Math.sin(item.progress * 10) * 0.1 : 0.52;
  return <group position={[LANE_X[item.lane], y, z]}>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.46, 0]}><torusGeometry args={[meta.good ? 0.7 : 0.78, 0.055, 10, 32]} /><meshStandardMaterial color={meta.good ? meta.color : "#ff2d2d"} emissive={meta.good ? meta.color : "#d41515"} emissiveIntensity={0.72} transparent opacity={0.95} /></mesh>
    <Text position={[0, 1.0, 0]} fontSize={0.28} color={meta.good ? "#fff8b8" : "#ffffff"} anchorX="center" anchorY="middle" outlineWidth={0.035} outlineColor={meta.good ? "#715000" : "#8d0808"}>{meta.hint}</Text>
    {item.kind === "star" && <mesh rotation={[item.progress * 5, item.progress * 7, 0]} castShadow><octahedronGeometry args={[0.58, 0]} /><meshStandardMaterial color={meta.color} emissive="#ff9f00" emissiveIntensity={0.9} /></mesh>}
    {item.kind === "badge" && <><mesh castShadow><cylinderGeometry args={[0.58,0.58,0.2,8]} /><meshStandardMaterial color={meta.color} emissive="#1680d7" emissiveIntensity={0.8} /></mesh><Text position={[0,0,0.12]} fontSize={0.3} color="#fff">H</Text></>}
    {item.kind === "skateboard" && <group rotation={[0,0,0.1]}><mesh castShadow><boxGeometry args={[1.18,0.12,0.38]} /><meshStandardMaterial color="#23cfc5" emissive="#138eb7" emissiveIntensity={0.55} /></mesh>{[-0.42,0.42].map(v=><mesh key={v} position={[v,-0.15,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.09,0.09,0.3,10]} /><meshStandardMaterial color="#25394b" /></mesh>)}</group>}
    {item.kind === "meteor" && <mesh rotation={[0.4,item.progress*7,0.2]} castShadow><dodecahedronGeometry args={[0.68,0]} /><meshStandardMaterial color={meta.color} emissive="#ff5a20" emissiveIntensity={0.45} /></mesh>}
    {item.kind === "ice" && <mesh castShadow><boxGeometry args={[1.15,1.0,1.0]} /><meshStandardMaterial color={meta.color} emissive="#48bddf" emissiveIntensity={0.3} transparent opacity={0.86} /></mesh>}
    {item.kind === "barrier" && <><mesh castShadow><boxGeometry args={[1.5,0.32,0.4]} /><meshStandardMaterial color={meta.color} /></mesh>{[-0.55,0.55].map(v=><mesh key={v} position={[v,-0.32,0]}><boxGeometry args={[0.18,0.75,0.18]} /><meshStandardMaterial color="#fff" /></mesh>)}</>}
    {item.kind === "zap" && <><mesh rotation={[0,0,0.58]}><boxGeometry args={[0.28,1.25,0.28]} /><meshStandardMaterial color="#ffd93d" emissive="#ff273b" emissiveIntensity={0.9} /></mesh><mesh rotation={[0,0,-0.58]} position={[0.34,-0.08,0]}><boxGeometry args={[0.28,1.25,0.28]} /><meshStandardMaterial color="#ff3448" emissive="#d91932" emissiveIntensity={0.9} /></mesh></>}
  </group>;
}

function Rail({ active, progress }: { active: boolean; progress: number }) {
  if (!active) return null;
  return <group position={[0,0,-46 + progress * 49]}>
    <mesh position={[0,0.52,0]}><boxGeometry args={[0.16,0.16,8]} /><meshStandardMaterial color="#d9e0e5" metalness={0.8} roughness={0.25} /></mesh>
    {[-3.2,0,3.2].map(z=><mesh key={z} position={[0,0.25,z]}><boxGeometry args={[0.1,0.55,0.1]} /><meshStandardMaterial color="#6f7b84" /></mesh>)}
  </group>;
}

function Scene({ lane, mode, jumping, items, skyGems, railActive, railProgress }: { lane: Lane; mode: Mode; jumping: boolean; items: RunItem[]; skyGems: SkyGem[]; railActive: boolean; railProgress: number }) {
  const speed = mode === "sky" ? 12.4 : 9.2;
  return <>
    <CameraRig lane={lane} mode={mode} jumping={jumping} />
    <color attach="background" args={[mode === "sky" ? "#61c8ff" : "#8ed7ef"]} />
    <fog attach="fog" args={[mode === "sky" ? "#c5efff" : "#d0e8ed", 24, 88]} />
    <ambientLight intensity={1.18} /><directionalLight position={[8,14,7]} intensity={2.25} castShadow /><hemisphereLight color="#e4f8ff" groundColor="#3e6846" intensity={0.72} />
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.01,-35]} receiveShadow><planeGeometry args={[29,124]} /><meshStandardMaterial color="#3e774c" /></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.01,-35]} receiveShadow><planeGeometry args={[9.7,124]} /><meshStandardMaterial color="#50626c" roughness={0.98} /></mesh>
    <MovingMarkers speed={speed} />
    {Array.from({ length: 13 },(_,i)=><SchoolProp key={`lt${i}`} x={-11.3-(i%2)*1.2} z={-i*8.2-5} kind="tree" speed={speed*0.9} />)}
    {Array.from({ length: 13 },(_,i)=><SchoolProp key={`rt${i}`} x={11.3+(i%2)*1.2} z={-i*8.2-9} kind="tree" speed={speed*0.9} />)}
    <SchoolProp x={-13.5} z={-30} kind="building" speed={speed*0.72} /><SchoolProp x={13.5} z={-66} kind="building" speed={speed*0.72} />
    <SchoolProp x={-11.8} z={-52} kind="fence" speed={speed} /><SchoolProp x={11.8} z={-36} kind="hoop" speed={speed*0.9} />
    <SchoolProp x={-12.2} z={-82} kind="shade" speed={speed*0.8} /><SchoolProp x={12.2} z={-92} kind="play" speed={speed*0.8} />
    {(mode === "ground" || mode === "landing" || mode === "grind") && items.map(item=><ItemMesh key={`${item.id}-${item.cycle}`} item={item} />)}
    <Rail active={railActive} progress={railProgress} />
    {mode === "sky" && skyGems.map(g => !g.collected && <group key={g.id} position={[LANE_X[g.lane],3.0,-30+g.progress*34]}><mesh><torusGeometry args={[0.48,0.14,12,28]} /><meshStandardMaterial color="#ffda3d" emissive="#ff9700" emissiveIntensity={0.85} /></mesh></group>)}
  </>;
}

function HeroOverlay({ hero, lane, mode, jumping, skateboard }: { hero: HeroId; lane: Lane; mode: Mode; jumping: boolean; skateboard: boolean }) {
  const visual = HEROES[hero];
  const frames = mode === "sky" || mode === "launch" || mode === "landing" ? visual.superFrames : visual.normal;
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); const timer = window.setInterval(() => setIndex(v => (v + 1) % frames.length), mode === "ground" || mode === "grind" ? 86 : 135); return () => window.clearInterval(timer); }, [frames, mode]);
  return <div className={`v22-hero hero-${hero} mode-${mode} ${jumping ? "jumping" : ""} ${skateboard ? "skating" : ""}`} style={{ "--lane": lane, "--accent": visual.accent } as CSSProperties}>
    <div className="v22-glow" /><img src={frames[index] ?? visual.card} alt={visual.name} draggable={false} /><div className="v22-shadow" />{skateboard && <div className="v22-board" />}
  </div>;
}

export function SuperZoosAdventureV22() {
  const [started,setStarted] = useState(false);
  const [hero,setHero] = useState<HeroId>("peter");
  const [lane,setLane] = useState<Lane>(0);
  const laneRef = useRef<Lane>(0);
  const [mode,setMode] = useState<Mode>("ground");
  const [jumping,setJumping] = useState(false);
  const jumpingRef = useRef(false);
  const [items,setItems] = useState<RunItem[]>(makeItems);
  const [skyGems,setSkyGems] = useState<SkyGem[]>(makeSky);
  const [hearts,setHearts] = useState(3);
  const [score,setScore] = useState(0);
  const [gems,setGems] = useState(0);
  const [distance,setDistance] = useState(0);
  const distanceRef = useRef(0);
  const [feedback,setFeedback] = useState("");
  const feedbackTimer = useRef<number | null>(null);
  const [skateboard,setSkateboard] = useState(false);
  const [railActive,setRailActive] = useState(false);
  const [railProgress,setRailProgress] = useState(0);
  const [gameOver,setGameOver] = useState(false);
  const gesture = useRef<Gesture | null>(null);

  useEffect(()=>{ laneRef.current=lane; },[lane]);
  useEffect(()=>{ jumpingRef.current=jumping; },[jumping]);
  const say = useCallback((text:string)=>{ setFeedback(text); if(feedbackTimer.current) clearTimeout(feedbackTimer.current); feedbackTimer.current=window.setTimeout(()=>setFeedback(""),1100); },[]);

  const reset = useCallback(()=>{
    setLane(0); laneRef.current=0; setMode("ground"); setJumping(false); jumpingRef.current=false; setItems(makeItems()); setSkyGems(makeSky()); setHearts(3); setScore(0); setGems(0); setDistance(0); distanceRef.current=0; setFeedback(""); setSkateboard(false); setRailActive(false); setRailProgress(0); setGameOver(false);
  },[]);

  useEffect(()=>{
    if(!started || gameOver) return;
    let raf=0; let previous=performance.now();
    const tick=(now:number)=>{
      const dt=Math.min(0.04,(now-previous)/1000); previous=now;
      if(mode==="ground" || mode==="grind" || mode==="landing"){
        setDistance(v=>{ const n=v+dt*42; distanceRef.current=n; return n; });
        setItems(current=>current.map(item=>{
          const next=item.progress+dt*0.205;
          if(next>1.34) return recycle(item);
          if(!item.handled && next>=1.02 && next<=1.22 && item.lane===laneRef.current){
            const meta=META[item.kind];
            if(meta.good){ setScore(v=>v+meta.score); setGems(v=>v+1); say(`${meta.label} +${meta.score}`); if(item.kind==="skateboard"){setSkateboard(true); say("Skateboard ready!");} return {...item,progress:next,handled:true}; }
            if(jumpingRef.current && item.kind!=="zap"){ setScore(v=>v+meta.score); say("Great jump!"); return {...item,progress:next,handled:true}; }
            setHearts(v=>{ const n=Math.max(0,v-1); if(n===0){setGameOver(true);setStarted(false);} return n; }); say("Careful — heart lost"); return {...item,progress:next,handled:true};
          }
          return {...item,progress:next};
        }));
        if(distanceRef.current>360 && Math.floor(distanceRef.current/360)%3===1 && mode==="ground"){
          setMode("launch"); setSkyGems(makeSky());
          window.setTimeout(()=>setMode("sky"),500);
          window.setTimeout(()=>setMode("landing"),3400);
          window.setTimeout(()=>{ setMode("ground"); setItems(makeItems(true)); say("Back to the school route!"); },4200);
        }
        if(skateboard && !railActive && distanceRef.current>180 && Math.floor(distanceRef.current/240)%4===2){ setRailActive(true); setRailProgress(0); }
        if(railActive){ setRailProgress(v=>{ const n=v+dt*0.22; if(n>=1.08){setRailActive(false); if(laneRef.current===0){setMode("ground");setScore(s=>s+35);say("Rail grind +35!");} return 0;} if(n>0.76 && laneRef.current===0 && skateboard) setMode("grind"); return n; }); }
      } else if(mode==="sky"){
        setSkyGems(current=>current.map(g=>{ if(g.collected) return g; const p=g.progress+dt*0.38; if(p>=0.82 && p<=1.04 && g.lane===laneRef.current){setScore(v=>v+10);setGems(v=>v+1);say("Sky gem +10");return {...g,progress:p,collected:true};} return {...g,progress:p,collected:p>1.12}; }));
      }
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick); return()=>cancelAnimationFrame(raf);
  },[started,gameOver,mode,skateboard,railActive,say]);

  const move=(d:-1|1)=>setLane(v=>Math.max(-1,Math.min(1,v+d)) as Lane);
  const jump=()=>{ if(!started || jumping || mode==="sky" || mode==="launch") return; setJumping(true); jumpingRef.current=true; window.setTimeout(()=>{setJumping(false);jumpingRef.current=false;},720); };
  const down=(e:PointerEvent<HTMLDivElement>)=>{ if(!started)return; gesture.current={x:e.clientX,y:e.clientY,id:e.pointerId}; try{e.currentTarget.setPointerCapture(e.pointerId);}catch{} };
  const up=(e:PointerEvent<HTMLDivElement>)=>{ const s=gesture.current;gesture.current=null;if(!s)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;if(Math.abs(dx)>36&&Math.abs(dx)>Math.abs(dy)*0.7)move(dx>0?1:-1);else if(dy<-28||Math.abs(dx)<14)jump(); };

  return <main className={`v22-app mode-${mode}`}>
    <header className="v22-hud"><div><span>SUPER ZOOS ADVENTURE V2.2</span><h1>School Adventure Run</h1></div><div className="v22-stats"><b>{[0,1,2].map(i=><i key={i} className={i<hearts?"on":""}>♥</i>)}</b><b>Gems {gems}</b><b>Score {score+Math.floor(distance/5)}</b><b>{skateboard?"Skateboard":"Run"}</b></div></header>
    <section className="v22-stage" onPointerDown={down} onPointerUp={up} onPointerCancel={()=>gesture.current=null}>
      <Canvas shadows dpr={[1,1.5]} camera={{position:[0,3.82,10.45],fov:44}}><Scene lane={lane} mode={mode} jumping={jumping} items={items} skyGems={skyGems} railActive={railActive} railProgress={railProgress} /></Canvas>
      {started && !gameOver && <HeroOverlay hero={hero} lane={lane} mode={mode} jumping={jumping} skateboard={skateboard} />}
      {feedback && <div className="v22-feedback">{feedback}</div>}
      {!started && !gameOver && <div className="v22-menu"><div className="v22-panel"><small>CHOOSE YOUR HERO</small><h2>School Adventure Run</h2><p>Gold and blue are good. Red rings are danger. Collect the skateboard to unlock rail grinding.</p><div className="v22-cards">{(Object.keys(HEROES) as HeroId[]).map(id=><button key={id} className={hero===id?"selected":""} onClick={()=>setHero(id)}><img src={HEROES[id].card} alt={HEROES[id].name}/><strong>{HEROES[id].name}</strong><span>{HEROES[id].tagline}</span></button>)}</div><button className="v22-start" onClick={()=>{reset();setStarted(true);}}>Start Adventure</button></div></div>}
      {gameOver && <div className="v22-menu"><div className="v22-panel"><small>GREAT TRY</small><h2>{HEROES[hero].name} is ready again</h2><p>Score {score+Math.floor(distance/5)} • Gems {gems}</p><button className="v22-start" onClick={()=>{reset();setStarted(true);}}>Try Again</button><button className="v22-secondary" onClick={()=>{reset();setStarted(false);}}>Choose Hero</button></div></div>}
      {started && <div className="v22-key"><span className="good">GOLD / BLUE = COLLECT</span><span className="bad">RED RING = DODGE OR JUMP</span></div>}
    </section>
    <nav className="v22-controls"><button onClick={()=>move(-1)} disabled={!started}>Left</button><button onClick={()=>move(1)} disabled={!started}>Right</button><button className="jump" onClick={jump} disabled={!started}>Jump</button><button className="restart" onClick={()=>{reset();setStarted(true);}}>Restart</button></nav>
  </main>;
}
