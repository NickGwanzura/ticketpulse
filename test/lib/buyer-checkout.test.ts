import { afterEach, describe, expect, it, vi } from 'vitest'
import { CheckoutBody, checkoutFingerprint, quoteMatches } from '@/lib/checkout-contract'
import { createOrderRecoveryToken, verifyOrderRecoveryToken } from '@/lib/order-recovery-token'
import { buyerOrderStatus } from '@/lib/buyer-order-status'
const id='11111111-1111-4111-8111-111111111111'
const input=CheckoutBody.parse({email:'buyer@example.com',name:'Buyer',phone:'0771234567',paymentMethod:'velocity-ecocash',eventSlug:'event',items:[{kind:'ticket',tierId:id,quantity:1}],checkoutRequestId:id})
afterEach(()=>vi.unstubAllEnvs())
describe('buyer checkout safeguards',()=>{
 it('requires durable request identity',()=>expect(CheckoutBody.safeParse({...input,checkoutRequestId:undefined}).success).toBe(false))
 it('requires explicit reviewed amount and currency',()=>{
  expect(quoteMatches(input,20,'USD')).toBe(false)
  expect(quoteMatches({...input,expectedAmount:20,expectedCurrency:'USD'},20,'USD')).toBe(true)
  expect(quoteMatches({...input,expectedAmount:20,expectedCurrency:'USD'},21,'USD')).toBe(false)
  expect(quoteMatches({...input,expectedAmount:20,expectedCurrency:'USD'},20,'ZWG')).toBe(false)
 })
 it('normalizes phone forms for retry identity while preserving changed numbers',()=>{
  const fp=checkoutFingerprint(input,id,20,'USD')
  expect(checkoutFingerprint({...input,phone:'+263771234567'},id,20,'USD')).toBe(fp)
  expect(checkoutFingerprint({...input,phone:'263771234567'},id,20,'USD')).toBe(fp)
  expect(checkoutFingerprint({...input,phone:'0779999999'},id,20,'USD')).not.toBe(fp)
 })
 it('preserves cancelled and verification statuses instead of claiming refunds',()=>{
  for(const status of ['cancelled','awaiting_verification','completed','refunded'] as const) expect(buyerOrderStatus(status)).toBe(status)
  expect(buyerOrderStatus('unexpected')).toBe('unknown')
 })
 it('requires a signed, unexpired recovery token',()=>{
  vi.stubEnv('AUTH_SECRET','test-order-recovery-secret')
  const now=1000000,token=createOrderRecoveryToken('BUYER@example.com',now)
  expect(verifyOrderRecoveryToken(token,now)).toBe('buyer@example.com')
  expect(verifyOrderRecoveryToken('buyer@example.com',now)).toBeNull()
  expect(verifyOrderRecoveryToken(token,now+15*60000)).toBeNull()
  expect(verifyOrderRecoveryToken(token.slice(0,-1)+'x',now)).toBeNull()
  vi.stubEnv('AUTH_SECRET','rotated-secret')
  expect(verifyOrderRecoveryToken(token,now)).toBeNull()
 })
})
