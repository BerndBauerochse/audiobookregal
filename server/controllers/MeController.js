const { Request, Response } = require('express')
const Logger = require('../Logger')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const { sort } = require('../libs/fastSort')
const { toNumber, isNullOrNaN } = require('../utils/index')
const userStats = require('../utils/queries/userStats')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class MeController {
  constructor() {}

  /**
   * GET: /api/me
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  getCurrentUser(req, res) {
    res.json(req.user.toOldJSONForBrowser())
  }

  /**
   * GET: /api/me/listening-sessions
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getListeningSessions(req, res) {
    const listeningSessions = await this.getUserListeningSessionsHelper(req.user.id)

    const itemsPerPage = toNumber(req.query.itemsPerPage, 10) || 10
    const page = toNumber(req.query.page, 0)

    const start = page * itemsPerPage
    const sessions = listeningSessions.slice(start, start + itemsPerPage)

    const payload = {
      total: listeningSessions.length,
      numPages: Math.ceil(listeningSessions.length / itemsPerPage),
      page,
      itemsPerPage,
      sessions
    }

    res.json(payload)
  }

  /**
   * GET: /api/me/item/listening-sessions/:libraryItemId/:episodeId
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getItemListeningSessions(req, res) {
    const libraryItem = await Database.libraryItemModel.findByPk(req.params.libraryItemId)
    const episode = await Database.podcastEpisodeModel.findByPk(req.params.episodeId)

    if (!libraryItem || (libraryItem.isPodcast && !episode)) {
      Logger.error(`[MeController] Media item not found for library item id "${req.params.libraryItemId}"`)
      return res.sendStatus(404)
    }

    const mediaItemId = episode?.id || libraryItem.mediaId
    let listeningSessions = await this.getUserItemListeningSessionsHelper(req.user.id, mediaItemId)

    const itemsPerPage = toNumber(req.query.itemsPerPage, 10) || 10
    const page = toNumber(req.query.page, 0)

    const start = page * itemsPerPage
    const sessions = listeningSessions.slice(start, start + itemsPerPage)

    const payload = {
      total: listeningSessions.length,
      numPages: Math.ceil(listeningSessions.length / itemsPerPage),
      page,
      itemsPerPage,
      sessions
    }

    res.json(payload)
  }

  /**
   * GET: /api/me/listening-stats
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getListeningStats(req, res) {
    const listeningStats = await this.getUserListeningStatsHelpers(req.user.id)
    res.json(listeningStats)
  }

  /**
   * GET: /api/me/progress/:id/:episodeId?
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getMediaProgress(req, res) {
    const mediaProgress = req.user.getOldMediaProgress(req.params.id, req.params.episodeId || null)
    if (!mediaProgress) {
      return res.sendStatus(404)
    }
    res.json(mediaProgress)
  }

  /**
   * DELETE: /api/me/progress/:id
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async removeMediaProgress(req, res) {
    await Database.mediaProgressModel.removeById(req.params.id)
    req.user.mediaProgresses = req.user.mediaProgresses.filter((mp) => mp.id !== req.params.id)

    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    res.sendStatus(200)
  }

  /**
   * PATCH: /api/me/progress/:libraryItemId/:episodeId?
   * TODO: Update to use mediaItemId and mediaItemType
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async createUpdateMediaProgress(req, res) {
    const progressUpdatePayload = {
      ...req.body,
      libraryItemId: req.params.libraryItemId,
      episodeId: req.params.episodeId
    }
    const mediaProgressResponse = await req.user.createUpdateMediaProgressFromPayload(progressUpdatePayload)
    if (mediaProgressResponse.error) {
      return res.status(mediaProgressResponse.statusCode || 400).send(mediaProgressResponse.error)
    }

    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    res.sendStatus(200)
  }

  /**
   * PATCH: /api/me/progress/batch/update
   * TODO: Update to use mediaItemId and mediaItemType
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async batchUpdateMediaProgress(req, res) {
    const itemProgressPayloads = req.body
    if (!itemProgressPayloads?.length) {
      return res.status(400).send('Missing request payload')
    }

    let hasUpdated = false
    for (const itemProgress of itemProgressPayloads) {
      const mediaProgressResponse = await req.user.createUpdateMediaProgressFromPayload(itemProgress)
      if (mediaProgressResponse.error) {
        Logger.error(`[MeController] batchUpdateMediaProgress: ${mediaProgressResponse.error}`)
        continue
      } else {
        hasUpdated = true
      }
    }

    if (hasUpdated) {
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    }

    res.sendStatus(200)
  }

  /**
   * POST: /api/me/item/:id/bookmark
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async createBookmark(req, res) {
    if (!(await Database.libraryItemModel.checkExistsById(req.params.id))) return res.sendStatus(404)

    const { time, title } = req.body
    if (isNullOrNaN(time)) {
      Logger.error(`[MeController] createBookmark invalid time`, time)
      return res.status(400).send('Invalid time')
    }
    if (!title || typeof title !== 'string') {
      Logger.error(`[MeController] createBookmark invalid title`, title)
      return res.status(400).send('Invalid title')
    }

    const bookmark = await req.user.createBookmark(req.params.id, time, title)
    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    res.json(bookmark)
  }

  /**
   * PATCH: /api/me/item/:id/bookmark
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateBookmark(req, res) {
    if (!(await Database.libraryItemModel.checkExistsById(req.params.id))) return res.sendStatus(404)

    const { time, title } = req.body
    if (isNullOrNaN(time)) {
      Logger.error(`[MeController] updateBookmark invalid time`, time)
      return res.status(400).send('Invalid time')
    }
    if (!title || typeof title !== 'string') {
      Logger.error(`[MeController] updateBookmark invalid title`, title)
      return res.status(400).send('Invalid title')
    }

    const bookmark = await req.user.updateBookmark(req.params.id, time, title)
    if (!bookmark) {
      Logger.error(`[MeController] updateBookmark not found for library item id "${req.params.id}" and time "${time}"`)
      return res.sendStatus(404)
    }

    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    res.json(bookmark)
  }

  /**
   * DELETE: /api/me/item/:id/bookmark/:time
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async removeBookmark(req, res) {
    if (!(await Database.libraryItemModel.checkExistsById(req.params.id))) return res.sendStatus(404)

    const time = Number(req.params.time)
    if (isNaN(time)) {
      return res.status(400).send('Invalid time')
    }

    if (!req.user.findBookmark(req.params.id, time)) {
      Logger.error(`[MeController] removeBookmark not found`)
      return res.sendStatus(404)
    }

    await req.user.removeBookmark(req.params.id, time)

    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    res.sendStatus(200)
  }

  /**
   * PATCH: /api/me/password
   * User change password. Requires current password.
   * Guest users cannot change password.
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updatePassword(req, res) {
    if (req.user.isGuest) {
      Logger.error(`[MeController] Guest user "${req.user.username}" attempted to change password`)
      return res.sendStatus(403)
    }

    const { password, newPassword } = req.body
    if ((typeof password !== 'string' && password !== null) || (typeof newPassword !== 'string' && newPassword !== null)) {
      return res.status(400).send('Missing or invalid password or new password')
    }

    const result = await this.auth.localAuthStrategy.changePassword(req.user, password, newPassword)

    if (result.error) {
      return res.status(400).send(result.error)
    }

    res.sendStatus(200)
  }

  /**
   * GET: /api/me/items-in-progress
   * Pull items in progress for all libraries
   * Used in Android Auto in progress list since there is no easy library selection
   * TODO: Update to use mediaItemId and mediaItemType. Use sort & limit in query
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getAllLibraryItemsInProgress(req, res) {
    const limit = !isNaN(req.query.limit) ? Number(req.query.limit) || 25 : 25
    const hideTags = !req.user.isAdminOrUp

    const mediaProgressesInProgress = req.user.mediaProgresses.filter((mp) => !mp.isFinished && (mp.currentTime > 0 || mp.ebookProgress > 0))

    const libraryItemsIds = [...new Set(mediaProgressesInProgress.map((mp) => mp.extraData?.libraryItemId).filter((id) => id))]
    const libraryItems = await Database.libraryItemModel.findAllExpandedWhere({ id: libraryItemsIds })

    let itemsInProgress = []

    for (const mediaProgress of mediaProgressesInProgress) {
      const oldMediaProgress = mediaProgress.getOldMediaProgress()
      const libraryItem = libraryItems.find((li) => li.id === oldMediaProgress.libraryItemId)
      if (libraryItem) {
        if (oldMediaProgress.episodeId && libraryItem.isPodcast) {
          const episode = libraryItem.media.podcastEpisodes.find((ep) => ep.id === oldMediaProgress.episodeId)
          if (episode) {
            const libraryItemWithEpisode = {
              ...libraryItem.toOldJSONMinified(hideTags),
              recentEpisode: episode.toOldJSON(libraryItem.id),
              progressLastUpdate: oldMediaProgress.lastUpdate
            }
            itemsInProgress.push(libraryItemWithEpisode)
          }
        } else if (!oldMediaProgress.episodeId) {
          itemsInProgress.push({
            ...libraryItem.toOldJSONMinified(hideTags),
            progressLastUpdate: oldMediaProgress.lastUpdate
          })
        }
      }
    }

    itemsInProgress = sort(itemsInProgress)
      .desc((li) => li.progressLastUpdate)
      .slice(0, limit)
    res.json({
      libraryItems: itemsInProgress
    })
  }

  /**
   * GET: /api/me/series/:id/remove-from-continue-listening
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async removeSeriesFromContinueListening(req, res) {
    if (!(await Database.seriesModel.checkExistsById(req.params.id))) {
      Logger.error(`[MeController] removeSeriesFromContinueListening: Series ${req.params.id} not found`)
      return res.sendStatus(404)
    }

    const hasUpdated = await req.user.addSeriesToHideFromContinueListening(req.params.id)
    if (hasUpdated) {
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    }
    res.json(req.user.toOldJSONForBrowser())
  }

  /**
   * GET: api/me/series/:id/readd-to-continue-listening
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async readdSeriesFromContinueListening(req, res) {
    if (!(await Database.seriesModel.checkExistsById(req.params.id))) {
      Logger.error(`[MeController] readdSeriesFromContinueListening: Series ${req.params.id} not found`)
      return res.sendStatus(404)
    }

    const hasUpdated = await req.user.removeSeriesFromHideFromContinueListening(req.params.id)
    if (hasUpdated) {
      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())
    }
    res.json(req.user.toOldJSONForBrowser())
  }

  /**
   * GET: api/me/progress/:id/remove-from-continue-listening
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async removeItemFromContinueListening(req, res) {
    const mediaProgress = req.user.mediaProgresses.find((mp) => mp.id === req.params.id)
    if (!mediaProgress) {
      return res.sendStatus(404)
    }

    // Already hidden
    if (mediaProgress.hideFromContinueListening) {
      return res.json(req.user.toOldJSONForBrowser())
    }

    mediaProgress.hideFromContinueListening = true
    await mediaProgress.save()

    SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())

    res.json(req.user.toOldJSONForBrowser())
  }

  /**
   * POST: /api/me/ereader-devices
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async updateUserEReaderDevices(req, res) {
    if (!req.body.ereaderDevices || !Array.isArray(req.body.ereaderDevices)) {
      return res.status(400).send('Invalid payload. ereaderDevices array required')
    }

    const userEReaderDevices = req.body.ereaderDevices
    for (const device of userEReaderDevices) {
      if (!device.name || !device.email) {
        return res.status(400).send('Invalid payload. ereaderDevices array items must have name and email')
      } else if (device.availabilityOption !== 'specificUsers' || device.users?.length !== 1 || device.users[0] !== req.user.id) {
        return res.status(400).send('Invalid payload. ereaderDevices array items must have availabilityOption "specificUsers" and only the current user')
      }
    }

    const otherDevices = Database.emailSettings.ereaderDevices.filter((device) => {
      return !Database.emailSettings.checkUserCanAccessDevice(device, req.user) || device.users?.length !== 1
    })

    const ereaderDevices = otherDevices.concat(userEReaderDevices)

    // Check for duplicate names
    const nameSet = new Set()
    const hasDupes = ereaderDevices.some((device) => {
      if (nameSet.has(device.name)) {
        return true // Duplicate found
      }
      nameSet.add(device.name)
      return false
    })

    if (hasDupes) {
      return res.status(400).send('Invalid payload. Duplicate "name" field found.')
    }

    const updated = Database.emailSettings.update({ ereaderDevices })
    if (updated) {
      await Database.updateSetting(Database.emailSettings)
      SocketAuthority.clientEmitter(req.user.id, 'ereader-devices-updated', {
        ereaderDevices: Database.emailSettings.getEReaderDevices(req.user)
      })
    }
    res.json({
      ereaderDevices: Database.emailSettings.getEReaderDevices(req.user)
    })
  }

  /**
   * GET: /api/me/stats/year/:year
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async getStatsForYear(req, res) {
    const year = Number(req.params.year)
    if (isNaN(year) || year < 2000 || year > 9999) {
      Logger.error(`[MeController] Invalid year "${year}"`)
      return res.status(400).send('Invalid year')
    }
    const data = await userStats.getStatsForYear(req.user.id, year)
    res.json(data)
  }

  /**
   * DELETE: /api/me/data
   *
   * Privacy Enhancement (GDPR Article 17 - Right to Erasure):
   * Allows users to delete their own stored data (progress, bookmarks, sessions).
   * Note: This does NOT delete the user account itself, only their activity data.
   * Guest users can use this to clear their data without admin intervention.
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async deleteUserData(req, res) {
    try {
      const userId = req.user.id
      Logger.info(`[MeController] User "${req.user.username}" requested data deletion (GDPR)`)

      // Delete media progress
      const progressDeleted = await Database.mediaProgressModel.destroy({
        where: { userId }
      })
      Logger.info(`[MeController] Deleted ${progressDeleted} media progress entries for user "${req.user.username}"`)

      // Delete playback sessions
      const sessionsDeleted = await Database.playbackSessionModel.destroy({
        where: { userId }
      })
      Logger.info(`[MeController] Deleted ${sessionsDeleted} playback sessions for user "${req.user.username}"`)

      // Clear bookmarks from user
      if (req.user.bookmarks && req.user.bookmarks.length > 0) {
        req.user.bookmarks = []
        await req.user.save()
        Logger.info(`[MeController] Cleared bookmarks for user "${req.user.username}"`)
      }

      // Clear series hide preferences
      if (req.user.extraData?.seriesHideFromContinueListening?.length > 0) {
        req.user.extraData = {
          ...req.user.extraData,
          seriesHideFromContinueListening: []
        }
        await req.user.save()
      }

      // Reload user data
      req.user.mediaProgresses = []

      SocketAuthority.clientEmitter(req.user.id, 'user_updated', req.user.toOldJSONForBrowser())

      res.json({
        success: true,
        message: 'Your data has been deleted successfully',
        deleted: {
          mediaProgress: progressDeleted,
          playbackSessions: sessionsDeleted,
          bookmarks: true
        }
      })
    } catch (error) {
      Logger.error(`[MeController] Failed to delete user data for "${req.user.username}":`, error)
      res.status(500).send('Failed to delete user data')
    }
  }

  /**
   * GET: /api/me/data-export
   *
   * Privacy Enhancement (GDPR Article 20 - Right to Data Portability):
   * Allows users to download all their stored personal data as a JSON file.
   * This includes: profile info, media progress, bookmarks, and listening history.
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async exportUserData(req, res) {
    try {
      Logger.info(`[MeController] User "${req.user.username}" requested data export (GDPR)`)

      // Collect all user data
      const userData = {
        exportDate: new Date().toISOString(),
        exportVersion: '1.0',
        privacyNotice: 'This export contains all personal data stored about you in compliance with GDPR Article 20.',

        // Basic profile information
        profile: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email || null,
          type: req.user.type,
          createdAt: req.user.createdAt,
          isActive: req.user.isActive
        },

        // Media progress (reading/listening positions)
        mediaProgress: req.user.mediaProgresses.map((mp) => ({
          id: mp.id,
          mediaItemId: mp.mediaItemId,
          mediaItemType: mp.mediaItemType,
          duration: mp.duration,
          currentTime: mp.currentTime,
          progress: mp.progress,
          isFinished: mp.isFinished,
          ebookLocation: mp.ebookLocation,
          ebookProgress: mp.ebookProgress,
          hideFromContinueListening: mp.hideFromContinueListening,
          finishedAt: mp.finishedAt,
          createdAt: mp.createdAt,
          updatedAt: mp.updatedAt
        })),

        // Bookmarks
        bookmarks: req.user.bookmarks.map((bm) => ({
          libraryItemId: bm.libraryItemId,
          title: bm.title,
          time: bm.time,
          createdAt: bm.createdAt
        })),

        // User preferences/settings (non-sensitive)
        preferences: {
          seriesHideFromContinueListening: req.user.extraData?.seriesHideFromContinueListening || []
        }
      }

      // Get user's listening sessions (historical data)
      const listeningSessions = await this.getUserListeningSessionsHelper(req.user.id)
      userData.listeningHistory = listeningSessions.map((session) => ({
        id: session.id,
        displayTitle: session.displayTitle,
        displayAuthor: session.displayAuthor,
        duration: session.duration,
        playMethod: session.playMethod,
        startTime: session.startTime,
        currentTime: session.currentTime,
        timeListening: session.timeListening,
        date: session.date,
        dayOfWeek: session.dayOfWeek,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
        // Note: deviceInfo is intentionally excluded for privacy
      }))

      // Set headers for file download
      const filename = `user-data-export-${req.user.username}-${new Date().toISOString().split('T')[0]}.json`
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

      res.json(userData)
    } catch (error) {
      Logger.error(`[MeController] Failed to export user data for "${req.user.username}":`, error)
      res.status(500).send('Failed to export user data')
    }
  }
}
module.exports = new MeController()
