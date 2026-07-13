import { Text, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Vector3, type Group, type Mesh } from "three";
import "./superZoosAdventureV24.css";

type Lane = -1 | 0 | 1;
type HeroId = "peter" | "judy";
type Phase = "ground" | "launch" | "sky" | "landing" | "grind";
type Kind = "star" | "badge" | "meteor" | "ice" | "barrier" | "skateboard" | "rail" | "trampoline" | "zap";
type Pattern = { kind: Kind; lane: Lane; offsets?: number[]; label: string; good: boolean; jumpable?: boolean };
type SkyGem = { id: number; lane: Lane; progress: number; taken: boolean };
type Gesture = { x: number; y: number };

const BASE = import.meta.env.BASE_URL || "/";
const asset = (p: string) => `${BASE}${p.replace(/^\/+/, "")}`;
const LANE_X: Record<Lane, number> = { [-1]: -2.35, [0]: 0, [1]: 2.35 };
const SKY_LANES: Lane[] = [-1,0,1,1,0,-1,0,1,-1,0,1,0];
const PATTERNS: Pattern[] = [
  { kind:"star", lane:0, offsets:[0,.22,.44,.66,.88], label:"COLLECT", good:true },
  { kind:"star", lane:-1, offsets:[0,.24,.48,.72], label:"COLLECT", good:true },
  { kind:"meteor", lane:0, label:"JUMP", good:false, jumpable:true },
  { kind:"star", lane:1, offsets:[0,.2,.4,.6,.8], label:"COLLECT", good:true },
  { kind:"badge", lane:-1, label:"POWER", good:true },
  { kind:"barrier", lane:0, label:"JUMP", good:false, jumpable:true },
  { kind:"star", lane:0, offsets:[0,.16,.32,.48,.64,.8], label:"COLLECT", good:true },
  { kind:"ice", lane:1, label:"JUMP", good:false, jumpable:true },
  { kind:"skateboard", lane:-1, label:"SKATE", good:true },
  { kind:"rail", lane:0, label:"LONG RAIL", good:true },
  { kind:"zap", lane:1, label:"DODGE", good:false },
  { kind:"star", lane:-1, offsets:[0,.18,.36,.54,.72,.9], label:"COLLECT", good:true },
  { kind:"trampoline", lane:0, label:"SKY RUN", good:true },
  { kind:"star", lane:1, offsets:[0,.2,.4,.6,.8], label:"COLLECT", good:true },
];

const HEROES = {
  peter:{name:"Peter",tagline:"Strong, brave and gentle",normal:[1,2,3,4].map(n=>asset(`images/characters/animation/peter-normal-run-0${n}.png`)),superFrames:[asset("images/characters/animation/peter-super-run-01.png"),asset("images/characters/animation/peter-super-turn-01.png"),asset("images/characters/animation/peter-super-turn-02.png")]},
  judy:{name:"Judy",tagline:"Fast, funny and fearless",normal:[1,2,3,4].map(n=>asset(`images/characters/animation/judy-normal-run-0${n}.png`)),superFrames:[asset("images/characters/animation/judy-super-run-01.png"),asset("images/characters/animation/judy-super-turn-01.png")]},
} as const;

const makeSky=():SkyGem[]=>SKY_LANES.map((lane,id)=>({id,lane,progress:-id*.1,taken:false}));

function CameraRig({lane,phase}:{lane:Lane;phase:Phase}){
  const {camera}=useThree(); const p=useRef(new Vector3()); const look=useRef(new Vector3());
  useFrame((_,dt)=>{const sky=phase==="sky"||phase==="launch";p.current.set(lane*-.06,sky?5.6:4.7,sky?11.8:12.4);camera.position.lerp(p.current,Math.min(1,dt*7));look.current.set(lane*.03,sky?2.5:1.05,-12.5);camera.lookAt(look.current);});
  return null;
}

function HeroSprite({hero,lane,phase,jumping,skating}:{hero:HeroId;lane:Lane;phase:Phase;jumping:boolean;skating:boolean}){
  const paths=phase==="sky"||phase==="launch"||phase==="landing"?HEROES[hero].superFrames:HEROES[hero].normal;
  const textures=useTexture(paths as unknown as string[]); const [frame,setFrame]=useState(0);
  useEffect(()=>{setFrame(0);const id=window.setInterval(()=>setFrame(v=>(v+1)%textures.length),phase==="ground"||phase==="grind"?88:140);return()=>clearInterval(id);},[textures,phase]);
  const y=phase==="sky"?3.8:phase==="launch"?3.0:phase==="landing"?2.4:jumping?2.55:1.95;
  return <group position={[LANE_X[lane],y,4.8]}>
    <sprite scale={[1.72,2.4,1]}><spriteMaterial map={textures[frame]} transparent depthWrite={false}/></sprite>
    <mesh position={[0,-1.05,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.5,24]}/><meshBasicMaterial color="#173d2a" transparent opacity={phase==="sky"?0:.22}/></mesh>
    {skating&&phase!=="sky"&&<group position={[0,-1.02,.08]}><mesh><boxGeometry args={[1.35,.12,.42]}/><meshStandardMaterial color="#35dfd0" emissive="#168fa8" emissiveIntensity={.45}/></mesh>{[-.45,.45].map(x=><mesh key={x} position={[x,-.14,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.09,.09,.32,10]}/><meshStandardMaterial color="#27394a"/></mesh>)}</group>}
  </group>
}

function MovingProp({x,z,kind,speed}:{x:number;z:number;kind:"tree"|"building"|"fence"|"hoop"|"shade"|"play"|"goals"|"canteen";speed:number}){
 const ref=useRef<Group>(null);useFrame((_,dt)=>{if(!ref.current)return;ref.current.position.z+=dt*speed;if(ref.current.position.z>20)ref.current.position.z-=150;});
 return <group ref={ref} position={[x,0,z]}>
  {kind==="tree"&&<><mesh position={[0,1.3,0]}><cylinderGeometry args={[.18,.32,2.6,10]}/><meshStandardMaterial color="#76513a"/></mesh><mesh position={[0,3,0]}><sphereGeometry args={[1.15,14,12]}/><meshStandardMaterial color="#3f8152"/></mesh><mesh position={[.75,2.7,0]}><sphereGeometry args={[.72,12,10]}/><meshStandardMaterial color="#5b9b66"/></mesh></>}
  {kind==="building"&&<><mesh position={[0,1.55,0]}><boxGeometry args={[7.3,3.1,3]}/><meshStandardMaterial color="#d5a05e"/></mesh><mesh position={[0,3.28,0]} rotation={[0,0,Math.PI/4]}><boxGeometry args={[4.55,4.55,3.05]}/><meshStandardMaterial color="#a84d38"/></mesh>{[-2.4,-1.2,0,1.2,2.4].map(v=><mesh key={v} position={[v,1.6,1.54]}><boxGeometry args={[.7,.85,.08]}/><meshStandardMaterial color="#9ed8ea"/></mesh>)}</>}
  {kind==="canteen"&&<><mesh position={[0,1.3,0]}><boxGeometry args={[8,2.6,3.2]}/><meshStandardMaterial color="#e1b46b"/></mesh><mesh position={[0,2.7,0]}><boxGeometry args={[8.6,.22,3.7]}/><meshStandardMaterial color="#5d7381"/></mesh>{[-2.6,0,2.6].map(v=><mesh key={v} position={[v,1.4,1.64]}><boxGeometry args={[1.7,.9,.08]}/><meshStandardMaterial color="#9ed8ea"/></mesh>)}</>}
  {kind==="fence"&&<><mesh position={[0,.8,0]}><boxGeometry args={[6,.12,.12]}/><meshStandardMaterial color="#eee8d8"/></mesh>{[-2.5,-1.25,0,1.25,2.5].map(v=><mesh key={v} position={[v,.68,0]}><boxGeometry args={[.11,1.4,.11]}/><meshStandardMaterial color="#eee8d8"/></mesh>)}</>}
  {kind==="hoop"&&<><mesh position={[0,1.8,0]}><cylinderGeometry args={[.08,.08,3.6,8]}/><meshStandardMaterial color="#657078"/></mesh><mesh position={[0,3.35,.25]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.5,.07,10,24]}/><meshStandardMaterial color="#eb5a2c"/></mesh></>}
  {kind==="shade"&&<><mesh position={[0,2.7,0]} rotation={[-.1,0,0]}><boxGeometry args={[5.4,.12,3.8]}/><meshStandardMaterial color="#f08a3f"/></mesh>{[-2.2,2.2].map(v=><mesh key={v} position={[v,1.3,0]}><cylinderGeometry args={[.08,.08,2.6,8]}/><meshStandardMaterial color="#59646d"/></mesh>)}</>}
  {kind==="play"&&<><mesh position={[0,1.25,0]} rotation={[.45,0,0]}><boxGeometry args={[3.2,.18,3.8]}/><meshStandardMaterial color="#f0bd42"/></mesh><mesh position={[0,.5,1.45]}><boxGeometry args={[3.6,.2,.5]}/><meshStandardMaterial color="#3f85c9"/></mesh></>}
  {kind==="goals"&&<><mesh position={[0,1.2,0]}><boxGeometry args={[3.8,.12,.12]}/><meshStandardMaterial color="#f4f4f0"/></mesh>{[-1.8,1.8].map(v=><mesh key={v} position={[v,.6,0]}><boxGeometry args={[.12,1.2,.12]}/><meshStandardMaterial color="#f4f4f0"/></mesh>)}</>}
 </group>
}

function PatternMesh({pattern,progress}:{pattern:Pattern;progress:number}){
 const baseZ=-42+progress*48; const x=LANE_X[pattern.lane]; const ring=pattern.good?"#ffd93d":"#ff3030";
 if(pattern.kind==="rail") return <group position={[x,0,baseZ-5]}><Text position={[0,1.3,4.2]} fontSize={.32} color="#fff" outlineWidth={.04} outlineColor="#3b4b55">LONG RAIL</Text><mesh position={[0,.62,0]}><boxGeometry args={[.18,.18,18]}/><meshStandardMaterial color="#dce3e8" metalness={.85} roughness={.22}/></mesh>{[-8,-4,0,4,8].map(z=><mesh key={z} position={[0,.3,z]}><boxGeometry args={[.12,.62,.12]}/><meshStandardMaterial color="#6f7b84"/></mesh>)}</group>;
 if(pattern.kind==="trampoline") return <group position={[x,.2,baseZ]}><Text position={[0,2.1,0]} fontSize={.32} color="#fff" outlineWidth={.04} outlineColor="#6b5100">SKY RUN</Text><mesh rotation={[-Math.PI/2,0,0]}><cylinderGeometry args={[2.2,2.2,.22,36]}/><meshStandardMaterial color="#287edb"/></mesh><mesh position={[0,.14,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[1.8,36]}/><meshStandardMaterial color="#ffdf3e" emissive="#e28b00" emissiveIntensity={.35}/></mesh></group>;
 const offsets=pattern.offsets??[0];
 return <>{offsets.map((off,i)=><group key={i} position={[x,pattern.good?1.28:.58,baseZ-off*12]}>
   <mesh rotation={[Math.PI/2,0,0]} position={[0,-.45,0]}><torusGeometry args={[.8,.07,10,36]}/><meshStandardMaterial color={ring} emissive={ring} emissiveIntensity={.7}/></mesh>
   {i===0&&<Text position={[0,1.05,0]} fontSize={.29} color="#fff" outlineWidth={.04} outlineColor={pattern.good?"#6b5100":"#850000"}>{pattern.label}</Text>}
   {pattern.kind==="star"&&<mesh rotation={[progress*5+i,progress*7,0]}><octahedronGeometry args={[.58,0]}/><meshStandardMaterial color="#ffe056" emissive="#ff9c00" emissiveIntensity={.9}/></mesh>}
   {pattern.kind==="badge"&&<mesh><cylinderGeometry args={[.62,.62,.2,8]}/><meshStandardMaterial color="#2da8ff" emissive="#167ac7" emissiveIntensity={.7}/></mesh>}
   {pattern.kind==="meteor"&&<mesh rotation={[.4,progress*7,.2]}><dodecahedronGeometry args={[.72,0]}/><meshStandardMaterial color="#d64d2b" emissive="#ff5a20" emissiveIntensity={.45}/></mesh>}
   {pattern.kind==="ice"&&<mesh><boxGeometry args={[1.2,1.05,1.05]}/><meshStandardMaterial color="#a7efff" emissive="#48bddf" emissiveIntensity={.3} transparent opacity={.88}/></mesh>}
   {pattern.kind==="barrier"&&<group><mesh><boxGeometry args={[1.6,.34,.42]}/><meshStandardMaterial color="#ff7a31"/></mesh>{[-.58,.58].map(v=><mesh key={v} position={[v,-.32,0]}><boxGeometry args={[.18,.76,.18]}/><meshStandardMaterial color="#fff"/></mesh>)}</group>}
   {pattern.kind==="zap"&&<group><mesh rotation={[0,0,.58]}><boxGeometry args={[.28,1.3,.28]}/><meshStandardMaterial color="#ffd83a" emissive="#ff263b" emissiveIntensity={.9}/></mesh><mesh rotation={[0,0,-.58]} position={[.35,-.08,0]}><boxGeometry args={[.28,1.3,.28]}/><meshStandardMaterial color="#ff3449" emissive="#d91a32" emissiveIntensity={.9}/></mesh></group>}
   {pattern.kind==="skateboard"&&<group><mesh><boxGeometry args={[1.5,.15,.48]}/><meshStandardMaterial color="#34dfd0" emissive="#168fa8" emissiveIntensity={.55}/></mesh>{[-.5,.5].map(v=><mesh key={v} position={[v,-.16,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.1,.1,.34,10]}/><meshStandardMaterial color="#26394a"/></mesh>)}</group>}
 </group>)}</>;
}

function World({hero,lane,phase,jumping,skating,pattern,progress,skyGems,zone}:{hero:HeroId;lane:Lane;phase:Phase;jumping:boolean;skating:boolean;pattern:Pattern;progress:number;skyGems:SkyGem[];zone:number}){
 const speed=phase==="sky"?12.5:9.5;
 return <><CameraRig lane={lane} phase={phase}/><color attach="background" args={[phase==="sky"?"#62c9ff":"#8ed7ef"]}/><fog attach="fog" args={[phase==="sky"?"#c7efff":"#d0e8ed",26,105]}/><ambientLight intensity={1.16}/><directionalLight position={[8,14,7]} intensity={2.3} castShadow/><hemisphereLight color="#e4f8ff" groundColor="#3e6846" intensity={.75}/>
 <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.02,-42]}><planeGeometry args={[36,150]}/><meshStandardMaterial color="#3e774c"/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[0,0,-42]}><planeGeometry args={[13.5,150]}/><meshStandardMaterial color="#50626c" roughness={.98}/></mesh>
 {[-2.25,2.25].map(x=>Array.from({length:34},(_,i)=><mesh key={`${x}-${i}`} position={[x,.03,-i*4.2]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.09,1.45]}/><meshStandardMaterial color="#f5efe0"/></mesh>))}
 {Array.from({length:15},(_,i)=><MovingProp key={`lt${i}`} x={-13-(i%2)*1.3} z={-i*9.3-5} kind="tree" speed={speed*.9}/>) }{Array.from({length:15},(_,i)=><MovingProp key={`rt${i}`} x={13+(i%2)*1.3} z={-i*9.3-9} kind="tree" speed={speed*.9}/>) }
 {zone===0&&<><MovingProp x={-15} z={-35} kind="building" speed={speed*.7}/><MovingProp x={15} z={-78} kind="building" speed={speed*.7}/><MovingProp x={-13} z={-60} kind="fence" speed={speed}/></>}
 {zone===1&&<><MovingProp x={-13.5} z={-42} kind="goals" speed={speed*.86}/><MovingProp x={13.5} z={-82} kind="goals" speed={speed*.86}/></>}
 {zone===2&&<><MovingProp x={-14} z={-40} kind="shade" speed={speed*.8}/><MovingProp x={14} z={-76} kind="play" speed={speed*.8}/></>}
 {zone===3&&<><MovingProp x={-13.5} z={-45} kind="hoop" speed={speed*.88}/><MovingProp x={13.5} z={-88} kind="hoop" speed={speed*.88}/></>}
 {zone===4&&<><MovingProp x={-15} z={-42} kind="canteen" speed={speed*.7}/><MovingProp x={15} z={-86} kind="canteen" speed={speed*.7}/></>}
 <HeroSprite hero={hero} lane={lane} phase={phase} jumping={jumping} skating={skating}/>{(phase==="ground"||phase==="grind")&&<PatternMesh pattern={pattern} progress={progress}/>} {phase==="sky"&&skyGems.filter(g=>!g.taken).map(g=><group key={g.id} position={[LANE_X[g.lane],3.2,-30+g.progress*35]}><mesh><torusGeometry args={[.5,.14,12,28]}/><meshStandardMaterial color="#ffda3d" emissive="#ff9700" emissiveIntensity={.85}/></mesh></group>)}</>;
}

export function SuperZoosAdventureV24(){
 const [hero,setHero]=useState<HeroId>("peter"),[started,setStarted]=useState(false),[phase,setPhase]=useState<Phase>("ground"),[lane,setLane]=useState<Lane>(0); const laneRef=useRef<Lane>(0);
 const [jumping,setJumping]=useState(false); const jumpingRef=useRef(false); const [index,setIndex]=useState(0),[progress,setProgress]=useState(-.05),[skyGems,setSkyGems]=useState<SkyGem[]>(makeSky),[elapsed,setElapsed]=useState(0),[score,setScore]=useState(0),[gems,setGems]=useState(0),[hearts,setHearts]=useState(3),[skating,setSkating]=useState(false),[feedback,setFeedback]=useState(""),[gameOver,setGameOver]=useState(false); const gesture=useRef<Gesture|null>(null),timer=useRef<number|null>(null); const pattern=PATTERNS[index%PATTERNS.length]; const zone=Math.floor(index/3)%5;
 useEffect(()=>{laneRef.current=lane},[lane]);useEffect(()=>{jumpingRef.current=jumping},[jumping]); const say=useCallback((t:string)=>{setFeedback(t);if(timer.current)clearTimeout(timer.current);timer.current=window.setTimeout(()=>setFeedback(""),1000)},[]); const next=useCallback(()=>{setIndex(i=>i+1);setProgress(-.05)},[]); const reset=useCallback(()=>{setPhase("ground");setLane(0);laneRef.current=0;setJumping(false);jumpingRef.current=false;setIndex(0);setProgress(-.05);setSkyGems(makeSky());setElapsed(0);setScore(0);setGems(0);setHearts(3);setSkating(false);setFeedback("");setGameOver(false)},[]);
 useEffect(()=>{if(!started||gameOver)return;let raf=0,prev=performance.now();const tick=(now:number)=>{const dt=Math.min(.04,(now-prev)/1000);prev=now;if(phase==="ground"||phase==="grind"){setProgress(p=>{const n=p+dt*.235;if(n>=1.0&&p<1.0){if(pattern.kind==="trampoline"&&laneRef.current===pattern.lane){setPhase("launch");setElapsed(0);setSkyGems(makeSky());say("Sky Run!");return n;}if(laneRef.current===pattern.lane){if(pattern.good){const value=pattern.kind==="badge"?20:pattern.kind==="skateboard"?25:pattern.kind==="rail"?40:(pattern.offsets?.length??1)*5;setScore(s=>s+value);setGems(g=>g+(pattern.offsets?.length??1));if(pattern.kind==="skateboard"){setSkating(true);say("Skateboard unlocked!")}else if(pattern.kind==="rail"&&skating){setPhase("grind");say("Long rail grind!")}else say(`${pattern.label} +${value}`)}else if(pattern.jumpable&&jumpingRef.current){setScore(s=>s+5);say("Great jump +5")}else{setHearts(h=>{const v=Math.max(0,h-1);if(v===0){setGameOver(true);setStarted(false)}return v});say("Careful — heart lost")}}}if(n>1.34){next();return-.05}return n})}else{setElapsed(v=>v+dt);if(phase==="launch"&&elapsed>.55){setPhase("sky");setElapsed(0)}else if(phase==="sky"){setSkyGems(list=>list.map(g=>{if(g.taken)return g;const p=g.progress+dt*.38;if(p>=.84&&p<=1.05&&g.lane===laneRef.current){setScore(s=>s+10);setGems(v=>v+1);say("Sky gem +10");return{...g,progress:p,taken:true}}return{...g,progress:p,taken:p>1.15}}));if(elapsed>3){setPhase("landing");setElapsed(0)}}else if(phase==="landing"&&elapsed>.75){setPhase("ground");setElapsed(0);next();say("Back to the school route!")}}raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[started,gameOver,phase,elapsed,pattern,next,say,skating]);
 const move=(d:-1|1)=>{if(started)setLane(v=>Math.max(-1,Math.min(1,v+d)) as Lane)}; const jump=()=>{if(!started||jumping||phase!=="ground")return;setJumping(true);jumpingRef.current=true;window.setTimeout(()=>{setJumping(false);jumpingRef.current=false},700)}; const down=(e:PointerEvent<HTMLDivElement>)=>{if(started)gesture.current={x:e.clientX,y:e.clientY}}; const up=(e:PointerEvent<HTMLDivElement>)=>{const s=gesture.current;gesture.current=null;if(!s)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;if(Math.abs(dx)>34&&Math.abs(dx)>Math.abs(dy)*.7)move(dx>0?1:-1);else if(dy<-26||Math.abs(dx)<14)jump()}; const total=score+index*3;
 return <main className={`v24-app phase-${phase}`}><header className="v24-hud"><div><small>SUPER ZOOS ADVENTURE V2.4</small><h1>Playground World</h1></div><div className="v24-stats"><b>{[0,1,2].map(i=><i key={i} className={i<hearts?"on":""}>♥</i>)}</b><b>Gems {gems}</b><b>Score {total}</b><b>{skating?"Skateboard":"Run"}</b></div></header><section className="v24-stage" onPointerDown={down} onPointerUp={up} onPointerCancel={()=>gesture.current=null}><Canvas shadows dpr={[1,1.5]} camera={{position:[0,4.7,12.4],fov:44}}><World hero={hero} lane={lane} phase={phase} jumping={jumping} skating={skating} pattern={pattern} progress={progress} skyGems={skyGems} zone={zone}/></Canvas>{feedback&&<div className="v24-feedback">{feedback}</div>}{!started&&!gameOver&&<div className="v24-menu"><div className="v24-panel"><small>CHOOSE YOUR HERO</small><h2>Playground World</h2><p>Collect patterns, jump school obstacles, unlock the skateboard, grind the long rail and reach the visible trampoline.</p><div className="v24-cards">{(Object.keys(HEROES) as HeroId[]).map(id=><button key={id} className={hero===id?"selected":""} onClick={()=>setHero(id)}><img src={HEROES[id].normal[0]} alt={HEROES[id].name}/><strong>{HEROES[id].name}</strong><span>{HEROES[id].tagline}</span></button>)}</div><button className="v24-start" onClick={()=>{reset();setStarted(true)}}>Start Adventure</button></div></div>}{gameOver&&<div className="v24-menu"><div className="v24-panel"><small>GREAT TRY</small><h2>{HEROES[hero].name} is ready again</h2><p>Score {total} • Gems {gems}</p><button className="v24-start" onClick={()=>{reset();setStarted(true)}}>Try Again</button><button className="v24-secondary" onClick={()=>{reset();setStarted(false)}}>Choose Hero</button></div></div>}{started&&<div className="v24-key"><span className="good">GOLD / BLUE = COLLECT</span><span className="bad">RED = DODGE OR JUMP</span></div>}</section><nav className="v24-controls"><button onClick={()=>move(-1)} disabled={!started}>Left</button><button onClick={()=>move(1)} disabled={!started}>Right</button><button className="jump" onClick={jump} disabled={!started||phase!=="ground"}>Jump</button><button className="restart" onClick={()=>{reset();setStarted(true)}}>Restart</button></nav></main>
}
