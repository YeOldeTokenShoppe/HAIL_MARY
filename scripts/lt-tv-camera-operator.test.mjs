// Integration checks against the actual exported studio and cameraman skeletons.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readGlb } from './lt-tv-models.mjs';
import { cameraOperatorMount, createCameraOperator, CAMERA_OPERATOR_LIMITS } from '../src/lib/ltTv/cameraOperator.mjs';
import { CREW, SET_MODEL } from '../src/lib/ltTv/modelContract.mjs';
import { createCrewAnimation } from '../src/lib/ltTv/crewAnimation.mjs';
function loadRig(path) {
    const gltf = readGlb(path);
    const json = JSON.parse(JSON.stringify(gltf));
    for (const key of ["meshes", "materials", "textures", "images", "samplers", "extensionsUsed", "extensionsRequired"]) {
        delete json[key];
    }
    for (const node of json.nodes) {
        delete node.mesh;
        delete node.skin;
    }
    const pad = (buf, fill) => {
        const extra = (4 - (buf.length % 4)) % 4;
        return extra ? Buffer.concat([buf, Buffer.alloc(extra, fill)]) : buf;
    };
    const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
    const binChunk = pad(gltf.bin, 0);
    const out = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binChunk.length);
    out.writeUInt32LE(0x46546c67, 0);
    out.writeUInt32LE(2, 4);
    out.writeUInt32LE(out.length, 8);
    out.writeUInt32LE(jsonChunk.length, 12);
    out.writeUInt32LE(0x4e4f534a, 16);
    jsonChunk.copy(out, 20);
    const at = 20 + jsonChunk.length;
    out.writeUInt32LE(binChunk.length, at);
    out.writeUInt32LE(0x004e4942, at + 4);
    binChunk.copy(out, at + 8);
    const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
    return new Promise((res, rej) => new GLTFLoader().parse(ab, "", res, rej));
}
const studio = await loadRig(SET_MODEL.file);
const model = await loadRig(CREW.CameraMan.file);
const scene = new THREE.Group();
scene.add(studio.scene);
studio.scene.add(model.scene);
const rig = model.scene.getObjectByName(CREW.CameraMan.rig);
const mixer = new THREE.AnimationMixer(rig);
const clip = THREE.AnimationClip.findByName(model.animations, CREW.CameraMan.onAir);
assert(clip, 'The shipped cameraman must include on_air');
assert.equal(clip.duration, 8);
for (const name of ['cameraMan_idle', 'cameraMan_talking', 'cameraMan_clapping']) {
    assert(model.animations.some(animation => animation.name === name), `Preserve ${name}`);
}
const action = mixer.clipAction(clip).play();
mixer.update(0);
const mount = cameraOperatorMount(studio.scene);
assert(mount, 'The shipped studio must have the camera and grip');
const operator = createCameraOperator(model.scene, mount);
assert(operator, 'The exported rig must support the operator solver');
const hand = rig.getObjectByName('Hand_R');
const head = rig.getObjectByName('head');
const eyes = rig.getObjectByName('eyes');
const feet = ['Foot_R', 'Foot_L'].map(n => rig.getObjectByName(n));
const up = new THREE.Vector3(0, 1, 0);
const headForward = new THREE.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
const right = headForward.clone().cross(up).normalize();
const wristLocal = mount.grip.worldToLocal(hand.getWorldPosition(new THREE.Vector3()));
const rotationLocal = mount.grip.getWorldQuaternion(new THREE.Quaternion()).normalize().invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()).normalize()).normalize();
const gazeLocal = mount.camera.worldToLocal(eyes.getWorldPosition(new THREE.Vector3()).addScaledVector(headForward, 0.65));
const feetLocal = feet.map(f => studio.scene.worldToLocal(f.getWorldPosition(new THREE.Vector3())));
const plantedNames = ['Foot_R', 'Foot_L', 'ball_r', 'ball_l', 'toes_r', 'toes_l'];
const plantedPose = plantedNames.map(name => {
    const node = rig.getObjectByName(name);
    return {
        position: studio.scene.worldToLocal(node.getWorldPosition(new THREE.Vector3())),
        quaternion: studio.scene.getWorldQuaternion(new THREE.Quaternion()).invert()
            .multiply(node.getWorldQuaternion(new THREE.Quaternion())).normalize(),
    };
});
function pan(yaw, pitch) {
    mount.pivot.quaternion.setFromAxisAngle(up, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(right, pitch)).multiply(mount.restQuaternion);
}
let maxError = 0, maxGaze = 0, maxFoot = 0, maxWristAngle = 0;
let unreachable = [];
for (const transform of [false, true]) {
    scene.position.set(transform ? 3 : 0, transform ? -0.4 : 0, transform ? 2 : 0);
    scene.rotation.set(transform ? 0.15 : 0, transform ? 0.72 : 0, transform ? -0.12 : 0);
    scene.scale.setScalar(transform ? 2.3 : 1);
    for (const yf of [-1, -0.5, 0, 0.5, 1])
        for (const pf of [-1, 0, 1])
            for (const time of [0, 1.23, 3.7, 7.99]) {
                const yaw = yf * CAMERA_OPERATOR_LIMITS.yaw, pitch = pf * CAMERA_OPERATOR_LIMITS.pitch;
                operator.restore();
                mixer.setTime(time);
                pan(yaw, pitch);
                const st = operator.update(yaw, pitch);
                const scale = transform ? 2.3 : 1;
                maxError = Math.max(maxError, st.wristError / scale);
                if (!st.reachable)
                    unreachable.push([yf, pf, time, st.wristError / scale]);
                const desired = mount.grip.localToWorld(wristLocal.clone());
                assert(hand.getWorldPosition(new THREE.Vector3()).distanceTo(desired) / scale < 0.001, 'Hand must stay within 1 mm of handle');
                const actualQ = mount.grip.getWorldQuaternion(new THREE.Quaternion()).normalize().invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()).normalize()).normalize();
                maxWristAngle = Math.max(maxWristAngle, actualQ.angleTo(rotationLocal));
                for (let i = 0; i < feet.length; i++)
                    maxFoot = Math.max(maxFoot, studio.scene.worldToLocal(feet[i].getWorldPosition(new THREE.Vector3())).distanceTo(feetLocal[i]));
                const desiredGaze = mount.camera.localToWorld(gazeLocal.clone()).sub(eyes.getWorldPosition(new THREE.Vector3())).normalize();
                const actualGaze = new THREE.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
                maxGaze = Math.max(maxGaze, actualGaze.angleTo(desiredGaze));
            }
}
assert(maxFoot < 1e-6, `Feet moved ${maxFoot}`);
assert(maxWristAngle < 0.001, `Wrist changed orientation ${maxWristAngle}`);
assert(maxGaze < THREE.MathUtils.degToRad(2), `Viewfinder gaze error ${THREE.MathUtils.radToDeg(maxGaze)} degrees`);
assert.equal(unreachable.length, 0, 'Every supported pan/tilt combination must be reachable');
// Return to the same animated frame repeatedly: constant channels must not
// accumulate the previous frame's procedural corrections.
scene.position.set(0, 0, 0);
scene.rotation.set(0, 0, 0);
scene.scale.setScalar(1);
for (let i = 0; i < 600; i++) {
    operator.restore();
    mixer.update(1 / 60);
    const yaw = Math.sin(i / 40) * 0.5;
    const pitch = Math.cos(i / 50) * CAMERA_OPERATOR_LIMITS.pitch;
    pan(yaw, pitch);
    operator.update(yaw, pitch);
}
operator.restore();
mixer.setTime(0);
pan(0, 0);
operator.update(0, 0);
assert(operator.status.wristError < 0.001, 'No cumulative grip drift after repeated pans');
let firstSpine;
for (let i = 0; i < 120; i++) {
    operator.restore();
    mixer.setTime(0.5);
    pan(0.4, 0.1);
    operator.update(0.4, 0.1);
    const spine = rig.getObjectByName('spine_01').quaternion;
    if (!firstSpine) firstSpine = spine.clone();
    assert(firstSpine.angleTo(spine) < 1e-6, 'Constant mixer channels must not accumulate torso rotation');
}
// A late load captures the authored pose even while the camera is panned.
operator.restore();
mixer.setTime(0);
pan(0.4, 0.15);
const late = createCameraOperator(model.scene, mount);
assert(Math.abs(mount.pivot.quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(up, 0.4).multiply(new THREE.Quaternion().setFromAxisAngle(right, 0.15)).multiply(mount.restQuaternion))) < 1e-6, 'Calibration must restore the live camera');
late.update(0.4, 0.15);
assert(hand.getWorldPosition(new THREE.Vector3()).distanceTo(mount.grip.localToWorld(wristLocal.clone())) < 0.001, 'Late loading must not change the grip offset');
assert.equal(cameraOperatorMount(new THREE.Group()), null);
assert.equal(createCameraOperator(new THREE.Group(), mount), null);

// Exercise the same playback controller used by StudioCrew, including mixer
// channel caching when tracking is disabled again after a broadcast.
late.restore();
mixer.stopAllAction();
const crewModel = await loadRig(CREW.CameraMan.file);
const referenceModel = await loadRig(CREW.CameraMan.file);
studio.scene.add(crewModel.scene);
const crewRig = crewModel.scene.getObjectByName(CREW.CameraMan.rig);
const referenceRig = referenceModel.scene.getObjectByName(CREW.CameraMan.rig);
const referenceMixer = new THREE.AnimationMixer(referenceRig);
let crew = createCrewAnimation(crewModel.scene, crewRig, crewModel.animations, CREW.CameraMan, mount);
const crewClip = name => THREE.AnimationClip.findByName(crew.clips, name);
const crewAction = name => crew.mixer.existingAction(crewClip(name));
const filmingWeight = () => crewAction('on_air').getEffectiveWeight();
const pose = () => {
    const bones = [];
    crewRig.traverse(bone => { if (bone.isBone) bones.push(bone.quaternion.clone().normalize()); });
    return bones;
};
function assertSamePose(before, message) {
    const after = pose();
    assert(before.every((q, i) => q.angleTo(after[i]) < 1e-6), message);
}
function assertOriginalClip(name) {
    referenceMixer.stopAllAction();
    const original = THREE.AnimationClip.findByName(referenceModel.animations, name);
    referenceMixer.clipAction(original).reset().play();
    referenceMixer.setTime(crewAction(name).time);
    // Hips and legs intentionally share the on_air stance; the spine and all
    // its descendants must still perform their original animated gestures.
    crewRig.getObjectByName('spine_01').traverse(bone => {
        if (!bone.isBone) return;
        const expected = referenceRig.getObjectByName(bone.name);
        assert(bone.quaternion.clone().normalize().angleTo(expected.quaternion.clone().normalize()) < 1e-5,
            `${name}: ${bone.name} must retain its original off-air pose`);
        assert(bone.position.distanceTo(expected.position) < 1e-5);
        assert(bone.scale.distanceTo(expected.scale) < 1e-5);
    });
}
let maxCrewFootDrift = 0;
let maxCrewFootAngle = 0;
function assertPlantedFeet() {
    plantedNames.forEach((name, i) => {
        const node = crewRig.getObjectByName(name);
        const position = studio.scene.worldToLocal(node.getWorldPosition(new THREE.Vector3()));
        const quaternion = studio.scene.getWorldQuaternion(new THREE.Quaternion()).invert()
            .multiply(node.getWorldQuaternion(new THREE.Quaternion())).normalize();
        maxCrewFootDrift = Math.max(maxCrewFootDrift, position.distanceTo(plantedPose[i].position));
        maxCrewFootAngle = Math.max(maxCrewFootAngle, quaternion.angleTo(plantedPose[i].quaternion));
        assert(maxCrewFootDrift < 1e-6, `Feet and toes must stay planted: drift ${maxCrewFootDrift} m`);
        assert(maxCrewFootAngle < 1e-5, `Feet must not pivot between clips: angle ${maxCrewFootAngle}`);
    });
}
function stepCrew(...args) {
    crew.update(...args);
    assertPlantedFeet();
}
assert.equal(filmingWeight(), 0, 'No filming pose before Play');
assertPlantedFeet();
assertOriginalClip('cameraMan_idle');
const seen = new Set();
for (let i = 0; i < 120 * 60; i++) {
    stepCrew(1 / 60, false, false, 0.4, 0.15);
    assert.equal(filmingWeight(), 0, 'Off-air cycling must never enable tracking');
    for (const name of CREW.CameraMan.idleClips) {
        if (crewAction(name).getEffectiveWeight() > 0.99999 && !seen.has(name)) {
            seen.add(name);
            assertOriginalClip(name);
        }
    }
}
assert.deepEqual([...seen], CREW.CameraMan.idleClips, 'Cycle all three original clips before Play');
const idlePose = pose();
stepCrew(0, true, false, 0.4, 0.15);
assertSamePose(idlePose, 'Play begins a blend without snapping to the grip');
for (let i = 0; i < 60; i++) stepCrew(1 / 60, true, false, 0.4, 0.15);
assert.equal(filmingWeight(), 1);
const gripError = () => crewRig.getObjectByName('Hand_R').getWorldPosition(new THREE.Vector3())
    .distanceTo(mount.grip.localToWorld(wristLocal.clone()));
assert(gripError() < 0.001, 'After Play the hand must follow the panned camera');
const pausedPose = pose();
const pausedTime = crewAction('on_air').time;
for (let i = 0; i < 60; i++) stepCrew(1 / 60, true, true, 0.4, 0.15);
assert.equal(crewAction('on_air').time, pausedTime, 'Pause must retain the filming animation time');
assertSamePose(pausedPose, 'Pause must hold the filming pose');
stepCrew(0, false, false, 0.4, 0.15);
assertSamePose(pausedPose, 'Stop begins a blend without snapping off the handle');
for (let i = 0; i < 60; i++) stepCrew(1 / 60, false, false, 0.4, 0.15);
assert.equal(filmingWeight(), 0);
assertOriginalClip('cameraMan_idle');
for (let i = 0; i < 12; i++) {
    stepCrew(1 / 60, i % 2 === 0, false, 0.4, 0.15);
    const sum = crewModel.animations.reduce((total, animation) => total + crewAction(animation.name).getEffectiveWeight(), 0);
    assert(Math.abs(sum - 1) < 1e-6, 'Quick Play/Stop clicks must preserve a full animation blend');
}
for (let i = 0; i < 60; i++) stepCrew(1 / 60, true, false, 0.4, 0.15);
assert(gripError() < 0.001, 'Replay must retain the authored grip calibration');
crew.dispose();
crew = createCrewAnimation(crewModel.scene, crewRig, crewModel.animations, CREW.CameraMan, mount);
assert.equal(filmingWeight(), 0, 'Remount starts off air');
assertPlantedFeet();
assertOriginalClip('cameraMan_idle');
crew.dispose();
referenceMixer.stopAllAction();
console.log(JSON.stringify({ maxWristErrorMetres: maxError, maxFootDriftMetres: maxFoot, maxCrewFootDriftMetres: maxCrewFootDrift, maxCrewFootAngleDegrees: THREE.MathUtils.radToDeg(maxCrewFootAngle), maxGazeDegrees: THREE.MathUtils.radToDeg(maxGaze), maxWristAngleDegrees: THREE.MathUtils.radToDeg(maxWristAngle), unreachable }, null, 2));
console.log('Camera operator: pose, pan/tilt, transforms, planted feet across idle loops and transitions, upper-body gestures, Play/Stop blends, pause, replay and remount passed.');
