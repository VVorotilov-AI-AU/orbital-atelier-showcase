/* One lightweight 3D signature. Generated artwork and the full semantic story remain independent. */
import * as THREE from './vendor/three.module.min.js';

export function createSpatial(host) {
  let renderer;
  try {renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});} catch {return null;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(36,1,.1,60);
  camera.position.set(0,0,8.8);
  scene.add(new THREE.HemisphereLight(0xfff5df,0x3f4b4b,2.3));
  const sun=new THREE.DirectionalLight(0xffe3b5,4.2);sun.position.set(-4,7,5);scene.add(sun);
  const cool=new THREE.DirectionalLight(0xe5eef5,2);cool.position.set(5,-2,-2);scene.add(cool);
  const group=new THREE.Group();scene.add(group);
  const metal=new THREE.MeshStandardMaterial({color:0xa68b61,metalness:.74,roughness:.34,transparent:true,opacity:.7});
  const amber=new THREE.MeshBasicMaterial({color:0xb87830,transparent:true,opacity:.75});
  const wire=new THREE.MeshBasicMaterial({color:0xa88043,wireframe:true,transparent:true,opacity:.18});
  const frames=[];
  for(let i=0;i<3;i++){
    const frame=new THREE.Group();
    const radius=1.95+i*.17;
    for(let j=0;j<6;j++){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.012+(i===0?.011:0),5,50,Math.PI*.26),i===1?amber:metal);
      ring.rotation.z=j*Math.PI/3;frame.add(ring);
    }
    frame.rotation.set(.35+i*.36,i===1?-.3:.35,i*.72);
    group.add(frame);frames.push(frame);
  }
  const shell=new THREE.Mesh(new THREE.IcosahedronGeometry(1.15,2),wire);group.add(shell);
  const points=[];
  const pointGeometry=new THREE.SphereGeometry(.033,6,5);
  for(let i=0;i<55;i++){
    const mesh=new THREE.Mesh(pointGeometry,amber);
    const a=i/55*Math.PI*2;mesh.position.set(Math.cos(a)*2.35,Math.sin(a)*2.35,Math.sin(a*3)*.35);
    group.add(mesh);points.push(mesh);
  }
  const arcs=[];
  for(let i=0;i<4;i++){
    const arc=new THREE.Mesh(new THREE.TorusGeometry(2.9,.012,4,84),metal);
    arc.position.z=-i*2.4;scene.add(arc);arcs.push(arc);
  }
  let current={enabled:true,visual:'core',travel:0,paused:false,hidden:document.hidden,anatomy:false,skillCount:9,pointer:{x:0,y:0}};
  let time=0,last=0,frameId=0,disposed=false;
  const resize=()=>{const w=host.clientWidth||1,h=host.clientHeight||1;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
  function draw(timestamp) {
    frameId=0;
    if(disposed||!current.enabled||current.hidden){host.style.opacity='0';return;}
    if(last&&timestamp-last<30){frameId=requestAnimationFrame(draw);return;}
    const dt=last?Math.min((timestamp-last)/1000,.05):0;last=timestamp;
    if(!current.paused)time+=dt;
    const modes={core:.23,anatomy:current.anatomy?.8:.14,skills:.45,return:.5};
    const opacity=modes[current.visual]??0;
    host.style.opacity=String(opacity*(1-current.travel*.7));
    group.visible=opacity>0;
    const tilt=current.paused?{x:0,y:0}:current.pointer;
    group.rotation.set(tilt.y*.05,tilt.x*.09,-.18);
    group.position.y=.12;
    frames.forEach((el,i)=>{el.rotation.z=i*.72+time*(i===1?-.035:.022);});
    shell.visible=current.visual==='anatomy'&&current.anatomy;
    points.forEach((el,i)=>{el.visible=current.visual==='skills'&&i<current.skillCount;});
    arcs.forEach((el,i)=>{el.visible=current.travel>.02&&current.travel<.99;el.position.z=-i*2.4+current.travel*11;el.rotation.z=time*.013;});
    renderer.render(scene,camera);
    if(!current.paused&&(opacity>0||current.travel>0))frameId=requestAnimationFrame(draw);
  }
  resize();
  const wake=()=>{if(!disposed&&!frameId)frameId=requestAnimationFrame(draw);};
  wake();
  const onContextLost=event=>{event.preventDefault();current.enabled=false;host.style.display='none';};
  renderer.domElement.addEventListener('webglcontextlost',onContextLost);
  return {resize(){if(!disposed){resize();wake();}},setState(next){if(!disposed){current={...current,...next};wake();}},dispose(){
    if(disposed)return;disposed=true;
    if(frameId)cancelAnimationFrame(frameId);
    renderer.domElement.removeEventListener('webglcontextlost',onContextLost);
    const geometries=new Set(),materials=new Set();
    scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>materials.add(material));});
    geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
    renderer.dispose();renderer.domElement.remove();
  }};
}
