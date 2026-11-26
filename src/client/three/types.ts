/**
 * Public types for the browser Three.js scene components.
 *
 * Entity and particle data reuse `cwtools-shared/editors` definitions so a Host and
 * the browser preview read the same `.asset` structures. Ship models compose
 * entity definitions at placement transforms; there is no canonical shared ship
 * type, so the minimal shape below carries only what a scene needs.
 */
import type { EntityDefinition, ParticleEffect, ShipDesignEntityAssetData } from 'cwtools-shared/editors'

/**
 * Resolves binary assets the scene needs from either the workspace (Host) or an
 * object-URL loader (browser). Both methods may be synchronous or async.
 */
export interface SceneAssetLoader {
  /** Raw `.mesh` bytes for a pdxmesh `file` path, or `null` when unavailable. */
  loadMesh(file: string): Promise<ArrayBuffer | null> | ArrayBuffer | null
  /** A texture URL (object URL or data URI) for a gfx texture path, or `null`. */
  loadTextureUrl(file: string): Promise<string | null> | string | null
}

/** Inline assets supplied directly on a prop, bypassing the loader. */
export interface InlineEntityAssets {
  /** Raw bytes of the entity's `pdxmesh` `.mesh` file. */
  readonly mesh?: ArrayBuffer
  /** Texture URLs keyed by the meshsetting's diffuse/normal/specular file. */
  readonly textures?: Readonly<Record<string, string>>
}

/** Shared visual options for every scene component. */
export interface SceneViewOptions {
  /** Background colour; `null` keeps the transparent canvas. */
  readonly background?: string | null
  /** Enable OrbitControls (orbit + zoom + optional pan). Default `true`. */
  readonly controls?: boolean
  /** Continuous animation loop. Default `true` for particles, `false` otherwise. */
  readonly animate?: boolean
  /** Camera azimuth/elevation/distances override for deterministic framing. */
  readonly camera?: { readonly azimuth?: number; readonly elevation?: number; readonly distance?: number }
  /** Extra CSS class applied to the canvas wrapper. */
  readonly className?: string
}

/** One entity placed into a ship model. */
export interface ShipSectionPlacement {
  /** Slot name (not used for placement when `position` is supplied). */
  readonly slot: string
  readonly entity: EntityDefinition
  readonly position?: readonly [number, number, number]
  readonly rotation?: readonly [number, number, number]
  readonly scale?: number
}

/** Minimal ship model composed of placed entity sections. */
export interface ShipSceneModel {
  readonly name: string
  readonly sections: readonly ShipSectionPlacement[]
  readonly scale?: number
}

/** Props shared by the Entity / Ship scene components. */
export interface MeshSceneProps extends SceneViewOptions {
  /** Asset resolver; may be omitted when every mesh/texture is inlined. */
  readonly loader?: SceneAssetLoader
  /** Per-entity inline mesh/texture overrides, keyed by entity name. */
  readonly assets?: Readonly<Record<string, InlineEntityAssets>>
}

/** Props for the particle scene component. */
export interface ParticleSceneProps extends SceneViewOptions {
  /** The parsed particle effect to simulate and render. */
  readonly effect: ParticleEffect
  /** Texture URLs keyed by `subsystem.texture.file`, from a loader or object URLs. */
  readonly textures?: Readonly<Record<string, string>>
  /** Deterministic seed for the approximation; defaults to 1. */
  readonly seed?: number
}

/** Props for the entity scene component. */
export interface EntitySceneProps extends MeshSceneProps {
  readonly entity: EntityDefinition
}

/** Props for the ship scene component. */
export interface ShipSceneProps extends MeshSceneProps {
  readonly ship: ShipSceneModel
}

export interface ResolvedShipSceneProps extends SceneViewOptions {
  readonly assets: readonly ShipDesignEntityAssetData[]
  readonly loader?: SceneAssetLoader
}
