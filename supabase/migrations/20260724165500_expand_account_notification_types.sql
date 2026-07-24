begin;

alter table public.lc_account_notifications
  drop constraint if exists lc_account_notifications_type_check;

alter table public.lc_account_notifications
  add constraint lc_account_notifications_type_check
  check (type in (
    'restriction_started',
    'restriction_changed',
    'restriction_lifted',
    'restriction_expired',
    'appeal_submitted',
    'appeal_needs_info',
    'appeal_approved',
    'appeal_rejected',
    'provider_inquiry_received',
    'commission_application_received',
    'site_message_resolved',
    'service_payment_succeeded'
  ));

comment on constraint lc_account_notifications_type_check on public.lc_account_notifications is
  'Account, private business, feedback and verified payment notification types emitted by the application.';

commit;
