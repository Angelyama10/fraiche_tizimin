'use client';

import { motion, useReducedMotion } from 'motion/react';

export function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.992 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 86, damping: 18, mass: 0.72, delay }}
      viewport={{ once: true, amount: 0.16 }}
    >
      {children}
    </motion.div>
  );
}
