// Run: node scripts/test-claw-machine.mjs
// Decode the actual runtime GLBs without textures for deterministic gameplay checks.
import draco3d from 'draco3d';
import { BufferGeometry, BufferAttribute } from 'three';
const module = await draco3d.createDecoderModule({});
const dracoLoader = {
 preload() {},
 decodeDracoFile(bytes, success, ids, types, colorSpace, failure) {
  const d=new module.Decoder(), b=new module.DecoderBuffer(), mesh=new module.Mesh();
  try {
   b.Init(new Int8Array(bytes),bytes.byteLength);
   const status=d.DecodeBufferToMesh(b,mesh);
   if(!status.ok()) throw new Error(status.error_msg());
   const geometry=new BufferGeometry(), face=new module.DracoInt32Array();
   try {
    const indices=new Uint32Array(mesh.num_faces()*3);
    for(let i=0;i<mesh.num_faces();i++){d.GetFaceFromMesh(mesh,i,face);for(let j=0;j<3;j++)indices[i*3+j]=face.GetValue(j);}
    geometry.setIndex(new BufferAttribute(indices,1));
   } finally {module.destroy(face);}
   for(const [name,id] of Object.entries(ids)){
    const attr=d.GetAttributeByUniqueId(mesh,id), data=new module.DracoFloat32Array();
    try{
     d.GetAttributeFloatForAllPoints(mesh,attr,data);
     const Type=globalThis[types[name]||'Float32Array'], values=new Type(data.size());
     for(let i=0;i<data.size();i++)values[i]=data.GetValue(i);
     geometry.setAttribute(name,new BufferAttribute(values,attr.num_components()));
    }finally{module.destroy(data);}
   }
   success(geometry);
  }catch(e){failure(e);}finally{module.destroy(mesh);module.destroy(b);module.destroy(d);}
 }
};

import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
async function loadGLB(path) {
 const b=fs.readFileSync(path), len=b.readUInt32LE(12), g=JSON.parse(b.subarray(20,20+len));
 // Headless geometry/animation validation: keep every node, accessor and mesh; omit textures.
 g.materials=[{pbrMetallicRoughness:{baseColorFactor:[.7,.5,.25,1]}}];
 for(const m of g.meshes||[]) for(const p of m.primitives) p.material=0;
 delete g.textures; delete g.images; delete g.samplers;
 g.extensionsRequired=(g.extensionsRequired||[]).filter(x=>!['KHR_texture_basisu','EXT_texture_webp'].includes(x));
 const j=Buffer.from(JSON.stringify(g)), pad=(4-j.length%4)%4, jb=Buffer.concat([j,Buffer.alloc(pad,32)]);
 const bin=b.subarray(20+len); const header=Buffer.alloc(20);
 header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+jb.length+bin.length,8);header.writeUInt32LE(jb.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const out=Buffer.concat([header,jb,bin]);
 return new GLTFLoader().setDRACOLoader(dracoLoader).setMeshoptDecoder(MeshoptDecoder).parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}

import assert from 'node:assert/strict';
import { createClawMachine, boundsInMachine } from '../src/lib/clawMachine.mjs';
import * as T from 'three';
const near=(a,b,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
function run(c, seconds=6) { for(let i=0;i<seconds*60;i++) c.update(1/60); }
for(const filename of ['Commercial_Strip7_opt_ktx2.glb','Commercial_Strip7_opt.glb']) {
 const {scene,animations}=await loadGLB(new URL(`../public/models/${filename}`, import.meta.url));
 const placement=new T.Group(); placement.position.set(8,3,-4); placement.rotation.y=.73; placement.scale.setScalar(.137); placement.add(scene); placement.updateMatrixWorld(true);
 const outside=[];scene.traverse(o=>{if(!o.name.startsWith('Claw'))outside.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);});
 const c=createClawMachine(scene,animations.find(a=>a.name==='Claw_Demo'));
 const rootPose=c.root.matrix.clone(), initial=new Map(c.toys.map(t=>[t,t.position.clone()]));
 const door=c.root.getObjectByName('Cap_01'), doorStart=door.position.clone(), doorQ=door.quaternion.clone();
 const worldDoor=()=>c.root.worldToLocal(door.getWorldPosition(new T.Vector3()));
 c.manual();const d0=worldDoor();
 c.moveTo(.31,-.25);c.press();run(c);assert.equal(c.state.held,null);assert.equal(c.state.phase,'ready');
 for(const toy of c.toys){
   c.aim(toy.name);run(c,1);assert.equal(c.getStatus().target,toy.name);
   c.press();run(c,1.2);assert.equal(c.state.held,toy);
   const shaft=c.root.getObjectByName('Claw_Piston_02'); c.root.updateWorldMatrix(true,true);
   const rel=shaft.matrixWorld.clone().invert().multiply(toy.matrixWorld);
   run(c,2);assert.equal(c.state.phase,'holding');
   c.moveTo(.1,-.18);c.root.updateWorldMatrix(true,true);
   const rel2=shaft.matrixWorld.clone().invert().multiply(toy.matrixWorld);
   rel.elements.forEach((v,i)=>near(v,rel2.elements[i],1e-4));
   if(toy.name==='Unicorn_01'){
     c.press();run(c);assert.equal(c.state.phase,'ready');assert.equal(c.state.pending,null);
     near(boundsInMachine(toy,c.root).min.y,1.16277,.003);
     c.aim(toy.name);run(c,1);c.press();run(c);assert.equal(c.state.held,toy);
   }
   c.deliver();run(c,8);assert.equal(c.state.phase,'prize');assert.equal(c.state.pending,toy);
   const b=boundsInMachine(toy,c.root), receptacle=boundsInMachine(c.box,c.root);
   assert.ok(b.min.x>=receptacle.min.x && b.max.x<=receptacle.max.x);
   assert.ok(b.min.z>=receptacle.min.z && b.max.z<=receptacle.max.z);
   assert.ok(b.min.y>receptacle.min.y && b.max.y<receptacle.max.y);
   const d1=worldDoor();near(d0.x,d1.x);near(d0.z,d1.z,1e-5);assert.ok(d1.y>d0.y+.3);near(doorQ.angleTo(door.quaternion),0);
   c.collect();run(c,1);assert.equal(toy.visible,false);near(door.position.distanceTo(doorStart),0,.001);
 }
 assert.equal(c.state.collected.size,2);
 c.reset();for(const toy of c.toys){assert.equal(toy.visible,true);near(toy.position.distanceTo(initial.get(toy)),0,.002);}
 c.aim('Unicorn_01');run(c,1);c.press();run(c,1.2);c.demo();run(c,14);assert.equal(c.state.mode,'demo');
 assert.ok(boundsInMachine(c.toys[0],c.root).max.y<.7);c.manual();assert.equal(c.state.phase,'ready');assert.equal(c.state.held,null);
 const fixedBefore=c.root.position.clone();c.update(.1,{x:100,z:100});assert.ok(c.state.x<=.32&&c.state.z<=.30);near(c.root.position.distanceTo(fixedBefore),0);
 c.dispose();near(c.root.matrix.elements.reduce((s,v,i)=>s+Math.abs(v-rootPose.elements[i]),0),0,.002);
 for(const [o,p,q,s] of outside){if(o===c.root||c.root.getObjectById(o.id))continue;near(o.position.distanceTo(p),0);o.quaternion.toArray().forEach((value,i)=>near(value,q.toArray()[i]));near(o.scale.distanceTo(s),0);}
 console.log(`PASS ${filename}: both prizes, miss, tray release/regrab, carrying, box landing, vertical door, collect/reset, demo/manual switching, transformed parent, unrelated objects unchanged.`);
}

import { bindClawPointerControls } from '../src/lib/clawPointerControls.mjs';
const {scene,animations}=await loadGLB(new URL('../public/models/Commercial_Strip7_opt_ktx2.glb', import.meta.url));
const c=createClawMachine(scene,animations[0]);c.manual();
const camera=new T.PerspectiveCamera(45,1280/720,.01,100);camera.position.copy(c.root.localToWorld(new T.Vector3(.18,1.4,3.8)));camera.lookAt(c.root.localToWorld(new T.Vector3(0,1.15,0)));camera.updateMatrixWorld(true);
class Events{map=new Map();addEventListener(n,f){if(!this.map.has(n))this.map.set(n,new Set());this.map.get(n).add(f)} removeEventListener(n,f){this.map.get(n)?.delete(f)} send(n,e){for(const f of this.map.get(n)||[])f(e)}}
const hub=new Events(), canvas=new Events();canvas.style={};canvas.getBoundingClientRect=()=>({left:0,top:0,width:1280,height:720});let capture=null;canvas.setPointerCapture=id=>capture=id;canvas.hasPointerCapture=id=>id===capture;canvas.releasePointerCapture=()=>capture=null;
const controls={enabled:true};const binding=bindClawPointerControls({canvas,camera,getMachine:()=>c,isActive:()=>true,getControls:()=>controls,eventTarget:hub});
function eventAt(name){c.root.updateWorldMatrix(true,true);const point=new T.Box3().setFromObject(c.root.getObjectByName(name)).getCenter(new T.Vector3()).project(camera);return{target:canvas,pointerId:1,button:0,clientX:(point.x+1)*640,clientY:(1-point.y)*360,prevented:false,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}}}
let e=eventAt('Lever');hub.send('pointerdown',e);assert.equal(e.stopped,true,'joystick must capture before OrbitControls');assert.equal(controls.enabled,false);
const move={...e,clientX:e.clientX+60};hub.send('pointermove',move);const before=c.state.x;c.update(.5,binding.input());assert.ok(c.state.x>before+.1);hub.send('pointerup',move);assert.equal(controls.enabled,true);assert.deepEqual(binding.input(),{x:0,z:0});assert.equal(capture,null);
c.reset();e=eventAt('Button_01');hub.send('pointerdown',e);assert.equal(e.stopped,true,'button captures pointer');assert.equal(controls.enabled,false);assert.equal(c.state.phase,'lower');hub.send('pointerup',e);assert.equal(controls.enabled,true);const click={...e,stopped:false};hub.send('click',click);assert.equal(click.stopped,true,'no duplicate R3F press');
c.reset();e=eventAt('Lever');hub.send('pointerdown',e);hub.send('blur',{});assert.equal(controls.enabled,true);assert.deepEqual(binding.input(),{x:0,z:0});
e=eventAt('Lever');hub.send('pointerdown',e);hub.send('pointercancel',e);assert.equal(controls.enabled,true);assert.equal(capture,null);
e={...eventAt('Lever'),clientX:0,clientY:0,stopped:false};hub.send('pointerdown',e);assert.equal(e.stopped,false);assert.equal(controls.enabled,true);
binding.dispose();c.dispose();console.log('PASS physical joystick and button: real geometry raycasts, drag motion, OrbitControls lock/restore, release/blur cleanup, duplicate-click suppression, background camera gestures preserved.');
