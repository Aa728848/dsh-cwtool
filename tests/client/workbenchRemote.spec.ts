import { describe, expect, it } from 'vitest'
import { CWTOOLS_WORKBENCH_REMOTE } from '../../src/client/workbenchRemote.ts'

describe('CWTools Workbench Remote descriptors', () => {
  it('passes only sessionId/filePath for file methods and name/args for tools', () => {
    for (const method of ['read', 'asset', 'gui', 'event']) {
      const descriptor = CWTOOLS_WORKBENCH_REMOTE.descriptors.find(item => item.method === method)
      expect(descriptor?.parameters.map(parameter => parameter.name)).toEqual(['sessionId', 'filePath'])
    }
    expect(CWTOOLS_WORKBENCH_REMOTE.descriptors.find(item => item.method === 'ship')?.parameters.map(parameter => parameter.name)).toEqual(['sessionId', 'filePath'])
    expect(CWTOOLS_WORKBENCH_REMOTE.descriptors.find(item => item.method === 'shipAsset')?.parameters.map(parameter => parameter.name)).toEqual(['sessionId', 'filePath', 'nodeId'])
    for (const method of ['execute', 'write']) {
      const descriptor = CWTOOLS_WORKBENCH_REMOTE.descriptors.find(item => item.method === method)
      expect(descriptor?.parameters.map(parameter => parameter.name)).toEqual(['sessionId', 'name', 'args'])
    }
  })
})
