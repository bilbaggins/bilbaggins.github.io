/* Bounded local diagnostics for static hosts too. No uploads or persistent storage. */
(function(root){
 'use strict';
 function create({maxChars=262144,maxLines=2000}={}){
  const lines=[],incidents=[],diagnostics=[],cinematicDiagnostics=[],contactDiagnostics=[],graphicsDiagnostics=[],colourDiagnostics=[],lagDiagnostics=[],hitchDiagnostics=[],ioDiagnostics=[];let chars=0,dropped=0;
  const redact=text=>String(text).replace(/([?&](?:key|token|code|accesscode|access_code|password|secret)=)[^&\s]*/gi,'$1[redacted]').replace(/("(?:key|token|code|accessCode|password|secret)"\s*:\s*")[^"]*/gi,'$1[redacted]');
  function add(source,value){
   const text=redact(typeof value==='string'?value:JSON.stringify(value)??String(value));
   if(value?.nativeLogSummary||value?.lagDiagnostic||/\[lag (?:diagnosis|page)\]|\[native fps\]/.test(text)){lagDiagnostics.push(new Date().toISOString()+' ['+source+'] '+text);if(lagDiagnostics.length>64)lagDiagnostics.shift();}
   if(/stream hitch:/.test(text)){hitchDiagnostics.push(new Date().toISOString()+' ['+source+'] '+text.slice(0,2048));if(hitchDiagnostics.length>32)hitchDiagnostics.shift();}
   if(value?.ioDiagnostic){ioDiagnostics.push(new Date().toISOString()+' ['+source+'] '+text);if(ioDiagnostics.length>64)ioDiagnostics.shift();}
   if(value?.colourDiagnostic){colourDiagnostics.push(new Date().toISOString()+' '+JSON.stringify(value.colourDiagnostic));if(colourDiagnostics.length>80)colourDiagnostics.shift();}
   // Keep low-rate audio counters and decoder failures when engine warnings evict the recent ring.
   if(/\[audio diagnostic\]|\[page audio\]|Decoder error on wave/.test(text)){
    diagnostics.push(new Date().toISOString()+' ['+source+'] '+text.slice(0,2048));
    if(diagnostics.length>64)diagnostics.shift();
   }
   if(/\[cinematic diagnostic\]/.test(text)){cinematicDiagnostics.push(new Date().toISOString()+' ['+source+'] '+text.slice(0,2048));if(cinematicDiagnostics.length>16)cinematicDiagnostics.shift();}
   if(/BC textures:|device ready:|BC fallback stats:|"bcStatus"|"gpuValidation"|"textureUploadDiagnostic"|"textureUseDiagnostic"/.test(text)){graphicsDiagnostics.push(new Date().toISOString()+' ['+source+'] '+text.slice(0,2048));if(graphicsDiagnostics.length>16)graphicsDiagnostics.shift();}
   if(/\[contact audio\]/.test(text)){contactDiagnostics.push(new Date().toISOString()+' ['+source+'] '+text.slice(0,2048));if(contactDiagnostics.length>64)contactDiagnostics.shift();}
   if(['game-crash','error','rejection'].includes(source)||(source==='game-progress'&&value?.gpuLost)){incidents.push(new Date().toISOString()+' ['+source+'] '+text.slice(0,4096));if(incidents.length>8)incidents.shift();}
   for(const part of text.split('\n')){const line=new Date().toISOString()+' ['+source+'] '+part.slice(0,2048);lines.push(line);chars+=line.length+1;}
   while(lines.length>maxLines||chars>maxChars){chars-=lines.shift().length+1;dropped++;}
  }
  return {add,text:()=>`GTA browser diagnostics; older lines dropped: ${dropped}\n`+(incidents.length?'Retained incidents:\n'+incidents.join('\n')+'\n':'')+(diagnostics.length?'Retained audio diagnostics:\n'+diagnostics.join('\n')+'\n':'')+(cinematicDiagnostics.length?'Retained cinematic diagnostics:\n'+cinematicDiagnostics.join('\n')+'\n':'')+(contactDiagnostics.length?'Retained contact diagnostics:\n'+contactDiagnostics.join('\n')+'\n':'')+(graphicsDiagnostics.length?'Retained graphics diagnostics:\n'+graphicsDiagnostics.join('\n')+'\n':'')+(colourDiagnostics.length?'Retained colour diagnostics:\n'+colourDiagnostics.join('\n')+'\n':'')+(lagDiagnostics.length?'Retained lag diagnostics:\n'+lagDiagnostics.join('\n')+'\n':'')+(hitchDiagnostics.length?'Retained frame hitches:\n'+hitchDiagnostics.join('\n')+'\n':'')+(ioDiagnostics.length?'Retained IO diagnostics:\n'+ioDiagnostics.join('\n')+'\n':'')+'Recent log:\n'+lines.join('\n')+'\n',size:()=>({chars,lines:lines.length,dropped})};
 }
 function mount({full=false}={}){
  const ring=create(),channels=[];
  // Whitelist launch settings: access codes, gateway keys and full URLs are excluded.
  const query=root.GTALaunchUrl?root.GTALaunchUrl.expand(location.search):new URLSearchParams(location.search),settings={};
  for(const key of ['mode','fps','low','scale','res','poseproof','trainer','fivem','multiplayer','clientlog','log','bcfallback','bchalf','audiodiag','mem','colordiag','lagdiag','iodiag','iopar','bghistory','rtstate','lagprofile','bindlocal','bindreuse','cbfast','iowaitdedup','binddiag','quietnative','cores','renderopt','shadows','fxaa','texturequality','reflectionquality','waterquality','particlequality','grassquality','anisotropic','lodscale','pedlod','vehiclelod','density','pedvariety','vehiclevariety','postfx','motionblur','dof','shadowquality','softshadows','ssao','drawdistance','fogvolumes','particleshadows','longshadows','flightstreaming','distantlights'])if(query.has(key))settings[key]=query.get(key);
  const environment={started:new Date().toISOString(),settings,full,isolated:root.crossOriginIsolated,memoryGB:navigator.deviceMemory,cores:navigator.hardwareConcurrency,userAgent:navigator.userAgent};
  ring.add('page',environment);
  for(const name of ['game-log','game-crash','game-progress']){const channel=new BroadcastChannel(name);channel.onmessage=event=>{try{ring.add(name,event.data);}catch(_){ring.add('capture','Malformed diagnostic message');}};channels.push(channel);}
  root.addEventListener('error',event=>ring.add('error',event.error?.stack||event.message||'Page error'));
  root.addEventListener('unhandledrejection',event=>ring.add('rejection',event.reason?.stack||String(event.reason)));
  const button=root.GTAGameUI?root.GTAGameUI.button({id:'download-client-log',label:'Save diagnostics'}):document.createElement('button');button.id='download-client-log';button.type='button';button.textContent='Save diagnostics';button.title=full?'Download recent engine and crash logs':'Download device, loading and crash details. For engine logs launch with clientlog=1.';
  if(!root.GTAGameUI){button.style.cssText='position:fixed;left:12px;bottom:42px;z-index:13;padding:5px 8px;border:1px solid #79b85b;border-radius:4px;background:#07100ecc;color:#d3efc2;font:12px sans-serif';document.body.append(button);}
  button.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(environment)+'\n'+ring.text()],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='gta-diagnostics-'+new Date().toISOString().replace(/[:.]/g,'-')+'.log';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  root.addEventListener('pagehide',()=>channels.forEach(channel=>channel.close()),{once:true});
  return ring;
 }
 root.GTAClientLogs={create,mount};
 if(typeof module!=='undefined')module.exports=root.GTAClientLogs;
})(typeof self!=='undefined'?self:globalThis);
