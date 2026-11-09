(async () => {
  'use strict';
  if(location.hostname!=='127.0.0.1')throw Error('Local fixture only');
  const result=document.getElementById('results'),workspace=document.getElementById('workspace'),reports=[];
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const settle=()=>new Promise(resolve=>setTimeout(resolve,50));
  for(const mode of ['idle-only','early-and-idle','unaccepted']) {
    const frame=document.createElement('iframe');frame.title='Synthetic '+mode;workspace.append(frame);
    const target=frame.contentWindow,doc=target.document,errors=[],messages=new Set(),changes=new Set();
    let accepted=mode!=='unaccepted',reads=0,writes=0;
    target.addEventListener('error',event=>errors.push(event.message));
    target.addEventListener('unhandledrejection',event=>errors.push(event.reason?.message||'rejection'));
    try {
      target.chrome??={};assert(!target.chrome.storage,'real storage must never be replaced');
      target.chrome.runtime={onMessage:{addListener:fn=>messages.add(fn),removeListener:fn=>messages.delete(fn)},
        async sendMessage(message){assert(message.type==='gmail-pro-consent'&&message.action==='status','only agreement status may be read');return {ok:true,status:{accepted}};}};
      target.chrome.storage={sync:{async get(){reads++;return {};},async set(){writes++;}},
        onChanged:{addListener:fn=>changes.add(fn),removeListener:fn=>changes.delete(fn)}};
      doc.body.innerHTML='<main role="main">Synthetic mailbox startup</main>';
      const load=file=>new Promise((resolve,reject)=>{
        const script=doc.createElement('script');script.src=location.origin+'/'+file;
        script.onload=resolve;script.onerror=()=>reject(Error('Could not load '+file));doc.head.append(script);
      });
      const registration=async block=>{
        for(const file of block.css||[]) {
          const link=doc.createElement('link');link.rel='stylesheet';link.href=location.origin+'/'+file;doc.head.append(link);
        }
        for(const file of block.js)await load(file);
      };
      let owners;
      if(mode==='early-and-idle'){await registration(GmailProStartupManifest[0]);owners={...target.GmailPro};}
      await registration(GmailProStartupManifest[1]);await settle();
      const app=target.GmailPro;
      if(owners)for(const [name,owner] of Object.entries(owners))assert(app[name]===owner,name+' owner replaced');
      assert(typeof app.autoBcc?.start==='function'&&typeof app.startAutoBcc==='function','complete idle startup');
      if(!accepted) {
        assert(!doc.documentElement.classList.contains('gmail-pro-apple-mail-mode')&&reads===0&&writes===0,'unaccepted startup stays paused');
        accepted=true;for(const listener of messages)listener({type:'gmail-pro-consent-changed'});await settle();
      }
      assert(doc.documentElement.classList.contains('gmail-pro-apple-mail-mode'),'real appearance controller started');
      // Consent and native label-menu integration each own one runtime listener.
      assert(reads===1&&writes===0&&changes.size===1&&messages.size===2,`single startup owners, no writes (${reads}/${writes}/${changes.size}/${messages.size})`);
      await registration(GmailProStartupManifest[1]);await settle();
      assert(reads===1&&writes===0&&changes.size===1&&messages.size===2,'replay is idempotent');
      target.dispatchEvent(new target.PageTransitionEvent('pagehide'));
      assert(changes.size===0&&messages.size===0,'cleanup releases both subscriptions');
      assert(!errors.length,errors.join('; '));reports.push('PASS '+mode);
    } catch(error){reports.push('FAIL '+mode+': '+error.message);}
    frame.remove();result.textContent=reports.join('\n');
  }
  result.textContent+='\n\n'+reports.filter(line=>line.startsWith('PASS')).length+'/'+reports.length+' checks passed';
  result.dataset.failures=String(reports.filter(line=>line.startsWith('FAIL')).length);
})();
