/** Resolve one detonation; secondary mines remain alive until their own fuse ends. */
export type BlastTarget = { x:number; y:number; type:string; detonateTimer?:number; chainDepth?:number };
export function resolveBlast<T extends BlastTarget>(targets:T[], source:T, radius:number) {
  const victims:T[] = [];
  const triggered:T[] = [];
  if (!targets.includes(source)) return {victims, triggered, bonus:0};
  for (const other of targets) {
    if(other === source) continue;
    if((other.x-source.x)**2 + (other.y-source.y)**2 >= radius*radius) continue;
    if(other.type === 'bomb') {
      if(other.detonateTimer === undefined) {
        other.detonateTimer = 10 + triggered.length * 6;
        other.chainDepth = Math.min(5, (source.chainDepth ?? 0) + 1);
        triggered.push(other);
      }
    } else victims.push(other);
  }
  const removed = new Set<T>([source, ...victims]);
  for(let i=targets.length-1;i>=0;i--) if(removed.has(targets[i])) targets.splice(i,1);
  return {victims, triggered, bonus:Math.min(5, source.chainDepth ?? 0)*250};
}
