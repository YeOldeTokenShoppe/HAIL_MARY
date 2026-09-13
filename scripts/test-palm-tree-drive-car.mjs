// Tests the exported node hierarchy and animation tracks with mesh bounds as
// stand-in geometry; browser preview verifies Draco decoding and rendering.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createLowRider, LOW_RIDER_MODEL_URL} from '../src/lib/palmTreeDriveCar.mjs';
const b=fs.readFileSync(new URL(`../public${LOW_RIDER_MODEL_URL}`, import.meta.url));const len=b.readUInt32LE(12);const j=JSON.parse(b.subarray(20,20+len));const bin=b.subarray(28+len);
const nodes=j.nodes.map(n=>{let o=new T.Object3D();if(n.mesh!==undefined){const box=new T.Box3();for(const p of j.meshes[n.mesh].primitives){const a=j.accessors[p.attributes.POSITION];box.union(new T.Box3(new T.Vector3().fromArray(a.min),new T.Vector3().fromArray(a.max)));}const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());o=new T.Mesh(new T.BoxGeometry(size.x,size.y,size.z).translate(...center.toArray()),new T.MeshBasicMaterial());}o.name=n.name||'';if(n.matrix)new T.Matrix4().fromArray(n.matrix).decompose(o.position,o.quaternion,o.scale);else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
j.nodes.forEach((n,i)=>(n.children||[]).forEach(k=>nodes[i].add(nodes[k])));const scene=new T.Group();j.scenes[j.scene||0].nodes.forEach(i=>scene.add(nodes[i]));
function values(i){const a=j.accessors[i],v=j.bufferViews[a.bufferView];const count=a.count*({SCALAR:1,VEC3:3,VEC4:4}[a.type]);assert.equal(a.componentType,5126);const offset=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:count},(_,k)=>bin.readFloatLE(offset+k*4));}
const animations=j.animations.map(a=>new T.AnimationClip(a.name,-1,a.channels.map(c=>{const s=a.samplers[c.sampler],property={translation:'position',rotation:'quaternion',scale:'scale'}[c.target.path];const Track=c.target.path==='rotation'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack;return new Track(`${nodes[c.target.node].uuid}.${property}`,values(s.input),values(s.output));})));
const rig=createLowRider({scene,animations});assert.equal(rig.wheels.length,4);rig.car.updateMatrixWorld(true);
const before=rig.wheels.map(w=>w.pivot.getWorldPosition(new T.Vector3()));
const axle=rig.wheels.map(w=>new T.Vector3(1,0,0).transformDirection(w.pivot.matrixWorld));assert(axle.every(v=>Math.abs(v.dot(new T.Vector3(-1,0,0)))>0.9999));
const take=animations.find(a=>a.name==='Take 01');assert(rig.mixer.existingAction(take).paused);
for(let k=0;k<60;k++)rig.update(1/60);rig.car.updateMatrixWorld(true);
rig.wheels.forEach((w,i)=>{assert(w.angle>0);assert(w.pivot.getWorldPosition(new T.Vector3()).distanceTo(before[i])<1e-5);});
assert.equal(rig.mixer.existingAction(take).time,0);assert(rig.mixer.existingAction(animations.find(a=>a.name==='mixamo.com')).time>0);
const skinTransforms=nodes.filter(o=>o.name.includes('mixamorig')).map(o=>o.quaternion.toArray());assert(skinTransforms.length>0);
rig.dispose();assert.equal(rig.mixer.stats.actions.inUse,0);
console.log('PASS: four real GLB wheels spin on the car X axle without orbiting; vehicle clip held; character clips advance; mixer cleanup succeeds.');
