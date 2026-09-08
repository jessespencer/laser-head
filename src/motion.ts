/** Rendering history stays outside the simulation's collision coordinates. */
type Position = { x: number; y: number };
const previous = new WeakMap<Position, Position>();
let blend = 1;
export function rememberPosition(p: Position) {
  let old = previous.get(p);
  if (!old) { old = { x: p.x, y: p.y }; previous.set(p, old); }
  old.x = p.x; old.y = p.y;
}
export function setRenderBlend(value: number) { blend = Math.max(0, Math.min(1, value)); }
export function renderX(p: Position) { const old = previous.get(p); return old ? old.x + (p.x - old.x) * blend : p.x; }
export function renderY(p: Position) { const old = previous.get(p); return old ? old.y + (p.y - old.y) * blend : p.y; }

/** Relative swept point/AABB test: fast shots cannot skip a moving target. */
export function shotHits(shot: Position, target: Position, halfWidth: number, halfHeight: number) {
  const a = previous.get(shot) ?? shot;
  const b = previous.get(target) ?? target;
  const x = a.x - b.x, y = a.y - b.y;
  const dx = shot.x - target.x - x, dy = shot.y - target.y - y;
  let enter = 0, leave = 1;
  for (const [start, delta, extent] of [[x, dx, halfWidth], [y, dy, halfHeight]]) {
    if (delta === 0) { if (Math.abs(start) > extent) return false; continue; }
    const t1 = (-extent - start) / delta, t2 = (extent - start) / delta;
    enter = Math.max(enter, Math.min(t1, t2));
    leave = Math.min(leave, Math.max(t1, t2));
    if (enter > leave) return false;
  }
  return true;
}
