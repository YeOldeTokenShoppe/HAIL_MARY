"use client";

import React, { useState } from 'react';
import CollectibleCard from '@/components/CollectibleCard';
import Link from 'next/link';

// Sample collectibles to showcase different rarities
const SAMPLE_COLLECTIBLES = [
  {
    prizeName: 'Trade Life RL80',
    prizeDescription: 'Our Lady of Perpetual Profit',
    prizeImage: '/images/maryToy.webp',
    prizeModelPath: '/models/Collectible1.glb',
    prizeVideoSrc: '/videos/neon80s.mp4',
    weekIdentifier: '2026-W05',
    editionNumber: 1,
    maxEditions: 100,
    mintedAt: { toDate: () => new Date('2026-01-27') },
    accentColor: '#f6e05e',
  },
  {
    prizeName: 'Trade Life RL80',
    prizeDescription: 'Our Lady of Tech',
    prizeImage: '/images/maryToy.webp',
    prizeModelPath: '/models/Collectible1.glb',
    weekIdentifier: '2026-W05',
    editionNumber: 7,
    maxEditions: 100,
    mintedAt: { toDate: () => new Date('2026-01-28') },
    accentColor: '#9f7aea',
  },
  {
    prizeName: 'Trade Life RL80',
    prizeDescription: 'Our Lady of Tech',
    prizeImage: '/images/maryToy.webp',
    prizeModelPath: '/models/Collectible1.glb',
    weekIdentifier: '2026-W05',
    editionNumber: 23,
    maxEditions: 100,
    mintedAt: { toDate: () => new Date('2026-01-29') },
    accentColor: '#3182ce',
  },
  {
    prizeName: 'Trade Life RL80',
    prizeDescription: 'Our Lady of Tech',
    prizeImage: '/images/maryToy.webp',
    prizeModelPath: '/models/Collectible1.glb',
    prizeVideoSrc: '/videos/stockChart.mp4',
    weekIdentifier: '2026-W05',
    editionNumber: 69,
    maxEditions: 100,
    mintedAt: { toDate: () => new Date('2026-01-30') },
    accentColor: '#9f7aea',
  },
  {
    prizeName: 'Trade Life RL80',
    prizeDescription: 'Our Lady of Tech',
    prizeImage: '/images/maryToy.webp',
    prizeModelPath: '/models/Collectible1.glb',
    prizeVideoSrc: '/videos/circuit1.mp4',
    weekIdentifier: '2026-W05',
    editionNumber: 80,
    maxEditions: 100,
    mintedAt: { toDate: () => new Date('2026-01-30') },
    accentColor: '#9f7aea',
  },
  {
    prizeName: 'Trade Life RL80',
    prizeDescription: 'Our Lady of Tech',
    prizeImage: '/images/maryToy.webp',
    prizeModelPath: '/models/Collectible1.glb',
    weekIdentifier: '2026-W05',
    editionNumber: 50,
    maxEditions: 100,
    mintedAt: { toDate: () => new Date('2026-01-31') },
    accentColor: '#00f5d4',
  },
  {
    prizeName: 'Trade Life RL80',
    prizeDescription: 'Our Lady of Tech',
    prizeImage: '/images/maryToy.webp',
    prizeModelPath: '/models/Collectible1.glb',
    weekIdentifier: '2026-W05',
    editionNumber: 100,
    maxEditions: 100,
    mintedAt: { toDate: () => new Date('2026-02-01') },
    accentColor: '#f6e05e',
  },
];

export default function CollectiblePreviewPage() {
  const [selectedCard, setSelectedCard] = useState(null);

  return (
    <div style={{
      backgroundColor: '#0a0a0a',
      minHeight: '100vh',
      padding: '40px 20px',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '40px',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <h1 style={{
            fontFamily: "'UnifrakturMaguntia', serif",
            fontSize: '3rem',
            color: '#fff',
            margin: '0 0 10px 0',
            cursor: 'pointer',
          }}>
            RL80
          </h1>
        </Link>
        <h2 style={{
          fontFamily: "'Bangers', cursive",
          fontSize: '2rem',
          background: 'linear-gradient(90deg, #00f5d4, #00d9ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 10px 0',
        }}>
          NFT Collectible Cards Preview
        </h2>
        <p style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.9rem',
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          Preview of different rarity tiers based on edition number.
          #1 and #100 are Legendary, #2-10 are Epic (Early Adopter),
          #69 and #80 are special Epic editions.
        </p>
      </div>

      {/* Rarity Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        marginBottom: '40px',
        flexWrap: 'wrap',
      }}>
        {[
          { label: 'Legendary', color: '#f6e05e', editions: '#1, #100' },
          { label: 'Epic', color: '#9f7aea', editions: '#2-10, #69, #80' },
          { label: 'Rare', color: '#3182ce', editions: '#11-25' },
          { label: 'Standard', color: '#4a5568', editions: '#26-99' },
        ].map(tier => (
          <div key={tier.label} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '20px',
            border: `1px solid ${tier.color}40`,
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: tier.color,
              boxShadow: `0 0 10px ${tier.color}`,
            }} />
            <span style={{ color: tier.color, fontWeight: 600, fontSize: '0.8rem' }}>
              {tier.label}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>
              ({tier.editions})
            </span>
          </div>
        ))}
      </div>

      {/* Cards Grid */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '30px',
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        {SAMPLE_COLLECTIBLES.map((collectible, index) => (
          <CollectibleCard
            key={index}
            {...collectible}
            isActive={selectedCard === index}
            onClick={() => setSelectedCard(selectedCard === index ? null : index)}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        marginTop: '60px',
        padding: '20px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <p style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '0.8rem',
        }}>
          These cards will be minted as ERC-721 NFTs on Base.
          Each edition number creates a unique collectible with its own rarity tier.
        </p>
        <Link
          href="/gachapon"
          style={{
            display: 'inline-block',
            marginTop: '20px',
            padding: '12px 24px',
            background: 'linear-gradient(90deg, #00f5d4, #00d9ff)',
            color: '#000',
            fontWeight: 700,
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '0.9rem',
          }}
        >
          Go to Gachapon Machine
        </Link>
      </div>
    </div>
  );
}
