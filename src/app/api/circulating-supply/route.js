import { tokenFunctions } from '@/lib/contract'
import { stakingFunctions } from '@/lib/stakingContract'

let cache = { value: null, ts: 0 }
const CACHE_TTL = 5 * 60_000 // 5 minutes

export async function GET() {
  const now = Date.now()
  if (cache.value && now - cache.ts < CACHE_TTL) {
    return new Response(cache.value, {
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  try {
    const [totalSupplyRaw, totalStakedRaw] = await Promise.all([
      tokenFunctions.getTotalSupply(),
      stakingFunctions.getTotalStaked(),
    ])

    const totalSupply = totalSupplyRaw / BigInt(10 ** 18)
    const totalStaked = BigInt(totalStakedRaw) / BigInt(10 ** 18)
    const circulating = (totalSupply - totalStaked).toString()

    cache = { value: circulating, ts: now }
    return new Response(circulating, {
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (err) {
    console.error('circulating-supply error:', err)
    return new Response(cache.value || '80000000000', {
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}
