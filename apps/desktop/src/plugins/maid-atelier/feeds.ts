import { useEffect, useState } from 'react'

import { COPY } from './copy'
import type { AtelierGateway, AtelierMessage, AtelierProfile, AtelierSession, AtelierTranscript } from './gateway'
import { type GoalFacts, type MaidHold, type ProgressCard, transcriptMarkdown } from './model'
import { emptyProgressCard, progressKey, type ProgressShelf } from './progress-store'
import type { PresenceTone } from './theme'

export function useAtelierFeeds(input: { gateway: AtelierGateway; gatewayOpen: boolean; shelf: ProgressShelf }) {
  const [profiles, setProfiles] = useState<AtelierProfile[]>([])
  const [sessions, setSessions] = useState<AtelierSession[]>([])
  const [presence, setPresence] = useState<Record<string, PresenceTone>>({})
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AtelierMessage[]>([])
  const [goal, setGoal] = useState<GoalFacts | null>(null)
  const [running, setRunning] = useState(false)
  const [card, setCard] = useState<ProgressCard | null>(null)
  const [readerTitle, setReaderTitle] = useState('')
  const [readerBody, setReaderBody] = useState('')
  const [sessionHolds, setSessionHolds] = useState<Record<string, MaidHold>>({})
  const owner = profiles.find(profile => profile.id === ownerId) ?? null

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

      return () => {
        live = false
      }
    }

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

    return () => {
      live = false
    }
  }, [owner, input.gateway, input.gatewayOpen])

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
      setMessages([])
      setGoal(null)
      setRunning(false)
      setCard(null)
      setReaderTitle('')
      setReaderBody('')

      return () => {
        live = false
      }
    }

    const selected = sessionId
    setCard(input.shelf.read(progressKey(selected)) ?? emptyProgressCard(selected))

    const pull = () => {
      input.gateway
        .resume(owner, selected)
        .then(transcript => {
          if (live) {
            paintTranscript(
              transcript,
              selected,
              sessions,
              setMessages,
              setGoal,
              setRunning,
              setSessionHolds,
              setReaderTitle,
              setReaderBody
            )
          }
        })
        .catch(() => {
          if (live) {
            setGoal(null)
          }
        })
    }

    pull()
    const timer = window.setInterval(pull, 4000)

    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [owner, input.gateway, sessionId, sessions, input.shelf])

  return {
    profiles,
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
    card,
    setCard,
    readerTitle,
    readerBody,
    sessionHolds
  }
}

function paintTranscript(
  transcript: AtelierTranscript,
  selected: string,
  sessions: readonly AtelierSession[],
  setMessages: (messages: AtelierMessage[]) => void,
  setGoal: (goal: GoalFacts | null) => void,
  setRunning: (running: boolean) => void,
  setSessionHolds: (update: (current: Record<string, MaidHold>) => Record<string, MaidHold>) => void,
  setReaderTitle: (title: string) => void,
  setReaderBody: (body: string) => void
) {
  setMessages(transcript.messages)
  setGoal(transcript.goal)
  setRunning(transcript.running)
  setSessionHolds(current => holdPatch(current, selected, transcript.sessionHold))
  const title = sessions.find(session => session.id === selected)?.title || COPY.currentSession
  setReaderTitle(title)
  setReaderBody(
    transcriptMarkdown(
      title,
      transcript.messages.map(message => ({ name: message.name, text: message.text }))
    )
  )
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
