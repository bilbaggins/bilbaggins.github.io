/* Read-only diagnostics for the opt-in exact-build engine hook. No relay/game writes. */
(function(root){
  'use strict';
  function read(memory,block){
    const buffer=memory.buffer;
    if(!Number.isSafeInteger(block)||block<=0||block%8||block+64>buffer.byteLength)throw new Error('Invalid mailbox range');
    const view=new DataView(buffer),sequence=new Int32Array(buffer,block+4,1);
    if(view.getUint32(block+32,true)!==0x424d5053||![1,2].includes(view.getUint32(block+36,true)))throw new Error('Mailbox signature mismatch');
    const before=Atomics.load(sequence,0);
    if(before&1)return null;
    const guid=view.getInt32(block,true),position=[8,16,24].map(offset=>view.getFloat32(block+offset,true));
    if(before!==Atomics.load(sequence,0))return null;
    if(!position.every(Number.isFinite))throw new Error('Non-finite pose');
    return {sequence:before>>>0,guid,position};
  }
  function context(memory,block){
    const buffer=memory.buffer,view=new DataView(buffer),sequence=new Int32Array(buffer,block+56,1);
    const before=Atomics.load(sequence,0);if(before&1)return null;
    const handler=Number(view.getBigUint64(block+40,true)),thread=Number(view.getBigUint64(block+48,true));
    if(before!==Atomics.load(sequence,0))return null;
    let name='none';
    if(Number.isSafeInteger(thread)&&thread>0&&thread+492<=buffer.byteLength){
      const bytes=new Uint8Array(buffer,thread+428,64),end=bytes.indexOf(0);
      name=new TextDecoder().decode(new Uint8Array(bytes.subarray(0,end<0?64:end)));
    }
    return {sequence:before>>>0,handler,thread,name};
  }
  function install(descriptor,log,options={}){
    if(!descriptor.runtimeMain){log('[pose proof] rejected: stats hook ran in a pthread instance');return;}
    const panel=document.createElement('div');
    panel.id='pose-proof-status';
    panel.hidden=options.hidePanel===true;
    panel.style.cssText='position:fixed;right:12px;bottom:20px;z-index:12;padding:10px;background:#07100ee6;color:#b3d99b;font:12px monospace;white-space:pre;pointer-events:none';
    const content=document.createElement('div');panel.append(content);
    let modelHash=0;
    if(options.car&&options.model){
      if(!/^[A-Za-z0-9_]{1,32}$/.test(options.model))throw new Error('Invalid model name');
      for(const code of new TextEncoder().encode(options.model.toLowerCase())){modelHash=(modelHash+code)>>>0;modelHash=(modelHash+(modelHash<<10))>>>0;modelHash^=modelHash>>>6;}
      modelHash=(modelHash+(modelHash<<3))>>>0;modelHash^=modelHash>>>11;modelHash=(modelHash+(modelHash<<15))>>>0;
      Atomics.store(new Int32Array(descriptor.memory.buffer,descriptor.block+104,1),0,modelHash|0);
    }
    let commandStatus=null,feedback=null,modelInput=null,lastAck=0,lastOpcode=0;
    if((options.replica||options.car)&&new DataView(descriptor.memory.buffer).getUint32(descriptor.block+36,true)===2){
      panel.style.pointerEvents='auto';commandStatus=document.createElement('div');feedback=document.createElement('div');feedback.setAttribute('role','status');
      if(options.trainer){
        const label=document.createElement('label');label.textContent='Vehicle model ';modelInput=document.createElement('input');modelInput.value=options.model||'sultan';modelInput.maxLength=32;modelInput.setAttribute('aria-label','Trainer vehicle model');modelInput.style.cssText='width:130px;color:#07100e;background:#fff';label.append(modelInput);panel.append(label);
        const help=document.createElement('div');help.textContent='Stock or mounted model name. Remove before spawning another.';help.style.cssText='white-space:normal;max-width:280px';panel.append(help);
      }
      const actions=options.car?[[options.trainer?'Spawn vehicle':options.model?'Spawn '+options.model:'Spawn Audi RS3',4,8],['Move spawned vehicle here',2,3],['Remove spawned vehicle',3,0],...(options.trainer?[['Repair spawned vehicle',5,0],['Clean spawned vehicle',6,0]]:[])]:[['Spawn test replica',1,2],['Move replica',2,5],['Remove replica',3,0]];
      for(const [label,opcode,offset] of actions){
        const button=document.createElement('button');button.type='button';button.textContent=label;
        button.style.cssText='display:block;margin-top:8px;padding:6px 10px;background:#79b85b;color:#07100e;border:0;border-radius:4px';
        button.onclick=()=>{
          try{if(options.isWorldReady&&!options.isWorldReady()){feedback.textContent='Wait for the playable world';return;}const pose=read(descriptor.memory,descriptor.block);if(!pose?.guid)return;
            if(modelInput&&opcode===4){const name=modelInput.value.trim().toLowerCase();if(!/^[a-z0-9_]{1,32}$/.test(name))throw new Error('Use a vehicle model name (letters, digits or underscore)');modelHash=hashModel(name);}
            const position=pose.position.slice();position[0]+=offset;
            const queued=command({...descriptor,car:!!options.car,trainer:!!options.trainer,modelHash:opcode===4?modelHash||undefined:undefined},opcode,position);if(queued)lastOpcode=opcode;
            feedback.textContent=queued?'Command queued':'Command pending';
          }catch(error){feedback.textContent=error.message;}
        };
        panel.append(button);
      }
      panel.append(feedback,commandStatus);
    }
    document.body.append(panel);
    log('[pose proof] runtime-main mailbox received');
    let lastLog=-Infinity,stopped=false;
    const timer=setInterval(()=>{
      try{
        const pose=read(descriptor.memory,descriptor.block);
        if(!pose)return;
        const script=options.context?context(descriptor.memory,descriptor.block):null;
        content.textContent=options.trainer?(options.mode==='story'?'Story vehicle trainer':'Sandbox vehicle trainer'):'Player hook\nGUID '+pose.guid+' / tick '+(pose.sequence>>>1)+'\n'+pose.position.map(v=>v.toFixed(2)).join(', ')+(script?'\nScript '+script.name+' / calls '+(script.sequence>>>1):'');
        if(commandStatus){const view=new DataView(descriptor.memory.buffer),ack=view.getUint32(descriptor.block+68,true),status=view.getInt32(descriptor.block+72,true),entity=view.getInt32(descriptor.block+108,true);
          commandStatus.textContent=options.trainer?(entity?'Spawned vehicle active':'No spawned vehicle'):(options.car?'Model registered '+view.getInt32(descriptor.block+76,true)+'\nEntity ':'Replica ')+entity+' / status '+status+' / ack '+ack;
          if(options.trainer&&ack!==lastAck){lastAck=ack;feedback.textContent=status<0?({'-1':'Vehicle creation failed','-2':'Spawned vehicle no longer exists','-3':'Position is out of range','-4':'Script session changed; return to the launcher','-5':'This model is not available in the mounted game assets','-7':'Model loading timed out','-8':'Remove the spawned vehicle before creating another','-9':'Reload the trainer from the launcher'}[status]||'Vehicle command failed'):({2:'Vehicle moved',3:'Vehicle removed',4:'Vehicle spawned',5:'Vehicle repaired',6:'Vehicle cleaned'}[lastOpcode]||'Command complete');}
        }
        if(performance.now()-lastLog>=5000){log('[pose proof] '+JSON.stringify({...pose,...(script?{script}: {})}));lastLog=performance.now();}
      }catch(error){
        clearInterval(timer);stopped=true;content.textContent='Pose proof stopped: '+error.message;log('[pose proof] stopped: '+error.message);
      }
    },100);
    return ()=>{if(!stopped)clearInterval(timer);panel.remove();};
  }
  function command(descriptor,opcode,position){
    const {memory,block}=descriptor,buffer=memory.buffer,view=new DataView(buffer);
    if(!Number.isSafeInteger(block)||block<=0||block%8||block+128>buffer.byteLength)throw new Error('Invalid command mailbox');
    if(view.getUint32(block+36,true)!==2||block+128>buffer.byteLength)throw new Error('Replica commands unavailable');
    if(!(descriptor.trainer?[2,3,4,5,6]:descriptor.car?[1,2,3,4]:[1,2,3]).includes(opcode)||!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite)||Math.abs(position[0])>=20000||Math.abs(position[1])>=20000||Math.abs(position[2])>=2000)throw new Error('Invalid replica command');
    if(descriptor.trainer&&view.getUint32(block+60,true)!==0x54524E31)throw new Error('Trainer runtime is not ready; reload from the launcher');
    if(descriptor.modelHash!==undefined&&(!Number.isInteger(descriptor.modelHash)||descriptor.modelHash<0||descriptor.modelHash>0xffffffff))throw new Error('Invalid vehicle model hash');
    const slot=new Int32Array(buffer,block+64,1);
    if(Atomics.compareExchange(slot,0,0,-1)!==0)return false;
    position.forEach((value,i)=>view.setFloat32(block+80+i*8,value,true));
    if(descriptor.modelHash!==undefined)view.setUint32(block+104,descriptor.modelHash>>>0,true);
    Atomics.store(slot,0,opcode);return true;
  }
  function hashModel(name){let hash=0;for(const code of new TextEncoder().encode(name.toLowerCase())){hash=(hash+code)>>>0;hash=(hash+(hash<<10))>>>0;hash^=hash>>>6;}hash=(hash+(hash<<3))>>>0;hash^=hash>>>11;return (hash+(hash<<15))>>>0;}
  root.GTAPoseBridge={read,context,command,install,hashModel};
  if(typeof module!=='undefined')module.exports=root.GTAPoseBridge;
})(typeof self!=='undefined'?self:globalThis);
