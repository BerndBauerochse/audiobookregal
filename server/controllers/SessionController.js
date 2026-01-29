const Path = require('path')
const { Request, Response, NextFunction } = require('express')
const Logger = require('../Logger')
const Database = require('../Database')
const { toNumber, isUUID } = require('../utils/index')
const { getAudioMimeTypeFromExtname, encodeUriPath } = require('../utils/fileUtils')
const { PlayMethod } = require('../utils/constants')

const ShareManager = require('../managers/ShareManager')

/**
 * @typedef RequestUserObject
 * @property {import('../models/User')} user
 *
 * @typedef {Request & RequestUserObject} RequestWithUser
 */

class SessionController {
  constructor() {}

  /**
   * GET: /api/sessions
   *
   * Privacy Enhancement: This endpoint has been disabled to prevent admin surveillance
   * of user listening activity. Admins can no longer view detailed session history.
   *
   * @this import('../routers/ApiRouter')
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getAllWithUserData(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[SessionController] getAllWithUserData: Non-admin user "${req.user.username}" requested all session data`)
      return res.sendStatus(404)
    }

    // Privacy Enhancement: Return empty session list to prevent admin surveillance
    // User playback progress is still saved for sync purposes, but detailed session
    // history (who listened to what, when, on which device) is no longer exposed
    Logger.info(`[SessionController] Privacy mode: Session history endpoint disabled for admin surveillance prevention`)

    const payload = {
      total: 0,
      numPages: 0,
      page: 0,
      itemsPerPage: 10,
      sessions: [],
      privacyNotice: 'Session history has been disabled for privacy protection. User playback progress sync remains functional.'
    }

    res.json(payload)
  }

  /**
   * GET: /api/sessions/open
   *
   * Privacy Enhancement: This endpoint has been disabled to prevent admin surveillance
   * of currently active user sessions.
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getOpenSessions(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[SessionController] getOpenSessions: Non-admin user "${req.user.username}" requested open session data`)
      return res.sendStatus(404)
    }

    // Privacy Enhancement: Return empty session list to prevent admin surveillance of active sessions
    Logger.info(`[SessionController] Privacy mode: Open sessions endpoint disabled for admin surveillance prevention`)

    res.json({
      sessions: [],
      shareSessions: [],
      privacyNotice: 'Active session monitoring has been disabled for privacy protection.'
    })
  }

  /**
   * GET: /api/session/:id
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async getOpenSession(req, res) {
    const libraryItem = await Database.libraryItemModel.getExpandedById(req.playbackSession.libraryItemId)
    const sessionForClient = req.playbackSession.toJSONForClient(libraryItem)
    res.json(sessionForClient)
  }

  /**
   * POST: /api/session/:id/sync
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  sync(req, res) {
    this.playbackSessionManager.syncSessionRequest(req.user, req.playbackSession, req.body, res)
  }

  /**
   * POST: /api/session/:id/close
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  close(req, res) {
    let syncData = req.body
    if (syncData && !Object.keys(syncData).length) syncData = null
    this.playbackSessionManager.closeSessionRequest(req.user, req.playbackSession, syncData, res)
  }

  /**
   * DELETE: /api/session/:id
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  async delete(req, res) {
    // if session is open then remove it
    const openSession = this.playbackSessionManager.getSession(req.playbackSession.id)
    if (openSession) {
      await this.playbackSessionManager.removeSession(req.playbackSession.id)
    }

    await Database.removePlaybackSession(req.playbackSession.id)
    res.sendStatus(200)
  }

  /**
   * POST: /api/sessions/batch/delete
   * @this import('../routers/ApiRouter')
   *
   * @typedef batchDeleteReqBody
   * @property {string[]} sessions
   *
   * @param {Request<{}, {}, batchDeleteReqBody, {}> & RequestUserObject} req
   * @param {Response} res
   */
  async batchDelete(req, res) {
    if (!req.user.isAdminOrUp) {
      Logger.error(`[SessionController] Non-admin user "${req.user.username}" attempted to batch delete sessions`)
      return res.sendStatus(403)
    }
    // Validate session ids
    if (!req.body.sessions?.length || !Array.isArray(req.body.sessions) || req.body.sessions.some((s) => !isUUID(s))) {
      Logger.error(`[SessionController] Invalid request body. "sessions" array is required`, req.body)
      return res.status(400).send('Invalid request body. "sessions" array of session id strings is required.')
    }

    // Check if any of these sessions are open and close it
    for (const sessionId of req.body.sessions) {
      const openSession = this.playbackSessionManager.getSession(sessionId)
      if (openSession) {
        await this.playbackSessionManager.removeSession(sessionId)
      }
    }

    try {
      const sessionsRemoved = await Database.playbackSessionModel.destroy({
        where: {
          id: req.body.sessions
        }
      })
      Logger.info(`[SessionController] ${sessionsRemoved} playback sessions removed by "${req.user.username}"`)
      res.sendStatus(200)
    } catch (error) {
      Logger.error(`[SessionController] Failed to remove playback sessions`, error)
      res.status(500).send('Failed to remove sessions')
    }
  }

  /**
   * POST: /api/session/local
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  syncLocal(req, res) {
    this.playbackSessionManager.syncLocalSessionRequest(req, res)
  }

  /**
   * POST: /api/session/local-all
   *
   * @this {import('../routers/ApiRouter')}
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   */
  syncLocalSessions(req, res) {
    this.playbackSessionManager.syncLocalSessionsRequest(req, res)
  }

  /**
   * GET: /public/session/:id/track/:index
   * While a session is open, this endpoint can be used to stream the audio track
   *
   * @this {import('../routers/PublicRouter')}
   *
   * @param {Request} req
   * @param {Response} res
   */
  async getTrack(req, res) {
    const audioTrackIndex = toNumber(req.params.index, null)
    if (audioTrackIndex === null) {
      Logger.error(`[SessionController] Invalid audio track index "${req.params.index}"`)
      return res.sendStatus(400)
    }

    const playbackSession = this.playbackSessionManager.getSession(req.params.id)
    if (!playbackSession) {
      Logger.error(`[SessionController] Unable to find playback session with id=${req.params.id}`)
      return res.sendStatus(404)
    }

    let audioTrack = playbackSession.audioTracks.find((t) => toNumber(t.index, 1) === audioTrackIndex)

    // Support clients passing 0 or 1 for podcast episode audio track index (handles old episodes pre-v2.21.0 having null index)
    if (!audioTrack && playbackSession.mediaType === 'podcast' && audioTrackIndex === 0) {
      audioTrack = playbackSession.audioTracks[0]
    }
    if (!audioTrack) {
      Logger.error(`[SessionController] Unable to find audio track with index=${audioTrackIndex}`)
      return res.sendStatus(404)
    }

    // Redirect transcode requests to the HLS router
    // Handles bug introduced in android v0.10.0-beta where transcode requests are made to this endpoint
    if (playbackSession.playMethod === PlayMethod.TRANSCODE && audioTrack.contentUrl) {
      Logger.debug(`[SessionController] Redirecting transcode request to "${audioTrack.contentUrl}"`)
      return res.redirect(audioTrack.contentUrl)
    }

    if (!audioTrack.metadata?.path) {
      Logger.error(`[SessionController] Invalid audio track "${audioTrack.index}" for session "${req.params.id}"`)
      return res.sendStatus(500)
    }

    const user = await Database.userModel.getUserById(playbackSession.userId)
    Logger.debug(`[SessionController] Serving audio track ${audioTrack.index} for session "${req.params.id}" belonging to user "${user.username}"`)

    if (global.XAccel) {
      const encodedURI = encodeUriPath(global.XAccel + audioTrack.metadata.path)
      Logger.debug(`Use X-Accel to serve static file ${encodedURI}`)
      return res.status(204).header({ 'X-Accel-Redirect': encodedURI }).send()
    }

    // Express does not set the correct mimetype for m4b files so use our defined mimetypes if available
    const audioMimeType = getAudioMimeTypeFromExtname(Path.extname(audioTrack.metadata.path))
    if (audioMimeType) {
      res.setHeader('Content-Type', audioMimeType)
    }
    res.sendFile(audioTrack.metadata.path)
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  openSessionMiddleware(req, res, next) {
    var playbackSession = this.playbackSessionManager.getSession(req.params.id)
    if (!playbackSession) return res.sendStatus(404)

    if (playbackSession.userId !== req.user.id && !req.user.isAdminOrUp) {
      Logger.error(`[SessionController] Non-admin user "${req.user.username}" attempting to access session belonging to another user "${req.params.id}"`)
      return res.sendStatus(403)
    }

    req.playbackSession = playbackSession
    next()
  }

  /**
   *
   * @param {RequestWithUser} req
   * @param {Response} res
   * @param {NextFunction} next
   */
  async middleware(req, res, next) {
    const playbackSession = await Database.getPlaybackSession(req.params.id)
    if (!playbackSession) {
      Logger.error(`[SessionController] Unable to find playback session with id=${req.params.id}`)
      return res.sendStatus(404)
    }

    if (req.method == 'DELETE' && !req.user.canDelete) {
      Logger.warn(`[SessionController] User "${req.user.username}" attempted to delete without permission`)
      return res.sendStatus(403)
    } else if ((req.method == 'PATCH' || req.method == 'POST') && !req.user.canUpdate) {
      Logger.warn(`[SessionController] User "${req.user.username}" attempted to update without permission`)
      return res.sendStatus(403)
    }

    req.playbackSession = playbackSession
    next()
  }
}
module.exports = new SessionController()
