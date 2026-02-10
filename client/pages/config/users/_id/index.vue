<template>
  <div class="w-full h-full">
    <div class="bg-bg rounded-md shadow-lg border border-white/5 p-0 sm:p-4 mb-8">
      <nuxt-link to="/config/users" class="text-white/70 hover:text-white/100 hover:bg-white/5 cursor-pointer rounded-full px-2 sm:px-0">
        <div class="flex items-center">
          <div class="h-10 w-10 flex items-center justify-center">
            <span class="material-symbols text-2xl">arrow_back</span>
          </div>
          <p class="pl-1">{{ $strings.LabelAllUsers }}</p>
        </div>
      </nuxt-link>
      <div class="flex items-center mb-2 mt-4 px-2 sm:px-0">
        <widgets-online-indicator :value="!!userOnline" />
        <h1 class="text-xl pl-2">{{ username }}</h1>
      </div>
      <div v-if="legacyToken" class="text-xs space-y-2 mt-4">
        <ui-text-input-with-label label="Legacy API Token" :value="legacyToken" readonly show-copy />

        <p class="text-warning" v-html="$strings.MessageAuthenticationLegacyTokenWarning" />
      </div>
      <div class="w-full h-px bg-white/10 my-2" />
      <!-- Privacy Enhancement: Activity tracking hidden to protect user privacy -->
      <div class="py-2">
        <h1 class="text-lg mb-2 text-white/90 px-2 sm:px-0">{{ $strings.HeaderListeningStats }}</h1>
        <div class="bg-green-500/10 border border-green-500/30 rounded p-3">
          <div class="flex items-center">
            <span class="material-symbols text-green-400 mr-2">shield</span>
            <p class="text-sm text-green-400">Datenschutz aktiv</p>
          </div>
          <p class="text-xs text-gray-400 mt-2">Detaillierte Hörstatistiken werden auf diesem Server nicht angezeigt, um die Privatsphäre der Benutzer zu schützen.</p>
        </div>
      </div>
      <!-- Media Progress section hidden for privacy -->
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
    legacyToken() {
      return this.user.token
    },
    userToken() {
      return this.user.accessToken
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    username() {
      return this.user.username
    },
    userOnline() {
      return this.$store.getters['users/getIsUserOnline'](this.user.id)
    },
    mediaProgress() {
      return this.user.mediaProgress.sort((a, b) => b.lastUpdate - a.lastUpdate)
    },
    dateFormat() {
      return this.$store.getters['getServerSetting']('dateFormat')
    },
    timeFormat() {
      return this.$store.getters['getServerSetting']('timeFormat')
    }
  },
  methods: {
    // Privacy Enhancement: Listening stats fetching removed
  },
  mounted() {
    // Privacy Enhancement: No longer fetching listening activity data
  }
}
</script>

<style>
.userAudiobooksTable {
  border-collapse: collapse;
  width: 100%;
  border: 1px solid #474747;
}
.userAudiobooksTable tr:nth-child(even) {
  background-color: #2e2e2e;
}
.userAudiobooksTable tr:not(:first-child) {
  background-color: #373838;
}
.userAudiobooksTable tr:hover:not(:first-child) {
  background-color: #474747;
}
.userAudiobooksTable tr.isFinished {
  background-color: rgba(76, 175, 80, 0.1);
}
.userAudiobooksTable td {
  padding: 4px 8px;
}
.userAudiobooksTable th {
  padding: 4px 8px;
  font-size: 0.75rem;
}
</style>
