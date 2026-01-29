<template>
  <div>
    <app-settings-content :header-text="$strings.HeaderListeningSessions">
      <!-- Privacy Enhancement: Session surveillance has been disabled -->
      <div class="bg-primary/20 border border-primary/40 rounded-lg p-6 my-4">
        <div class="flex items-center mb-4">
          <span class="material-symbols text-2xl text-green-400 mr-3">shield</span>
          <h3 class="text-lg font-semibold text-green-400">Privacy Protection Enabled</h3>
        </div>
        <p class="text-white/80 mb-4">
          Session monitoring and activity tracking have been disabled to protect user privacy.
          This server has been configured with enhanced privacy features in compliance with GDPR principles.
        </p>
        <div class="bg-black/20 rounded p-4">
          <p class="text-sm text-white/60 mb-2"><strong>What this means:</strong></p>
          <ul class="text-sm text-white/60 list-disc list-inside space-y-1">
            <li>User listening sessions are not tracked or displayed</li>
            <li>Device information is anonymized (shown as "Generic Device")</li>
            <li>IP addresses are not stored with session data</li>
            <li>Playback synchronization continues to work normally</li>
            <li>Users can still resume their audiobooks across devices</li>
          </ul>
        </div>
        <p class="text-xs text-white/40 mt-4">
          User playback progress is still saved locally for sync purposes, but detailed activity logs are no longer collected or displayed.
        </p>
      </div>
    </app-settings-content>
  </div>
</template>

<script>
/**
 * Privacy Enhancement: This page has been modified to display a privacy notice
 * instead of session monitoring functionality. The session tracking features
 * have been disabled to protect user privacy.
 */
export default {
  asyncData({ store, redirect }) {
    if (!store.getters['user/getIsAdminOrUp']) {
      redirect('/')
      return
    }
    return {}
  },
  data() {
    return {}
  }
}
</script>

<style scoped>
/* Privacy Enhancement: Simplified styling for privacy notice page */
</style>
