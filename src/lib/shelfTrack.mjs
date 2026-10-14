import * as THREE from 'three';

// A closed ride track whose plan (x, z) follows a Catmull-Rom loop and whose
// height is a shelf profile along that loop: level shelves for the dioramas,
// joined by smoothstep ramps. Every shelf is exactly flat and every ramp eases
// in and out, so the car never pitches on a shelf and never kinks off one.
// It is a THREE.Curve, so TubeGeometry, getPointAt/getTangentAt/getLength
// and the rail builder use it unchanged.
export class ShelfTrack extends THREE.Curve {
  constructor(planPoints, { shelfLength, heights, tension = 0.7 }) {
    super();
    this.plan = new THREE.CatmullRomCurve3(
      planPoints.map((p) => new THREE.Vector3(p.x, 0, p.z)), true, 'catmullrom', tension);
    this.plan.arcLengthDivisions = 4096;
    this.plan.updateArcLengths();
    this.arcLengthDivisions = 4096;
    const planLength = this.plan.getLength();
    this.count = heights.length;
    this.heights = heights.slice();
    // Fractions of the plan loop: shelf, then ramp, repeated once per shelf.
    this.shelf = shelfLength / planLength;
    this.ramp = 1 / this.count - this.shelf;
    if (this.ramp <= 0) throw new Error('ShelfTrack: shelves longer than the loop.');
    this.updateArcLengths();
  }

  // Height at plan fraction t (not arc fraction of this 3D curve).
  heightAt(t) {
    t = ((t % 1) + 1) % 1;
    const period = this.shelf + this.ramp;
    const i = Math.min(Math.floor(t / period), this.count - 1);
    const local = t - i * period;
    const a = this.heights[i];
    if (local <= this.shelf) return a;
    const b = this.heights[(i + 1) % this.count];
    const x = Math.min((local - this.shelf) / this.ramp, 1);
    return a + (b - a) * x * x * (3 - 2 * x);
  }

  getPoint(t, target = new THREE.Vector3()) {
    this.plan.getPointAt(((t % 1) + 1) % 1, target);
    target.y = this.heightAt(t);
    return target;
  }

  // Each shelf as arc fractions of this curve (what curvePosition uses).
  shelfSpans() {
    const lengths = this.getLengths();
    const total = lengths[lengths.length - 1];
    const u = (t) => lengths[Math.round(t * (lengths.length - 1))] / total;
    return this.heights.map((height, i) => {
      const start = i * (this.shelf + this.ramp);
      const a = u(start), b = u(start + this.shelf);
      return { index: i, start: a, end: b, mid: (a + b) / 2, height };
    });
  }
}
