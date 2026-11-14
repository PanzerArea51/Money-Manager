import type { ReactNode } from 'react';
import './Card.css';

type CardProps = {
  children: ReactNode;
  onClick?: () => void;
};

export function Card({ children, onClick }: CardProps) {
  if (onClick) {
    return (
      <button type="button" className="card card--clickable" onClick={onClick}>
        {children}
      </button>
    );
  }
  return <div className="card">{children}</div>;
}
