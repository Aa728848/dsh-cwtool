// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ShipDesignData, StaticGalaxyParseResult } from 'cwtools-shared/editors'
import { ShipGalaxyTools } from '../../src/client/ShipGalaxyTools.tsx'

afterEach(cleanup)

const ship = {
  name: 'Test ship',
  sections: [{ id: 'section-1', slot: 'root', template: 'template-1', components: [] }],
} as unknown as ShipDesignData

const galaxy = {
  scenarios: [{ systems: [
    { id: 'system-a', nodeKey: 'node-a', name: 'Alpha' },
    { id: 'system-b', nodeKey: 'node-b', name: 'Beta' },
  ] }],
} as unknown as StaticGalaxyParseResult

describe('ShipGalaxyTools candidate transactions', () => {
  it('runs ship apply/validate/commit and galaxy apply with independent transaction ids', async () => {
    const onWrite = vi.fn(async (tool: string, args: Record<string, unknown>) => {
      const transactionId = tool === 'ship_design_draft' ? 'tx-ship' : 'tx-galaxy'
      return { ok: true, data: { transactionId, ...(tool === 'ship_design_draft' ? { designs: [ship] } : {}) } }
    })
    const onShipDesign = vi.fn()
    render(<ShipGalaxyTools documentPath='common/global_ship_designs/test.txt' shipDesign={ship} galaxy={galaxy} onWrite={onWrite} onShipDesign={onShipDesign} />)
    fireEvent.change(screen.getByLabelText('Section template'), { target: { value: 'template-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply section' }))
    await waitFor(() => expect(onWrite).toHaveBeenCalledWith('ship_design_draft', expect.objectContaining({ action: 'apply', transactionId: 'tx-ship' })))
    fireEvent.click(screen.getByRole('button', { name: 'Validate ship' }))
    await waitFor(() => expect(onWrite).toHaveBeenCalledWith('ship_design_draft', { action: 'validate', filePath: 'common/global_ship_designs/test.txt', transactionId: 'tx-ship' }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit ship' }))
    await waitFor(() => expect(onWrite).toHaveBeenCalledWith('ship_design_draft', { action: 'commit', filePath: 'common/global_ship_designs/test.txt', transactionId: 'tx-ship' }))
    fireEvent.change(screen.getByLabelText('Galaxy X'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Galaxy Y'), { target: { value: '-4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move system' }))
    await waitFor(() => expect(onWrite).toHaveBeenCalledWith('static_galaxy_draft', expect.objectContaining({ action: 'apply', transactionId: 'tx-galaxy' })))
    expect(onWrite.mock.calls.map(call => call[0])).not.toContain('candidate_transaction')
    const galaxyApply = onWrite.mock.calls.find(call => call[0] === 'static_galaxy_draft' && (call[1] as { action?: string }).action === 'apply')?.[1] as Record<string, unknown>
    expect(galaxyApply.request).toEqual({ kind: 'move', moves: [{ nodeKey: 'node-a', x: 12, y: -4 }] })
    expect(onShipDesign).toHaveBeenCalled()
  })
})
