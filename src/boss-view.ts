import type {Boss} from './boss';
import {bossPhase} from './boss';
import {renderX,renderY} from './motion';
import {CANVAS_W} from './types';
export function drawBoss(ctx:CanvasRenderingContext2D,b:Boss){
  if(b.variant==='refinery') { drawReactor(ctx,b); return; }
  ctx.save();
  if(b.dead)ctx.globalAlpha=Math.max(0,1-b.deathTicks/90);
  const s=b.scale,x=renderX(b),y=renderY(b);
  const phase=bossPhase(b), pulse=0.5+0.5*Math.sin(b.tick*0.075);
  // Broken cannons reveal a hotter reactor and open armor seams.
  ctx.save();ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=(b.dead?Math.max(0,1-b.deathTicks/90):1)*(phase===0?0.22+pulse*0.12:0.08);
  ctx.fillStyle=phase===0?'#ff334e':'#9f5aff';
  ctx.beginPath();ctx.ellipse(x,y,100*s,170*s,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.fillStyle='#202938';ctx.strokeStyle='#677788';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(x-75*s,y);ctx.lineTo(x-25*s,y-140*s);ctx.lineTo(x+65*s,y-110*s);ctx.lineTo(x+100*s,y);ctx.lineTo(x+65*s,y+110*s);ctx.lineTo(x-25*s,y+140*s);ctx.closePath();ctx.fill();ctx.stroke();
  // Forward-swept armor claws and heavy cannon housings.
  for(const side of [-1,1]) {
    ctx.fillStyle='#384657';ctx.strokeStyle='#8294a5';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x+25*s,y+side*70*s);ctx.lineTo(x+45*s,y+side*145*s);
    ctx.lineTo(x-55*s,y+side*162*s);ctx.lineTo(x-115*s,y+side*110*s);
    ctx.lineTo(x-62*s,y+side*125*s);ctx.lineTo(x-40*s,y+side*70*s);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle=phase===0?'#ff654f':'#ca7958';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(x-84*s,y+side*118*s);ctx.lineTo(x-42*s,y+side*142*s);ctx.lineTo(x+16*s,y+side*129*s);ctx.stroke();
  }
  // Beveled armor, vents and exhaust give the silhouette a mechanical read.
  ctx.fillStyle='#1b2639';
  for(const side of [-1,1]){
    ctx.beginPath();ctx.moveTo(x-22*s,y+side*125*s);ctx.lineTo(x+50*s,y+side*96*s);ctx.lineTo(x+68*s,y+side*50*s);ctx.lineTo(x-5*s,y+side*62*s);ctx.closePath();ctx.fill();
    ctx.fillStyle='#7790aa';
    for(let i=0;i<3;i++)ctx.fillRect(x+18*s,y+side*(70+i*12)*s,28*s,4*s);
    ctx.fillStyle='#1b2639';
    ctx.fillRect(x+62*s,y+side*48*s-10*s,25*s,20*s);
    ctx.fillStyle='#ffa75f';
    ctx.beginPath();ctx.moveTo(x+87*s,y+side*48*s-6*s);ctx.lineTo(x+(104+Math.sin(b.tick*0.4)*7)*s,y+side*48*s);ctx.lineTo(x+87*s,y+side*48*s+6*s);ctx.fill();
    ctx.fillStyle='#1b2639';
  }
  ctx.strokeStyle='#586e89';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x+65*s,y-40*s);ctx.lineTo(x+82*s,y);ctx.lineTo(x+65*s,y+40*s);ctx.stroke();
  for(const p of b.parts){
    const px=renderX(p),py=renderY(p);
    if(p.hp<=0){
      ctx.fillStyle='#0d111a';ctx.beginPath();ctx.arc(px,py,p.half,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#ff773e';ctx.lineWidth=2;ctx.beginPath();
      for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.moveTo(px+Math.cos(a)*p.half,py+Math.sin(a)*p.half);ctx.lineTo(px+Math.cos(a+0.3)*p.half*0.4,py+Math.sin(a+0.3)*p.half*0.4);}ctx.stroke();continue;
    }
    const shield=p.kind==='core'&&bossPhase(b)>0;
    ctx.fillStyle=shield?'#254c66':p.kind==='core'?'#ce2946':'#4b586d';
    ctx.strokeStyle=p.charging?'#ffdf80':'#d3e7ff';
    ctx.lineWidth=p.charging?4:2;
    ctx.beginPath();ctx.arc(px,py,p.half,0,Math.PI*2);ctx.fill();ctx.stroke();
    if(p.kind==='core') {
      ctx.save();ctx.translate(px,py);ctx.rotate(b.tick*(shield?0.008:-0.03));
      ctx.strokeStyle=shield?'#68c6e3':'#ff9b5d';ctx.lineWidth=3;
      for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,p.half+7*s,i*Math.PI*2/3,i*Math.PI*2/3+1.3);ctx.stroke();}
      ctx.restore();
    }
    ctx.fillStyle='#182439';ctx.fillRect(px-p.half*0.7,py-8*s,p.half*1.4,16*s);
    ctx.fillStyle=p.charging?'#fff7ad':'#ff975c';ctx.fillRect(px-p.half*0.5,py-3*s,p.half,6*s);
    if(p.charging){
      const phase=bossPhase(b),angles=phase===2?[0]:phase===1?[-0.18,0,0.18]:[-0.34,-0.17,0,0.17,0.34];
      ctx.strokeStyle='#ffbc62';ctx.beginPath();
      for(const a of angles){ctx.moveTo(px,py);ctx.lineTo(px+(p.aimX*Math.cos(a)-p.aimY*Math.sin(a))*100,py+(p.aimX*Math.sin(a)+p.aimY*Math.cos(a))*100);}
      ctx.stroke();
    }
    ctx.fillStyle='#151c29';ctx.fillRect(px-p.half,py+p.half+7,p.half*2,4);
    ctx.fillStyle='#f8bb79';ctx.fillRect(px-p.half,py+p.half+7,p.half*2*p.hp/p.maxHp,4);
  }
  ctx.restore();
  const width=Math.min(340,CANVAS_W*0.45),left=(CANVAS_W-width)/2;
  ctx.save();ctx.textAlign='center';ctx.fillStyle='#efcfff';ctx.font='bold 14px monospace';
  ctx.fillText(b.dead?'DREADNOUGHT DESTROYED':bossPhase(b)>0?'DREADNOUGHT — BREAK THE CANNONS':'DREADNOUGHT — CORE EXPOSED',CANVAS_W/2,88);
  ctx.fillStyle='#252334';ctx.fillRect(left,98,width,6);
  ctx.fillStyle='#cf8cff';ctx.fillRect(left,98,width*b.parts.reduce((n,p)=>n+p.hp,0)/150,6);ctx.restore();
}

function drawReactor(c:CanvasRenderingContext2D,b:Boss) {
  const x=renderX(b),y=renderY(b),s=b.scale,locked=bossPhase(b)>0;
  c.save();c.globalAlpha=b.dead?Math.max(0,1-b.deathTicks/90):1;
  c.translate(x,y);
  c.fillStyle='#142d34';c.strokeStyle='#548078';c.lineWidth=4;
  c.beginPath();c.ellipse(0,0,140*s,220*s,0,0,Math.PI*2);c.fill();c.stroke();
  c.strokeStyle='#304c4d';c.lineWidth=14*s;
  c.beginPath();c.ellipse(0,0,105*s,175*s,0,0,Math.PI*2);c.stroke();
  for(let i=0;i<12;i++) {const a=i*Math.PI/6;c.save();c.translate(Math.cos(a)*125*s,Math.sin(a)*201*s);c.rotate(a);c.fillStyle=i%2?'#9b7847':'#4b6966';c.fillRect(-8*s,-4*s,16*s,8*s);c.restore();}
  c.restore();
  c.save();c.globalAlpha=b.dead?Math.max(0,1-b.deathTicks/90):1;
  for(const p of b.parts) {
    const px=renderX(p),py=renderY(p);
    c.strokeStyle=p.hp<=0?'#263e3d':p.charging?'#ffedac':'#95c7b6';c.lineWidth=3;
    c.fillStyle=p.hp<=0?'#0b171c':p.kind==='core'?(locked?'#245568':'#e05e34'):'#35594f';
    c.beginPath();c.arc(px,py,p.half,0,Math.PI*2);c.fill();c.stroke();
    if(p.hp<=0)continue;
    c.fillStyle=p.charging?'#fff4b2':p.kind==='core'?'#9dffe8':'#d7e9a1';
    c.beginPath();c.arc(px,py,p.half*0.4,0,Math.PI*2);c.fill();
    if(p.charging){c.strokeStyle='#f2bc78';c.lineWidth=1;
      for(const a of (locked?[-0.12,0,0.12]:[-0.48,-0.24,0,0.24,0.48])){c.beginPath();c.moveTo(px,py);c.lineTo(px+(p.aimX*Math.cos(a)-p.aimY*Math.sin(a))*135,py+(p.aimX*Math.sin(a)+p.aimY*Math.cos(a))*135);c.stroke();}}
    c.fillStyle='#c4e9b4';c.fillRect(px-p.half,py+p.half+8,p.half*2*p.hp/p.maxHp,3);
  }
  c.restore();c.save();c.textAlign='center';c.font='bold 14px monospace';c.fillStyle='#b5ebd6';
  c.fillText(b.dead?'HELIOFORGE — REACTOR SILENCED':locked?'HELIOFORGE — BREAK THE FOUR COOLING NODES':'HELIOFORGE — REACTOR EXPOSED',CANVAS_W/2,88);
  const w=Math.min(360,CANVAS_W*0.5);c.fillStyle='#263c37';c.fillRect((CANVAS_W-w)/2,98,w,5);c.fillStyle='#a5dfab';c.fillRect((CANVAS_W-w)/2,98,w*b.parts.reduce((n,p)=>n+p.hp,0)/216,5);c.restore();
}
