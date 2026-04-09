import { erc20Abi } from 'viem'
import { publicClient } from '@/lib/viemClient'
import { RL80_ADDRESS } from '@/lib/contracts'

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
    const raw = await publicClient.readContract({
      address: RL80_ADDRESS,
      abi: erc20Abi,
      functionName: 'totalSupply',
    })
    const supply = (raw / BigInt(10 ** 18)).toString()
    cache = { value: supply, ts: now }
    return new Response(supply, {
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (err) {
    console.error('total-supply error:', err)
    return new Response(cache.value || '80000000000', {
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}
