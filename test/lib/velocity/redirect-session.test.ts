import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTransactionRedirectUrl } from '@/services/velocity'
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})
describe('existing Velocity hosted session recovery',()=>{
 it.each(['https://payments.example.test/pay', {body:{redirectUrl:'https://payments.example.test/pay'}}])('recovers a documented session with one GET and no transaction creation',async payload=>{
  vi.stubEnv('VELOCITY_API_KEY','test-only-key');vi.stubEnv('VELOCITY_BASE_URL','https://provider.example.test')
  const fetch=vi.fn().mockResolvedValue({ok:true,text:async()=>JSON.stringify(payload)})
  vi.stubGlobal('fetch',fetch)
  expect(await getTransactionRedirectUrl('session/a')).toBe('https://payments.example.test/pay')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('https://provider.example.test/transactions/public/redirect-url/session%2Fa',expect.objectContaining({method:'GET',cache:'no-store'}))
 })
 it.each(['http://unsafe.example.test','javascript:alert(1)','https://user:password@example.test/pay'])('rejects unsafe redirect %s',async payload=>{
  vi.stubEnv('VELOCITY_API_KEY','test-only-key');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,text:async()=>JSON.stringify(payload)}))
  expect(await getTransactionRedirectUrl('session')).toBeNull()
 })
})
