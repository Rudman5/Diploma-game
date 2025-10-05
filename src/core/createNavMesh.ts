import * as BABYLON from '@babylonjs/core';
import Recast from 'recast-detour';
import { RecastJSPlugin } from '@babylonjs/core/Navigation/Plugins/recastJSPlugin';

export async function createNavMesh(
  scene: BABYLON.Scene,
  meshes: BABYLON.Mesh[]
): Promise<BABYLON.RecastJSPlugin> {
  const recast = await Recast();

  const oldPlugin = (scene as any).navigationPlugin as RecastJSPlugin;
  if (oldPlugin) oldPlugin.dispose();

  const oldCrowd = (scene as any).crowd;
  if (oldCrowd) oldCrowd.dispose();

  const navigationPlugin = new RecastJSPlugin(recast);
  const params = {
    cs: 1,
    ch: 0.5,
    walkableSlopeAngle: 45,
    walkableHeight: 2,
    walkableRadius: 1.5,
    walkableClimb: 1,
    maxEdgeLen: 50,
    maxSimplificationError: 1.3,
    minRegionArea: 8,
    mergeRegionArea: 20,
    maxVertsPerPoly: 3,
    detailSampleDist: 2,
    detailSampleMaxError: 1,
    borderSize: 8,
    tileSize: 64,
  };

  navigationPlugin.createNavMesh(meshes, params);

  const crowd = navigationPlugin.createCrowd(50, 1, scene);
  (scene as any).crowd = crowd;

  (scene as any).navigationPlugin = navigationPlugin;

  return navigationPlugin;
}
