import * as BABYLON from '@babylonjs/core';
import Recast from 'recast-detour';
import { RecastJSPlugin } from '@babylonjs/core/Navigation/Plugins/recastJSPlugin';
import { extendedScene } from '../types';

export async function createNavMesh(
  scene: extendedScene,
  meshes: BABYLON.Mesh[]
): Promise<BABYLON.RecastJSPlugin> {
  const recast = await Recast();

  const oldPlugin = scene.navigationPlugin as RecastJSPlugin;
  if (oldPlugin) oldPlugin.dispose();

  const oldCrowd = scene.crowd;
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

  const crowd = navigationPlugin.createCrowd(1200, 30, scene);
  scene.crowd = crowd;

  scene.navigationPlugin = navigationPlugin;

  return navigationPlugin;
}
