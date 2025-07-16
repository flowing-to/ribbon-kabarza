import { Object3DNode } from "@react-three/fiber";
import * as THREE from "three";

// your custom bent‑plane geometry
export class BentPlaneGeometry extends THREE.PlaneGeometry {
  constructor(
    radius: number,
    ...args: ConstructorParameters<typeof THREE.PlaneGeometry>
  ) {
    super(...args);
    const p = this.parameters;
    const hw = p.width * 0.5;
    const a = new THREE.Vector2(-hw, 0);
    const b = new THREE.Vector2(0, radius);
    const c = new THREE.Vector2(hw, 0);
    const ab = new THREE.Vector2().subVectors(a, b);
    const bc = new THREE.Vector2().subVectors(b, c);
    const ac = new THREE.Vector2().subVectors(a, c);
    const r =
      (ab.length() * bc.length() * ac.length()) / (2 * Math.abs(ab.cross(ac)));
    const center = new THREE.Vector2(0, radius - r);
    const baseV = new THREE.Vector2().subVectors(a, center);
    const baseAngle = baseV.angle() - Math.PI * 0.5;
    const arc = baseAngle * 2;
    const uv = this.attributes.uv;
    const pos = this.attributes.position;
    const mainV = new THREE.Vector2();

    for (let i = 0; i < uv.count; i++) {
      const uvRatio = 1 - uv.getX(i);
      const y = pos.getY(i);
      mainV.copy(c).rotateAround(center, arc * uvRatio);
      pos.setXYZ(i, mainV.x, y, mainV.y);
    }
    pos.needsUpdate = true;
  }
}

// tell react‐three/fiber about the new element
export async function extendBentPlane() {
  // this import needs to match your fibre version
  const { extend } = await import("@react-three/fiber");
  extend({ BentPlaneGeometry });
}
//test
declare module "@react-three/fiber" {
  interface ThreeElements {
    bentPlaneGeometry: Object3DNode<
      BentPlaneGeometry,
      typeof BentPlaneGeometry
    >;
  }
}
