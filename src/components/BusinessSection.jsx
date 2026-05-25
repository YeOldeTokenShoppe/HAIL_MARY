"use client";

import React, { useRef } from "react";
import dynamic from "next/dynamic";
import { useInView } from "framer-motion";
import DropInTitle from "./DropInTitle";
import "./BusinessSection.css";

const NoiseSphere = dynamic(() => import("./NoiseSphere"), { ssr: false });

export default function BusinessSection() {
  const ref = useRef(null);
  const inView = useInView(ref, {
    amount: 0.15,
    margin: "120px 0px",
    once: true,
  });

  return (
    <section
      ref={ref}
      className={`biz-section${inView ? " is-revealed" : ""}`}
      aria-label="A Rather Unusual Opportun80"
    >
      <div className="biz-visual">
        <NoiseSphere className="biz-goop" />
      </div>

      <div className="biz-text">
        <DropInTitle
          lines={["Stake", "Your", "Claim!"]}
          colors={["#2ad6ee", "#d4af37", "#d92db0"]}
          fontSize={{ mobile: "2rem", desktop: "3.4rem" }}
          triggerAnimation={inView}
          instanceId="biz-heading"
        />

        <div className="biz-body">
          <p>
            Most tokens promise you the future. This one promises you a prayer.
            The returns are spiritual. The losses, tax-deductible in certain
            jurisdictions of the soul.
          </p>

          <p>
            RL80 is not financial advice. It is not even financial. It is a
            votive offering minted on Base, traded on faith, and governed by
            nothing except the immutable conviction that the line must go up —
            because the bots said so.
          </p>

          <p>
            There is no roadmap. There is only the road. And on that road, a
            procession of monks, machines, and market makers — all walking
            toward the same impossible coordinate on the chart.
          </p>
        </div>
      </div>
    </section>
  );
}
