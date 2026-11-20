/* Native ioPad bridge for build 8b0b5899ed. Adapted from dev-gyata/gta-launcher v1.2.0. */
(function(root) {
  'use strict';
  const PAD=12840656, STICK=12839248, COUNT=12839904;
  const BITS=[64,32,128,16,4,8,1,2,256,2048,512,1024,4096,16384,32768,8192];
  function axisPair(x,y) {
    x=Number.isFinite(x)?x:0; y=Number.isFinite(y)?y:0;
    const m=Math.hypot(x,y), r=m<=.1?0:Math.min(1,(m-.1)/.9)/m;
    return [x*r,y*r].map(v=>Math.max(0,Math.min(255,Math.round((v+1)*127.5))));
  }
  function encode(gp) {
    const [lx,ly]=axisPair(gp.axes[0],gp.axes[1]), [rx,ry]=axisPair(gp.axes[2],gp.axes[3]);
    let bits=0; gp.buttons.forEach((b,i)=>{if((b.pressed||b.value>.3)&&BITS[i])bits|=BITS[i];});
    const trigger=i=>Math.round(Math.max(0,Math.min(1,gp.buttons[i]?.value||0))*255);
    return {lx,ly,rx,ry,l2:trigger(6),r2:trigger(7),bits};
  }
  function install(memory,block,options={}) {
    if(options.build!=='/b/8b0b5899ed'||(options.disabled&&!options.virtualGamepad))return null;
    if(!navigator.getGamepads&&!options.virtualGamepad){options.status?.({state:'unavailable',text:'Browser Gamepad API unavailable'});return null;}
    let active=false, state=null, timer=null, gpIndex=-1, stopped=false, motors=[0,0], lastPlay=0, rejected='', lastStatus='', verified=false, lastDiag=0;
    const status=(state,text)=>{const next=state+'\0'+text;if(next!==lastStatus){lastStatus=next;options.status?.({state,text});}};
    const views=()=>({u8:new Uint8Array(memory.buffer),dv:new DataView(memory.buffer)});
    const ready=()=>{const {dv}=views();return dv.byteLength>PAD+136&&dv.getUint32(PAD,true)!==0&&dv.getUint32(PAD+8,true)===0&&dv.getInt32(COUNT,true)===0&&(verified||dv.getUint32(PAD+20,true)===0x80808080);};
    // Some Windows Xbox drivers expose the normal Xbox layout without setting
    // Gamepad.mapping to "standard". Restrict the fallback to Xbox/XInput IDs;
    // arbitrary HID reports can have a different button order.
    function gamepad() {
      const virtual=options.virtualGamepad?.();
      if(virtual?.connected)return virtual;
      if(options.disabled||!navigator.getGamepads)return null;
      let pads;
      try { pads=Array.from(navigator.getGamepads()||[]); } catch(_) { return null; }
      return pads.find(p=>p?.connected&&p.mapping==='standard')||pads.find(p=>p?.connected&&/xbox|xinput|045e(?:[ :-]|$)/i.test(p.id||'')&&p.axes?.length>=4&&p.buttons?.length>=16)||null;
    }
    function rumble(values) {
      if(gpIndex<0||!navigator.getGamepads)return;
      const actuator=navigator.getGamepads()[gpIndex]?.vibrationActuator;
      if(!actuator)return;
      try {const effect=values.some(Boolean)?actuator.playEffect?.('dual-rumble',{duration:120,strongMagnitude:values[0],weakMagnitude:values[1]}):actuator.reset?.(); effect?.catch(()=>{});}catch(_){}
    }
    function write() {
      if(!active||!state)return;
      const {u8,dv}=views();
      u8.set([state.lx,state.ly,state.rx,state.ry,state.l2,state.r2],PAD+108);
      dv.setUint32(PAD+132,state.bits,true);
      const next=[dv.getUint16(PAD+66,true)/65535,dv.getUint16(PAD+68,true)/65535], now=performance.now();
      if(next[0]!==motors[0]||next[1]!==motors[1]||(next.some(Boolean)&&now-lastPlay>80)){motors=next;lastPlay=now;rumble(next);}
    }
    function release() {
      if(!active)return;
      clearInterval(timer); timer=null; state=null;
      const {u8,dv}=views(); u8.fill(128,PAD+108,PAD+112);u8.fill(0,PAD+112,PAD+114);dv.setUint32(PAD+132,0,true);dv.setInt32(COUNT,0,true);
      rumble([0,0]); motors=[0,0]; active=false;status('waiting','Press a controller button');
    }
    function poll() {
      if(stopped)return;
      // The worker focus word gates keyboard/mouse delivery. Native ioPad does not
      // consume that block, and it can remain stale after focus changes in an
      // embedded/launcher window. The page focus and blur handler are the correct
      // lifecycle boundary for the controller bridge.
      const candidate=!document.hidden&&(!document.hasFocus||document.hasFocus())?gamepad():null;
      const menuCaptured=options.menu?.(candidate)===true;
      const gp=!menuCaptured&&!options.suspended?.()?candidate:null;
      if(!gp){release();status('waiting','Press a controller button');}
      else {
        if(!active&&ready()) {
          const {dv}=views();for(let o=12;o<=40;o+=4)dv.setInt32(STICK+o,32768,true);dv.setInt16(STICK+148,-1,true);dv.setInt32(COUNT,1,true);
          active=true;verified=true;rejected='';timer=setInterval(write,1);const text='Controller connected (mapping '+(gp.mapping||'none')+')';options.log?.('[page input] native '+text.toLowerCase());status('connected',text);
        } else if(!active) {
          const {dv}=views(), reason='ioPad guard '+dv.getUint32(PAD,true).toString(16)+'/'+dv.getUint32(PAD+8,true)+'/'+dv.getUint32(PAD+20,true).toString(16)+' count='+dv.getInt32(COUNT,true);
          if(reason!==rejected){rejected=reason;options.log?.('[page input] native controller waiting: '+reason);status('guard','Native guard waiting: '+reason);}
        }
        if(active){gpIndex=gp.index;state=encode(gp);write();
          if(options.diag && performance.now()-lastDiag>=250){
            lastDiag=performance.now();const {dv}=views(), base=24488864;
            const axis=o=>({value:Math.round(dv.getFloat32(base+o+4,true)*1000)/1000,source:dv.getInt32(base+o+16,true)});
            options.diag({stick:[state.rx,state.ry],buttons:state.bits,liveInit:dv.getUint8(29309190),weapon:[axis(34640),axis(34568)],radio:[axis(57680),axis(57608)]});
          }
        }
      }
      requestAnimationFrame(poll);
    }
    addEventListener('blur',release);addEventListener('gamepaddisconnected',release);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
    addEventListener('pagehide',()=>{stopped=true;release();},{once:true});
    status('waiting','Press a controller button');
    requestAnimationFrame(poll);
    return {release};
  }
  root.GTAController={encode,axisPair,install};
  if(typeof module!=='undefined')module.exports=root.GTAController;
})(typeof self!=='undefined'?self:globalThis);
