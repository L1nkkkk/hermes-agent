import { useEffect, useRef, useState } from 'react'

import type {
  AtelierGateway,
  AtelierMessage,
  AtelierProfile,
  AtelierProject,
  AtelierSession,
  AtelierTranscript
} from './gateway'
import type { GoalFacts, MaidHold } from './model'
import type { PresenceTone } from './theme'

export function useAtelierFeeds(input: {
  gateway: AtelierGateway
  gatewayOpen: boolean
  /** Bumps after `session.create` so the rail re-reads `session.list`. */
  listEpoch: number
  /** Fired once per selection when `session.resume` never paints that session. */
  onResumeFailed: () => void
}) {
  const [profiles, setProfiles] = useState<AtelierProfile[]>([])
  const [projects, setProjects] = useState<AtelierProject[]>([])
  const [sessions, setSessions] = useState<AtelierSession[]>([])
  const [presence, setPresence] = useState<Record<string, PresenceTone>>({})
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AtelierMessage[]>([])
  const [goal, setGoal] = useState<GoalFacts | null>(null)
  const [running, setRunning] = useState(false)
  const [workspacePath, setWorkspacePath] = useState<string | null>(null)
  const [sessionHolds, setSessionHolds] = useState<Record<string, MaidHold>>({})
  const resumeFailedRef = useRef(input.onResumeFailed)
  const owner = profiles.find(profile => profile.id === ownerId) ?? null

  useEffect(() => {
    resumeFailedRef.current = input.onResumeFailed
  }, [input.onResumeFailed])

  useEffect(() => {
    let live = true

    input.gateway
      .listProfiles()
      .then(rows => {
        if (!live) {
          return
        }

        setProfiles(rows)
        setOwnerId(current => (current && rows.some(row => row.id === current) ? current : (rows[0]?.id ?? null)))
      })
      .catch(() => {
        if (live) {
          setProfiles([])
        }
      })

    return () => {
      live = false
    }
  }, [input.gateway, input.gatewayOpen])

  useEffect(() => {
    let live = true

    if (!owner) {
      setSessions([])
      setProjects([])

      return () => {
        live = false
      }
    }

    setProjects([])

    input.gateway
      .listSessions(owner)
      .then(rows => {
        if (live) {
          setSessions(rows)
        }
      })
      .catch(() => {
        if (live) {
          setSessions([])
        }
      })

    input.gateway
      .listProjects(owner)
      .then(rows => {
        if (live) {
          setProjects(rows)
        }
      })
      .catch(() => {
        if (live) {
          setProjects([])
        }
      })

    return () => {
      live = false
    }
  }, [owner, input.gateway, input.gatewayOpen, input.listEpoch])

  useEffect(() => {
    let live = true

    Promise.all(profiles.map(profile => profilePresence(input.gateway, profile)))
      .then(pairs => {
        if (live) {
          setPresence(Object.fromEntries(pairs))
        }
      })
      .catch(() => {
        if (live) {
          setPresence({})
        }
      })

    return () => {
      live = false
    }
  }, [profiles, input.gateway, input.gatewayOpen])

  useEffect(() => {
    let live = true

    if (!owner || !sessionId) {
      clearDesk(setMessages, setGoal, setRunning, setWorkspacePath)

      return () => {
        live = false
      }
    }

    const selected = sessionId
    // Drop the previous session before the new resume lands. A failed resume
    // must not leave that transcript on the desk. A later poll of a session
    // that already painted keeps the last good copy so the 4s refresh can heal.
    clearDesk(setMessages, setGoal, setRunning, setWorkspacePath)

    let painted = false
    let announced = false

    const pull = () => {
      input.gateway
        .resume(owner, selected)
        .then(transcript => {
          if (!live) {
            return
          }

          painted = true
          announced = false
          paintTranscript(transcript, selected, setMessages, setGoal, setRunning, setSessionHolds, setWorkspacePath)
        })
        .catch(() => {
          if (!live || painted || announced) {
            return
          }

          // Selection already cleared the previous transcript. Toast once so
          // the empty desk is a failed open, not a silent blank.
          announced = true
          resumeFailedRef.current()
        })
    }

    pull()
    const timer = window.setInterval(pull, 4000)

    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [owner, input.gateway, sessionId])

  return {
    profiles,
    projects,
    sessions,
    presence,
    owner,
    ownerId,
    setOwnerId,
    sessionId,
    setSessionId,
    messages,
    setMessages,
    goal,
    running,
    workspacePath,
    sessionHolds
  }
}

function clearDesk(
  setMessages: (messages: AtelierMessage[]) => void,
  setGoal: (goal: GoalFacts | null) => void,
  setRunning: (running: boolean) => void,
  setWorkspacePath: (path: string | null) => void
) {
  setMessages([])
  setGoal(null)
  setRunning(false)
  setWorkspacePath(null)
}

function paintTranscript(
  transcript: AtelierTranscript,
  selected: string,
  setMessages: (messages: AtelierMessage[]) => void,
  setGoal: (goal: GoalFacts | null) => void,
  setRunning: (running: boolean) => void,
  setSessionHolds: (update: (current: Record<string, MaidHold>) => Record<string, MaidHold>) => void,
  setWorkspacePath: (path: string | null) => void
) {
  setMessages(transcript.messages)
  setGoal(transcript.goal)
  setRunning(transcript.running)
  setSessionHolds(current => holdPatch(current, selected, transcript.sessionHold))
  setWorkspacePath(transcript.workspacePath)
}

async function profilePresence(
  gateway: AtelierGateway,
  profile: AtelierProfile
): Promise<readonly [string, PresenceTone]> {
  try {
    const rows = await gateway.listSessions(profile)

    if (rows.some(row => row.busy === true)) {
      return [profile.id, 'busy']
    }

    if (rows.some(row => row.busy === null)) {
      return [profile.id, 'unknown']
    }

    return [profile.id, 'idle']
  } catch {
    return [profile.id, 'unknown']
  }
}

function holdPatch(
  current: Readonly<Record<string, MaidHold>>,
  sessionId: string,
  hold: MaidHold | null
): Record<string, MaidHold> {
  if (hold) {
    return current[sessionId] === hold ? current : { ...current, [sessionId]: hold }
  }

  if (!(sessionId in current)) {
    return current
  }

  const next = { ...current }
  delete next[sessionId]

  return next
}
