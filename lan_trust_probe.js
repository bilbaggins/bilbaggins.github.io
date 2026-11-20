/* Test the same nested-worker fetch path that the engine needs, without starting it. */
if(new URL(self.location.href).searchParams.get('child')==='1'){
  self.postMessage({ready:true});
}else{
  let child,timer,finished=false;
  const finish=ready=>{
    if(finished)return;finished=true;clearTimeout(timer);child?.terminate();self.postMessage({ready});
  };
  try{
    const url=new URL(self.location.href);url.searchParams.set('child','1');
    child=new Worker(url.href);
    child.onmessage=event=>finish(event.data?.ready===true);
    child.onerror=event=>{event.preventDefault();finish(false);};
    timer=setTimeout(()=>finish(false),2000);
  }catch(_){finish(false);}
}
