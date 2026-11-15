import './FloatingActionButton.css';

type FloatingActionButtonProps = {
  label: string;
  onClick: () => void;
};

export function FloatingActionButton({ label, onClick }: FloatingActionButtonProps) {
  return (
    <button type="button" className="fab" aria-label={label} onClick={onClick}>
      <span aria-hidden="true">+</span>
    </button>
  );
}
