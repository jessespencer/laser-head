import {drawStarfield} from './effects';
import type {Refinery} from './refinery';
import {CANVAS_H} from './types';
import {renderX,renderY} from './motion';

export function drawRefineryBackground(c:CanvasRenderingContext2D,t:number,w:number,h:number) {
  c.save();
  const haze=c.createLinearGradient(0,0,0,h);
  haze.addColorStop(0,'#07151d');haze.addColorStop(0.5,'#100c19');haze.addColorStop(1,'#21130f');
  c.fillStyle=haze;c.fillRect(0,0,w,h);
  drawStarfield(c);
  // Distant eclipsed planet and slow industrial silhouettes.
  const px=w*0.73-t*0.04%(w+400);
  c.fillStyle='#172533';c.beginPath();c.arc(px,h*0.2,160,0,Math.PI*2);c.fill();
  c.fillStyle='#09121d';c.beginPath();c.arc(px-30,h*0.2-25,150,0,Math.PI*2);c.fill();
  for(let i=-1;i<w/190+2;i++) {
    const tile=i+Math.floor(t*0.32/190);
    const x=i*190-(t*0.32)%190, top=h*0.72+Math.sin(tile*7)*35;
    c.fillStyle='#18202a';c.fillRect(x,top,110,h-top);c.fillRect(x+25,top-80,22,80);
    c.strokeStyle='#2b3034';c.lineWidth=5;c.beginPath();c.moveTo(x+36,top-40);c.lineTo(x+145,top-40);c.lineTo(x+145,top+60);c.stroke();
    c.fillStyle='#655039';c.fillRect(x+30,top-84,12,4);
  }
  // Slow vapor trails above the stacks; restrained so incoming shots stay bright.
  c.fillStyle='rgba(83,101,110,0.07)';
  for(let i=0;i<8;i++){const x=((i*233-t*0.65)%(w+300)+w+300)%(w+300)-150;
    c.beginPath();c.ellipse(x,h*0.6+Math.sin(i*4+t*0.004)*25,95,15,0,0,Math.PI*2);c.fill();}
  // Near decks: repeating panels, rails, conduits and hazard markings.
  for(const side of [0,1]) {
    const y=side?h-76:104;
    c.fillStyle='#111e28';c.fillRect(0,y,w,64);
    c.fillStyle='#2b424a';c.fillRect(0,y+(side?0:61),w,3);
    for(let i=-1;i<w/160+2;i++) {
      const x=i*160-(t*1.8)%160;
      c.strokeStyle='#263943';c.lineWidth=1;c.strokeRect(x+4,y+8,148,46);
      c.fillStyle='#2d373c';c.fillRect(x+15,y+19,62,5);
      c.fillStyle='#917343';for(let k=0;k<4;k++) c.fillRect(x+108+k*8,y+38,4,10);
      c.fillStyle='#457b78';c.fillRect(x+17,y+39,20,3);
    }
  }
  c.restore();
}
export function drawFacilities(c:CanvasRenderingContext2D,r:Refinery) {
  c.save();
  for(const wreck of r.wrecks) {
    c.fillStyle='#111a21';c.fillRect(wreck.x-30,wreck.y-24,60,48);
    c.strokeStyle='#614332';c.lineWidth=2;c.beginPath();c.moveTo(wreck.x-23,wreck.y-18);c.lineTo(wreck.x+12,wreck.y+8);c.lineTo(wreck.x-14,wreck.y+20);c.stroke();
    if(wreck.life>660){c.fillStyle='rgba(255,144,67,0.6)';c.fillRect(wreck.x+8,wreck.y-5,4,3);}
  }
  for(const u of r.units) {
    const x=renderX(u),y=renderY(u);
    if(u.kind==='turret') {
      const deck=y<CANVAS_H/2?165:CANVAS_H-76;
      c.fillStyle='#233840';c.fillRect(x-7,Math.min(y,deck),14,Math.abs(deck-y));
      c.strokeStyle='#4e625c';c.lineWidth=2;c.beginPath();c.moveTo(x,deck);c.lineTo(x,y);c.stroke();
    }
    c.save();c.translate(x,y);
    if(u.kind==='carrier') {
      c.fillStyle='#152e36';c.strokeStyle='#6bd8bb';c.lineWidth=2;
      c.beginPath();c.moveTo(-44,0);c.lineTo(-20,-30);c.lineTo(36,-24);c.lineTo(48,0);c.lineTo(36,24);c.lineTo(-20,30);c.closePath();c.fill();c.stroke();
      c.fillStyle='#9affcf';for(let k=-1;k<=1;k++)c.fillRect(-12,k*12-2,32,4);
      c.fillStyle='#baffdf';c.textAlign='center';c.font='10px monospace';c.fillText('SUPPLY',0,-40);
    } else if(u.kind==='fuel') {
      c.fillStyle=u.fuse?'#fff0bc':'#63472e';c.strokeStyle='#e1a65e';c.lineWidth=2;
      c.fillRect(-15,-23,30,46);c.strokeRect(-15,-23,30,46);
      c.fillStyle=u.fuse?'#fff':'#ffb95e';c.fillRect(-7,-15,14,30);
      c.fillStyle='#4d3027';c.fillRect(-18,-20,36,5);c.fillRect(-18,15,36,5);
    } else {
      // The base and gun travel together; destruction removes the active mount.
      c.fillStyle='#172731';c.strokeStyle='#3b5964';c.lineWidth=2;c.fillRect(-52,-42,104,84);c.strokeRect(-52,-42,104,84);
      c.fillStyle='#384e59';c.beginPath();c.arc(0,0,26,0,Math.PI*2);c.fill();
      c.strokeStyle=u.charging?'#fff0a8':'#9badab';c.stroke();
      c.save();c.rotate(Math.atan2(u.aimY,u.aimX));c.fillStyle='#71888a';c.fillRect(0,-8,38,16);c.fillStyle=u.charging?'#fff3ab':'#ff8d52';c.fillRect(30,-5,10,10);c.restore();
      if(u.charging) {c.strokeStyle='#efb368';c.setLineDash([5,7]);c.beginPath();c.moveTo(0,0);c.lineTo(u.aimX*160,u.aimY*160);c.stroke();c.setLineDash([]);}
    }
    if(u.kind!=='fuel') {c.fillStyle='#101821';c.fillRect(-28,36,56,3);c.fillStyle='#a5d0b6';c.fillRect(-28,36,56*u.hp/u.maxHp,3);}
    c.restore();
  }
  if(r.pickup) {
    const p=r.pickup;c.save();c.translate(p.x,p.y);c.rotate(Math.PI/4);c.fillStyle='#153e32';c.strokeStyle='#a3ffca';c.lineWidth=3;c.fillRect(-19,-19,38,38);c.strokeRect(-19,-19,38,38);c.restore();
    c.fillStyle='#c3ffdb';c.font='bold 12px monospace';c.textAlign='center';c.fillText('SPREAD + REPAIR',p.x,p.y-36);
    for(const dy of [-8,0,8]) {c.beginPath();c.moveTo(p.x-9,p.y);c.lineTo(p.x+10,p.y+dy);c.strokeStyle='#afffd0';c.stroke();}
  }
  c.restore();
}
