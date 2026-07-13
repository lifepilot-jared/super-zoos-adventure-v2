import { Text, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Vector3, type Group, type Mesh } from "three";
import "./superZoosAdventureV23.css";

type Lane = -1 | 0 | 1;
type HeroId = "peter" | "judy";
type Phase = "ground" | "launch" | "sky" | "landing" | "grind";
type EncounterKind = "stars" | "meteor" | "badge" | "barrier" | "ice" | "skateboard" | "rail" | "trampoline" | "zap";
type Gesture = { x: number; y: number; id: number };
type Encounter = { kind: EncounterKind; lane: Lane; label: string; good: boolean; jumpable?: boolean };
type SkyGem = { id: number; lane: Lane; progress: number; taken: boolean };

const BASE = import.meta.env.BASE_URL || "/";
const asset = (p: string) => `${BASE}${p.replace(/^\/+/, "")}`;
const LANE_X: Record<Lane, number> = { [-1]: -2.15, [0]: 0, [1]: 2.15 };
const SKY_PATTERN: Lane[] = [-1, 0, 1, 0, 1, -1, 0, 1, -1, 0, 1];
const ENCOUNTERS: Encounter[] = [
  { kind: "stars", lane: 0, label: "COLLECT", good: true },
  { kind: "meteor", lane: -1, label: "JUMP", good: false, jumpable: true },
  { kind: "badge", lane: 1, label: "POWER", good: true },
  { kind: "barrier", lane: 0, label: "JUMP", good: false, jumpable: true },
  { kind: "stars", lane: -1, label: "COLLECT", good: true },
  { kind: "ice", lane: 1, label: "JUMP", good: false, jumpable: true },
  { kind: "skateboard", lane: 0, label: "SKATE", good: true },
  { kind: "rail", lane: 0, label: "RAIL", good: true },
  { kind: "zap", lane: -1, label: "DODGE", good: false },
  { kind: "trampoline", lane: 0, label: "SKY RUN", good: true },
  { kind: "stars", lane: 1, label: "COLLECT", good: true },
  { kind: "meteor", lane: 0, label: "JUMP", good: false, jumpable: true },
  { kind: "badge", lane: -1, label: "POWER", good: true },
];

const HEROES = {
  peter: {
    name: "Peter",
    tagline: "Strong, brave and gentle",
    normal: [1, 2, 3, 4].map(n => asset(`images/characters/animation/peter-normal-run-0${n}.png`)),
    superFrames: [asset("images/characters/animation/peter-super-run-01.png"), asset("images/characters/animation/peter-super-turn-01.png"), asset("images/characters/animation/peter-super-turn-02.png")],
  },
  judy: {
    name: "Judy",
    tagline: "Fast, funny and fearless",
    normal: [1, 2, 3, 4].map(n => asset(`images/characters/animation/judy-normal-run-0${n}.png`)),
    superFrames: [asset("images/characters/animation/judy-super-run-01.png"), asset("images/characters/animation/judy-super-turn-01.png")],
  },
} as const;

const makeSky = (): SkyGem[] => SKY_PATTERN.map((lane, id) => ({ id, lane, progress: -id * 0.11, taken: false }));

function CameraRig({ lane, phase }: { lane: Lane; phase: Phase }) {
  const { camera } = useThree();
  const p = useRef(new Vector3());
  const look = useRef(new Vector3());
  useFrame((_, dt) => {
    const sky = phase === "sky" || phase === "launch";
    p.current.set(lane * -0.08, sky ? 5.4 : 4.1, sky ? 11.2 : 10.8);
    camera.position.lerp(p.current, Math.min(1, dt * 7));
    look.current.set(lane * 0.04, sky ? 2.4 : 1.15, -10);
    camera.lookAt(look.current);
  });
  return null;
}

function HeroSprite({ hero, lane, phase, jumping, skating }: { hero: HeroId; lane: Lane; phase: Phase; jumping: boolean; skating: boolean }) {
  const paths = phase === "sky" || phase === "launch" || phase === "landing" ? HEROES[hero].superFrames : HEROES[hero].normal;
  const textures = useTexture(paths as unknown as string[]);
  const [frame, setFrame] = useState(0);
  useEffect(() => { setFrame(0); const id = window.setInterval(() => setFrame(v => (v + 1) % textures.length), phase === "ground" || phase === "grind" ? 92 : 140); return () => clearInterval(id); }, [textures, phase]);
  const y = phase === "sky" ? 3.6 : phase === "launch" ? 2.8 : phase === "landing" ? 2.0 : jumping ? 2.2 : 1.55;
  return <group position={[LANE_X[lane], y, 4.2]}>
    <sprite scale={[2.45, 3.35, 1]}><spriteMaterial map={textures[frame]} transparent depthWrite={false} /></sprite>
    <mesh position={[0, -1.45, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.65, 24]} /><meshBasicMaterial color="#173d2a" transparent opacity={phase === "sky" ? 0 : 0.25} /></mesh>
    {skating && phase !== "sky" && <group position={[0, -1.22, 0.08]}><mesh><boxGeometry args={[1.35, 0.12, 0.42]} /><meshStandardMaterial color="#36dfd0" emissive="#168fa8" emissiveIntensity={0.45} /></mesh></group>}
  </group>;
}

function MovingProp({ x, z, kind, speed }: { x: number; z: number; kind: "tree" | "building" | "fence" | "hoop" | "shade" | "play"; speed: number }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => { if (!ref.current) return; ref.current.position.z += dt * speed; if (ref.current.position.z > 18) ref.current.position.z -= 124; });
  return <group ref={ref} position={[x, 0, z]}>
    {kind === "tree" && <><mesh position={[0,1.25,0]}><cylinderGeometry args={[0.18,0.3,2.5,10]} /><meshStandardMaterial color="#78533b" /></mesh><mesh position={[0,2.8,0]}><sphereGeometry args={[1.1,14,12]} /><meshStandardMaterial color="#3e8051" /></mesh><mesh position={[0.72,2.56,0]}><sphereGeometry args={[0.72,12,10]} /><meshStandardMaterial color="#5b9b66" /></mesh></>}
    {kind === "building" && <><mesh position={[0,1.5,0]}><boxGeometry args={[6.8,3,2.8]} /><meshStandardMaterial color="#d5a05e" /></mesh><mesh position={[0,3.2,0]} rotation={[0,0,Math.PI/4]}><boxGeometry args={[4.45,4.45,2.85]} /><meshStandardMaterial color="#a84d38" /></mesh></>}
    {kind === "fence" && <><mesh position={[0,.8,0]}><boxGeometry args={[5.5,.12,.12]} /><meshStandardMaterial color="#eee8d8" /></mesh>{[-2,-1,0,1,2].map(v=><mesh key={v} position={[v,.68,0]}><boxGeometry args={[.11,1.35,.11]} /><meshStandardMaterial color="#eee8d8" /></mesh>)}</>}
    {kind === "hoop" && <><mesh position={[0,1.8,0]}><cylinderGeometry args={[.08,.08,3.6,8]} /><meshStandardMaterial color="#657078" /></mesh><mesh position={[0,3.35,.25]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.5,.07,10,24]} /><meshStandardMaterial color="#eb5a2c" /></mesh></>}
    {kind === "shade" && <><mesh position={[0,2.7,0]} rotation={[-.1,0,0]}><boxGeometry args={[5,.12,3.5]} /><meshStandardMaterial color="#f08a3f" /></mesh>{[-2.1,2.1].map(v=><mesh key={v} position={[v,1.3,0]}><cylinderGeometry args={[.08,.08,2.6,8]} /><meshStandardMaterial color="#59646d" /></mesh>)}</>}
    {kind === "play" && <><mesh position={[0,1.25,0]} rotation={[.45,0,0]}><boxGeometry args={[3,.18,3.5]} /><meshStandardMaterial color="#f0bd42" /></mesh><mesh position={[0,.5,1.35]}><boxGeometry args={[3.4,.2,.45]} /><meshStandardMaterial color="#3f85c9" /></mesh></>}
  </group>;
}

function EncounterMesh({ encounter, progress }: { encounter: Encounter; progress: number }) {
  const z = -34 + progress * 38;
  const x = LANE_X[encounter.lane];
  const ring = encounter.good ? "#ffd93d" : "#ff2f2f";
  return <group position={[x, encounter.good ? 1.25 : .55, z]}>
    <mesh rotation={[Math.PI/2,0,0]} position={[0,-.45,0]}><torusGeometry args={[encounter.kind === "trampoline" ? 2.2 : .78,.07,10,36]} /><meshStandardMaterial color={ring} emissive={ring} emissiveIntensity={.65} /></mesh>
    <Text position={[0,1.05,0]} fontSize={.3} color="#fff" outlineWidth={.04} outlineColor={encounter.good ? "#6b5100" : "#850000"}>{encounter.label}</Text>
    {encounter.kind === "stars" && <mesh rotation={[progress*5,progress*7,0]}><octahedronGeometry args={[.62,0]} /><meshStandardMaterial color="#ffe056" emissive="#ff9c00" emissiveIntensity={.9} /></mesh>}
    {encounter.kind === "badge" && <mesh><cylinderGeometry args={[.62,.62,.2,8]} /><meshStandardMaterial color="#2da8ff" emissive="#167ac7" emissiveIntensity={.7} /></mesh>}
    {encounter.kind === "meteor" && <mesh rotation={[.4,progress*7,.2]}><dodecahedronGeometry args={[.72,0]} /><meshStandardMaterial color="#d64d2b" emissive="#ff5a20" emissiveIntensity={.45} /></mesh>}
    {encounter.kind === "ice" && <mesh><boxGeometry args={[1.2,1.05,1.05]} /><meshStandardMaterial color="#a7efff" emissive="#48bddf" emissiveIntensity={.3} transparent opacity={.88} /></mesh>}
    {encounter.kind === "barrier" && <group><mesh><boxGeometry args={[1.6,.34,.42]} /><meshStandardMaterial color="#ff7a31" /></mesh>{[-.58,.58].map(v=><mesh key={v} position={[v,-.32,0]}><boxGeometry args={[.18,.76,.18]} /><meshStandardMaterial color="#fff" /></mesh>)}</group>}
    {encounter.kind === "zap" && <group><mesh rotation={[0,0,.58]}><boxGeometry args={[.28,1.3,.28]} /><meshStandardMaterial color="#ffd83a" emissive="#ff263b" emissiveIntensity={.9} /></mesh><mesh rotation={[0,0,-.58]} position={[.35,-.08,0]}><boxGeometry args={[.28,1.3,.28]} /><meshStandardMaterial color="#ff3449" emissive="#d91a32" emissiveIntensity={.9} /></mesh></group>}
    {encounter.kind === "skateboard" && <group><mesh><boxGeometry args={[1.4,.14,.44]} /><meshStandardMaterial color="#34dfd0" emissive="#168fa8" emissiveIntensity={.5} /></mesh></group>}
    {encounter.kind === "rail" && <group position={[0,-.15,-2.6]}><mesh position={[0,.5,0]}><boxGeometry args={[.16,.16,6]} /><meshStandardMaterial color="#dce3e8" metalness={.8} /></mesh></group>}
    {encounter.kind === "trampoline" && <group position={[0,-.38,0]}><mesh rotation={[-Math.PI/2,0,0]}><cylinderGeometry args={[2.1,2.1,.2,36]} /><meshStandardMaterial color="#287edb" /></mesh><mesh position={[0,.12,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[1.75,36]} /><meshStandardMaterial color="#ffdf3e" emissive="#e28b00" emissiveIntensity={.35} /></mesh></group>}
  </group>;
}

function World({ hero, lane, phase, jumping, skating, encounter, encounterProgress, skyGems }: { hero: HeroId; lane: Lane; phase: Phase; jumping: boolean; skating: boolean; encounter: Encounter; encounterProgress: number; skyGems: SkyGem[] }) {
  const speed = phase === "sky" ? 12.5 : 9.2;
  return <>
    <CameraRig lane={lane} phase={phase} />
    <color attach="background" args={[phase === "sky" ? "#62c9ff" : "#8ed7ef"]} />
    <fog attach="fog" args={[phase === "sky" ? "#c7efff" : "#d0e8ed", 24, 92]} />
    <ambientLight intensity={1.15} /><directionalLight position={[8,14,7]} intensity={2.2} castShadow /><hemisphereLight color="#e4f8ff" groundColor="#3e6846" intensity={.72} />
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.02,-36]}><planeGeometry args={[32,130]} /><meshStandardMaterial color="#3e774c" /></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,-36]}><planeGeometry args={[11.2,130]} /><meshStandardMaterial color="#50626c" roughness={.98} /></mesh>
    {[-1.9,1.9].map(x=>Array.from({length:30},(_,i)=><mesh key={`${x}-${i}`} position={[x,.03,-i*4.1]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.08,1.4]} /><meshStandardMaterial color="#f5efe0" /></mesh>))}
    {Array.from({length:13},(_,i)=><MovingProp key={`lt${i}`} x={-12-(i%2)*1.2} z={-i*8.8-5} kind="tree" speed={speed*.9} />)}
    {Array.from({length:13},(_,i)=><MovingProp key={`rt${i}`} x={12+(i%2)*1.2} z={-i*8.8-9} kind="tree" speed={speed*.9} />)}
    <MovingProp x={-14} z={-34} kind="building" speed={speed*.72} /><MovingProp x={14} z={-70} kind="building" speed={speed*.72} />
    <MovingProp x={-12.4} z={-55} kind="fence" speed={speed} /><MovingProp x={12.4} z={-38} kind="hoop" speed={speed*.9} />
    <MovingProp x={-13} z={-88} kind="shade" speed={speed*.8} /><MovingProp x={13} z={-98} kind="play" speed={speed*.8} />
    <HeroSprite hero={hero} lane={lane} phase={phase} jumping={jumping} skating={skating} />
    {phase === "ground" || phase === "grind" ? <EncounterMesh encounter={encounter} progress={encounterProgress} /> : null}
    {phase === "sky" && skyGems.filter(g=>!g.taken).map(g=><group key={g.id} position={[LANE_X[g.lane],3.2,-28+g.progress*33]}><mesh><torusGeometry args={[.5,.14,12,28]} /><meshStandardMaterial color="#ffda3d" emissive="#ff9700" emissiveIntensity={.85} /></mesh></group>)}
  </>;
}

export function SuperZoosAdventureV23() {
  const [hero,setHero] = useState<HeroId>("peter");
  const [started,setStarted] = useState(false);
  const [phase,setPhase] = useState<Phase>("ground");
  const [lane,setLane] = useState<Lane>(0);
  const laneRef = useRef<Lane>(0);
  const [jumping,setJumping] = useState(false);
  const jumpingRef = useRef(false);
  const [encounterIndex,setEncounterIndex] = useState(0);
  const [encounterProgress,setEncounterProgress] = useState(-.05);
  const [skyGems,setSkyGems] = useState<SkyGem[]>(makeSky);
  const [phaseElapsed,setPhaseElapsed] = useState(0);
  const [score,setScore] = useState(0);
  const [gems,setGems] = useState(0);
  const [hearts,setHearts] = useState(3);
  const [skating,setSkating] = useState(false);
  const [feedback,setFeedback] = useState("");
  const [gameOver,setGameOver] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const feedbackTimer = useRef<number | null>(null);
  const encounter = ENCOUNTERS[encounterIndex % ENCOUNTERS.length];

  useEffect(()=>{laneRef.current=lane;},[lane]);
  useEffect(()=>{jumpingRef.current=jumping;},[jumping]);
  const say = useCallback((t:string)=>{setFeedback(t); if(feedbackTimer.current) clearTimeout(feedbackTimer.current); feedbackTimer.current=window.setTimeout(()=>setFeedback(""),1100);},[]);
  const nextEncounter = useCallback(()=>{setEncounterIndex(i=>i+1);setEncounterProgress(-.05);},[]);
  const reset = useCallback(()=>{setPhase("ground");setLane(0);laneRef.current=0;setJumping(false);jumpingRef.current=false;setEncounterIndex(0);setEncounterProgress(-.05);setSkyGems(makeSky());setPhaseElapsed(0);setScore(0);setGems(0);setHearts(3);setSkating(false);setFeedback("");setGameOver(false);},[]);

  useEffect(()=>{
    if(!started || gameOver) return;
    let raf=0, prev=performance.now();
    const tick=(now:number)=>{
      const dt=Math.min(.04,(now-prev)/1000); prev=now;
      if(phase==="ground" || phase==="grind"){
        setEncounterProgress(p=>{
          const n=p+dt*.205;
          if(n>=1.02 && p<1.02){
            if(encounter.kind==="trampoline"){
              if(laneRef.current===encounter.lane){setPhase("launch");setPhaseElapsed(0);setSkyGems(makeSky());say("Sky Run!");return n;}
            } else if(laneRef.current===encounter.lane){
              if(encounter.good){setScore(s=>s+(encounter.kind==="badge"?20:encounter.kind==="skateboard"?25:10));setGems(g=>g+1);if(encounter.kind==="skateboard"){setSkating(true);say("Skateboard unlocked!");}else if(encounter.kind==="rail"&&skating){setPhase("grind");setScore(s=>s+35);say("Rail grind +35!");}else say(`${encounter.label} collected`);}
              else if(encounter.jumpable&&jumpingRef.current){setScore(s=>s+5);say("Great jump +5");}
              else{setHearts(h=>{const v=Math.max(0,h-1);if(v===0){setGameOver(true);setStarted(false);}return v;});say("Careful — heart lost");}
            }
          }
          if(n>1.28){nextEncounter();return -.05;}
          return n;
        });
      } else {
        setPhaseElapsed(v=>v+dt);
        if(phase==="launch" && phaseElapsed>.55){setPhase("sky");setPhaseElapsed(0);}
        else if(phase==="sky"){
          setSkyGems(list=>list.map(g=>{if(g.taken)return g;const p=g.progress+dt*.36;if(p>=.84&&p<=1.04&&g.lane===laneRef.current){setScore(s=>s+10);setGems(v=>v+1);say("Sky gem +10");return{...g,progress:p,taken:true};}return{...g,progress:p,taken:p>1.15};}));
          if(phaseElapsed>3.15){setPhase("landing");setPhaseElapsed(0);}
        } else if(phase==="landing" && phaseElapsed>.8){setPhase("ground");setPhaseElapsed(0);nextEncounter();say("Back to the school route!");}
      }
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[started,gameOver,phase,phaseElapsed,encounter,nextEncounter,say,skating]);

  const move=(d:-1|1)=>{if(!started)return;setLane(v=>Math.max(-1,Math.min(1,v+d)) as Lane);};
  const jump=()=>{if(!started||jumping||phase!=="ground")return;setJumping(true);jumpingRef.current=true;window.setTimeout(()=>{setJumping(false);jumpingRef.current=false;},720);};
  const down=(e:PointerEvent<HTMLDivElement>)=>{if(!started)return;gesture.current={x:e.clientX,y:e.clientY,id:e.pointerId};};
  const up=(e:PointerEvent<HTMLDivElement>)=>{const s=gesture.current;gesture.current=null;if(!s)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;if(Math.abs(dx)>36&&Math.abs(dx)>Math.abs(dy)*.7)move(dx>0?1:-1);else if(dy<-28||Math.abs(dx)<14)jump();};
  const total=score+encounterIndex*3;

  return <main className={`v23-app phase-${phase}`}>
    <header className="v23-hud"><div><small>SUPER ZOOS ADVENTURE V2.3</small><h1>School Adventure Run</h1></div><div className="v23-stats"><b>{[0,1,2].map(i=><i key={i} className={i<hearts?"on":""}>♥</i>)}</b><b>Gems {gems}</b><b>Score {total}</b><b>{skating?"Skateboard":"Run"}</b></div></header>
    <section className="v23-stage" onPointerDown={down} onPointerUp={up} onPointerCancel={()=>gesture.current=null}>
      <Canvas shadows dpr={[1,1.5]} camera={{position:[0,4.1,10.8],fov:43}}><World hero={hero} lane={lane} phase={phase} jumping={jumping} skating={skating} encounter={encounter} encounterProgress={encounterProgress} skyGems={skyGems} /></Canvas>
      {feedback&&<div className="v23-feedback">{feedback}</div>}
      {!started&&!gameOver&&<div className="v23-menu"><div className="v23-panel"><small>CHOOSE YOUR HERO</small><h2>Stable Runner Core</h2><p>One clear encounter at a time. Reach the visible trampoline to start Sky Run.</p><div className="v23-cards">{(Object.keys(HEROES) as HeroId[]).map(id=><button key={id} className={hero===id?"selected":""} onClick={()=>setHero(id)}><img src={HEROES[id].normal[0]} alt={HEROES[id].name}/><strong>{HEROES[id].name}</strong><span>{HEROES[id].tagline}</span></button>)}</div><button className="v23-start" onClick={()=>{reset();setStarted(true);}}>Start Adventure</button></div></div>}
      {gameOver&&<div className="v23-menu"><div className="v23-panel"><small>GREAT TRY</small><h2>{HEROES[hero].name} is ready again</h2><p>Score {total} • Gems {gems}</p><button className="v23-start" onClick={()=>{reset();setStarted(true);}}>Try Again</button><button className="v23-secondary" onClick={()=>{reset();setStarted(false);}}>Choose Hero</button></div></div>}
      {started&&<div className="v23-key"><span className="good">GOLD / BLUE = COLLECT</span><span className="bad">RED = DODGE OR JUMP</span></div>}
    </section>
    <nav className="v23-controls"><button onClick={()=>move(-1)} disabled={!started}>Left</button><button onClick={()=>move(1)} disabled={!started}>Right</button><button className="jump" onClick={jump} disabled={!started||phase!=="ground"}>Jump</button><button className="restart" onClick={()=>{reset();setStarted(true);}}>Restart</button></nav>
  </main>;
}
