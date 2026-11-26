import * as THREE from 'three'
import type { EntityDefinition, MeshSettingOverride, ShipDesignEntityAssetData } from 'cwtools-shared/editors'
import { buildGeometry, disposeObject3D, parsePdxMesh, pdxScriptEuler } from './geometry.ts'
import type { InlineEntityAssets, SceneAssetLoader, ShipSceneModel } from './types.ts'

export interface BuiltEntity {
  readonly group: THREE.Group
  /** Number of sub-meshes actually turned into geometry. */
  readonly meshCount: number
  /** Non-fatal reasons geometry could not be built (missing mesh, parse error). */
  readonly notes: readonly string[]
}

async function resolveMeshBytes(
  file: string,
  inline: InlineEntityAssets | undefined,
  loader: SceneAssetLoader | undefined,
): Promise<ArrayBuffer | null> {
  if (inline?.mesh !== undefined) return inline.mesh
  if (loader !== undefined) return loader.loadMesh(file)
  return null
}

async function resolveTextureUrl(
  file: string,
  inline: InlineEntityAssets | undefined,
  loader: SceneAssetLoader | undefined,
): Promise<string | null> {
  const direct = inline?.textures?.[file]
  if (direct !== undefined) return direct
  if (loader !== undefined) return loader.loadTextureUrl(file)
  return null
}

function diffuseFile(meshSettings: readonly MeshSettingOverride[] | undefined, materialDiffuse: string | undefined): string | undefined {
  const override = meshSettings?.find((setting) => setting.textureDiffuse !== undefined)
  return override?.textureDiffuse ?? (materialDiffuse !== undefined && materialDiffuse !== '' ? materialDiffuse : undefined)
}

/**
 * Build a Three.js group for one entity definition (its pdxmesh geometry plus
 * locator markers). Missing or unparsable meshes are reported in `notes` rather
 * than thrown so a scene still renders the remaining data.
 */
export async function buildEntityObject(
  entity: EntityDefinition,
  inline: InlineEntityAssets | undefined,
  loader: SceneAssetLoader | undefined,
): Promise<BuiltEntity> {
  const group = new THREE.Group()
  group.name = entity.name
  if (entity.scale !== undefined) group.scale.setScalar(entity.scale)
  const notes: string[] = []
  let meshCount = 0

  const meshFile = entity.pdxmesh
  if (meshFile === undefined) {
    notes.push(`${entity.name}: no pdxmesh declared`)
  } else {
    const bytes = await resolveMeshBytes(meshFile, inline, loader)
    if (bytes === null) {
      notes.push(`${entity.name}: mesh ${meshFile} not available`)
    } else {
      try {
        const parsed = parsePdxMesh(bytes)
        for (const subMesh of parsed.subMeshes) {
          const geometry = buildGeometry(subMesh)
          const texFile = diffuseFile(entity.meshSettings, subMesh.material.diffuse)
          const material = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.1, roughness: 0.85 })
          if (texFile !== undefined) {
            const url = await resolveTextureUrl(texFile, inline, loader)
            if (url !== null) {
              const texture = new THREE.TextureLoader().load(url)
              texture.colorSpace = THREE.SRGBColorSpace
              material.map = texture
              material.color.set(0xffffff)
            }
          }
          const mesh = new THREE.Mesh(geometry, material)
          mesh.name = subMesh.name
          group.add(mesh)
          meshCount += 1
        }
        for (const locator of parsed.locators) {
          const marker = new THREE.Object3D()
          marker.name = `locator:${locator.name}`
          marker.position.set(locator.position[0], locator.position[1], locator.position[2])
          marker.quaternion.set(locator.rotation[0], locator.rotation[1], locator.rotation[2], locator.rotation[3])
          group.add(marker)
        }
      } catch (error) {
        notes.push(`${entity.name}: failed to parse ${meshFile}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  for (const locator of entity.locators) {
    const marker = new THREE.Object3D()
    marker.name = `script-locator:${locator.name}`
    if (locator.position !== undefined) marker.position.set(locator.position[0], locator.position[1], locator.position[2])
    if (locator.rotation !== undefined) marker.setRotationFromEuler(pdxScriptEuler(locator.rotation[0], locator.rotation[1], locator.rotation[2]))
    group.add(marker)
  }

  return { group, meshCount, notes }
}

export interface BuiltShip {
  readonly group: THREE.Group
  readonly meshCount: number
  readonly notes: readonly string[]
}

/** Compose a ship model from placed entity sections. */
export async function buildShipObject(
  ship: ShipSceneModel,
  assets: Readonly<Record<string, InlineEntityAssets>> | undefined,
  loader: SceneAssetLoader | undefined,
): Promise<BuiltShip> {
  const group = new THREE.Group()
  group.name = ship.name
  if (ship.scale !== undefined) group.scale.setScalar(ship.scale)
  const notes: string[] = []
  let meshCount = 0
  for (const section of ship.sections) {
    const built = await buildEntityObject(section.entity, assets?.[section.entity.name], loader)
    built.group.position.set(...(section.position ?? ([0, 0, 0] as const)))
    if (section.rotation !== undefined) built.group.setRotationFromEuler(pdxScriptEuler(section.rotation[0], section.rotation[1], section.rotation[2]))
    if (section.scale !== undefined) built.group.scale.setScalar(section.scale)
    group.add(built.group)
    meshCount += built.meshCount
    notes.push(...built.notes)
  }
  return { group, meshCount, notes }
}

function inlineMesh(asset: ShipDesignEntityAssetData): ArrayBuffer | undefined {
  if (!asset.meshBase64) return undefined
  const binary = atob(asset.meshBase64); const bytes = Uint8Array.from(binary, char => char.charCodeAt(0)); return bytes.buffer
}

async function buildResolvedEntity(asset: ShipDesignEntityAssetData, loader: SceneAssetLoader | undefined, depth: number): Promise<BuiltEntity> {
  const group = new THREE.Group(); group.name = asset.name
  if (asset.scale !== undefined) group.scale.setScalar(asset.scale)
  const notes: string[] = []; let meshCount = 0
  const attachments = new Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion }>()
  const bytes = inlineMesh(asset) ?? (asset.meshUri && loader ? await loader.loadMesh(asset.meshUri) : null)
  if (bytes) {
    try {
      const parsed = parsePdxMesh(bytes)
      for (const subMesh of parsed.subMeshes) {
        const geometry = buildGeometry(subMesh)
        const material = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.1, roughness: 0.85 })
        const original = diffuseFile(asset.meshSettings, subMesh.material.diffuse)
        const mapped = original ? asset.textureMap[original] ?? asset.textureMap[original.toLowerCase()] ?? original : undefined
        if (mapped && loader) {
          const url = mapped.startsWith('data:') ? mapped : await loader.loadTextureUrl(mapped)
          if (url) { const texture = new THREE.TextureLoader().load(url); texture.colorSpace = THREE.SRGBColorSpace; material.map = texture; material.color.set(0xffffff) }
        }
        const mesh = new THREE.Mesh(geometry, material); mesh.name = subMesh.name; group.add(mesh); meshCount++
      }
      for (const locator of parsed.locators) attachments.set(locator.name, { position: new THREE.Vector3(...locator.position), quaternion: new THREE.Quaternion(...locator.rotation) })
    } catch (error) { notes.push(`${asset.name}: failed to parse mesh: ${error instanceof Error ? error.message : String(error)}`) }
  } else notes.push(`${asset.name}: mesh not available`)
  for (const locator of asset.locators) {
    const position = new THREE.Vector3(...(locator.position ?? [0, 0, 0]))
    const quaternion = new THREE.Quaternion().setFromEuler(pdxScriptEuler(...(locator.rotation ?? [0, 0, 0])))
    attachments.set(locator.name, { position, quaternion })
    const marker = new THREE.Object3D(); marker.name = `locator:${locator.name}`; marker.position.copy(position); marker.quaternion.copy(quaternion); if (locator.scale !== undefined) marker.scale.setScalar(locator.scale); group.add(marker)
  }
  if (depth < 8) for (const attach of asset.attaches) {
    const child = await buildResolvedEntity(attach.entity, loader, depth + 1); const transform = attachments.get(attach.locatorName)
    if (transform) { child.group.position.copy(transform.position); child.group.quaternion.copy(transform.quaternion) }
    group.add(child.group); meshCount += child.meshCount; notes.push(...child.notes)
  }
  return { group, meshCount, notes }
}

/** Build full Host-resolved ship meshes, attachments and textures without script placeholders. */
export async function buildResolvedShipObject(assets: readonly ShipDesignEntityAssetData[], loader: SceneAssetLoader | undefined): Promise<BuiltShip> {
  const group = new THREE.Group(); const notes: string[] = []; let meshCount = 0
  for (const asset of assets.slice(0, 64)) { const built = await buildResolvedEntity(asset, loader, 0); group.add(built.group); meshCount += built.meshCount; notes.push(...built.notes) }
  return { group, meshCount, notes }
}

/** Compute a framing box for a built object, or `null` when it has no geometry. */
export function frameObject(object: THREE.Object3D): { center: THREE.Vector3; radius: number } | null {
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) return null
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  return { center: sphere.center.clone(), radius: Math.max(0.001, sphere.radius) }
}

export { disposeObject3D }