import { describe, expect, it, vi } from 'vitest'
import { InventoryRecoveryError, restoreExpiredOrderInventory } from '@/lib/order-expiry'
import type { DbTx } from '@/lib/velocity/idempotency'
import { orders, tickets } from '@/db/schema'
describe('expired payment inventory recovery',()=>{
 it('stops settlement when released inventory cannot be reacquired',async()=>{
  const update=vi.fn(()=>({set:()=>({where:()=>({returning:async()=>[]})})}))
  const tx={select:()=>({from:()=>({where:async()=>[{type:'ticket',tierId:'tier',quantity:2}]})}),update} as unknown as DbTx
  await expect(restoreExpiredOrderInventory(tx,{id:'order'} as typeof orders.$inferSelect,{inventoryReserved:true})).rejects.toBeInstanceOf(InventoryRecoveryError)
  expect(update).not.toHaveBeenCalledWith(tickets)
 })
 it('restores ticket usability only after capacity has been reacquired',async()=>{
  const update=vi.fn(()=>({set:()=>({where:()=>({returning:async()=>[{id:'tier'}]})})}))
  const tx={select:()=>({from:()=>({where:async()=>[{type:'ticket',tierId:'tier',quantity:1}]})}),update} as unknown as DbTx
  await restoreExpiredOrderInventory(tx,{id:'order'} as typeof orders.$inferSelect,{inventoryReserved:true})
  expect(update).toHaveBeenLastCalledWith(tickets)
 })
})
