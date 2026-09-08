type Sound = 'laser'|'plasma'|'hit'|'kill'|'blast'|'damage'|'pickup'|'warning'|'victory';
let context:AudioContext|null=null;
let output:GainNode|null=null;
let muted=false,paused=false,voices=0;
try { muted=localStorage.getItem('laserhead.muted')==='true'; } catch { /* optional preference */ }
const last=new Map<string,number>();
export function soundMuted(){return muted;}
function volume(){if(context && output) output.gain.setTargetAtTime(muted||paused?0:0.16,context.currentTime,0.015);}
export function unlockAudio(){
  try {
    if(!context){context=new AudioContext();output=context.createGain();output.gain.value=muted||paused?0:0.16;output.connect(context.destination);}
    if(context.state==='suspended')void context.resume().catch(()=>{});
  }catch{ /* Audio is optional when unavailable. */ }
}
export function toggleSound(){muted=!muted;try{localStorage.setItem('laserhead.muted',String(muted));}catch{}volume();}
export function pauseAudio(value:boolean){paused=value;volume();}
function tone(frequency:number,end:number,duration:number,type:OscillatorType='square',delay=0,gain=0.22){
  if(!context||!output||context.state!=='running'||muted||paused||voices>=24)return;
  const ctx=context,o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime+delay;
  o.type=type;o.frequency.setValueAtTime(frequency,now);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+duration);
  g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(gain,now+0.005);g.gain.exponentialRampToValueAtTime(0.001,now+duration);
  o.connect(g);g.connect(output);voices++;
  o.onended=()=>{o.disconnect();g.disconnect();voices--;};o.start(now);o.stop(now+duration+0.01);
}
export function playSound(sound:Sound,combo=1){
  if(!context||muted||paused)return;
  const now=context.currentTime;
  const gap=sound==='laser'||sound==='plasma'?0.045:sound==='hit'?0.05:0.075;
  if(now-(last.get(sound)??-100)<gap)return;last.set(sound,now);
  if(sound==='laser')tone(900,180,0.075,'sawtooth',0,0.10);
  if(sound==='plasma')tone(440,90,0.09,'sawtooth',0,0.17);
  if(sound==='hit')tone(160,70,0.045,'triangle');
  if(sound==='kill'){tone(100,30,0.15,'sawtooth');tone(450+combo*70,650+combo*70,0.07,'sine',0.03,0.13);}
  if(sound==='blast'){tone(100,20,0.5,'sawtooth',0,0.4);tone(65,25,0.6,'sine',0,0.5);}
  if(sound==='damage')tone(180,35,0.28,'sawtooth',0,0.35);
  if(sound==='pickup')[440,660,880].forEach((f,i)=>tone(f,f,0.14,'sine',i*0.07));
  if(sound==='warning'){tone(180,180,0.18,'square',0,0.2);tone(140,140,0.22,'square',0.22,0.2);}
  if(sound==='victory')[330,440,550,660].forEach((f,i)=>tone(f,f,0.35,'triangle',i*0.12,0.3));
}
