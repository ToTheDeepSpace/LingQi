import { useState } from 'react';
import ReportModal, { type ReportTargetType } from './ReportModal';
import { readStoredCreatorAuth } from '../lib/authSession';

export default function ReportFlagButton({
  targetType,
  targetId,
  targetTitle,
  targetSubId,
  ownerId,
  own = false,
}: {
  targetType: ReportTargetType;
  targetId: string;
  targetTitle: string;
  targetSubId?: string;
  ownerId?: string | null;
  own?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const auth = readStoredCreatorAuth();
  if (own || (ownerId && ownerId === auth?.id)) return null;

  const showReport = () => {
    if (!auth?.token) {
      const redirect = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        aria-label="举报这条内容"
        title="举报"
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          showReport();
        }}
        style={{
          display: 'inline-grid',
          width: 28,
          minWidth: 28,
          height: 28,
          padding: 0,
          placeItems: 'center',
          border: 0,
          borderRadius: 6,
          background: 'transparent',
          color: 'rgba(71,85,105,0.72)',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ⚑
      </button>
      {open && (
        <ReportModal
          targetType={targetType}
          targetId={targetId}
          targetTitle={targetTitle}
          targetSubId={targetSubId}
          authToken={auth?.token || ''}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
