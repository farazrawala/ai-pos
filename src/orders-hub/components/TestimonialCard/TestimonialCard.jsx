import { Quote } from 'lucide-react';

export default function TestimonialCard({ quote, name, role }) {
  return (
    <blockquote className="oh-quote-card">
      <Quote size={20} aria-hidden="true" />
      <p>{quote}</p>
      <footer>
        <strong>{name}</strong>
        <span>{role}</span>
      </footer>
    </blockquote>
  );
}
