import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { SharedToolResult } from 'cwtools-shared'
import { CwtoolsToolError } from './errors.ts'

const SUCCESS_STATUSES = new Set(['ready', 'partial', 'success', 'loading', 'stale'])

function normalizeJson(value: unknown, seen: WeakSet<object>, path: string): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new CwtoolsToolError('invalid_result', path + ' contains a non-finite number.')
    return value
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new CwtoolsToolError('invalid_result', path + ' contains a cycle.')
    seen.add(value)
    const result = value.map((entry, index) => {
      if (entry === undefined) throw new CwtoolsToolError('invalid_result', path + '[' + index + '] is undefined.')
      return normalizeJson(entry, seen, path + '[' + index + ']')
    })
    seen.delete(value)
    return result
  }
  if (typeof value === 'object' && value !== null) {
    const prototype = Object.getPrototypeOf(value) as object | null
    if (prototype !== Object.prototype && prototype !== null) {
      throw new CwtoolsToolError('invalid_result', path + ' contains a non-plain object.')
    }
    if (seen.has(value)) throw new CwtoolsToolError('invalid_result', path + ' contains a cycle.')
    seen.add(value)
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      const entry = (value as Record<string, unknown>)[key]
      if (entry === undefined) continue
      result[key] = normalizeJson(entry, seen, path + '.' + key)
    }
    seen.delete(value)
    return result
  }
  throw new CwtoolsToolError('invalid_result', path + ' contains a non-JSON value of type ' + typeof value + '.')
}

export function normalizeSuccessfulResult(result: SharedToolResult): SharedToolResult {
  const normalized = normalizeJson(result, new WeakSet(), '$') as SharedToolResult
  if (normalized.ok !== true || !SUCCESS_STATUSES.has(normalized.status) || typeof normalized.source !== 'string') {
    throw new CwtoolsToolError('invalid_result', 'CWTools returned an invalid success envelope.')
  }
  return normalized
}

export function errorFromSharedResult(result: SharedToolResult): CwtoolsToolError {
  const code = result.error?.code ?? result.status
  const message = result.error?.message ?? 'CWTools tool call failed with status ' + result.status + '.'
  // DSH renders only the message, and "fetch failed" alone does not say that the
  // backend went away; keep the stable code visible next to the text.
  const detail = result.error?.code ? message + ' (' + result.error.code + ')' : message
  return new CwtoolsToolError(code, detail, result.nextSteps ?? [])
}

export function renderCwtoolsResult(value: unknown, maxResultChars: number): string {
  const text = JSON.stringify(value, null, 2) ?? 'null'
  if (text.length <= maxResultChars) return text
  const omitted = text.length - maxResultChars
  return text.slice(0, maxResultChars) + '\n… [truncated ' + omitted + ' characters; canonical tool result is unchanged]'
}

export const SUCCESS_OUTPUT_SCHEMA: ToolDefinition['output']['schema'] = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    status: { type: 'string', enum: ['ready', 'partial', 'success', 'loading', 'stale'] },
    source: { type: 'string' },
    data: {},
    warnings: { type: 'array', items: { type: 'string' } },
    nextSteps: { type: 'array', items: { type: 'string' } },
    vanillaCache: { type: 'object', additionalProperties: true },
    readiness: { type: 'object', additionalProperties: true },
  },
  required: ['ok', 'status', 'source'],
}
