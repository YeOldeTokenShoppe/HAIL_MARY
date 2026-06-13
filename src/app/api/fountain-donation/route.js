// app/api/fountain-donation/route.js
//
// Logs a fountain donation (charity or dev tip) to the public
// `fountain_donations` feed — the toasts and the "Total Given" counter
// in fountain.html read from it. That collection is `write: if false`
// for clients, so this route is its ONLY writer (admin SDK), and it
// only writes what it can verify on-chain: donor, recipient, amount,
// and currency all come from the receipt. Same trust model as
// /api/burn-offering — with ONE deliberate exception: the optional
// `wish` (a public one-liner attached to the golden coin). It can't be
// chain-verified, so it's sanitized to short plain text here and must
// be HTML-escaped by every renderer. First POST per tx hash wins
// (create() idempotency), so attaching a wish to someone ELSE'S
// donation requires beating the donor's own immediate POST.
//
// Verifies either form a donation can take:
//   - USDC: an ERC-20 Transfer to a known recipient wallet
//   - ETH:  a native send to a known recipient wallet
// Recipients = CHARITY_WALLETS + DEV_WALLET from lib/contracts.js.
//
// Doc id = tx hash, created with create() — natural idempotency, so a
// client retry can't double-count the counter or re-toast.

import { NextResponse } from 'next/server';
import { erc20Abi, parseEventLogs, formatUnits } from 'viem';
import { publicClient } from '@/lib/viemClient';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { CHARITY_WALLETS, DEV_WALLET, USDC_ADDRESS } from '@/lib/contracts';

// Older transfers can't be resurrected as brand-new toasts.
const MAX_DONATION_AGE_MS = 2 * 60 * 60 * 1000;

// address (lowercase) → { key, name } for every wallet the fountain
// gives to.
const RECIPIENTS = (() => {
  const map = {};
  for (const [key, c] of Object.entries(CHARITY_WALLETS)) {
    map[c.address.toLowerCase()] = { key, name: c.name };
  }
  map[DEV_WALLET.address.toLowerCase()] = { key: 'DEV', name: DEV_WALLET.name };
  return map;
})();

export async function POST(request) {
  try {
    const { txHash, wish: rawWish, donorName: rawName } = await request.json();

    if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: 'invalid-tx-hash' }, { status: 400 });
    }
    const hash = txHash.toLowerCase();

    // Sanitize the wish down to one short line of plain text: strip
    // control/zero-width/bidi characters, collapse whitespace, cap at 80.
    let wish = null;
    if (typeof rawWish === 'string') {
      const cleaned = rawWish
        .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\ufeff]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
      if (cleaned) wish = cleaned;
    }

    // Same treatment for the optional self-claimed donor name (shorter cap).
    // Like `wish`, this is client-supplied and NOT chain-verified, so it is
    // sanitized to short plain text here and MUST be HTML-escaped on render.
    let donorName = null;
    if (typeof rawName === 'string') {
      const cleaned = rawName
        .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\ufeff]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 24);
      if (cleaned) donorName = cleaned;
    }

    let receipt;
    try {
      receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 90_000,
      });
    } catch (err) {
      return NextResponse.json(
        { error: 'tx-not-confirmed', retryable: true, message: err.message },
        { status: 504 },
      );
    }

    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'tx-reverted' }, { status: 400 });
    }

    // Identify the donation. USDC first (has logs), else a native ETH
    // send (no logs — read the transaction itself).
    let donor;
    let recipient;
    let recipientAddress;
    let currency;
    let amountWei;
    let amount;

    const usdcTransfers = parseEventLogs({
      abi: erc20Abi,
      logs: receipt.logs,
      eventName: 'Transfer',
    }).filter(
      (log) =>
        log.address.toLowerCase() === USDC_ADDRESS.toLowerCase() &&
        RECIPIENTS[log.args.to.toLowerCase()],
    );

    if (usdcTransfers.length > 0) {
      const first = usdcTransfers[0];
      donor = first.args.from.toLowerCase();
      recipientAddress = first.args.to.toLowerCase();
      recipient = RECIPIENTS[recipientAddress];
      currency = 'USDC';
      amountWei = usdcTransfers
        .filter((l) => l.args.to.toLowerCase() === recipientAddress)
        .reduce((sum, l) => sum + l.args.value, 0n);
      amount = Number(formatUnits(amountWei, 6));
    } else {
      const tx = await publicClient.getTransaction({ hash });
      const to = tx.to?.toLowerCase();
      if (!to || !RECIPIENTS[to] || tx.value <= 0n) {
        return NextResponse.json(
          { error: 'not-a-fountain-donation' },
          { status: 400 },
        );
      }
      donor = tx.from.toLowerCase();
      recipientAddress = to;
      recipient = RECIPIENTS[to];
      currency = 'ETH';
      amountWei = tx.value;
      amount = Number(formatUnits(amountWei, 18));
    }

    if (!(amount > 0)) {
      return NextResponse.json({ error: 'zero-amount' }, { status: 400 });
    }

    const block = await publicClient.getBlock({
      blockNumber: receipt.blockNumber,
    });
    const donatedAtMs = Number(block.timestamp) * 1000;
    if (Date.now() - donatedAtMs > MAX_DONATION_AGE_MS) {
      return NextResponse.json({ error: 'donation-too-old' }, { status: 400 });
    }

    // Dollar value, server-side (the client's word on price isn't
    // trusted): USDC at face value, ETH via Coinbase spot. Best-effort —
    // null just drops the ETH donation from the $ counter.
    let usdValue = currency === 'USDC' ? amount : null;
    if (currency === 'ETH') {
      try {
        const res = await fetch(
          'https://api.coinbase.com/v2/prices/ETH-USD/spot',
        );
        const spot = parseFloat((await res.json())?.data?.amount);
        if (Number.isFinite(spot)) usdValue = amount * spot;
      } catch {
        // keep null
      }
    }

    const adb = getAdminDb();
    if (!adb) {
      return NextResponse.json(
        { error: 'firestore-unavailable' },
        { status: 503 },
      );
    }

    // `userName` derives from the chain, not client input — no injection
    // surface (same posture as the VigilTicker displayName pattern). The
    // optional `donorName` above IS client-supplied (sanitized, unverified),
    // so renderers must escape it and pair it with this verified address.
    const shortDonor = `${donor.slice(0, 6)}...${donor.slice(-4)}`;

    try {
      await adb.collection('fountain_donations').doc(hash).create({
        donor,
        userId: donor,
        userName: shortDonor,
        donorName,
        userAvatar: null,
        charity: recipient.key,
        charityName: recipient.name,
        charityAddress: recipientAddress,
        amount: String(amount),
        currency,
        usdValue,
        wish,
        amountWei: amountWei.toString(),
        txHash: hash,
        timestamp: FieldValue.serverTimestamp(),
        donatedAtChainMs: donatedAtMs,
        network: 'base',
      });
    } catch (err) {
      if (err.code === 6 || /already exists/i.test(err.message || '')) {
        return NextResponse.json({ success: true, alreadyLogged: true });
      }
      throw err;
    }

    return NextResponse.json({
      success: true,
      charity: recipient.key,
      amount,
      currency,
      usdValue,
    });
  } catch (error) {
    console.error('[fountain-donation] error:', error);
    return NextResponse.json(
      { error: 'log-failed', retryable: true, message: error.message },
      { status: 500 },
    );
  }
}
