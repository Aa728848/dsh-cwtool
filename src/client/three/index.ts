/**
 * Native Three.js scene components for dsh-cwtools.
 *
 * Browser-safe: no Node, VS Code or Host imports. Entity and particle data reuse
 * `cwtools-shared/editors` types; assets arrive through a `SceneAssetLoader`
 * (workspace reads) or inline ArrayBuffer/object-URL props.
 */
export { EntityScene, ParticleScene, ShipScene } from './Scenes.tsx'
export { SceneHost, WebGLUnavailableError, type SceneHostOptions } from './sceneHost.ts'
export { buildEntityObject, buildShipObject, frameObject, disposeObject3D } from './entityBuilder.ts'
export { parsePdxMesh, buildGeometry, pdxScriptEuler } from './geometry.ts'
export { ParticleEffectSimulation, ParticleSystemSim, evalCurve } from './particleSimulation.ts'
export { ParticleEffectRenderer } from './particleRenderer.ts'
export type {
  SceneAssetLoader,
  SceneViewOptions,
  InlineEntityAssets,
  EntitySceneProps,
  ParticleSceneProps,
  ShipSceneProps,
  ShipSceneModel,
  ShipSectionPlacement,
  MeshSceneProps,
} from './types.ts'
