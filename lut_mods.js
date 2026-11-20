/* Data-only .cube grading: bounded parsing, resampling and hash-pinned shader generation. */
import './shader_mods.js?v=shader-data-v1';
import {storedZip} from './mod_archive.js';
const encoder=new TextEncoder(),helper=globalThis.GTAShaderMods||globalThis.self?.GTAShaderMods;
const clamp=x=>Math.max(0,Math.min(1,x));
function bad(message){throw Error('CUBE LUT: '+message);}
export function parseCube(source){
 if(typeof source!=='string'||encoder.encode(source).length>16*1048576)bad('text exceeds 16 MiB');
 let size=0,title='',min=[0,0,0],max=[1,1,1],rows=[],seen=new Set(),started=false;
 for(const [lineIndex,raw] of source.split(/\r?\n/).entries()){
  const line=raw.replace(/#.*$/,'').trim();if(!line)continue;
  const keyword=/^([A-Za-z_][A-Za-z_0-9]*)\b(.*)$/.exec(line);
  if(keyword){const key=keyword[1],value=keyword[2].trim();if(started)bad('header after data at line '+(lineIndex+1));if(seen.has(key))bad('duplicate '+key);seen.add(key);
   if(key==='TITLE'){const match=/^"([^"\r\n]{0,120})"$/.exec(value);if(!match)bad('invalid title');title=match[1];}
   else if(key==='LUT_3D_SIZE'){if(!/^\d+$/.test(value)||(size=Number(value))<2||size>65)bad('3D size must be 2–65');}
   else if(key==='DOMAIN_MIN'||key==='DOMAIN_MAX'){const values=value.split(/\s+/).map(Number);if(values.length!==3||!values.every(x=>Number.isFinite(x)&&Math.abs(x)<=65504))bad('invalid domain');if(key==='DOMAIN_MIN')min=values;else max=values;}
   else bad('unsupported directive '+key+' (1D/shaper/HDR pipelines are not supported)');
  }else{started=true;if(!size)bad('LUT_3D_SIZE must precede data');const values=line.split(/\s+/).map(Number);if(values.length!==3||!values.every(x=>Number.isFinite(x)&&x>=0&&x<=1))bad('expected three finite SDR values in [0,1] at line '+(lineIndex+1));rows.push(values);if(rows.length>size**3)bad('too many entries');}
 }
 if(!size||rows.length!==size**3)bad('expected exactly size³ RGB entries');if(min.some((x,i)=>!(max[i]>x)||max[i]-x<1e-6))bad('domain range must be positive');return {size,title,min,max,rows};
}
export function sampleCube(cube,rgb){
 const p=rgb.map(x=>clamp(x)*(cube.size-1)),lo=p.map(Math.floor),hi=lo.map(x=>Math.min(cube.size-1,x+1)),f=p.map((x,i)=>x-lo[i]),result=[0,0,0];
 for(let b=0;b<2;b++)for(let g=0;g<2;g++)for(let r=0;r<2;r++){const weight=(r?f[0]:1-f[0])*(g?f[1]:1-f[1])*(b?f[2]:1-f[2]),row=cube.rows[((b?hi[2]:lo[2])*cube.size+(g?hi[1]:lo[1]))*cube.size+(r?hi[0]:lo[0])];for(let c=0;c<3;c++)result[c]+=row[c]*weight;}return result;
}
export function cubeWords(cube){const words=[];for(let b=0;b<16;b++)for(let g=0;g<16;g++)for(let r=0;r<16;r++){const v=sampleCube(cube,[r/15,g/15,b/15]).map(x=>Math.round(clamp(x)*1023));words.push((v[0]|v[1]<<10|v[2]<<20)>>>0);}return words;}
export function cubeWGSL(cube){const vector=values=>'vec3<f32>('+values.map(x=>Number(x).toExponential(9)).join(',')+')';return `
@group(3u) @binding(0u) var<storage, read> grandv_mod_words: array<u32>;
fn grandvCubeFetch(p:vec3<u32>)->vec3<f32>{let w=grandv_mod_words[(p.z*16u+p.y)*16u+p.x];return vec3<f32>(f32(w&1023u),f32((w>>10u)&1023u),f32((w>>20u)&1023u))/1023.0;}
fn grandvCube(colour:vec3<f32>)->vec3<f32>{
 let point=clamp((colour-${vector(cube.min)})/(${vector(cube.max)}-${vector(cube.min)}),vec3<f32>(0.0),vec3<f32>(1.0))*15.0;
 let low=vec3<u32>(floor(point));let high=min(low+vec3<u32>(1u),vec3<u32>(15u));let f=fract(point);
 let a=mix(grandvCubeFetch(low),grandvCubeFetch(vec3<u32>(high.x,low.y,low.z)),f.x);
 let b=mix(grandvCubeFetch(vec3<u32>(low.x,high.y,low.z)),grandvCubeFetch(vec3<u32>(high.xy,low.z)),f.x);
 let c=mix(grandvCubeFetch(vec3<u32>(low.xy,high.z)),grandvCubeFetch(vec3<u32>(high.x,low.y,high.z)),f.x);
 let d=mix(grandvCubeFetch(vec3<u32>(low.x,high.yz)),grandvCubeFetch(high),f.x);
 return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);
}
`;}
export async function buildCubePack(source,filename,{index,loadBase}={}){
 const cube=parseCube(source),words=cubeWords(cube),data=new Uint8Array(words.length*4),view=new DataView(data.buffer);words.forEach((x,i)=>view.setUint32(i*4,x,true));
 if(!index){const response=await fetch('/b/8b0b5899ed/shaders/index.json',{cache:'no-store'});if(!response.ok)bad('stock shader index unavailable');index=await response.json();}loadBase=loadBase||((hash)=>helper.loadBase(hash,index));
 const shaders=[],files=[{path:'lut.wgslbuf',bytes:data},{path:'Original.cube.txt',bytes:encoder.encode(source)}];
 for(const [hash,record] of Object.entries(index))if(record?.effect==='postfx'&&record.stage==='ps'&&record.program?.startsWith('PS_Composite')){
  const base=await loadBase(hash);if(base.split('return o0;').length!==2)bad('unsupported stock composite wrapper');const alpha=base.includes('o0.w = dot(')?'dot(grandvLutColour,vec3<f32>(0.299,0.587,0.114))':'o0.w';
  const code=base.replace('return o0;',`let grandvLutColour=grandvCube(o0.xyz); return vec4<f32>(grandvLutColour,${alpha});`)+cubeWGSL(cube),path='shaders/'+hash+'.wgsl';shaders.push({hash,baseSha256:await helper.sha256(base),file:path,dataFile:'lut.wgslbuf'});files.push({path,bytes:encoder.encode(code)});
 }
 if(!shaders.length||shaders.length>64)bad('no compatible composite targets');
 const name=('LUT: '+(cube.title||filename.replace(/\.cube$/i,''))).slice(0,80),info={format:'grandv-shader-pack-v1',name,source:{type:'cube',filename,size:cube.size,workingSize:16,precision:'RGB10',domainMin:cube.min,domainMax:cube.max},shaders};
 files.unshift({path:'shaderpack.json',bytes:encoder.encode(JSON.stringify(info))});return {zip:storedZip(files),cube,name,programs:shaders.length};
}
