import './MobileTaskAction.css';

type MobileTaskActionProps = {
  label: string;
  form?: string;
  disabled?: boolean;
  onClick?: () => void;
};

export default function MobileTaskAction({ label, form, disabled = false, onClick }: MobileTaskActionProps) {
  return (
    <div className="mobile-task-action">
      <button
        className="mobile-task-action__button"
        type={form ? 'submit' : 'button'}
        form={form}
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </button>
    </div>
  );
}
