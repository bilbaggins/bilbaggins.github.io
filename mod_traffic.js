/* Opt-in traffic mailbox. Only the mounted model hash is supplied, never a model index. */
(function(root){
 'use strict';
 const MARKER=0x54524632,EXTENDED=0x54524633;
 function modelHash(name){
  if(typeof name!=='string'||!/^[a-z0-9_]{1,64}$/i.test(name))throw new Error('Invalid traffic model name');
  let h=0;for(const c of new TextEncoder().encode(name.toLowerCase())){h=(h+c)>>>0;h=(h+(h<<10))>>>0;h^=h>>>6;}
  h=(h+(h<<3))>>>0;h^=h>>>11;return (h+(h<<15))>>>0;
 }
 function mailbox(descriptor){
  if(!descriptor?.runtimeMain)throw new Error('Traffic requires the main runtime');
  const {memory,block}=descriptor,buffer=memory?.buffer;
  if(!buffer||!Number.isSafeInteger(block)||block<=0||block%8||block+448>buffer.byteLength)throw new Error('Invalid traffic mailbox');
  const v=new DataView(buffer);
  if(v.getUint32(block+32,true)!==0x424d5053||v.getUint32(block+36,true)!==2||![MARKER,EXTENDED].includes(v.getUint32(block+164,true)))throw new Error('Traffic runtime is not available');
  const extended=v.getUint32(block+164,true)===EXTENDED,size=extended?1536:448;if(block+size>buffer.byteLength)throw new Error('Traffic mailbox is truncated');return {v,words:new Int32Array(buffer,block+128,(size-128)/4),slots:extended?16:4,slotBase:extended?512:192};
 }
 function install(descriptor,log,{model,models=model?[model]:[],isWorldReady=()=>false,share=5}={}){
  if(!Array.isArray(models)||models.length<1||models.length>16)throw new Error('Traffic requires 1–16 models');if(![5,10,25].includes(share))throw new Error('Invalid modded traffic share');
  const hashes=models.map(modelHash);if(new Set(hashes).size!==hashes.length)throw new Error('Traffic model hash conflict');const layout=mailbox(descriptor);if(models.length>layout.slots||layout.slots===4&&share!==5)throw new Error('This traffic runtime does not support the requested pool/rate');
  let armed=false,stopped=false,lastState=null,lastCount=0,lastLog=-Infinity;
  const stop=()=>{if(stopped)return;stopped=true;clearInterval(timer);try{Atomics.store(mailbox(descriptor).words,0,0);}catch(_){};};
  const timer=setInterval(()=>{
   try{
    const {v,words,slotBase,slots}=mailbox(descriptor),base=descriptor.block;
    if(!armed&&isWorldReady()){
     for(let i=0;i<hashes.length;i++){const at=(slotBase-128)/4+i*16;Atomics.store(words,at+1,hashes[i]|0);Atomics.store(words,at,1);}if(slots===16)Atomics.store(words,12,100/share);
     Atomics.store(words,1,hashes.length);Atomics.store(words,0,1);armed=true;
    }
    if(!armed)return;
    const pool=models.map((model,i)=>{const at=base+slotBase+i*64,state=v.getInt32(at,true);let instances=null;
     if(state===2){const info=Number(v.getBigUint64(at+24,true));if(Number.isSafeInteger(info)&&info>0&&info+184<=v.byteLength){const data=Number(v.getBigUint64(info+176,true));if(Number.isSafeInteger(data)&&data>0&&data+1712<=v.byteLength)instances=v.getInt16(data+1708,true)+v.getInt16(data+1710,true);}}
     return {model,state,instances,substitutions:v.getUint32(at+20,true),index:state===2?v.getUint32(at+8,true):null};});
    const state=pool.map(x=>x.state+':'+x.instances).join(','),eligible=v.getUint32(base+152,true),substitutions=v.getUint32(base+156,true);
    if(state!==lastState||performance.now()-lastLog>=5000){
     log('[mod traffic] '+JSON.stringify({share,pool,choices:v.getUint32(base+140,true),lastFlags:v.getUint32(base+144,true),lastStreet:v.getUint32(base+148,true),lastOriginal:v.getUint32(base+172,true),eligible,substitutions}));lastState=state;lastCount=substitutions;lastLog=performance.now();
    }
   }catch(error){log('[mod traffic] stopped: '+error.message);stop();}
  },100);
  root.addEventListener?.('pagehide',stop,{once:true});return stop;
 }
 root.GTAModTraffic={modelHash,mailbox,install};
 if(typeof module!=='undefined')module.exports=root.GTAModTraffic;
})(typeof window!=='undefined'?window:globalThis);
