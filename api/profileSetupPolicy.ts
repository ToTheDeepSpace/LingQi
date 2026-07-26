type ProfileSetupState = {
  profile_setup_completed?: boolean | null;
} | null;

export function profileSetupBlockReason(profile: ProfileSetupState) {
  if (profile?.profile_setup_completed === false) {
    return '发布前请先设置公开昵称，并等待审核通过';
  }
  return '';
}
