import { Text, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Vector3, type Group, type Mesh } from "three";
import "./superZoosAdventureV25.css";

type Lane = -1 | 0 | 1;
type HeroId = "peter" | "judy";
type Phase = "ground" | "launch" | "sky" | "landing" | "grind";
type Kind = "star" | "shield" | "boost" | "magnet" | "skateboard" | "meteor" | "ice" | "barrier" | "cone" | "bag" | "ball" | "tunnel" | "swingbar" | "rail" | "trampoline";
type Pattern = { kind: Kind; lane: Lane; offsets: number[]; label: string; good: boolean; jumpable?: boolean; slideOnly?: boolean };
type SkyGem = { id: number; lane: Lane; progress: number; taken: boolean };
type Gesture = { x: number; y: number };
type PowerState = { shieldUntil: number; boostUntil: number; magnetUntil: number };

const BASE = import.meta.env.BASE_URL || "/";
const asset = (p: string) => `${BASE}${p.replace(/^\/+/, "")}`;
const LANE_X: Record<Lane, number> = { [-1]: -2.45, [0]: 0, [1]: 2.45 };
const HEROES = {
  peter: { name: "Peter", tagline: "Strong, brave and gentle", normal: [1,2,3,4].map(n=>asset(`images/characters/animation/peter-normal-run-0${n}.png`)), superFrames:[asset("images/characters/animation/peter-super-run-01.png"),asset("images/characters/animation/peter-super-turn-01.png"),asset("images/characters/animation/peter-super-turn-02.png")] },
  judy: { name: "Judy", tagline: "Fast, funny and fearless", normal: [1,2,3,4].map(n=>asset(`images/characters/animation/judy-normal-run-0${n}.png`)), superFrames:[asset("images/characters/animation/judy-super-run-01.png"),asset("images/characters/animation/judy-super-turn-01.png")] }
} as const;

const PATTERNS: Pattern[] = [
  {kind:"star",lane:0,offsets:[0,.14,.28,.42,.56,.7],label:"STAR TRAIL",good:true},
  {kind:"cone",lane:-1,offsets:[0],label:"JUMP",good:false,jumpable:true},
  {kind:"star",lane:1,offsets:[0,.14,.28,.42,.56],label:"COLLECT",good:true},
  {kind:"shield",lane:0,offsets:[0],label:"SHIELD",good:true},
  {kind:"meteor",lane:1,offsets:[0],label:"JUMP",good:false,jumpable:true},
  {kind:"star",lane:-1,offsets:[0,.12,.24,.36,.48,.6,.72],label:"STAR LINE",good:true},
  {kind:"tunnel",lane:0,offsets:[0],label:"SLIDE",good:false,slideOnly:true},
  {kind:"magnet",lane:1,offsets:[0],label:"MAGNET",good:true},
  {kind:"bag",lane:-1,offsets:[0],label:"DODGE",good:false},
  {kind:"boost",lane:0,offsets:[0],label:"SPEED",good:true},
  {kind:"barrier",lane:1,offsets:[0],label:"JUMP",good:false,jumpable:true},
  {kind:"star",lane:0,offsets:[0,.1,.2,.3,.4,.5,.6,.7,.8],label:"BONUS LINE",good:true},
  {kind:"skateboard",lane:-1,offsets:[0],label:"SKATEBOARD",good:true},
  {kind:"rail",lane:0,offsets:[0],label:"LONG RAIL",good:true},
  {kind:"swingbar",lane:1,offsets:[0],label:"SLIDE",good:false,slideOnly:true},
  {kind:"ball",lane:0,offsets:[0],label:"DODGE",good:false},
  {kind:"ice",lane:-1,offsets:[0],label:"JUMP",good:false,jumpable:true},
  {kind:"star",lane:1,offsets:[0,.12,.24,.36,.48,.6],label:"COLLECT",good:true},
  {kind:"trampoline",lane:0,offsets:[0],label:"SKY RUN",good:true}
];
const SKY: Lane[] = [-1,0,1,1,0,-1,0,1,-1,0,1,0];
const makeSky = (): SkyGem[] => SKY.map((lane,id)=>({id,lane,progress:-id*.09,taken:false}));

function CameraRig({lane,phase}:{lane:Lane;phase:Phase}){
  const {camera}=useThree(); const p=useRef(new Vector3()); const look=useRef(new Vector3());
  useFrame((_,dt)=>{const sky=phase==="sky"||phase==="launch";p.current.set(lane*-.05,sky?5.8:5.0,sky?12.2:13.2);camera.position.lerp(p.current,Math.min(1,dt*7));look.current.set(lane*.02,sky?2.5:1.2,-13.5);camera.lookAt(look.current);});
  return null;
}

function HeroSprite({hero,lane,phase,jumping,sliding,skating,powers}:{hero:HeroId;lane:Lane;phase:Phase;jumping:boolean;sliding:boolean;skating:boolean;powers:PowerState}){
  const paths=phase==="sky"||phase==="launch"||phase==="landing"?HEROES[hero].superFrames:HEROES[hero].normal;
  const textures=useTexture(paths as unknown as string[]); const [frame,setFrame]=useState(0);
  useEffect(()=>{setFrame(0);const id=window.setInterval(()=>setFrame(v=>(v+1)%textures.length),phase==="ground"||phase==="grind"?86:135);return()=>clearInterval(id);},[textures,phase]);
  const now=performance.now(); const powered=powers.shieldUntil>now||powers.boostUntil>now||powers.magnetUntil>now;
  const y=phase==="sky"?3.9:phase==="launch"?3.15:phase==="landing"?2.55:jumping?2.95:sliding?1.35:2.15;
  return <group position={[LANE_X[lane],y,5.2]} scale={sliding?[1.15,.62,1]:[1,1,1]}>
    {powered&&<pointLight color={powers.shieldUntil>now?"#66dfff":powers.boostUntil>now?"#ffe052":"#e06cff"} intensity={1.4} distance={4}/>} 
    <sprite scale={[1.55,2.18,1]}><spriteMaterial map={textures[frame]} transparent depthWrite={false}/></sprite>
    <mesh position={[0,-.94,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.46,24]}/><meshBasicMaterial color="#173d2a" transparent opacity={phase==="sky"?0:.22}/></mesh>
    {skating&&phase!=="sky"&&<group position={[0,-.96,.05]}>
      <mesh><boxGeometry args={[.48,.13,1.55]}/><meshStandardMaterial color="#35dfd0" emissive="#168fa8" emissiveIntensity={.5}/></mesh>
      {[-.52,.52].map(z=><group key={z}>{[-.2,.2].map(x=><mesh key={x} position={[x,-.14,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.09,.09,.18,10]}/><meshStandardMaterial color="#27394a"/></mesh>)}</group>)}
    </group>}
  </group>;
}

function MovingProp({x,z,kind,speed}:{x:number;z:number;kind:"tree"|"building"|"fence"|"hoop"|"shade"|"play"|"goals"|"canteen"|"bench"|"bike";speed:number}){
  const ref=useRef<Group>(null);useFrame((_,dt)=>{if(!ref.current)return;ref.current.position.z+=dt*speed;if(ref.current.position.z>22)ref.current.position.z-=165;});
  return <group ref={ref} position={[x,0,z]}>
    {kind==="tree"&&<><mesh position={[0,1.3,0]}><cylinderGeometry args={[.18,.32,2.6,10]}/><meshStandardMaterial color="#76513a"/></mesh><mesh position={[0,3,0]}><sphereGeometry args={[1.15,14,12]}/><meshStandardMaterial color="#3f8152"/></mesh><mesh position={[.75,2.7,0]}><sphereGeometry args={[.72,12,10]}/><meshStandardMaterial color="#5b9b66"/></mesh></>}
    {kind==="building"&&<><mesh position={[0,1.55,0]}><boxGeometry args={[7.3,3.1,3]}/><meshStandardMaterial color="#d5a05e"/></mesh><mesh position={[0,3.28,0]} rotation={[0,0,Math.PI/4]}><boxGeometry args={[4.55,4.55,3.05]}/><meshStandardMaterial color="#a84d38"/></mesh></>}
    {kind==="canteen"&&<><mesh position={[0,1.3,0]}><boxGeometry args={[8,2.6,3.2]}/><meshStandardMaterial color="#e1b46b"/></mesh><mesh position={[0,2.7,0]}><boxGeometry args={[8.6,.22,3.7]}/><meshStandardMaterial color="#5d7381"/></mesh></>}
    {kind==="fence"&&<><mesh position={[0,.8,0]}><boxGeometry args={[6,.12,.12]}/><meshStandardMaterial color="#eee8d8"/></mesh>{[-2.5,-1.25,0,1.25,2.5].map(v=><mesh key={v} position={[v,.68,0]}><boxGeometry args={[.11,1.4,.11]}/><meshStandardMaterial color="#eee8d8"/></mesh>)}</>}
    {kind==="hoop"&&<><mesh position={[0,1.8,0]}><cylinderGeometry args={[.08,.08,3.6,8]}/><meshStandardMaterial color="#657078"/></mesh><mesh position={[0,3.35,.25]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.5,.07,10,24]}/><meshStandardMaterial color="#eb5a2c"/></mesh></>}
    {kind==="shade"&&<><mesh position={[0,2.7,0]} rotation={[-.1,0,0]}><boxGeometry args={[5.4,.12,3.8]}/><meshStandardMaterial color="#f08a3f"/></mesh>{[-2.2,2.2].map(v=><mesh key={v} position={[v,1.3,0]}><cylinderGeometry args={[.08,.08,2.6,8]}/><meshStandardMaterial color="#59646d"/></mesh>)}</>}
    {kind==="play"&&<><mesh position={[0,1.25,0]} rotation={[.45,0,0]}><boxGeometry args={[3.2,.18,3.8]}/><meshStandardMaterial color="#f0bd42"/></mesh><mesh position={[0,.5,1.45]}><boxGeometry args={[3.6,.2,.5]}/><meshStandardMaterial color="#3f85c9"/></mesh></>}
    {kind==="goals"&&<><mesh position={[0,1.2,0]}><boxGeometry args={[3.8,.12,.12]}/><meshStandardMaterial color="#f4f4f0"/></mesh>{[-1.8,1.8].map(v=><mesh key={v} position={[v,.6,0]}><boxGeometry args={[.12,1.2,.12]}/><meshStandardMaterial color="#f4f4f0"/></mesh>)}</>}
    {kind==="bench"&&<><mesh position={[0,.65,0]}><boxGeometry args={[2.8,.18,.5]}/><meshStandardMaterial color="#9b6a44"/></mesh>{[-1,1].map(v=><mesh key={v} position={[v,.28,0]}><boxGeometry args={[.16,.72,.16]}/><meshStandardMaterial color="#60442f"/></mesh>)}</>}
    {kind==="bike"&&<>{[-.8,.8].map(v=><mesh key={v} position={[v,.55,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.45,.06,10,24]}/><meshStandardMaterial color="#324b5c"/></mesh>)}<mesh position={[0,.75,0]}><boxGeometry args={[1.6,.08,.08]}/><meshStandardMaterial color="#4e9cca"/></mesh></>}
  </group>;
}

function PickupBurst({x,z,color}:{x:number;z:number;color:string}){
  return <group position={[x,1.35,z]}>{Array.from({length:8},(_,i)=><mesh key={i} position={[Math.cos(i*Math.PI/4)*.55,Math.sin(i*Math.PI/4)*.55,0]}><sphereGeometry args={[.09,8,8]}/><meshBasicMaterial color={color}/></mesh>)}</group>;
}

function ItemShape({kind}:{kind:Kind}){
  if(kind==="star") return <mesh><octahedronGeometry args={[.58,0]}/><meshStandardMaterial color="#ffe056" emissive="#ff9c00" emissiveIntensity={.9}/></mesh>;
  if(kind==="shield") return <mesh><icosahedronGeometry args={[.62,0]}/><meshStandardMaterial color="#55d9ff" emissive="#178dd2" emissiveIntensity={.8}/></mesh>;
  if(kind==="boost") return <mesh rotation={[0,0,.8]}><coneGeometry args={[.55,1.1,5]}/><meshStandardMaterial color="#ffe052" emissive="#ff8c00" emissiveIntensity={.8}/></mesh>;
  if(kind==="magnet") return <group><mesh position={[-.25,0,0]} rotation={[0,0,.25]}><boxGeometry args={[.22,.9,.22]}/><meshStandardMaterial color="#ef4ed2" emissive="#9b2cc1" emissiveIntensity={.7}/></mesh><mesh position={[.25,0,0]} rotation={[0,0,-.25]}><boxGeometry args={[.22,.9,.22]}/><meshStandardMaterial color="#ef4ed2" emissive="#9b2cc1" emissiveIntensity={.7}/></mesh></group>;
  if(kind==="skateboard") return <group rotation={[0,0,0]}><mesh><boxGeometry args={[.5,.14,1.55]}/><meshStandardMaterial color="#34dfd0" emissive="#168fa8" emissiveIntensity={.55}/></mesh>{[-.52,.52].map(z=><group key={z}>{[-.2,.2].map(x=><mesh key={x} position={[x,-.15,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.1,.1,.18,10]}/><meshStandardMaterial color="#26394a"/></mesh>)}</group>)}</group>;
  if(kind==="meteor") return <mesh><dodecahedronGeometry args={[.72,0]}/><meshStandardMaterial color="#d64d2b" emissive="#ff5a20" emissiveIntensity={.45}/></mesh>;
  if(kind==="ice") return <mesh><boxGeometry args={[1.2,1.05,1.05]}/><meshStandardMaterial color="#a7efff" emissive="#48bddf" emissiveIntensity={.3} transparent opacity={.88}/></mesh>;
  if(kind==="barrier") return <group><mesh><boxGeometry args={[1.6,.34,.42]}/><meshStandardMaterial color="#ff7a31"/></mesh>{[-.58,.58].map(v=><mesh key={v} position={[v,-.32,0]}><boxGeometry args={[.18,.76,.18]}/><meshStandardMaterial color="#fff"/></mesh>)}</group>;
  if(kind==="cone") return <mesh><coneGeometry args={[.55,1.15,12]}/><meshStandardMaterial color="#ff7b32"/></mesh>;
  if(kind==="bag") return <group><mesh><boxGeometry args={[.9,.78,.42]}/><meshStandardMaterial color="#5d7fbd"/></mesh><mesh position={[0,.48,0]}><torusGeometry args={[.28,.06,8,18]}/><meshStandardMaterial color="#2e4e83"/></mesh></group>;
  if(kind==="ball") return <mesh><sphereGeometry args={[.58,18,14]}/><meshStandardMaterial color="#ef7e32"/></mesh>;
  return null;
}

function PatternMesh({pattern,progress,collected,burst}:{pattern:Pattern;progress:number;collected:number[];burst:number|null}){
  const baseZ=-46+progress*52; const x=LANE_X[pattern.lane];
  if(pattern.kind==="rail") return <group position={[x,0,baseZ-8]}><Text position={[0,1.4,7]} fontSize={.33} color="#fff" outlineWidth={.04} outlineColor="#344851">LONG RAIL</Text><mesh position={[0,.7,0]}><boxGeometry args={[.18,.18,28]}/><meshStandardMaterial color="#dce3e8" metalness={.85} roughness={.2}/></mesh>{[-13,-9,-5,-1,3,7,11,13].map(z=><mesh key={z} position={[0,.34,z]}><boxGeometry args={[.13,.68,.13]}/><meshStandardMaterial color="#6f7b84"/></mesh>)}</group>;
  if(pattern.kind==="trampoline") return <group position={[x,.2,baseZ]}><Text position={[0,2.1,0]} fontSize={.34} color="#fff" outlineWidth={.04} outlineColor="#6b5100">SKY RUN</Text><mesh rotation={[-Math.PI/2,0,0]}><cylinderGeometry args={[2.25,2.25,.22,36]}/><meshStandardMaterial color="#287edb"/></mesh><mesh position={[0,.14,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[1.82,36]}/><meshStandardMaterial color="#ffdf3e" emissive="#e28b00" emissiveIntensity={.35}/></mesh></group>;
  if(pattern.kind==="tunnel") return <group position={[x,0,baseZ]}><Text position={[0,2.7,0]} fontSize={.32} color="#fff" outlineWidth={.04} outlineColor="#850000">SLIDE</Text><mesh position={[0,1.9,0]}><boxGeometry args={[2.8,.28,1.2]}/><meshStandardMaterial color="#76583f"/></mesh>{[-1.25,1.25].map(v=><mesh key={v} position={[v,.95,0]}><boxGeometry args={[.24,1.9,.24]}/><meshStandardMaterial color="#76583f"/></mesh>)}</group>;
  if(pattern.kind==="swingbar") return <group position={[x,0,baseZ]}><Text position={[0,2.75,0]} fontSize={.32} color="#fff" outlineWidth={.04} outlineColor="#850000">SLIDE</Text><mesh position={[0,1.9,0]}><boxGeometry args={[2.9,.22,.3]}/><meshStandardMaterial color="#3f78b0"/></mesh>{[-1.3,1.3].map(v=><mesh key={v} position={[v,1,0]}><boxGeometry args={[.2,2,.2]}/><meshStandardMaterial color="#3f78b0"/></mesh>)}</group>;
  const ring=pattern.good?"#ffd93d":"#ff3030";
  return <>{pattern.offsets.map((off,i)=>{const z=baseZ-off*13;if(collected.includes(i)) return burst===i?<PickupBurst key={i} x={x} z={z} color={pattern.kind==="shield"?"#66dcff":pattern.kind==="magnet"?"#ed69ff":"#ffe056"}/>:null;return <group key={i} position={[x,pattern.good?1.3:.6,z]}>
    <mesh rotation={[Math.PI/2,0,0]} position={[0,-.47,0]}><torusGeometry args={[.82,.07,10,36]}/><meshStandardMaterial color={ring} emissive={ring} emissiveIntensity={.75}/></mesh>
    {i===0&&<Text position={[0,1.08,0]} fontSize={.3} color="#fff" outlineWidth={.04} outlineColor={pattern.good?"#6b5100":"#850000"}>{pattern.label}</Text>}
    <ItemShape kind={pattern.kind}/>
  </group>})}</>;
}

function World({hero,lane,phase,jumping,sliding,skating,powers,pattern,progress,collected,burst,skyGems,zone}:{hero:HeroId;lane:Lane;phase:Phase;jumping:boolean;sliding:boolean;skating:boolean;powers:PowerState;pattern:Pattern;progress:number;collected:number[];burst:number|null;skyGems:SkyGem[];zone:number}){
  const boost=powers.boostUntil>performance.now(); const speed=(phase==="sky"?12.5:9.6)*(boost?1.2:1);
  return <><CameraRig lane={lane} phase={phase}/><color attach="background" args={[phase==="sky"?"#62c9ff":"#8ed7ef"]}/><fog attach="fog" args={[phase==="sky"?"#c7efff":"#d0e8ed",28,112]}/><ambientLight intensity={1.18}/><directionalLight position={[8,14,7]} intensity={2.35} castShadow/><hemisphereLight color="#e4f8ff" groundColor="#3e6846" intensity={.76}/>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.02,-45]}><planeGeometry args={[38,165]}/><meshStandardMaterial color="#3e774c"/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[0,0,-45]}><planeGeometry args={[14.8,165]}/><meshStandardMaterial color="#50626c" roughness={.98}/></mesh>
  {[-2.4,2.4].map(x=>Array.from({length:38},(_,i)=><mesh key={`${x}-${i}`} position={[x,.03,-i*4.3]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.09,1.5]}/><meshStandardMaterial color="#f5efe0"/></mesh>))}
  {Array.from({length:16},(_,i)=><MovingProp key={`lt${i}`} x={-13.5-(i%2)*1.4} z={-i*9.8-5} kind="tree" speed={speed*.88}/>)}{Array.from({length:16},(_,i)=><MovingProp key={`rt${i}`} x={13.5+(i%2)*1.4} z={-i*9.8-9} kind="tree" speed={speed*.88}/>)}
  {zone===0&&<><MovingProp x={-15.5} z={-36} kind="building" speed={speed*.68}/><MovingProp x={15.5} z={-84} kind="building" speed={speed*.68}/><MovingProp x={-13.5} z={-64} kind="fence" speed={speed}/></>}
  {zone===1&&<><MovingProp x={-14} z={-44} kind="goals" speed={speed*.85}/><MovingProp x={14} z={-92} kind="goals" speed={speed*.85}/><MovingProp x={-13.5} z={-74} kind="bench" speed={speed*.95}/></>}
  {zone===2&&<><MovingProp x={-14.5} z={-42} kind="shade" speed={speed*.78}/><MovingProp x={14.5} z={-82} kind="play" speed={speed*.78}/></>}
  {zone===3&&<><MovingProp x={-14} z={-46} kind="hoop" speed={speed*.86}/><MovingProp x={14} z={-94} kind="hoop" speed={speed*.86}/><MovingProp x={-13.5} z={-70} kind="bike" speed={speed*.9}/></>}
  {zone===4&&<><MovingProp x={-15.5} z={-44} kind="canteen" speed={speed*.68}/><MovingProp x={15.5} z={-92} kind="canteen" speed={speed*.68}/></>}
  <HeroSprite hero={hero} lane={lane} phase={phase} jumping={jumping} sliding={sliding} skating={skating} powers={powers}/>{(phase==="ground"||phase==="grind")&&<PatternMesh pattern={pattern} progress={progress} collected={collected} burst={burst}/>} {phase==="sky"&&skyGems.filter(g=>!g.taken).map(g=><group key={g.id} position={[LANE_X[g.lane],3.25,-31+g.progress*36]}><mesh><torusGeometry args={[.52,.14,12,28]}/><meshStandardMaterial color="#ffda3d" emissive="#ff9700" emissiveIntensity={.85}/></mesh></group>)}</>;
}

export function SuperZoosAdventureV25(){
  const [hero,setHero]=useState<HeroId>("peter"),[started,setStarted]=useState(false),[phase,setPhase]=useState<Phase>("ground"),[lane,setLane]=useState<Lane>(0); const laneRef=useRef<Lane>(0);
  const [jumping,setJumping]=useState(false),[sliding,setSliding]=useState(false); const jumpingRef=useRef(false),slidingRef=useRef(false);
  const [index,setIndex]=useState(0),[progress,setProgress]=useState(-.05),[collected,setCollected]=useState<number[]>([]),[burst,setBurst]=useState<number|null>(null),[skyGems,setSkyGems]=useState<SkyGem[]>(makeSky),[elapsed,setElapsed]=useState(0),[score,setScore]=useState(0),[gems,setGems]=useState(0),[hearts,setHearts]=useState(3),[skating,setSkating]=useState(false),[powers,setPowers]=useState<PowerState>({shieldUntil:0,boostUntil:0,magnetUntil:0}),[feedback,setFeedback]=useState(""),[gameOver,setGameOver]=useState(false);
  const gesture=useRef<Gesture|null>(null),timer=useRef<number|null>(null); const pattern=PATTERNS[index%PATTERNS.length]; const zone=Math.floor(index/4)%5;
  useEffect(()=>{laneRef.current=lane},[lane]);useEffect(()=>{jumpingRef.current=jumping},[jumping]);useEffect(()=>{slidingRef.current=sliding},[sliding]);
  const say=useCallback((t:string)=>{setFeedback(t);if(timer.current)clearTimeout(timer.current);timer.current=window.setTimeout(()=>setFeedback(""),1100)},[]);
  const next=useCallback(()=>{setIndex(i=>i+1);setProgress(-.05);setCollected([]);setBurst(null)},[]);
  const reset=useCallback(()=>{setPhase("ground");setLane(0);laneRef.current=0;setJumping(false);jumpingRef.current=false;setSliding(false);slidingRef.current=false;setIndex(0);setProgress(-.05);setCollected([]);setBurst(null);setSkyGems(makeSky());setElapsed(0);setScore(0);setGems(0);setHearts(3);setSkating(false);setPowers({shieldUntil:0,boostUntil:0,magnetUntil:0});setFeedback("");setGameOver(false)},[]);
  useEffect(()=>{if(!started||gameOver)return;let raf=0,prev=performance.now();const tick=(now:number)=>{const dt=Math.min(.04,(now-prev)/1000);prev=now;if(phase==="ground"||phase==="grind"){
    const boost=powers.boostUntil>now;setProgress(p=>{const n=p+dt*(boost?.28:.235);pattern.offsets.forEach((off,i)=>{if(collected.includes(i))return;const effective=n-off*.18;const magnet=powers.magnetUntil>now&&pattern.kind==="star";const laneHit=laneRef.current===pattern.lane||magnet;if(effective>=.98&&effective<=1.1&&laneHit){
      if(pattern.kind==="trampoline"){setPhase("launch");setElapsed(0);setSkyGems(makeSky());say("Sky Run!");return;}
      if(pattern.kind==="rail"){if(skating){setPhase("grind");setScore(s=>s+60);say("Long rail grind +60!")}else say("Find the skateboard first");setCollected(v=>[...v,i]);return;}
      if(pattern.good){setCollected(v=>[...v,i]);setBurst(i);window.setTimeout(()=>setBurst(null),280);let value=10;if(pattern.kind==="shield"){setPowers(v=>({...v,shieldUntil:now+6000}));value=20;say("Shield active!")}else if(pattern.kind==="boost"){setPowers(v=>({...v,boostUntil:now+5000}));value=25;say("Speed boost!")}else if(pattern.kind==="magnet"){setPowers(v=>({...v,magnetUntil:now+6000}));value=25;say("Gem magnet!")}else if(pattern.kind==="skateboard"){setSkating(true);value=30;say("Skateboard unlocked!")}else say("Collected!");setScore(s=>s+value);setGems(g=>g+1);return;}
      const shield=powers.shieldUntil>now;if(shield){setCollected(v=>[...v,i]);say("Shield blocked it!");return;}const safe=(pattern.jumpable&&jumpingRef.current)||(pattern.slideOnly&&slidingRef.current);if(safe){setCollected(v=>[...v,i]);setScore(s=>s+5);say(pattern.slideOnly?"Great slide +5":"Great jump +5")}else{setCollected(v=>[...v,i]);setHearts(h=>{const v=Math.max(0,h-1);if(v===0){setGameOver(true);setStarted(false)}return v});say("Careful — heart lost")}
    }});if(n>1.42){next();return-.05}return n});
  }else{setElapsed(v=>v+dt);if(phase==="launch"&&elapsed>.55){setPhase("sky");setElapsed(0)}else if(phase==="sky"){setSkyGems(list=>list.map(g=>{if(g.taken)return g;const p=g.progress+dt*.38;if(p>=.84&&p<=1.05&&g.lane===laneRef.current){setScore(s=>s+10);setGems(v=>v+1);say("Sky gem +10");return{...g,progress:p,taken:true}}return{...g,progress:p,taken:p>1.15}}));if(elapsed>3){setPhase("landing");setElapsed(0)}}else if(phase==="landing"&&elapsed>.75){setPhase("ground");setElapsed(0);next();say("Back to the school route!")}}
    raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[started,gameOver,phase,elapsed,pattern,next,say,skating,powers,collected]);
  const move=(d:-1|1)=>{if(started)setLane(v=>Math.max(-1,Math.min(1,v+d)) as Lane)};
  const jump=()=>{if(!started||jumping||sliding||phase!=="ground")return;setJumping(true);jumpingRef.current=true;window.setTimeout(()=>{setJumping(false);jumpingRef.current=false},760)};
  const slide=()=>{if(!started||sliding||jumping||phase!=="ground")return;setSliding(true);slidingRef.current=true;window.setTimeout(()=>{setSliding(false);slidingRef.current=false},820)};
  const down=(e:PointerEvent<HTMLDivElement>)=>{if(started)gesture.current={x:e.clientX,y:e.clientY}};const up=(e:PointerEvent<HTMLDivElement>)=>{const s=gesture.current;gesture.current=null;if(!s)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;if(Math.abs(dx)>34&&Math.abs(dx)>Math.abs(dy)*.7)move(dx>0?1:-1);else if(dy<-28)jump();else if(dy>28)slide();else if(Math.abs(dx)<14)jump()};
  const now=performance.now();const total=score+index*3;const activePower=powers.shieldUntil>now?"Shield":powers.boostUntil>now?"Speed":powers.magnetUntil>now?"Magnet":skating?"Skateboard":"Run";
  return <main className={`v25-app phase-${phase}`}><header className="v25-hud"><div><small>SUPER ZOOS ADVENTURE V2.5</small><h1>Playground Power Run</h1></div><div className="v25-stats"><b>{[0,1,2].map(i=><i key={i} className={i<hearts?"on":""}>♥</i>)}</b><b>Gems {gems}</b><b>Score {total}</b><b>{activePower}</b></div></header><section className="v25-stage" onPointerDown={down} onPointerUp={up} onPointerCancel={()=>gesture.current=null}><Canvas shadows dpr={[1,1.5]} camera={{position:[0,5,13.2],fov:43}}><World hero={hero} lane={lane} phase={phase} jumping={jumping} sliding={sliding} skating={skating} powers={powers} pattern={pattern} progress={progress} collected={collected} burst={burst} skyGems={skyGems} zone={zone}/></Canvas>{feedback&&<div className="v25-feedback">{feedback}</div>}{!started&&!gameOver&&<div className="v25-menu"><div className="v25-panel"><small>CHOOSE YOUR HERO</small><h2>Playground Power Run</h2><p>Collect real power-ups, jump obstacles, slide under tunnels and swing bars, unlock the skateboard and grind the long rail.</p><div className="v25-cards">{(Object.keys(HEROES) as HeroId[]).map(id=><button key={id} className={hero===id?"selected":""} onClick={()=>setHero(id)}><img src={HEROES[id].normal[0]} alt={HEROES[id].name}/><strong>{HEROES[id].name}</strong><span>{HEROES[id].tagline}</span></button>)}</div><button className="v25-start" onClick={()=>{reset();setStarted(true)}}>Start Adventure</button></div></div>}{gameOver&&<div className="v25-menu"><div className="v25-panel"><small>GREAT TRY</small><h2>{HEROES[hero].name} is ready again</h2><p>Score {total} • Gems {gems}</p><button className="v25-start" onClick={()=>{reset();setStarted(true)}}>Try Again</button><button className="v25-secondary" onClick={()=>{reset();setStarted(false)}}>Choose Hero</button></div></div>}{started&&<div className="v25-key"><span className="good">GOLD / BLUE / PURPLE = COLLECT</span><span className="bad">RED = JUMP, DODGE OR SLIDE</span></div>}</section><nav className="v25-controls"><button onClick={()=>move(-1)} disabled={!started}>Left</button><button onClick={()=>move(1)} disabled={!started}>Right</button><button className="jump" onClick={jump} disabled={!started||phase!=="ground"}>Jump</button><button className="slide" onClick={slide} disabled={!started||phase!=="ground"}>Slide</button><button className="restart" onClick={()=>{reset();setStarted(true)}}>Restart</button></nav></main>;
}
