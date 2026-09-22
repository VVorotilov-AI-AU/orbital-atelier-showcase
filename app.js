/* Orbital Atelier. Native scroll is the source of truth; every chapter is a complete state. */
(() => {
  'use strict';
  const data = JSON.parse(document.querySelector('#story-data').textContent);
  const explainerData = JSON.parse(document.querySelector('#explainer-data').textContent);
  const chapters = [...document.querySelectorAll('.chapter')];
  const stages = chapters.map(el => el.querySelector('.chapter-stage'));
  const rooms = [...document.querySelectorAll('.room')];
  const routeLinks = [...document.querySelectorAll('[data-chapter]')];
  const routeOptions = [...document.querySelectorAll('[data-route-index]')];
  const root = document.documentElement;
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const compactQuery = matchMedia('(max-width: 900px)');
  const state = { active: -1, read: false, paused: false, nav: null, webgl: null, pointer: {x:0,y:0}, selected: {harness:'model',memory:null}, explainerId:null, restoreFocus: null, restoreScroll: 0, restoreAfterDialog: true, hashDirty:false, position:null, visitBase:-1, manualSelections:new Set() };
  const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
  const smooth = (a,b,v) => {const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
  let step = innerHeight * 1.35;
  let renderQueued = false;
  let hashTimer = 0;
  const $ = s => document.querySelector(s);
  const text = (selector,value) => {const el=$(selector);if(el) el.textContent=value;};
  const reading = () => state.read || compactQuery.matches;

  function syncHash() {
    if(state.hashDirty && !state.nav && !document.querySelector('dialog[open]') && state.active>=0) {
      history.replaceState(null,'',`#${data.chapters[state.active].id}`);
      state.hashDirty=false;
    }
  }

  function activate(index) {
    index=clamp(index,0,chapters.length-1);
    if(state.active===index) return;
    state.active=index;
    chapters.forEach((el,i)=>el.classList.toggle('is-active',i===index));
    routeLinks.forEach((el,i)=>i===index?el.setAttribute('aria-current','step'):el.removeAttribute('aria-current'));
    routeOptions.forEach((el,i)=>i===index?el.setAttribute('aria-current','step'):el.removeAttribute('aria-current'));
    $('#chapter-number').innerHTML=`${String(index+1).padStart(2,'0')} <i>/ ${chapters.length}</i>`;
    text('#chapter-label',data.chapters[index].label);
    $('#previous').disabled=index===0;
    $('#next').disabled=index===chapters.length-1;
    $('#next').setAttribute('aria-label',index===chapters.length-1?'End of journey':`Next chapter: ${data.chapters[index+1].label}`);
    text('#scene-announcer',`Chapter ${index+1} of ${chapters.length}: ${data.chapters[index].label}`);
    state.hashDirty=true;
    clearTimeout(hashTimer);
    hashTimer=setTimeout(syncHash,180);
  }

  function render() {
    renderQueued=false;
    if(reading()) {
      let index=0;
      chapters.forEach((el,i)=>{if(el.getBoundingClientRect().top<innerHeight*.43) index=i;el.inert=false;el.querySelector('.wall-copy').inert=false;el.removeAttribute('aria-hidden');el.classList.add('is-visible');});
      activate(index);
      state.position={reading:true,index,ratio:(scrollY-chapters[index].offsetTop)/Math.max(chapters[index].offsetHeight,1)};
      root.style.setProperty('--progress',String((index)/(chapters.length-1)));
      if(state.webgl) state.webgl.setState({enabled:false});
      return;
    }
    const position=clamp(scrollY/step,0,chapters.length-1);
    state.position={reading:false,value:position};
    const base=Math.floor(position);
    const fraction=position-base;
    const travel=smooth(.62,1,fraction);
    const nextAlpha=smooth(.75,.98,fraction);
    const oldAlpha=1-smooth(.69,.94,fraction);
    const active=fraction>.9?Math.min(base+1,chapters.length-1):base;
    activate(active);
    if(state.visitBase!==active) {state.visitBase=active;state.manualSelections.clear();}
    const scrollStates={
      model:['harness',['model','harness']],
      instructions:['toolkit',['instructions','skills','tools','review']],
      memory:['memory',['0','1','2','3']],
      verification:['verification',['file','receiver']]
    };
    const sequence=scrollStates[data.chapters[base].id];
    if(sequence&&!state.manualSelections.has(sequence[0])) {
      const [group,values]=sequence;
      const value=values[Math.min(values.length-1,Math.floor(clamp(fraction/ .58)*values.length))];
      if(String(state.selected[group])!==value) select(group,value,{manual:false});
    }
    chapters.forEach((el,i)=>{
      const isBase=i===base, isNext=i===base+1 && fraction>.62;
      const visible=isBase||isNext;
      el.classList.toggle('is-visible',visible);
      const stageAlpha=isBase?oldAlpha:nextAlpha;
      el.inert=i!==active||(!reducedQuery.matches&&stageAlpha<.2);
      el.style.setProperty('--assembly-spread',String(.75+.25*smooth(0,.58,isBase?fraction:0)));
      el.setAttribute('aria-hidden',String(i!==active));
      if(!visible) return;
      const stage=stages[i], copy=el.querySelector('.wall-copy'), bay=el.querySelector('.artifact-bay');
      if(reducedQuery.matches) {
        stage.style.opacity=i===active?'1':'0';
        stage.style.transform='none';copy.inert=false;copy.style.opacity='1';copy.style.transform='none';bay.style.transform='none';
        return;
      }
      stage.style.opacity=String(isBase?oldAlpha:nextAlpha);
      stage.style.transform='none';
      const copyAlpha=isBase?1-smooth(.61,.78,fraction):smooth(.83,1,fraction);
      copy.style.opacity=String(copyAlpha);
      copy.inert=copyAlpha<.1;
      if((el.inert&&el.contains(document.activeElement))||(copy.inert&&copy.contains(document.activeElement))) $('#route-button').focus({preventScroll:true});
      copy.style.transform=isBase?`translate3d(${-travel*45}px,${-travel*5}px,0)`:`translate3d(${(1-nextAlpha)*25}px,0,0)`;
      bay.style.transform=isBase?`translate3d(${-travel*innerWidth*.1}px,${-fraction*9}px,0) scale(${1+travel*.6}) rotate(${travel*-4}deg)`:`translate3d(${(1-nextAlpha)*50}px,${(1-nextAlpha)*8}px,0) scale(${.80+.2*nextAlpha})`;
    });
    const oldRoom=data.chapters[base].room;
    const newRoom=data.chapters[Math.min(base+1,chapters.length-1)].room;
    const roomBlend=smooth(.73,.96,fraction);
    rooms.forEach(el=>{
      const isOld=el.classList.contains(`room-${oldRoom}`),isNew=el.classList.contains(`room-${newRoom}`);
      const opacity=isOld?(isNew?1:1-roomBlend):(isNew?roomBlend:0);
      el.style.opacity=String(opacity);
      if(opacity>0) {
        const scale=reducedQuery.matches?1:(isOld&&isNew?1+.055*Math.sin(fraction*Math.PI):isOld?1+fraction*.025+travel*.27:1.055-.055*roomBlend);
        const shift=reducedQuery.matches?0:isOld&&isNew?Math.sin(fraction*Math.PI)*.5:isOld?travel*1.1:(1-roomBlend)*.35;
        const lift=reducedQuery.matches?0:isOld&&isNew?Math.sin(fraction*Math.PI)*.15:isOld?fraction*.15:(1-roomBlend)*.15;
        el.style.transform=`scale(${scale}) translate3d(${-shift}%,${-lift}%,0)`;
      }
    });
    const aperture=$('.transit-aperture');
    const visibleTravel=reducedQuery.matches?0:Math.sin(travel*Math.PI)*.7;
    aperture.style.opacity=String(visibleTravel);
    aperture.style.transform=`translateX(20%) scale(${.7+travel*3.8}) rotate(${travel*9}deg)`;
    root.style.setProperty('--progress',String(position/(chapters.length-1)));
    root.style.setProperty('--travel',String(travel));
    if(state.webgl) state.webgl.setState({enabled:!reducedQuery.matches,visual:data.chapters[active].visual,travel,paused:state.paused,anatomy:state.selected.harness==='harness',skillCount:0,pointer:state.pointer});
  }
  function scheduleRender(){if(!renderQueued){renderQueued=true;requestAnimationFrame(render);}}

  function destination(index) {return reading()?chapters[index].offsetTop-86:index*step;}
  function stopTravel(finish=false) {
    if(!state.nav) return false;
    const current=state.nav;
    state.nav=null;
    if(current.tween) current.tween.kill();
    if(finish) window.scrollTo(0,destination(current.target));
    text('#travel-cue','SCROLL TO TRAVEL');
    render();
    syncHash();
    return true;
  }
  function go(index,{animate=true,historyEntry=true}={}) {
    index=clamp(index,0,chapters.length-1);
    stopTravel(false);
    clearTimeout(hashTimer);
    const target=destination(index);
    const targetHash=`#${data.chapters[index].id}`;
    if(historyEntry && location.hash!==targetHash) history.pushState(null,'',targetHash);
    if(index===state.active && Math.abs(scrollY-target)<1) {render();syncHash();return;}
    if(!animate||reducedQuery.matches||reading()||!window.gsap) {
      scrollTo(0,target);render();syncHash();return;
    }
    const proxy={y:scrollY};
    const duration=Math.abs(index-state.active)>1?1.75:1.5;
    const nav={target:index,origin:state.active,tween:null};
    state.nav=nav;
    text('#travel-cue','PRESS AGAIN TO ARRIVE');
    nav.tween=gsap.to(proxy,{y:target,duration,ease:'power2.inOut',onUpdate:()=>{scrollTo(0,proxy.y);render();},onComplete:()=>{if(state.nav===nav){state.nav=null;text('#travel-cue','SCROLL TO TRAVEL');scrollTo(0,target);render();syncHash();}}});
  }
  function advance(direction) {
    if(state.nav) {
      const nav=state.nav;
      if(direction===Math.sign(nav.target-nav.origin)) {stopTravel(true);return;}
      go(nav.origin);return;
    }
    const target=state.active+direction;
    if(target<0||target>=chapters.length) return;
    go(target);
  }
  function setReading(value) {
    const index=Math.max(state.active,0);
    stopTravel(false);state.read=value;
    document.body.classList.toggle('reading',reading());
    $('#read-button').setAttribute('aria-pressed',String(state.read));
    text('#read-button',state.read?'Spatial':'Read');
    chapters.forEach(el=>{el.inert=false;el.removeAttribute('aria-hidden');});
    requestAnimationFrame(()=>{scrollTo(0,destination(index));render();});
  }
  function resize() {
    const index=Math.max(state.active,0);
    const position=state.position;
    stopTravel(false);
    step=innerHeight*1.35;
    root.style.setProperty('--step',`${step}px`);
    document.body.classList.toggle('reading',reading());
    if(state.webgl) state.webgl.resize();
    requestAnimationFrame(()=>{
      let target=destination(index);
      if(position?.reading && reading()) target=chapters[position.index].offsetTop+position.ratio*chapters[position.index].offsetHeight;
      else if(position && !position.reading && !reading()) target=position.value*step;
      if(document.querySelector('dialog[open]')&&state.restoreAfterDialog)state.restoreScroll=target;
      scrollTo(0,target);render();
    });
  }

  function showDialog(dialog) {
    state.restoreFocus=document.activeElement;
    state.restoreScroll=scrollY;
    state.restoreAfterDialog=true;
    stopTravel(false);
    document.body.style.overflow='hidden';
    dialog.showModal();
    dialog.querySelector('[data-close-dialog]').focus({preventScroll:true});
  }
  function fillInspector(detail) {
    text('#inspector-title',detail.title);text('#inspector-label',detail.label);
    const content=$('#inspector-content');content.replaceChildren();
    for(const s of detail.paragraphs||[]){const p=document.createElement('p');p.textContent=s;content.append(p);}
    if(detail.gallery){const gallery=document.createElement('div');gallery.className='artifact-gallery';for(const item of detail.gallery){const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=item.src;img.alt=item.alt;img.loading='lazy';caption.textContent=item.caption;figure.append(img,caption);gallery.append(figure);}content.append(gallery);}
    if(detail.items){const dl=document.createElement('dl');for(const [label,value] of detail.items){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);dl.append(row);}content.append(dl);}
  }
  function inspect(index) {fillInspector(data.chapters[index].detail);showDialog($('#inspector'));}
  function element(tag,className,content) {
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(content!==undefined)node.textContent=content;
    return node;
  }
  function flowArrow(){return element('span','explainer-arrow','→');}
  function renderDiagram(diagram) {
    if(!diagram)return null;
    if(diagram.type==='memory'){
      const figure=$('#diagram-template-'+diagram.type).content.firstElementChild.cloneNode(true);
      const zoom=figure.querySelector('.diagram-zoom'),viewport=figure.querySelector('.diagram-viewport');
      zoom.disabled=false;
      zoom.addEventListener('click',()=>{
        const enlarged=figure.classList.toggle('is-enlarged');
        zoom.setAttribute('aria-pressed',String(enlarged));
        zoom.textContent=enlarged?'Show overview':'Enlarge diagram';
        viewport.scrollTo(0,0);
      });
      return figure;
    }
    const frame=element('div','explainer-diagram diagram-'+diagram.type);
    if(diagram.type==='loop'){
      const flow=element('div','explainer-flow');
      for(const [index,label] of diagram.steps.entries()){
        if(index)flow.append(flowArrow());
        flow.append(element('div','flow-node',label));
      }
      if(diagram.outcome)flow.append(flowArrow(),element('div','flow-node flow-outcome',diagram.outcome));
      frame.append(flow);
    }
    if(diagram.type==='decision'){
      const entries=element('div','trigger-row');
      for(const entry of diagram.entries){
        const node=element('div','flow-node trigger-node');
        node.append(element('b','',entry.title),element('span','',entry.text));
        entries.append(node);
      }
      const outcomes=element('div','branch-row');
      outcomes.append(element('div','flow-node flow-outcome',diagram.act),element('div','flow-node flow-wait',diagram.wait));
      frame.append(entries,flowArrow(),element('div','flow-node decision-gate',diagram.gate),flowArrow(),outcomes);
    }
    return frame;
  }
  function renderExplainer(card) {
    state.explainerId=card.id;
    text('#explainer-label',card.eyebrow);
    const content=$('#explainer-content');content.replaceChildren();content.dataset.card=card.id;
    const heading=element('h2','',card.title);heading.id='explainer-title';content.append(heading);
    if(card.lead)content.append(element('p','explainer-lead',card.lead));
    if(card.body)content.append(element('p','explainer-body',card.body));
    if(card.image){
      const figure=element('figure','explainer-figure'),link=element('a','explainer-image-link'),img=document.createElement('img');
      link.href=card.image.src;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label','Open the original figure at full size');
      img.src=card.image.src;img.alt=card.image.alt;img.loading='lazy';
      link.append(img);figure.append(link,element('figcaption','',card.image.caption));content.append(figure);
    }
    const diagram=renderDiagram(card.diagram);if(diagram)content.append(diagram);
    if(card.tiles){
      const tiles=element('div','explainer-tiles');
      for(const tile of card.tiles){const item=element('article','');item.append(element('h3','',tile.title),element('p','',tile.text));tiles.append(item);}
      content.append(tiles);
    }
    if(card.strip){
      const strip=element('div','explainer-strip');
      for(const item of card.strip){const row=element('p','');row.append(element('strong','',item.title+': '),document.createTextNode(item.text));strip.append(row);}
      content.append(strip);
    }
    if(card.caption)content.append(element('p','explainer-caption',card.caption));
    if(card.note)content.append(element('p','explainer-note',card.note));
    content.append(element('p','explainer-footer',card.footer));
    if(card.sources?.length){
      const sources=element('div','explainer-sources');sources.append(element('strong','','Sources'));
      for(const source of card.sources){
        if(source.url){const link=element('a','',source.label);link.href=source.url;link.target='_blank';link.rel='noopener';sources.append(link);}
        else sources.append(element('span','',source.label));
      }
      content.append(sources);
    }
    const group=explainerData.cards.filter(item=>item.group===card.group),index=group.findIndex(item=>item.id===card.id);
    $('#explainer-previous').hidden=group.length<2;$('#explainer-next').hidden=group.length<2;
    $('#explainer-previous').disabled=index===0;$('#explainer-next').disabled=index===group.length-1;
    text('#explainer-position',group.length>1?(index+1)+' / '+group.length:'');
  }
  function openExplainer(id){
    const card=explainerData.cards.find(item=>item.id===id);if(!card)return;
    renderExplainer(card);showDialog($('#explainer-dialog'));
    $('#explainer-dialog').scrollTop=0;
  }
  function moveExplainer(direction){
    const card=explainerData.cards.find(item=>item.id===state.explainerId);if(!card)return;
    const group=explainerData.cards.filter(item=>item.group===card.group),index=group.findIndex(item=>item.id===card.id);
    const next=group[index+direction];if(next){renderExplainer(next);$('#explainer-dialog').scrollTop=0;}
  }
  const toolkit={
    instructions:['PURPOSE & BOUNDARIES','Instructions','Define the task, priorities, permissions and conditions that remain true.','What should exist?\nWhat may the system do?\nWhat must stay true?','Purpose · scope · expected outcome'],
    skills:['REUSABLE METHODS','Skills','Package a proven procedure so recurring work starts from a strong method.','Recognise the task.\nFollow the method.\nReturn useful evidence.','Repeatable method · clear handoff'],
    tools:['PERMITTED ACTIONS','Tools','Connect the harness to files, software, data and communication within scope.','Read and create.\nCalculate and browse.\nAct within permission.','Capability · permission · result'],
    review:['CHECKED OUTCOMES','Review','Open the result where it will be used and compare it with the promised outcome.','Name the claim.\nExercise the result.\nRecord the useful scope.','Outcome · evidence · scope']
  };
  const memory=[['A durable record','The fact exists outside the current conversation.'],['A relevant passage','The search selects the source that belongs to this task.'],['Context received','The selected passage actually reaches the next session.'],['Correctly used','The final answer preserves meaning, relevance and uncertainty.']];
  const receipts={file:['FILE SAVED','A recoverable checkpoint exists.','The artifact is available for review at the next stage.','Checkpoint: saved and inspectable'],receiver:['OUTCOME CHECKED','The intended use was exercised.','Open the result where it will be used and check the behaviour the task depends on.','Scope: the named outcome and scenario']};
  function select(group,value,{manual=true}={}) {
    if(manual) state.manualSelections.add(group);
    state.selected[group]=String(value);
    document.querySelectorAll(`[data-select="${group}"]`).forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.value===String(value))));
    if(group==='harness'){
      state.selected.harness=value;$('.harness-machine').dataset.harness=value;
      document.querySelectorAll('[data-layer]').forEach(el=>el.inert=value==='model');
    }
    if(group==='toolkit'){const row=toolkit[value];['category','name','copy','excerpt'].forEach((key,i)=>text(`[data-toolkit-${key}]`,row[i]));text('[data-toolkit-footer]',row[4]);}
    if(group==='memory'){const index=Number(value),row=memory[index];state.selected.memory=index;text('[data-memory-title]',row[0]);text('[data-memory-copy]',row[1]);text('.vault-readout>span',`OBSERVATION 0${index+1}`);$('.active-path').style.strokeDashoffset=String(1400*(1-(index+1)/4));}
    if(group==='verification'){const row=receipts[value];['status','title','copy','limit'].forEach((key,i)=>text(`[data-receipt-${key}]`,row[i]));$('.acceptance-receipt').dataset.received=String(value==='receiver');}
    scheduleRender();
  }

  document.addEventListener('click',event=>{
    const close=event.target.closest('[data-close-dialog]');if(close){close.closest('dialog').close();return;}
    const explainer=event.target.closest('[data-explainer]');if(explainer){openExplainer(explainer.dataset.explainer);return;}
    const layer=event.target.closest('[data-layer]');if(layer){const item=data.chapters[1].detail.items.find(([label])=>label.toLowerCase()===layer.dataset.layer);fillInspector({title:item[0],label:'HARNESS LAYER / TEACHING MODEL',paragraphs:[item[1],data.chapters[1].detail.paragraphs[1]]});showDialog($('#inspector'));return;}
    const choice=event.target.closest('[data-select]');if(choice){select(choice.dataset.select,choice.dataset.value);return;}
    const evidence=event.target.closest('[data-inspect]');if(evidence){inspect(Number(evidence.closest('.chapter').dataset.index));return;}
    const anchor=event.target.closest('a[href^="#"]');
    if(anchor && !anchor.classList.contains('skip-link')){const index=data.chapters.findIndex(c=>`#${c.id}`===anchor.getAttribute('href'));if(index>=0){event.preventDefault();const dialog=anchor.closest('dialog');if(dialog){state.restoreAfterDialog=false;dialog.close();$('#route-button').focus({preventScroll:true});}go(index);}}
  });
  document.querySelectorAll('[data-select]').forEach(button=>button.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
    const group=button.parentElement;
    const buttons=[...group.querySelectorAll(`:scope>[data-select="${button.dataset.select}"]`)];
    if(buttons.length<2)return;
    event.preventDefault();event.stopPropagation();
    const i=buttons.indexOf(button),next=buttons[(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];next.focus();next.click();
  }));
  $('#next').addEventListener('click',()=>advance(1));
  $('#previous').addEventListener('click',()=>advance(-1));
  $('#route-button').addEventListener('click',()=>showDialog($('#route-dialog')));
  $('#explainer-previous').addEventListener('click',()=>moveExplainer(-1));
  $('#explainer-next').addEventListener('click',()=>moveExplainer(1));
  $('#read-button').addEventListener('click',()=>setReading(!state.read));
  $('#pause').addEventListener('click',()=>{
    state.paused=!state.paused;$('#pause').setAttribute('aria-pressed',String(state.paused));$('#pause').setAttribute('aria-label',state.paused?'Resume ambient motion':'Pause ambient motion');text('#pause',state.paused?'▶':'Ⅱ');scheduleRender();
  });
  document.querySelectorAll('dialog').forEach(dialog=>{
    dialog.addEventListener('close',()=>{document.body.style.overflow='';if(state.restoreAfterDialog){scrollTo(0,state.restoreScroll);if(state.restoreFocus?.isConnected)state.restoreFocus.focus({preventScroll:true});}scheduleRender();syncHash();});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
  });
  document.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]'))return;
    if(event.key==='Escape') {if(stopTravel(true))return;}
    if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable],.segmented,.file-tabs,.artifact-bay'))return;
    if(event.key==='ArrowRight'||event.key==='PageDown'){event.preventDefault();advance(1);}
    else if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();advance(-1);}
    else if(event.code==='Space'&&event.target===document.body){event.preventDefault();advance(1);}
    else if(event.key==='Home'){event.preventDefault();go(0,{animate:false});}
    else if(event.key==='End'){event.preventDefault();go(chapters.length-1,{animate:false});}
    else if(event.key.toLowerCase()==='m')$('#route-button').click();
    else if(event.key.toLowerCase()==='r'&&!compactQuery.matches)setReading(!state.read);
    else if(event.key.toLowerCase()==='p')$('#pause').click();
  });
  addEventListener('scroll',scheduleRender,{passive:true});
  addEventListener('wheel',()=>stopTravel(false),{passive:true});
  addEventListener('touchstart',()=>stopTravel(false),{passive:true});
  addEventListener('resize',resize,{passive:true});
  addEventListener('pointermove',event=>{state.pointer={x:clamp(event.clientX/innerWidth)*2-1,y:clamp(event.clientY/innerHeight)*2-1};if(!state.paused&&!reading())scheduleRender();},{passive:true});
  const fromHash=()=>{const index=data.chapters.findIndex(c=>c.id===location.hash.slice(1));if(index>=0)go(index,{animate:false,historyEntry:false});};
  addEventListener('hashchange',fromHash);addEventListener('popstate',fromHash);
  reducedQuery.addEventListener('change',()=>{stopTravel(true);render();});
  compactQuery.addEventListener('change',resize);
  document.addEventListener('visibilitychange',()=>{if(state.webgl)state.webgl.setState({hidden:document.hidden});});

  document.body.classList.add('enhanced');
  document.querySelectorAll('button').forEach(el=>el.disabled=false);
  document.body.classList.toggle('reading',reading());
  root.style.setProperty('--step',`${step}px`);
  document.querySelectorAll('[data-layer]').forEach(el=>el.inert=true);
  document.querySelectorAll('.vault-readout,.acceptance-receipt').forEach(el=>el.setAttribute('aria-live','polite'));
  const initial=data.chapters.findIndex(c=>c.id===location.hash.slice(1));
  if(initial>=0)requestAnimationFrame(()=>go(initial,{animate:false,historyEntry:false}));
  render();
  if(location.protocol!=='file:'&&!reducedQuery.matches&&!compactQuery.matches) {
    import('./spatial.js').then(module=>{if(reducedQuery.matches||compactQuery.matches){document.body.dataset.spatial='fallback';return;}state.webgl=module.createSpatial($('#spatial-renderer'));state.webgl?.setState({hidden:document.hidden});document.body.dataset.spatial=state.webgl?'ready':'fallback';render();}).catch(()=>{document.body.dataset.spatial='fallback';});
  } else document.body.dataset.spatial='fallback';
})();
