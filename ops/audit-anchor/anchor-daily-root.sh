#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

DATABASE="${AUDIT_ANCHOR_DATABASE:-lingqi_prod_candidate}"
STATE_DIR="${AUDIT_ANCHOR_STATE_DIR:-/var/lib/jumulu-audit-anchor}"
PRIVATE_KEY="${AUDIT_ANCHOR_PRIVATE_KEY:-/srv/secrets/jumulu-audit-anchor/private.pem}"
PUBLIC_KEY="${AUDIT_ANCHOR_PUBLIC_KEY:-/srv/ops/jumulu-audit-anchor/public.pem}"
COS_SECRET_FILE="${COS_SECRET_FILE:-/srv/secrets/jusichen_cos_upload.env}"
COS_UPLOADER="${COS_UPLOADER:-/srv/ops/postgres-backup/cos-object.mjs}"
COS_BASE="${AUDIT_ANCHOR_COS_BASE:-system-audit-anchors/jumulu/v1}"

for required_file in "$PRIVATE_KEY" "$PUBLIC_KEY" "$COS_SECRET_FILE" "$COS_UPLOADER"; do
  if [[ ! -r "$required_file" ]]; then
    echo "audit-anchor: required file is missing: $required_file" >&2
    exit 1
  fi
done

install -d -m 700 "$STATE_DIR" "$STATE_DIR/anchors"

if [[ -z "${AUDIT_ANCHOR_DATE:-}" ]]; then
  mapfile -t completed_dates < <(runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$DATABASE" -At -c \
    "select audit_date::text
       from lc_audit_daily_roots
      where audit_date <= ((now() at time zone 'utc')::date - 1)
      order by audit_date")
  if (( ${#completed_dates[@]} == 0 )); then
    echo "audit-anchor: no completed daily root is available"
    exit 0
  fi

  dates_to_anchor=()
  for completed_date in "${completed_dates[@]}"; do
    completed_year="${completed_date:0:4}"
    completed_month="${completed_date:5:2}"
    completed_file="$STATE_DIR/anchors/$completed_year/$completed_month/jumulu-audit-root-$completed_date.json"
    if [[ ! -s "$completed_file" || ! -s "$completed_file.sig" ]]; then
      dates_to_anchor+=("$completed_date")
    fi
  done
  if (( ${#dates_to_anchor[@]} == 0 )); then
    dates_to_anchor+=("${completed_dates[-1]}")
  fi
  for selected_date in "${dates_to_anchor[@]}"; do
    AUDIT_ANCHOR_DATE="$selected_date" "$0"
  done
  echo "audit-anchor: completed ${#dates_to_anchor[@]} root verification(s)"
  exit 0
fi

if [[ ! "$AUDIT_ANCHOR_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "audit-anchor: invalid requested date" >&2
  exit 1
fi

work_dir="$(mktemp -d "$STATE_DIR/.work.XXXXXX")"
cleanup() {
  find "$work_dir" -type f -exec shred -u {} + 2>/dev/null || true
  rmdir "$work_dir" 2>/dev/null || true
}
trap cleanup EXIT

root_row="$(runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$DATABASE" -AtF $'\t' -c \
  "select audit_date::text, root_hash, entry_count::text,
          coalesce(first_entry_hash, ''), coalesce(last_entry_hash, ''), generated_at::text
     from lc_audit_daily_roots
    where audit_date = '$AUDIT_ANCHOR_DATE'
      and audit_date <= ((now() at time zone 'utc')::date - 1)
    limit 1")"

if [[ -z "$root_row" ]]; then
  echo "audit-anchor: no completed daily root is available"
  exit 0
fi

IFS=$'\t' read -r audit_date root_hash entry_count first_entry_hash last_entry_hash generated_at <<< "$root_row"
if [[ ! "$audit_date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] ||
   [[ ! "$root_hash" =~ ^[0-9a-f]{64}$ ]] ||
   [[ ! "$entry_count" =~ ^[0-9]+$ ]] ||
   (( entry_count <= 0 )) ||
   [[ ! "$first_entry_hash" =~ ^[0-9a-f]{64}$ ]] ||
   [[ ! "$last_entry_hash" =~ ^[0-9a-f]{64}$ ]]; then
  echo "audit-anchor: database returned an invalid daily root" >&2
  exit 1
fi

hashes_file="$work_dir/entry-hashes.txt"
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d "$DATABASE" -At -c \
  "select entry_hash
     from lc_audit_chain_entries
    where chain_date = '$AUDIT_ANCHOR_DATE'
    order by created_at, id" > "$hashes_file"
mapfile -t entry_hashes < "$hashes_file"
if (( ${#entry_hashes[@]} != entry_count )); then
  echo "audit-anchor: entry count does not match the stored daily root for $audit_date" >&2
  exit 1
fi
for entry_hash in "${entry_hashes[@]}"; do
  if [[ ! "$entry_hash" =~ ^[0-9a-f]{64}$ ]]; then
    echo "audit-anchor: invalid chain entry hash for $audit_date" >&2
    exit 1
  fi
done
if [[ "${entry_hashes[0]}" != "$first_entry_hash" || "${entry_hashes[-1]}" != "$last_entry_hash" ]]; then
  echo "audit-anchor: first or last entry does not match the stored daily root for $audit_date" >&2
  exit 1
fi
computed_root="$(node - "$audit_date" "$hashes_file" <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const [chainDate, hashesFile] = process.argv.slice(2);
const hashes = fs.readFileSync(hashesFile, 'utf8').split(/\r?\n/).filter(Boolean);
const canonical = JSON.stringify({ version: 'lc-audit-root-v1', chainDate, hashes });
process.stdout.write(crypto.createHash('sha256').update(canonical).digest('hex'));
NODE
)"
if [[ "$computed_root" != "$root_hash" ]]; then
  echo "audit-anchor: recomputed root does not match the stored daily root for $audit_date" >&2
  exit 1
fi

year="${audit_date:0:4}"
month="${audit_date:5:2}"
anchor_dir="$STATE_DIR/anchors/$year/$month"
payload_file="$anchor_dir/jumulu-audit-root-$audit_date.json"
signature_file="$payload_file.sig"
install -d -m 700 "$anchor_dir"

if [[ -e "$payload_file" || -e "$signature_file" ]]; then
  if [[ ! -s "$payload_file" || ! -s "$signature_file" ]]; then
    echo "audit-anchor: incomplete local anchor exists for $audit_date" >&2
    exit 1
  fi
  openssl dgst -sha256 -verify "$PUBLIC_KEY" -signature "$signature_file" "$payload_file" >/dev/null
  node - "$payload_file" "$audit_date" "$root_hash" "$entry_count" <<'NODE'
const fs = require('node:fs');
const [file, expectedDate, expectedRoot, expectedCount] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
if (payload.audit_date !== expectedDate || payload.root_hash !== expectedRoot || Number(payload.entry_count) !== Number(expectedCount)) {
  throw new Error('local anchor no longer matches the database daily root');
}
NODE
else
  export AUDIT_DATE="$audit_date" ROOT_HASH="$root_hash" ENTRY_COUNT="$entry_count"
  export FIRST_ENTRY_HASH="$first_entry_hash" LAST_ENTRY_HASH="$last_entry_hash"
  export GENERATED_AT="$generated_at" ANCHORED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  node <<'NODE' > "$payload_file"
const payload = {
  version: 'jumulu-audit-anchor-v1',
  site: 'jumulu.jusichen.com',
  database: 'lingqi_prod_candidate',
  audit_date: process.env.AUDIT_DATE,
  root_hash: process.env.ROOT_HASH,
  entry_count: Number(process.env.ENTRY_COUNT),
  first_entry_hash: process.env.FIRST_ENTRY_HASH || null,
  last_entry_hash: process.env.LAST_ENTRY_HASH || null,
  root_generated_at: process.env.GENERATED_AT,
  anchored_at: process.env.ANCHORED_AT,
  signature: 'RSA-3072-SHA256',
};
process.stdout.write(`${JSON.stringify(payload)}\n`);
NODE
  openssl dgst -sha256 -sign "$PRIVATE_KEY" -out "$signature_file" "$payload_file"
  openssl dgst -sha256 -verify "$PUBLIC_KEY" -signature "$signature_file" "$payload_file" >/dev/null
  chmod 400 "$payload_file" "$signature_file"
fi

set -a
# shellcheck disable=SC1090
source "$COS_SECRET_FILE"
set +a

upload_once() {
  local source_file="$1"
  local object_suffix="$2"
  local downloaded_file="$work_dir/$(basename "$source_file").downloaded"
  local error_file="$work_dir/$(basename "$source_file").error"

  if node "$COS_UPLOADER" get "$object_suffix" "$downloaded_file" 2>"$error_file"; then
    if ! cmp -s "$source_file" "$downloaded_file"; then
      echo "audit-anchor: refusing to overwrite different COS object: $object_suffix" >&2
      exit 1
    fi
  elif grep -q 'COS GET failed: 404' "$error_file"; then
    node "$COS_UPLOADER" put "$source_file" "$object_suffix"
    node "$COS_UPLOADER" get "$object_suffix" "$downloaded_file"
    cmp -s "$source_file" "$downloaded_file" || {
      echo "audit-anchor: COS round-trip mismatch: $object_suffix" >&2
      exit 1
    }
  else
    cat "$error_file" >&2
    exit 1
  fi
}

object_dir="$COS_BASE/$year/$month"
upload_once "$PUBLIC_KEY" "$COS_BASE/public/jumulu-audit-anchor-public.pem"
upload_once "$payload_file" "$object_dir/$(basename "$payload_file")"
upload_once "$signature_file" "$object_dir/$(basename "$signature_file")"

downloaded_payload="$work_dir/anchor.json"
downloaded_signature="$work_dir/anchor.sig"
node "$COS_UPLOADER" get "$object_dir/$(basename "$payload_file")" "$downloaded_payload"
node "$COS_UPLOADER" get "$object_dir/$(basename "$signature_file")" "$downloaded_signature"
openssl dgst -sha256 -verify "$PUBLIC_KEY" -signature "$downloaded_signature" "$downloaded_payload" >/dev/null

echo "audit-anchor: date=$audit_date entries=$entry_count root=${root_hash:0:16}... signed and COS-verified"
