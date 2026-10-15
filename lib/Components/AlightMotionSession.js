/**
 * This file is part of the Denia-md project.
 * Alight Motion Premium Session Manager
 * In-memory session tracking with 10-minute timeout per user.
 */

const sessions = new Map()

// 10 minutes session timeout
export const SESSION_TIMEOUT = 10 * 60 * 1000

/**
 * Get active session for a user JID
 * @param {string} jid
 * @returns {object|null}
 */
export const getSession = (jid) => {
   if (!jid) return null
   return sessions.get(jid) || null
}

/**
 * Check if a user has an active session
 * @param {string} jid
 * @returns {boolean}
 */
export const hasSession = (jid) => {
   if (!jid) return false
   return sessions.has(jid)
}

/**
 * Start or reset a session for a user
 * @param {string} jid
 * @param {Function} onTimeout
 * @returns {object}
 */
export const startSession = (jid, onTimeout) => {
   if (!jid) return null

   // Clear existing session and timer if present
   clearSession(jid)

   const timer = setTimeout(async () => {
      try {
         if (sessions.has(jid)) {
            clearSession(jid)
            if (typeof onTimeout === 'function') {
               await onTimeout(jid)
            }
         }
      }
      catch (_) {}
   }, SESSION_TIMEOUT)

   const sessionData = {
      step: 'email',
      email: null,
      token: null,
      createdAt: Date.now(),
      timer
   }

   sessions.set(jid, sessionData)
   return sessionData
}

/**
 * Update an existing session
 * @param {string} jid
 * @param {object} updates
 * @returns {object|null}
 */
export const updateSession = (jid, updates = {}) => {
   const current = sessions.get(jid)
   if (!current) return null

   const updated = {
      ...current,
      ...updates
   }
   sessions.set(jid, updated)
   return updated
}

/**
 * Clear session and securely wipe sensitive data from memory
 * @param {string} jid
 */
export const clearSession = (jid) => {
   if (!jid) return
   const current = sessions.get(jid)
   if (current) {
      if (current.timer) {
         clearTimeout(current.timer)
      }
      // Zero out / wipe sensitive values
      current.step = null
      current.email = null
      current.token = null
      current.timer = null
      sessions.delete(jid)
   }
}
