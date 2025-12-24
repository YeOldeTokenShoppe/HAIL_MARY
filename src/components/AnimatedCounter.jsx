'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';

export default function AnimatedCounter({ target, suffix = '', prefix = '', duration = 2 }) {
  const [count, setCount] = useState(0);
  const countRef = useRef(null);
  const isInView = useInView(countRef, { once: true });
  
  useEffect(() => {
    if (!isInView) return;
    
    let startTime;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(easeOutQuart * target);
      
      setCount(currentCount);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isInView, target, duration]);
  
  return (
    <span ref={countRef}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}