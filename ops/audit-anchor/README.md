# Jumulu audit-root anchor

This job signs every completed `lc_audit_daily_roots` row that has not been
anchored yet with a root-only RSA-3072 private key. When there is no backlog it
re-verifies the latest anchor. Each payload and signature is stored locally,
uploaded to COS, downloaded again, and verified.

Before signing, the job reloads the day's ordered chain entries and recomputes
the root hash. A mismatch in the root, count, first hash, or last hash stops the
job and leaves the existing anchor untouched.

The private key must only exist at:

`/srv/secrets/jumulu-audit-anchor/private.pem`

The public key is versioned in this repository and installed at:

`/srv/ops/jumulu-audit-anchor/public.pem`

The uploader refuses to overwrite a different object for an already anchored
date. COS credentials are currently shared with the encrypted backup channel;
use a separate write-once CAM role or COS object-lock policy when available.
