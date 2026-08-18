import { useEffect, useState } from 'react';
import { useInView } from '../hooks/useInView.js';

export default function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }) {
  const { ref, isInView } = useInView();
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (!window.matchMedia) return;
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  return (
    <Tag
      ref={ref}
      className={`oh-reveal${isInView || reduce ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
