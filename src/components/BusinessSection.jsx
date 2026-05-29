"use client";

import React, { useRef } from "react";
import { useInView } from "framer-motion";
import DropInTitle from "./DropInTitle";
import "./BusinessSection.css";

export default function BusinessSection() {
  const ref = useRef(null);
  const inView = useInView(ref, {
    amount: 0.01,
    margin: "200px 0px",
  });

  return (
    <section
      ref={ref}
      className={`biz-section${inView ? " is-revealed" : ""}`}
      aria-label="A Rather Unusual Opportun80"
    >
      <div className="biz-visual" style={{ position: "relative", marginTop: "2rem" }}>
        <span className="biz-filigree-tl" aria-hidden="true">&#x2766;</span>
        <span className="biz-filigree-tr" aria-hidden="true">&#x2766;</span>
        <span className="biz-filigree-bl" aria-hidden="true">&#x2766;</span>
        <span className="biz-filigree-br" aria-hidden="true">&#x2766;</span>
        <img
          src="/carousel_images/img12.jpg"
          alt=""
          className="biz-image"
        />
      </div>

      <div className="biz-text">
        <DropInTitle
          lines={["Witness", "the halo", "effect"]}
          colors={["#2ad6ee", "#d4af37", "#d92db0"]}
          fontSize={{ mobile: "2rem", desktop: "3.4rem" }}
          triggerAnimation={inView}
          instanceId="biz-heading"
        />

        <div className="biz-body" style={{ marginTop: "1.5rem" }}>
          <p>
            <strong>Coming Soon</strong> — Enjoy the reflected glory of Our Lady with 
            tiered access to site services when you hold RL80 tokens.
          </p>

          {/* <p><strong>How it works:</strong></p> */}

          {/* <p>
            RL80 patrons pay USDC for a service or asset. USDC arrives at the
            RevenueRouter contract. The Router splits it: 30% to stakers, 70%
            to operations. The Router has no override. The split has no setter.
            The destination addresses are immutable.
          </p>

          <p>
            Verify on Basescan. The wallet is public. The code is public. The
            flow is auditable by anyone.
          </p> */}
        </div>
      </div>
    </section>
  );
}
