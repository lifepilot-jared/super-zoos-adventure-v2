# SUPER ZOOS ADVENTURE V2 BUILD CONTRACT

## Purpose
Rebuild Super Zoos as an original iPad-first 3D chase-camera adventure while preserving the current classic game.

## Protected branches
- `main`: current playable classic build
- `archive/super-zoos-dash-classic-v1`: permanent classic checkpoint
- `feature/super-zoos-adventure-v2`: all v2 work

## V2 non-negotiables
- Original Super Zoos characters and story world
- Peter and Judy use the supplied plush artwork, not placeholder SVGs
- True perspective chase camera
- Three readable lanes
- School scenery remains outside the gameplay corridor
- Hazards and rewards are visually dominant
- iPad Safari touch controls
- Calm Mode
- No flashing or harsh fail presentation
- Static deployment through GitHub Pages

## Technical foundation
- React + TypeScript + Vite
- Three.js through React Three Fiber
- React Three Drei helpers
- Modular game-state machine
- Separate render, gameplay, audio, character, mission and world systems

## Gameplay modes
1. Ground Run
2. Jump
3. Shield / Super Mode
4. Trampoline Launch
5. Sky Flight
6. Safe Landing
7. Pause
8. Mission Complete

## V2 staged delivery
### Stage 1 — 3D Greybox
- perspective camera
- three lanes
- smooth lane change
- jump arc
- basic road/oval route
- iPad controls

### Stage 2 — Character renderer
- Peter normal run frames
- Super Peter frames
- Judy normal and super frames
- look-back celebration
- aura and shield states

### Stage 3 — Australian school route
- gum trees
- school hall
- canteen
- library
- playground
- court
- fences and shade sails
- scenery outside playable lanes

### Stage 4 — Gameplay readability
- clear red hazards
- clear green/blue rewards
- fair spawning
- depth fog
- lane telegraphing

### Stage 5 — Trampoline Sky Run
- trampoline telegraph
- launch transition
- aerial left/right controls
- gem formations
- gentle cloud hazards
- safe landing

### Stage 6 — Story and characters
- Peter greets Eli
- Dr Winnie mission context
- Judy joins the mission
- short voice and trumpet moments

## Definition of Done for first playable v2
- Runs in iPad Safari
- Peter appears as the supplied plush character
- Camera and scenery move from one shared game clock
- Lane changes and jump feel responsive
- Environment does not obstruct hazards or rewards
- Trampoline sky section completes without collision bugs
- Classic version remains preserved and playable
