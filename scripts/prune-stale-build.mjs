import { unlink,readdir } from 'node:fs/promises'
const stale=['lib/types/client/CwtoolsWorkbench.d.ts','lib/types/client/CwtoolsWorkbench.d.ts.map','lib/client.cjs','lib/client.cjs.map']
for(const name of await readdir('lib').catch(()=>[]))if(/^(?:Scenes|editors)-.*\.cjs(?:\.map)?$/.test(name))stale.push('lib/'+name)
for(const file of stale)await unlink(file).catch(error=>{if(error?.code!=='ENOENT')throw error})