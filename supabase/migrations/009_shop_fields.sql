ALTER TABLE lc_profiles ADD COLUMN IF NOT EXISTS shop_name text;
ALTER TABLE lc_profiles ADD COLUMN IF NOT EXISTS shop_description text;
ALTER TABLE lc_profiles ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE lc_profiles ADD COLUMN IF NOT EXISTS contact_wechat text;
ALTER TABLE lc_profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE lc_profiles ADD COLUMN IF NOT EXISTS juzhanggui_link text;
ALTER TABLE lc_rankings ADD COLUMN IF NOT EXISTS shop_reply text;
ALTER TABLE lc_rankings ADD COLUMN IF NOT EXISTS appeal_status text DEFAULT NULL;
ALTER TABLE lc_rankings ADD COLUMN IF NOT EXISTS appeal_reason text DEFAULT NULL;