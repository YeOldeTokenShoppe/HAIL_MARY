// Tests the exported node hierarchy and animation tracks with mesh bounds as
// stand-in geometry; browser preview verifies Draco decoding and rendering.
import fs from 'node:fs';
import draco from 'draco3d';
const decoderModule = await draco.createDecoderModule({});
import assert from 'node:assert/strict';
import * as T from 'three';
import {createLowRider, LOW_RIDER_MODEL_URL} from '../src/lib/palmTreeDriveCar.mjs';
const b=fs.readFileSync(new URL(`../public${LOW_RIDER_MODEL_URL}`, import.meta.url));const len=b.readUInt32LE(12);const j=JSON.parse(b.subarray(20,20+len));const bin=b.subarray(28+len);
function wheelGeometry(n, fallback) {
 if(!n.name?.startsWith('Wheel')) return fallback;
 const primitive=j.meshes[n.mesh].primitives[0], ext=primitive.extensions.KHR_draco_mesh_compression;
 const v=j.bufferViews[ext.bufferView];
 const bytes=new Int8Array(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));
 const decoder=new decoderModule.Decoder(), buffer=new decoderModule.DecoderBuffer(), mesh=new decoderModule.Mesh();
 buffer.Init(bytes,bytes.length);
 const status=decoder.DecodeBufferToMesh(buffer,mesh); assert(status.ok());
 const attribute=decoder.GetAttributeByUniqueId(mesh,ext.attributes.POSITION), values=new decoderModule.DracoFloat32Array();
 decoder.GetAttributeFloatForAllPoints(mesh,attribute,values);
 const positions=new Float32Array(values.size());for(let i=0;i<positions.length;i++) positions[i]=values.GetValue(i);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));
 for(const object of [values,mesh,buffer,decoder,status]) decoderModule.destroy(object);
 return geometry;
}
const nodes=j.nodes.map(n=>{let o=new T.Object3D();if(n.mesh!==undefined){const box=new T.Box3();for(const p of j.meshes[n.mesh].primitives){const a=j.accessors[p.attributes.POSITION];box.union(new T.Box3(new T.Vector3().fromArray(a.min),new T.Vector3().fromArray(a.max)));}const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());o=new T.Mesh(wheelGeometry(n,new T.BoxGeometry(size.x,size.y,size.z).translate(...center.toArray())),new T.MeshBasicMaterial());}o.name=n.name||'';if(n.matrix)new T.Matrix4().fromArray(n.matrix).decompose(o.position,o.quaternion,o.scale);else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
j.nodes.forEach((n,i)=>(n.children||[]).forEach(k=>nodes[i].add(nodes[k])));const scene=new T.Group();j.scenes[j.scene||0].nodes.forEach(i=>scene.add(nodes[i]));
function values(i){const a=j.accessors[i],v=j.bufferViews[a.bufferView];const count=a.count*({SCALAR:1,VEC3:3,VEC4:4}[a.type]);assert.equal(a.componentType,5126);const offset=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:count},(_,k)=>bin.readFloatLE(offset+k*4));}
const animations=j.animations.map(a=>new T.AnimationClip(a.name,-1,a.channels.map(c=>{const s=a.samplers[c.sampler],property={translation:'position',rotation:'quaternion',scale:'scale'}[c.target.path];const Track=c.target.path==='rotation'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack;return new Track(`${nodes[c.target.node].uuid}.${property}`,values(s.input),values(s.output));})));
const rig=createLowRider({scene,animations});assert.equal(rig.wheels.length,4);rig.car.updateMatrixWorld(true);
const chassisPosition=rig.car.position.clone();
let maxGap=0;
for(let frame=0;frame<360;frame++) {
 rig.update(1/60);rig.car.updateMatrixWorld(true);
 for(const wheel of rig.wheels) {
  const bounds=new T.Box3().setFromObject(wheel.mesh,true);
  maxGap=Math.max(maxGap,Math.abs(bounds.min.y));
 }
}
assert(maxGap<0.015, `Tire gap during rotation: ${maxGap}`);
assert(rig.car.position.equals(chassisPosition));
console.log('PASS: actual Draco-decoded tire geometry remains within',maxGap.toFixed(6),'world units of road across 360 frames.');
rig.dispose();
