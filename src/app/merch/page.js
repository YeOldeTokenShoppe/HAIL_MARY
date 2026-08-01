"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./merch.module.css";

const PRODUCTS = [
  {
    id: "votive",
    shopifyHandle: "our-lady-votive-candle",
    category: "WAX / DEVOTION",
    name: "Our Lady Votive",
    price: 24,
    image: "/images/votiveCandlePreview.webp",
    imageAlt: "Green Our Lady devotional candle",
    description:
      "An eight-inch devotional candle for long positions, lost causes, and late-night chart watching.",
    details: ["8 in prayer candle", "Approx. 80 hr burn", "Printed glass"],
    options: ["Terminal Green", "Oxblood", "Midnight"],
    badge: "FIRST EDITION",
  },
  {
    id: "stickers",
    shopifyHandle: "terminal-indulgences-sticker-pack",
    category: "VINYL / SIGNAL",
    name: "Terminal Indulgences",
    price: 12,
    description:
      "A six-piece set of waterproof marks pulled from the HAIL_MARY visual archive.",
    details: ["6 die-cut stickers", "Weatherproof vinyl", "2–3.5 in"],
    badge: "PACK OF 6",
  },
  {
    id: "coin",
    shopifyHandle: "rl80-commemorative-coin",
    category: "METAL / RELIC",
    name: "The RL80 Strike",
    price: 48,
    image: "/images/coinFront1.png",
    imageAlt: "RL80 commemorative coin concept",
    description:
      "A commissioned challenge coin struck for the faithful. Individually numbered and minted once.",
    details: ["44 mm diameter", "Antiqued brass", "Edition of 80"],
    badge: "PRE-ORDER",
    preorder: true,
  },
];

const shopifyDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function StickerArtwork() {
  return (
    <div className={styles.stickerStage} aria-label="Sticker pack artwork preview">
      <div className={`${styles.sticker} ${styles.stickerMary}`}>
        <Image src="/images/maryWoodcut.webp" alt="" fill sizes="180px" />
      </div>
      <div className={`${styles.sticker} ${styles.stickerMark}`}>
        <Image src="/icon80.svg" alt="" fill sizes="130px" />
      </div>
      <div className={`${styles.sticker} ${styles.stickerFlame}`}>
        <Image src="/images/flame.svg" alt="" fill sizes="100px" />
      </div>
      <div className={`${styles.sticker} ${styles.stickerTattoo}`}>
        <Image src="/images/RL80_TATTOO.png" alt="" fill sizes="140px" />
      </div>
    </div>
  );
}

function ProductArt({ product }) {
  if (product.id === "stickers") return <StickerArtwork />;

  if (product.id === "coin") {
    return (
      <div className={styles.coinCardArt}>
        <div className={styles.coinCardFace}>
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            sizes="(max-width: 760px) 72vw, 340px"
          />
        </div>
        <span className={styles.coinEdition}>80 / 80</span>
      </div>
    );
  }

  return (
    <div className={styles.candleArt}>
      <span className={styles.candleAura} />
      <Image
        src={product.image}
        alt={product.imageAlt}
        fill
        sizes="(max-width: 760px) 60vw, 280px"
        priority
      />
    </div>
  );
}

function ProductCard({ product, onAdd }) {
  const [selectedOption, setSelectedOption] = useState(product.options?.[0] ?? null);

  return (
    <article className={styles.productCard}>
      <div className={styles.productVisual}>
        <span className={styles.productBadge}>{product.badge}</span>
        <ProductArt product={product} />
      </div>

      <div className={styles.productInfo}>
        <div className={styles.productKicker}>
          <span>{product.category}</span>
          <span>{product.id.toUpperCase().padStart(8, "0")}</span>
        </div>
        <h3>{product.name}</h3>
        <p className={styles.productDescription}>{product.description}</p>

        <ul className={styles.productDetails}>
          {product.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>

        {product.options && (
          <fieldset className={styles.variants}>
            <legend>Glass color</legend>
            <div>
              {product.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={selectedOption === option ? styles.variantActive : ""}
                  aria-pressed={selectedOption === option}
                  onClick={() => setSelectedOption(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div className={styles.productAction}>
          <span className={styles.price}>{formatPrice(product.price)}</span>
          <button
            type="button"
            onClick={() => onAdd(product, selectedOption)}
            aria-label={`${product.preorder ? "Reserve" : "Add"} ${product.name}`}
          >
            {product.preorder ? "Reserve edition" : "Add to bag"}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export default function MerchPage() {
  const [bag, setBag] = useState([]);
  const [notice, setNotice] = useState("");
  const itemCount = useMemo(
    () => bag.reduce((total, item) => total + item.quantity, 0),
    [bag],
  );

  function addToBag(product, option) {
    setBag((current) => {
      const key = `${product.id}-${option ?? "default"}`;
      const existing = current.find((item) => item.key === key);
      if (existing) {
        return current.map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, { key, product, option, quantity: 1 }];
    });

    setNotice(
      shopifyDomain
        ? `${product.name} added. Shopify checkout is ready for variant IDs.`
        : `${product.name} added to the demo bag. Connect Shopify to enable checkout.`,
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="Return to HAIL_MARY">
          <span>RL80</span>
          <small>OUR LADY OF PERPETUAL PROFIT</small>
        </Link>

        <nav aria-label="Merch navigation">
          <a href="#offerings">Offerings</a>
          <a href="#coin">The strike</a>
          <span className={styles.liveStatus}>
            <i aria-hidden="true" /> Drop 001
          </span>
          <button
            type="button"
            className={styles.bagButton}
            onClick={() =>
              setNotice(
                itemCount
                  ? `${itemCount} item${itemCount === 1 ? "" : "s"} in the demo bag. Shopify checkout will open here once connected.`
                  : "The offering bag is empty.",
              )
            }
          >
            Bag <span>{String(itemCount).padStart(2, "0")}</span>
          </button>
        </nav>
      </header>

      <nav className={styles.sideRail} aria-label="Quick merch links">
        <a href="#offerings"><span />Offerings</a>
        <a href="#coin"><span />Strike</a>
        <Link href="/"><span />Exit</Link>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>HAIL_MARY PHYSICAL ARCHIVE · DROP 001</p>
          <h1>
            Relics for the
            <span>terminal age.</span>
          </h1>
          <p className={styles.heroText}>
            Votive wax, vinyl signals, and one commissioned strike. Objects for
            holding onto while everything else moves.
          </p>
          <a className={styles.heroLink} href="#offerings">
            View the offering table <span aria-hidden="true">↓</span>
          </a>
        </div>

        <div className={styles.heroRelic} aria-label="Featured RL80 commemorative coin">
          <span className={styles.orbitText}>MATER EX MACHINA · RL80 · MMXXVI ·</span>
          <div className={styles.coin}>
            <div className={styles.coinInner}>
              <div className={styles.coinFront}>
                <Image
                  src="/images/coinFront1.png"
                  alt="Front concept for the RL80 commemorative coin"
                  fill
                  priority
                  sizes="(max-width: 760px) 78vw, 520px"
                />
              </div>
              <div className={styles.coinBack}>
                <Image
                  src="/images/coinBack1.png"
                  alt="Back concept for the RL80 commemorative coin"
                  fill
                  sizes="(max-width: 760px) 78vw, 520px"
                />
              </div>
            </div>
          </div>
          <p>
            <span>FEATURED RELIC</span>
            Commission in progress · edition of 80
          </p>
        </div>
      </section>

      <div className={styles.signalBand} aria-hidden="true">
        <div>
          {Array.from({ length: 2 }).map((_, index) => (
            <span key={index}>
              WAX ✦ VINYL ✦ STRUCK METAL ✦ PHYSICAL GOODS ✦ SECURE CHECKOUT VIA
              SHOPIFY ✦&nbsp;
            </span>
          ))}
        </div>
      </div>

      <section className={styles.offerings} id="offerings">
        <div className={styles.sectionHeading}>
          <div>
            <p>THE OFFERING TABLE</p>
            <h2>Three objects. One small edition.</h2>
          </div>
          <p>
            First-run pieces from the world of Our Lady of Perpetual Profit.
            Prices and specifications are realistic placeholders until production
            quotes and Shopify variants are final.
          </p>
        </div>

        <div className={styles.productGrid}>
          {PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={addToBag} />
          ))}
        </div>
      </section>

      <section className={styles.strike} id="coin">
        <div className={styles.strikeArt}>
          <span className={styles.strikeNumber}>80</span>
          <Image
            src="/images/coinBack1.png"
            alt="Back of the commissioned RL80 coin concept"
            fill
            sizes="(max-width: 760px) 90vw, 50vw"
          />
        </div>
        <div className={styles.strikeCopy}>
          <p className={styles.eyebrow}>COMMISSION NOTES / 001</p>
          <h2>A relic with weight.</h2>
          <p>
            The commemorative strike is planned as a 44 mm antiqued-brass coin,
            numbered by hand and presented in a black archive sleeve. Final metal,
            edge treatment, and ship date will be confirmed after the commission
            is approved.
          </p>
          <dl>
            <div>
              <dt>Edition</dt>
              <dd>80 numbered pieces</dd>
            </div>
            <div>
              <dt>Material</dt>
              <dd>Antiqued brass</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Commissioning</dd>
            </div>
          </dl>
          <button type="button" onClick={() => addToBag(PRODUCTS[2], null)}>
            Reserve the strike · {formatPrice(PRODUCTS[2].price)}
          </button>
        </div>
      </section>

      <section className={styles.fulfillment}>
        <div>
          <span>01</span>
          <h3>Small-batch production</h3>
          <p>Made in finite runs. Restock notices will be posted before each release.</p>
        </div>
        <div>
          <span>02</span>
          <h3>Shopify checkout</h3>
          <p>Inventory, tax, shipping, and payment will be handled through Shopify.</p>
        </div>
        <div>
          <span>03</span>
          <h3>Worldwide intent</h3>
          <p>Initial rates shown at checkout once packaging weights are confirmed.</p>
        </div>
      </section>

      <footer className={styles.footer}>
        <div>
          <span className={styles.footerMark}>RL80</span>
          <p>Physical artifacts from Our Lady of Perpetual Profit.</p>
        </div>
        <Link href="/">Return to the cathedral ↗</Link>
        <p>© MMXXVI · HAIL_MARY</p>
      </footer>

      {notice && (
        <div className={styles.notice} role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </main>
  );
}
