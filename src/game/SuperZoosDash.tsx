import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { createGameAudio } from "./audio";
import { readBestScore, saveBestScore } from "./storage";
import "./SuperZoosDash.css";
import "./controlPatch.css";

type Lane = -1 | 0 | 1;
type ScreenState = "start" | "playing" | "paused" | "ended";
type PeterMode = "normal" | "super";
type HeroId = "peter" | "judy";
type ObjectKind = "star" | "heroBadge" | "backpack" | "books" | "bench" | "trafficCone" | "basketball";

type RunnerObject = {
  id: number;
  kind: ObjectKind;
  lane: Lane;
  progress: number;
};

type FloatingMessage = {
  id: number;
  text: string;
  createdAt: number;
};

type HeroProfile = {
  id: HeroId;
  name: string;
  superName: string;
  powerLetter: string;
  role: string;
  imagePath: string;
  accent: string;
};

type ObjectProfile = {
  symbol: string;
  label: string;
  hint: string;
  message: string;
  points: number;
  danger: boolean;
};

type GameState = {
  screen: ScreenState;
  calmMode: boolean;
  soundOn: boolean;
  selectedHero: HeroId;
  score: number;
  bestScore: number;
  hearts: number;
  lane: Lane;
  objects: RunnerObject[];
  nextSpawnAt: number;
  tutorialIndex: number;
  shieldActiveUntil: number;
  shieldCooldownUntil: number;
  superUntil: number;
  invulnerableUntil: number;
  jumpUntil: number;
  runStartedAt: number;
  messages: FloatingMessage[];
  idSeed: number;
  doctorWinnieUntil: number;
  doctorWinnieLane: Lane;
  nextDoctorWinnieAt: number;
};

type GestureStart = {
  pointerId: number;
  x: number;
  y: number;
};

const LANES: Lane[] = [-1, 0, 1];
const VERSION = "v0.4-real-art";
const BASE_PATH = typeof window !== "undefined" && window.location.pathname.startsWith("/super-zoos-dash") ? "/super-zoos-dash/" : "/";

function assetPath(path: string) {
  return `${BASE_PATH}${path.replace(/^\/+/, "")}`;
}

const HEROES: Record<HeroId, HeroProfile> = {
  peter: {
    id: "peter",
    name: "Peter",
    superName: "Super Peter",
    powerLetter: "P",
    role: "brave badge collector",
    imagePath: assetPath("images/characters/peter.svg"),
    accent: "#167bff",
  },
  judy: {
    id: "judy",
    name: "Judy",
    superName: "Super Judy",
    powerLetter: "J",
    role: "gentle quick jumper",
    imagePath: assetPath("images/characters/judy.svg"),
    accent: "#f35d9f",
  },
};

const DOCTOR_WINNIE_IMAGE = assetPath("images/characters/dr-winnie.svg");

const OBJECT_PROFILES: Record<ObjectKind, ObjectProfile> = {
  star: {
    symbol: "★",
    label: "GET",
    hint: "Collect stars",
    message: "Star sparkle!",
    points: 12,
    danger: false,
  },
  heroBadge: {
    symbol: "◆",
    label: "POWER",
    hint: "Collect badges",
    message: "Super badge!",
    points: 30,
    danger: false,
  },
  backpack: {
    symbol: "🎒",
    label: "JUMP",
    hint: "Jump backpack",
    message: "Backpack cleared!",
    points: 8,
    danger: true,
  },
  books: {
    symbol: "📚",
    label: "JUMP",
    hint: "Jump books",
    message: "Book stack cleared!",
    points: 9,
    danger: true,
  },
  bench: {
    symbol: "▰",
    label: "JUMP",
    hint: "Jump bench",
    message: "Bench cleared!",
    points: 10,
    danger: true,
  },
  trafficCone: {
    symbol: "▲",
    label: "DODGE",
    hint: "Dodge cone",
    message: "Cone avoided!",
    points: 8,
    danger: true,
  },
  basketball: {
    symbol: "●",
    label: "JUMP",
    hint: "Jump ball",
    message: "Ball bounced past!",
    points: 10,
    danger: true,
  },
};

const TUNING = {
  normal: {
    objectSpeed: 0.27,
    spawnGapMs: 2250,
    scoreRate: 6.5,
  },
  calm: {
    objectSpeed: 0.2,
    spawnGapMs: 3200,
    scoreRate: 4.4,
  },
};

const POWER = {
  shieldDurationMs: 2850,
  shieldCooldownMs: 6200,
  superDurationMs: 7200,
  graceAfterHitMs: 1600,
  jumpDurationMs: 1050,
  jumpLandingGraceMs: 500,
};

const DOCTOR_WINNIE = {
  maxDurationMs: 2200,
  firstCameoMinMs: 10000,
  firstCameoMaxMs: 14000,
  subsequentMinMs: 10000,
  subsequentMaxMs: 16000,
  endGameMs: 45000,
  possibleObstacles: ["backpack", "books", "trafficCone", "basketball"] as ObjectKind[],
};

const tutorialPlan: Array<Pick<RunnerObject, "kind" | "lane">> = [
  { kind: "star", lane: 0 },
  { kind: "star", lane: -1 },
  { kind: "heroBadge", lane: 1 },
  { kind: "backpack", lane: 0 },
  { kind: "books", lane: -1 },
];

function createInitialState(calmMode = false, soundOn = true, selectedHero: HeroId = "peter"): GameState {
  const now = performance.now();

  return {
    screen: "start",
    calmMode,
    soundOn,
    selectedHero,
    score: 0,
    bestScore: readBestScore(),
    hearts: 3,
    lane: 0,
    objects: [],
    nextSpawnAt: now + 1100,
    tutorialIndex: 0,
    shieldActiveUntil: 0,
    shieldCooldownUntil: 0,
    superUntil: 0,
    invulnerableUntil: 0,
    jumpUntil: 0,
    runStartedAt: now,
    messages: [],
    idSeed: 1,
    doctorWinnieUntil: 0,
    doctorWinnieLane: 0,
    nextDoctorWinnieAt: now + DOCTOR_WINNIE.firstCameoMinMs + Math.random() * (DOCTOR_WINNIE.firstCameoMaxMs - DOCTOR_WINNIE.firstCameoMinMs),
  };
}

function isGood(kind: ObjectKind) {
  return !OBJECT_PROFILES[kind].danger;
}

function isDanger(kind: ObjectKind) {
  return OBJECT_PROFILES[kind].danger;
}

function randomLane(): Lane {
  return LANES[Math.floor(Math.random() * LANES.length)] ?? 0;
}

function chooseKindForElapsed(elapsedSeconds: number): ObjectKind {
  const roll = Math.random();

  if (elapsedSeconds < 24) {
    if (roll < 0.68) return "star";
    if (roll < 0.88) return "heroBadge";
    return "backpack";
  }

  if (elapsedSeconds < 52) {
    if (roll < 0.54) return "star";
    if (roll < 0.68) return "heroBadge";
    if (roll < 0.82) return "backpack";
    if (roll < 0.94) return "books";
    return "trafficCone";
  }

  // Post-52s: escalating difficulty with more obstacles
  if (elapsedSeconds < 75) {
    if (roll < 0.4) return "star";
    if (roll < 0.52) return "heroBadge";
    if (roll < 0.68) return "backpack";
    if (roll < 0.82) return "books";
    if (roll < 0.92) return "bench";
    return "trafficCone";
  }

  if (elapsedSeconds < 95) {
    if (roll < 0.34) return "star";
    if (roll < 0.46) return "heroBadge";
    if (roll < 0.62) return "backpack";
    if (roll < 0.76) return "books";
    if (roll < 0.87) return "bench";
    if (roll < 0.96) return "trafficCone";
    return "basketball";
  }

  // 95s+: intense difficulty
  if (roll < 0.28) return "star";
  if (roll < 0.38) return "heroBadge";
  if (roll < 0.55) return "backpack";
  if (roll < 0.7) return "books";
  if (roll < 0.83) return "bench";
  if (roll < 0.92) return "trafficCone";
  return "basketball";
}

function spawnObject(state: GameState, now: number): GameState {
  const planned = tutorialPlan[state.tutorialIndex];
  const elapsedSeconds = (now - state.runStartedAt) / 1000;
  const kind = planned?.kind ?? chooseKindForElapsed(elapsedSeconds);
  const lane = planned?.lane ?? randomLane();
  const id = state.idSeed;

  return {
    ...state,
    idSeed: id + 1,
    tutorialIndex: planned ? state.tutorialIndex + 1 : state.tutorialIndex,
    objects: [
      ...state.objects,
      {
        id,
        kind,
        lane,
        progress: 0,
      },
    ],
  };
}

function addMessage(state: GameState, text: string, now: number): GameState {
  return {
    ...state,
    idSeed: state.idSeed + 1,
    messages: [...state.messages, { id: state.idSeed, text, createdAt: now }].slice(-3),
  };
}

function objectStyle(object: RunnerObject): CSSProperties {
  const progress = Math.max(0, Math.min(1.24, object.progress));
  const visualProgress = Math.min(1, progress * 1.06);
  const afterPlayerDrift = Math.max(0, progress - 1);
  const laneSpread = 7 + visualProgress * 32;
  const x = 50 + object.lane * laneSpread;
  const y = 20 + visualProgress * 70 + afterPlayerDrift * 24;
  const size = 0.32 + visualProgress * 1.42 + afterPlayerDrift * 0.2;
  const opacity = 0.5 + visualProgress * 0.5;

  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: `translate(-50%, -50%) scale(${size})`,
    opacity,
    zIndex: Math.round(10 + visualProgress * 10),
  };
}

function clampLaneIndex(index: number) {
  return Math.max(0, Math.min(LANES.length - 1, index));
}

function playerLaneX(lane: Lane) {
  return 50 + lane * 25.5;
}

export function SuperZoosDash() {
  const [game, setGameState] = useState<GameState>(() => createInitialState());
  const gameRef = useRef(game);
  const lastFrameRef = useRef<number | null>(null);
  const gestureStartRef = useRef<GestureStart | null>(null);
  const audio = useMemo(() => createGameAudio(() => gameRef.current.soundOn), []);

  function setGame(next: GameState) {
    gameRef.current = next;
    setGameState(next);
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, []);

  useEffect(() => {
    let frame = 0;

    function tick(now: number) {
      const previous = lastFrameRef.current ?? now;
      lastFrameRef.current = now;
      const dt = Math.min(0.05, (now - previous) / 1000);
      const current = gameRef.current;

      if (current.screen !== "playing") {
        frame = requestAnimationFrame(tick);
        return;
      }

      const tuning = current.calmMode ? TUNING.calm : TUNING.normal;
      const elapsedSeconds = (now - current.runStartedAt) / 1000;
      
      let next: GameState = {
        ...current,
        score: current.score + tuning.scoreRate * dt,
        objects: current.objects.map((object) => {
          const progress = Math.min(1, Math.max(0, object.progress));
          const readableApproachBoost = 0.82 + Math.pow(progress, 1.25) * 1.18;
          return {
            ...object,
            progress: object.progress + tuning.objectSpeed * dt * readableApproachBoost,
          };
        }),
        messages: current.messages.filter((message) => now - message.createdAt < 1700),
        doctorWinnieUntil: Math.max(0, current.doctorWinnieUntil - dt * 1000),
      };

      // Doctor Winnie cameo logic
      if (elapsedSeconds < DOCTOR_WINNIE.endGameMs / 1000 && now >= next.nextDoctorWinnieAt) {
        const lane = randomLane();
        const obstacleKind = DOCTOR_WINNIE.possibleObstacles[
          Math.floor(Math.random() * DOCTOR_WINNIE.possibleObstacles.length)
        ] as ObjectKind;
        
        // Spawn the obstacle
        next = spawnObject(next, now);
        if (next.objects.length > 0) {
          next.objects[next.objects.length - 1].kind = obstacleKind;
          next.objects[next.objects.length - 1].lane = lane;
        }
        
        // Show Doctor Winnie cameo
        next.doctorWinnieUntil = DOCTOR_WINNIE.maxDurationMs;
        next.doctorWinnieLane = lane;
        
        // Add message
        const messages: Record<ObjectKind, string> = {
          backpack: "Doctor Winnie dropped a backpack!",
          books: "Doctor Winnie scattered books!",
          trafficCone: "Doctor Winnie set a cone!",
          basketball: "Doctor Winnie rolled out a ball!",
          star: "Doctor Winnie found a star!",
          heroBadge: "Doctor Winnie found a badge!",
          bench: "Doctor Winnie moved a bench!",
        };
        next = addMessage(next, messages[obstacleKind] || "Doctor Winnie was here!", now);
        
        // Schedule next cameo
        const delayRange = DOCTOR_WINNIE.subsequentMaxMs - DOCTOR_WINNIE.subsequentMinMs;
        next.nextDoctorWinnieAt = now + DOCTOR_WINNIE.subsequentMinMs + Math.random() * delayRange;
      }

      if (now >= next.nextSpawnAt) {
        next = spawnObject(next, now);
        const earlySafetyMultiplier = elapsedSeconds < 30 ? 1.32 : elapsedSeconds < 60 ? 1.16 : 1;
        // Post-52s: gradually increase spawn rate (+5% every 5s after 52s)
        const postEliteBoost = Math.max(1, (elapsedSeconds - 52) / 100);
        next.nextSpawnAt = now + tuning.spawnGapMs * earlySafetyMultiplier * postEliteBoost * (1 + Math.random() * 0.36);
      }

      const keptObjects: RunnerObject[] = [];
      for (const object of next.objects) {
        const profile = OBJECT_PROFILES[object.kind];
        const sameLane = object.lane === next.lane;
        const atCollectPoint = object.progress >= 0.88;
        const atObstaclePoint = object.progress >= 1;

        if (isGood(object.kind)) {
          if (!atCollectPoint) {
            keptObjects.push(object);
            continue;
          }

          if (!sameLane) {
            if (object.progress < 1.18) keptObjects.push(object);
            continue;
          }

          if (object.kind === "heroBadge") {
            next.score += profile.points;
            next.superUntil = now + POWER.superDurationMs;
            next.shieldActiveUntil = Math.max(next.shieldActiveUntil, now + POWER.shieldDurationMs);
            next = addMessage(next, `${HEROES[next.selectedHero].superName}!`, now);
            audio.play("heroPower");
          } else {
            next.score += profile.points;
            next = addMessage(next, profile.message, now);
            audio.play("gem");
          }
          continue;
        }

        if (!atObstaclePoint) {
          keptObjects.push(object);
          continue;
        }

        if (!sameLane) {
          if (object.progress < 1.15) keptObjects.push(object);
          continue;
        }

        if (now < next.jumpUntil + POWER.jumpLandingGraceMs) {
          next.score += profile.points;
          next = addMessage(next, profile.message, now);
          audio.play("jump");
          continue;
        }

        if (now < next.shieldActiveUntil) {
          next.score += Math.max(8, profile.points);
          next = addMessage(next, "Kindness shield!", now);
          audio.play("shield");
          continue;
        }

        if (now >= next.invulnerableUntil) {
          next.hearts -= 1;
          next.invulnerableUntil = now + POWER.graceAfterHitMs;
          next = addMessage(next, `Careful: ${profile.hint}!`, now);
          audio.play("bump");
        }
      }

      next.objects = keptObjects.filter((object) => object.progress < 1.22);

      if (next.hearts <= 0) {
        const finalScore = Math.max(0, Math.floor(next.score));
        const bestScore = saveBestScore(finalScore);
        next = {
          ...next,
          screen: "ended",
          score: finalScore,
          bestScore,
          hearts: 0,
          objects: [],
          messages: [],
        };
        audio.play("runEnd");
      }

      setGame(next);
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [audio]);

  const now = performance.now();
  const heroMode: PeterMode = now < game.superUntil || now < game.shieldActiveUntil ? "super" : "normal";
  const shieldReady = game.screen === "playing" && now >= game.shieldCooldownUntil;
  const shieldCooldownSeconds = Math.max(0, Math.ceil((game.shieldCooldownUntil - now) / 1000));
  const jumping = now < game.jumpUntil;
  const canJump = game.screen === "playing" && now >= game.jumpUntil - 220;
  const running = game.screen === "playing" && now >= game.jumpUntil;
  const selectedHero = HEROES[game.selectedHero];
  const doctorWinnieVisible = game.doctorWinnieUntil > 0;

  function startRun() {
    audio.unlock();
    lastFrameRef.current = null;
    const current = gameRef.current;
    const fresh = createInitialState(current.calmMode, current.soundOn, current.selectedHero);
    setGame({ ...fresh, screen: "playing" });
  }

  function pauseRun() {
    if (gameRef.current.screen !== "playing") return;
    setGame({ ...gameRef.current, screen: "paused" });
  }

  function resumeRun() {
    if (gameRef.current.screen !== "paused") return;
    lastFrameRef.current = null;
    setGame({ ...gameRef.current, screen: "playing" });
  }

  function toggleCalmMode() {
    if (gameRef.current.screen !== "start") return;
    setGame({ ...gameRef.current, calmMode: !gameRef.current.calmMode });
  }

  function selectHero(heroId: HeroId) {
    if (gameRef.current.screen !== "start") return;
    setGame({ ...gameRef.current, selectedHero: heroId });
  }

  function toggleSound() {
    setGame({ ...gameRef.current, soundOn: !gameRef.current.soundOn });
  }

  function moveToLane(lane: Lane) {
    const current = gameRef.current;
    if (current.screen !== "playing") return;
    if (current.lane !== lane) audio.play("jump");
    setGame({ ...current, lane });
  }

  function stepLane(direction: -1 | 1) {
    const current = gameRef.current;
    const currentIndex = LANES.indexOf(current.lane);
    const nextLane = LANES[clampLaneIndex(currentIndex + direction)] ?? 0;
    moveToLane(nextLane);
  }

  function jump() {
    const current = gameRef.current;
    const jumpNow = performance.now();
    if (current.screen !== "playing" || jumpNow < current.jumpUntil - 220) return;
    setGame({ ...current, jumpUntil: jumpNow + POWER.jumpDurationMs });
    audio.play("jump");
  }

  function activateShield() {
    const current = gameRef.current;
    const shieldNow = performance.now();
    if (current.screen !== "playing" || shieldNow < current.shieldCooldownUntil) return;

    let next: GameState = {
      ...current,
      shieldActiveUntil: shieldNow + POWER.shieldDurationMs,
      shieldCooldownUntil: shieldNow + POWER.shieldCooldownMs,
      superUntil: Math.max(current.superUntil, shieldNow + POWER.shieldDurationMs),
    };
    next = addMessage(next, "Kindness shield!", shieldNow);
    setGame(next);
    audio.play("shield");
  }

  function handleStagePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    if (gameRef.current.screen !== "playing") return;
    gestureStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some iPad/browser combinations may not allow pointer capture. The gesture still works without it.
    }
  }

  function handleStagePointerUp(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const start = gestureStartRef.current;
    gestureStartRef.current = null;
    if (gameRef.current.screen !== "playing") return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const startX = start?.x ?? event.clientX;
    const startY = start?.y ?? event.clientY;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Gesture tuning: larger deadzone for better iPad feel
    // Vertical swipe: 48px minimum, must be more vertical than horizontal
    if (dy < -48 && absY > absX * 0.75) {
      jump();
      return;
    }

    // Horizontal swipe: 56px minimum, must be more horizontal than vertical
    if (absX > 56 && absX > absY * 0.65) {
      stepLane(dx > 0 ? 1 : -1);
      return;
    }

    // Tap in thirds: left, middle, right
    const x = event.clientX - bounds.left;
    const third = bounds.width / 3;
    if (x < third) moveToLane(-1);
    else if (x > third * 2) moveToLane(1);
    else jump();
  }

  function cancelGesture() {
    gestureStartRef.current = null;
  }

  function stopControlEvent(event: PointerEvent<HTMLElement>) {
    event.stopPropagation();
  }

  return (
    <main className="dash-app" aria-label="Super Zoos Dash game">
      <section className="runner-shell">
        <header className="top-bar">
          <div>
            <p className="eyebrow">Super Zoos <span className="version-chip">{VERSION}</span></p>
            <h1>Super Zoos Dash</h1>
          </div>
          <button className="small-button" type="button" onClick={toggleSound}>
            Sound: {game.soundOn ? "On" : "Off"}
          </button>
        </header>

        <div className="hud" aria-live="polite">
          <span>{selectedHero.name}</span>
          <span>Badges {Math.floor(game.score)}</span>
          <span>Best {game.bestScore}</span>
          <span className="hearts" aria-label={`${game.hearts} hearts left`}>
            {Array.from({ length: 3 }, (_, index) => (
              <span key={index} className={index < game.hearts ? "heart full" : "heart"}>♥</span>
            ))}
          </span>
        </div>

        {game.screen === "start" ? (
          <StartScreen
            calmMode={game.calmMode}
            selectedHero={game.selectedHero}
            onSelectHero={selectHero}
            onStart={startRun}
            onToggleCalm={toggleCalmMode}
          />
        ) : (
          <div
            className="stage school-stage"
            onPointerDown={handleStagePointerDown}
            onPointerUp={handleStagePointerUp}
            onPointerCancel={cancelGesture}
            role="application"
            aria-label={`Swipe left or right to move lanes. Swipe up to jump. Help ${selectedHero.name} collect badges and jump school obstacles.`}
          >
            <div className="sky" />
            <div className="sun" />
            <div className="hall" />
            <div className="gumtree left" />
            <div className="gumtree right" />
            <div className="fence" />
            {doctorWinnieVisible && (
              <div className="doctor-winnie-cameo" style={{ left: `${playerLaneX(game.doctorWinnieLane)}%` }} aria-hidden="true">
                <img src={DOCTOR_WINNIE_IMAGE} alt="" />
              </div>
            )}
            <div className="oval-perspective">
              <span className="lane-line left" />
              <span className="lane-line right" />
              <span className="horizon" />
            </div>
            <div className="clarity-strip">
              <span className="good">GET ★</span>
              <span className="power">GET ◆ POWER</span>
              <span className="bad">JUMP SCHOOL ITEMS</span>
              <span className="jump">SWIPE ↑ JUMP</span>
            </div>

            {game.objects.map((object) => (
              <RunnerObjectView key={object.id} object={object} />
            ))}

            <PeterRunner hero={selectedHero} lane={game.lane} mode={heroMode} protectedNow={now < game.shieldActiveUntil} recovering={now < game.invulnerableUntil} jumping={jumping} running={running} />

            {game.messages.map((message) => (
              <div key={message.id} className="floating-message">
                {message.text}
              </div>
            ))}

            {game.screen === "playing" && (
              <button className="pause-button" type="button" onClick={pauseRun} onPointerDown={stopControlEvent} aria-label="Pause run">
                Pause
              </button>
            )}

            {game.screen === "paused" && (
              <Overlay title="Paused" subtitle={`${selectedHero.name} is safe. Ready when you are.`}>
                <button className="primary-button" type="button" onClick={resumeRun} onPointerDown={stopControlEvent}>
                  Resume
                </button>
                <button className="secondary-button" type="button" onClick={startRun} onPointerDown={stopControlEvent}>
                  Restart
                </button>
              </Overlay>
            )}

            {game.screen === "ended" && (
              <Overlay title="Great school save!" subtitle={`Score ${Math.floor(game.score)} • Best ${game.bestScore}`}>
                <button className="primary-button" type="button" onClick={startRun} onPointerDown={stopControlEvent}>
                  Try Again
                </button>
              </Overlay>
            )}
          </div>
        )}

        {game.screen !== "start" && (
          <div className="lane-controls" onPointerDown={stopControlEvent}>
            <button type="button" onClick={() => moveToLane(-1)} disabled={game.screen !== "playing"}>
              Left
            </button>
            <button type="button" onClick={() => moveToLane(0)} disabled={game.screen !== "playing"}>
              Middle
            </button>
            <button type="button" onClick={() => moveToLane(1)} disabled={game.screen !== "playing"}>
              Right
            </button>
            <button className="jump-button" type="button" disabled={!canJump} onClick={jump}>
              {jumping ? "Jumping" : "Jump"}
            </button>
            <button className="shield-button" type="button" disabled={!shieldReady} onClick={activateShield}>
              {shieldReady ? "Shield" : `Shield ${shieldCooldownSeconds}s`}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function StartScreen({ calmMode, selectedHero, onSelectHero, onStart, onToggleCalm }: { calmMode: boolean; selectedHero: HeroId; onSelectHero: (heroId: HeroId) => void; onStart: () => void; onToggleCalm: () => void }) {
  return (
    <div className="start-screen school-start-screen">
      <div className="start-card school-start-card">
        <div className="mission-banner">
          <img src={DOCTOR_WINNIE_IMAGE} alt="" aria-hidden="true" />
          <div>
            <span className="mission-kicker">School mission</span>
            <strong>Doctor Winnie scattered the Super Zoo badges!</strong>
          </div>
        </div>

        <h2>Choose your Super Zoo</h2>
        <p><strong>Collect stars and badges.</strong> Jump over backpacks, books, benches, cones, and rolling balls. The game now starts slower and gives you more time to react.</p>

        <div className="hero-choice-grid" aria-label="Choose a Super Zoo character">
          {Object.values(HEROES).map((hero) => {
            const selected = hero.id === selectedHero;
            return (
              <button
                key={hero.id}
                className={`hero-choice ${selected ? "selected" : ""}`}
                style={selected ? { borderColor: hero.accent } : undefined}
                type="button"
                onClick={() => onSelectHero(hero.id)}
                aria-pressed={selected}
              >
                <img src={hero.imagePath} alt="" aria-hidden="true" />
                <span className="hero-choice-name">{hero.name}</span>
                <span className="hero-choice-role">{hero.role}</span>
              </button>
            );
          })}
        </div>

        <div className="legend-row" aria-hidden="true">
          <span className="legend-good">★ GET</span>
          <span className="legend-power">◆ POWER</span>
          <span className="legend-bad">SCHOOL ITEM = JUMP</span>
          <span className="legend-jump">↑ JUMP</span>
        </div>
        <div className="start-actions">
          <button className="primary-button start-run-button" type="button" onClick={onStart}>
            Start School Rescue
          </button>
          <button className="secondary-button" type="button" onClick={onToggleCalm}>
            Calm Mode: {calmMode ? "On" : "Off"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RunnerObjectView({ object }: { object: RunnerObject }) {
  const profile = OBJECT_PROFILES[object.kind];
  const good = isGood(object.kind);

  return (
    <div className={`runner-object ${object.kind} ${good ? "collect" : "danger school-obstacle"}`} style={objectStyle(object)} aria-hidden="true">
      <span className="object-symbol">{profile.symbol}</span>
      <span className="object-label">{profile.label}</span>
    </div>
  );
}

function PeterRunner({ hero, lane, mode, protectedNow, recovering, jumping, running }: { hero: HeroProfile; lane: Lane; mode: PeterMode; protectedNow: boolean; recovering: boolean; jumping: boolean; running: boolean }) {
  return (
    <div
      className={`peter-runner hero-runner ${hero.id} ${mode} ${protectedNow ? "shielded" : ""} ${recovering ? "recovering" : ""} ${jumping ? "jumping" : ""} ${running ? "running" : ""}`}
      style={{ left: `${playerLaneX(lane)}%`, transform: "translateX(-50%)" }}
      aria-label={mode === "super" ? hero.superName : hero.name}
    >
      <div className="peter-shadow hero-shadow" />
      <div className="peter-body-art hero-sprite-wrap" aria-hidden="true">
        <span className="hero-cape" />
        <img className="hero-sprite" src={hero.imagePath} alt="" />
        <span className="hero-letter">{mode === "super" ? hero.powerLetter : ""}</span>
      </div>
    </div>
  );
}

function Overlay({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="overlay" onPointerDown={(event) => event.stopPropagation()}>
      <div className="overlay-panel">
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <div className="legend-row" aria-hidden="true">
          <span className="legend-good">★ GET</span>
          <span className="legend-power">◆ POWER</span>
          <span className="legend-bad">SCHOOL ITEM = JUMP</span>
          <span className="legend-jump">↑ JUMP</span>
        </div>
        <div className="overlay-actions">{children}</div>
      </div>
    </div>
  );
}
