import './PeriodNavigator.css';

type PeriodNavigatorProps = {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  previousDisabled?: boolean;
  /** Describes the unit, e.g. "week" or "month". Used for accessible names. */
  unit?: string;
};

export function PeriodNavigator({
  label,
  onPrevious,
  onNext,
  nextDisabled = false,
  previousDisabled = false,
  unit = 'period',
}: PeriodNavigatorProps) {
  return (
    <div className="period-navigator" role="group" aria-label={`${unit} navigation`}>
      <button
        type="button"
        className="period-navigator__button"
        onClick={onPrevious}
        disabled={previousDisabled}
        aria-label={`Previous ${unit}`}
      >
        <span aria-hidden="true">&lsaquo;</span>
      </button>
      <span className="period-navigator__label" aria-live="polite">
        {label}
      </span>
      <button
        type="button"
        className="period-navigator__button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={`Next ${unit}`}
      >
        <span aria-hidden="true">&rsaquo;</span>
      </button>
    </div>
  );
}
