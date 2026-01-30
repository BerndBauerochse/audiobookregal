<template>
  <div class="w-full h-full">
    <div class="bg-bg rounded-md shadow-lg border border-white/5 p-0 sm:p-4 mb-8">
      <nuxt-link :to="`/config/users/${user.id}`" class="text-white/70 hover:text-white/100 hover:bg-white/5 cursor-pointer rounded-full px-2 sm:px-0">
        <div class="flex items-center">
          <div class="h-10 w-10 flex items-center justify-center">
            <span class="material-symbols text-2xl">arrow_back</span>
          </div>
          <p class="pl-1">{{ $strings.LabelBackToUser }}</p>
        </div>
      </nuxt-link>
      <div class="flex items-center mb-2 mt-4 px-2 sm:px-0">
        <widgets-online-indicator :value="!!userOnline" />
        <h1 class="text-xl pl-2">{{ username }}</h1>
      </div>

      <div class="w-full h-px bg-white/10 my-2" />

      <!-- Privacy Enhancement: Session tracking disabled -->
      <div class="py-2">
        <h1 class="text-lg mb-2 text-white/90 px-2 sm:px-0">{{ $strings.HeaderListeningSessions }}</h1>
        <div class="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
          <div class="flex items-center mb-4">
            <span class="material-symbols text-2xl text-green-400 mr-3">shield</span>
            <h3 class="text-lg font-semibold text-green-400">Privacy Protection Enabled</h3>
          </div>
          <p class="text-white/80 mb-4">
            User session tracking has been disabled on this server to protect privacy.
          </p>
          <div class="bg-black/20 rounded p-4">
            <p class="text-sm text-white/60 mb-2"><strong>What this means:</strong></p>
            <ul class="text-sm text-white/60 list-disc list-inside space-y-1">
              <li>Individual listening sessions are not tracked</li>
              <li>No history of "who listened to what" is recorded</li>
              <li>Playback sync still works normally for users</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ params, redirect, app }) {
    var user = await app.$axios.$get(`/api/users/${params.id}`).catch((error) => {
      console.error('Failed to get user', error)
      return null
    })
    if (!user) return redirect('/config/users')
    return {
      user
    }
  },
  data() {
    return {}
  },
  computed: {
    username() {
      return this.user.username
    },
    userOnline() {
      return this.$store.getters['users/getIsUserOnline'](this.user.id)
    }
  }
}
</script>
