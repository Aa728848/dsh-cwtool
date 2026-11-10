import z from '@deepseek-ai/schemastery'
import type { CwtoolsConfig, CwtoolsConfigInput } from './contract/configTypes.ts'
import { cwtoolsReadGroupFor, type CwtoolsReadToolName } from './contract/toolCatalog.ts'

export type Config = CwtoolsConfig
const timer = z.number().step(1).min(1).max(2_147_483_647)

export const Config: z<CwtoolsConfigInput, Config> = z.object({
  enabled: z.boolean().default(true),
  readGroups: z.object({
    project: z.boolean().default(true),
    localisation: z.boolean().default(true),
    semantic: z.boolean().default(true),
    navigation: z.boolean().default(true),
    diagnostics: z.boolean().default(true),
    shader: z.boolean().default(true),
  }).default({}),
  readTools: z.dict(z.boolean(), z.string()).default({}),
  writeTools: z.object({
    write_localisation: z.boolean().default(false),
  }).default({}),
  backend: z.object({
    serverPath: z.string().default(''),
    gamePath: z.string().default(''),
    rulesPath: z.string().default(''),
    cachePath: z.string().default(''),
    game: z.string().default(''),
    forceStart: z.boolean().default(false),
    startupTimeoutMs: timer.default(30_000),
    requestTimeoutMs: timer.default(20_000),
    idleShutdownMs: timer.default(600_000),
    maxWorkspaceRuntimes: z.number().step(1).min(1).max(8).default(2),
    preferActiveBackend: z.boolean().default(true),
    activeManifestPath: z.string().default(''),
    debug: z.boolean().default(false),
  }).default({}),
  output: z.object({
    maxResultChars: z.number().step(1).min(1000).max(200_000).default(16_000),
  }).default({}),
})

export function isReadToolEnabled(config: Config, name: CwtoolsReadToolName): boolean {
  return config.enabled && config.readGroups[cwtoolsReadGroupFor(name)] && config.readTools[name] !== false
}

export function isWriteLocalisationEnabled(config: Config): boolean {
  return config.enabled && config.writeTools.write_localisation === true
}
