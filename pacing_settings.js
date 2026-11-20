/* Normal launches support bounded experimental high rates while retaining native VSync. */
(function(root){
  'use strict';
  function get(search){
    const q=new URLSearchParams(search);
    // Isolate native VSync0 while retaining a bounded GPU consumer and every fence.
    if(q.get('fpsdiag')==='1'&&q.get('vsynctest')==='off'&&q.get('mode')==='sandbox'&&['60','75','120'].includes(q.get('fps'))&&!['fpsdebug','nativehz','fpsbench','poseproof','usermod','carmod','multiplayer'].some(key=>q.has(key)))return {fps:+q.get('fps'),frameLimit:0,diagnosticVsync:true};
    if(q.get('fpsdiag')==='1'&&q.get('fpsdebug')==='75')return {fps:75,frameLimit:1,diagnostic:true};
    const fps=['24','30','60','75','90','100','120'].includes(q.get('fps'))?+q.get('fps'):60;
    const frameLimit=fps===30?2:fps===24?0:1;
    return {fps,frameLimit,experimental:fps>60};
  }
  root.GTAPacingSettings={get};if(typeof module!=='undefined')module.exports=root.GTAPacingSettings;
})(typeof self!=='undefined'?self:globalThis);
