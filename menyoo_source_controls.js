/* SPDX-License-Identifier: GPL-3.0-or-later
 * Keyboard and standard-controller transport. Menus and action feedback render inside GTA.
 */
(function(root){
 'use strict';
 function decodeLabel(raw){const end=raw.indexOf(0);return new TextDecoder().decode(new Uint8Array(raw.subarray(0,end<0?raw.length:end)));}
 if(typeof document==='undefined'){module.exports={decodeLabel};return;}
 let opened=false;
 let menuKey='F4';try{const settings=JSON.parse(localStorage.getItem('menyoo.source.settings.v1')||'{}');if(['F4','F6','F8'].includes(settings.hotkey))menuKey=settings.hotkey;}catch(_){}
 root.GTATrainerPort={isOpen:()=>opened};
 const old=root.GTAPoseBridge.install;
 root.GTAPoseBridge.install=function(d,log,o={}){
  const stop=old(d,log,o.trainer?{...o,hidePanel:true}:o);
  if(!o.trainer||!d.runtimeMain)return stop;
  const legacy=d;
  d={...legacy,get block(){
   const v=new DataView(legacy.memory.buffer);
   if(v.getUint32(legacy.block+128,true)===0x4d4e5931)return legacy.block;
   const pointer=Number(v.getBigUint64(legacy.block+448,true));
   return Number.isSafeInteger(pointer)&&pointer>0&&pointer%8===0&&pointer+131072<=v.byteLength?pointer:0;
  }};
  let releaseController=false;
  function setOpened(value){if(opened===value)return;opened=value;if(!value)releaseController=true;if(value)document.exitPointerLock?.();root.dispatchEvent(new Event('keyboard-controls-change'));}
  function send(bit){
   if(o.isWorldReady&&!o.isWorldReady())return false;
   const v=new DataView(d.memory.buffer);
   if(!d.block)return false;
   if(v.getUint32(d.block+128,true)!==0x4d4e5931||v.getInt32(d.block+148,true))return false;
   Atomics.or(new Int32Array(d.memory.buffer,d.block+132,1),0,bit);
   if(bit===1)setOpened(!opened);
   return true;
  }
  let padId=null,armed=false,previous=[],chordDown=false,direction=0,repeatAt=0;
  const neutral=gp=>!(gp?.buttons||[]).some(b=>b.pressed||b.value>.3)&&!(gp?.axes||[]).some(v=>Math.abs(v)>.3);
  function resetPad(){padId=null;armed=false;previous=[];chordDown=false;direction=0;repeatAt=0;}
  function controller(gp,blocked=false){
   if(!gp||blocked){resetPad();return opened||releaseController;}
   const buttons=Array.from(gp.buttons||[],b=>!!b.pressed||b.value>.3),combo=!!buttons[5]&&!!buttons[15];
   const id=String(gp.index)+':'+String(gp.id);
   if(id!==padId){resetPad();padId=id;armed=neutral(gp);previous=buttons;chordDown=combo;return opened||combo||releaseController;}
   if(!armed){armed=neutral(gp);previous=buttons;chordDown=combo;return opened||combo||releaseController;}
   if(combo&&!chordDown){if(send(1))releaseController=true;direction=0;}
   chordDown=combo;
   if(releaseController){
    if(neutral(gp))releaseController=false;
    previous=buttons;direction=0;return opened||releaseController||combo;
   }
   if(!opened){previous=buttons;direction=0;return combo;}
   let bit=buttons[0]&&!previous[0]?8:buttons[1]&&!previous[1]?16:0;
   let next=buttons[12]?2:buttons[13]?4:buttons[14]?32:buttons[15]?64:0;
   if(!next){const x=Number(gp.axes?.[0])||0,y=Number(gp.axes?.[1])||0;
    const limit=direction ? .35 : .65;
    if(Math.max(Math.abs(x),Math.abs(y))>limit)next=Math.abs(y)>=Math.abs(x)?(y<0?2:4):(x<0?32:64);
   }
   const now=performance.now();
   if(next!==direction){direction=next;repeatAt=now+350;if(!bit)bit=next;}
   else if(next&&now>=repeatAt){repeatAt=now+110;if(!bit)bit=next;}
   if(bit)send(bit);
   previous=buttons;return true;
  }
  root.GTATrainerPort.controller=controller;
  const hotkey=e=>{
   if(e.target.closest?.('input,textarea,select,button,dialog,[contenteditable=true]'))return;
   const bit=e.code===menuKey?1:{ArrowUp:2,ArrowDown:4,Enter:8,Backspace:16,Escape:16,ArrowLeft:32,ArrowRight:64}[e.code];
   if(!bit||bit!==1&&!opened)return;
   e.preventDefault();e.stopImmediatePropagation();
   if(bit===1&&e.repeat)return;
   send(bit);
  };
  root.addEventListener('keydown',hotkey,true);
  const timer=setInterval(()=>{
   const v=new DataView(d.memory.buffer);
   if(!d.block)return;
   if(v.getUint32(d.block+128,true)!==0x4d4e5931)return;
   // Let the game consume pending navigation before reconciling optimistic F4.
   if(v.getInt32(d.block+148,true)){setOpened(false);return;}
   if(!Atomics.load(new Int32Array(d.memory.buffer,d.block+132,1),0))setOpened(!!v.getInt32(d.block+136,true));
  },100);
  return()=>{if(root.GTATrainerPort.controller===controller)delete root.GTATrainerPort.controller;resetPad();releaseController=false;clearInterval(timer);root.removeEventListener('keydown',hotkey,true);setOpened(false);stop?.();};
 };
})(typeof window!=='undefined'?window:globalThis);
