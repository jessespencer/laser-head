# Laser Head — arcade upgrade roadmap

Direction: fast, smooth alien arcade shooter inspired by Galaga and DemonStar.
Keep the custom player head. Enemies are aliens, mines, and alien machinery;
no software logos or assistant mascots in gameplay.

## Implemented on codex/arcade-upgrades

- Fixed 60 Hz simulation with interpolated rendering; faster movement, shots,
  enemies, and spawn pacing after playtesting the initial timing change.
- Hold-to-fire, swept projectile collisions, normalized diagonal movement.
- Damage immunity, focus-loss pause, explicit resume, input reset.
- Cached avatar tint, on-demand background removal, upload resource cleanup.
- Alien scout, drone, tank, mine sprites and a plasma-core power-up.
- Formation milestone: staged swoop/split/dive squadrons, 5–8 aliens per wave,
  alternating with random raids and 0.75-second recovery gaps. Formation tanks
  enter from the fourth formation. Enemy speed ramps with survival time and score.
- Mines reduced from size 54 to 26, retaining their full blast radius; offered
  on occasional fourth waves with a twenty-second minimum gap and one opportunity at a time: 50% singles, 35% pairs, 15% triples.
- Plasma has a slim cyan-white beam sprite with a modest thickness boost, cyan hit effects,
  and a matching HUD bar; the existing doubled firing cadence is preserved.

- Tanks fly in, brake, and execute one to three irregularly timed attacks before exiting.
  Hunter and spreader variants have distinct cannons/fins and different pattern preferences;
  attacks may be single shots, fans or short salvos.
  Attack tanks accompany formations from the second formation; random tanks also fire.
  Amber projectiles damage the player with the existing recovery shield. Aiming locks
  during the charge cue. Removed the plasma eye dots from the avatar.

- Mine chains preserve secondary mines for staggered fuses (10 ticks, then 6-tick
  offsets for additional neighbors). Each chain depth adds 250 base points,
  capped at depth five and multiplied by the current combo; floating text shows
  the awarded chain bonus. Overlapping blasts cannot rearm a mine or double-score it.
- Tank charge cues share the exact aim directions used by their shots: one line
  for aimed fire, three for the fan. Fast projectile speed and burst timing retained.

- Audio: synthesized laser/plasma fire, hits, explosions, combo pitch, pickups,
  damage, boss warning and victory. M toggles a persisted mute preference; focus
  loss silences audio. Concurrent voices and repeated sounds are bounded.
- Sector 01: mixed encounters lead into the Dreadnought at 70 seconds. Destroy
  its two cannons to expose the core; attacks change as parts fall. A staged
  destruction sequence ends in SECTOR CLEARED and the existing score entry flow.
  Roughly 90 seconds is the design target, not a forced timeout: finish time
  depends on how quickly the player defeats the boss.

Game feel remains subject to playtesting.

## Next, in order

1. **Playtest and polish:** tune sound mix, boss durability, projectile readability
   and the stage pacing from actual play. Add reduced-effects controls.
2. **More content:** additional stages, bosses and weapon choices once the first
   stage's feel is approved.
3. **Performance and replayability:** seeded stress scenes, frame-time measurements,
   quality settings, then additional stages and weapons based on playtest results.

Maintain the current fast pace while tuning patterns and difficulty. Do not
raise speed indiscriminately as a substitute for interesting attacks. Keep
performance changes tied to measurements as entity counts increase.

## Sector 02 — Helioforge refinery prototype

**Not enabled in shipped builds.** The code below is on main but unreachable: the
menu button is removed and Sector 01 now ends the run at the Dreadnought. Re-enable
by restoring the `sector === 1` transition branch in `src/game.ts` and the menu button
in `src/main.ts`. Still needs hands-on playtesting before it goes live.

- Sector 01 now leads into Sector 02 after a three-second clearance card, carrying
  score and remaining shields forward and repairing up to two shields (cap eight).
- The menu's **SECTOR 02 · REFINERY** button starts directly in the new sector;
  it uses your uploaded head when available. Regular PLAY begins the campaign.
- Layered eclipse, distant industrial stacks, vapor and moving deck panels establish
  a refinery environment. Mounted turrets telegraph locked shots; fuel cells chain
  with delayed fuses, damage nearby defenses and airborne enemies, and leave wrecks.
- Three authored supply carriers drop a persistent spread upgrade plus one shield
  repair. Spread adds diagonal eye shots and also works during plasma overdrive.
- Mixed formations accompany alternating turret banks; spawning winds down at 65s.
  Helioforge arrives at 75s. Four orbiting cooling nodes protect its reactor; the
  exposed core begins a fresh telegraphed five-shot attack cycle.
- Final refinery victory enters the existing score flow. Pause, restart and resize
  continue to work. Prototype balance still needs hands-on playtesting.
