import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { predictionOpen } from '../logic'
import type { Snapshot, Store } from '../store/store'
import type { Guess, Prediction, Watch } from '../types'
import type { Flash } from './useToast'

const OPENED_KEY = 'pititi.predictions.opened.v1'

function readOpened(): Set<string> | null {
  try {
    const raw = localStorage.getItem(OPENED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}
function writeOpened(ids: Set<string>) {
  try {
    localStorage.setItem(OPENED_KEY, JSON.stringify([...ids]))
  } catch {
    // Worst case the "they're open" message shows again
  }
}

/** Predictions: what's loaded, adding, guessing, judging, and telling you when a prediction just opened. */
export function usePredictions(store: Store, me: string | null, flash: Flash) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [guesses, setGuesses] = useState<Guess[]>([])
  /** Predictions need migration 017; hidden until it's run */
  const [predictOn, setPredictOn] = useState(false)

  const take = useCallback((snap: Partial<Pick<Snapshot, 'predictions' | 'guesses' | 'predictOn'>>) => {
    if (snap.predictions) setPredictions(snap.predictions)
    if (snap.guesses) setGuesses(snap.guesses)
    if (snap.predictOn !== undefined) setPredictOn(snap.predictOn)
  }, [])

  const sameGuess = (a: Guess, b: Pick<Guess, 'predictionId' | 'personId'>) => a.predictionId === b.predictionId && a.personId === b.personId

  async function add(p: Omit<Prediction, 'createdBy' | 'createdAt'>, guess: string): Promise<boolean> {
    if (!me) return false
    const now = new Date().toISOString()
    const pred: Prediction = { ...p, createdBy: me, createdAt: now }
    const first: Guess = { predictionId: p.id, personId: me, guess: guess.trim(), verdict: null, createdAt: now }
    setPredictions((list) => [...list, pred])
    setGuesses((list) => [...list, first])
    try {
      await store.addPrediction(pred, first)
      flash(t('Prediction sealed 🔮'))
      return true
    } catch {
      setPredictions((list) => list.filter((x) => x.id !== p.id))
      setGuesses((list) => list.filter((g) => g.predictionId !== p.id))
      flash(t("Couldn't save it. Check your connection."))
      return false
    }
  }

  async function guess(predictionId: string, text: string): Promise<boolean> {
    if (!me) return false
    const g: Guess = { predictionId, personId: me, guess: text.trim(), verdict: null, createdAt: new Date().toISOString() }
    const before = guesses.find((x) => sameGuess(x, g)) ?? null
    setGuesses((list) => [...list.filter((x) => !sameGuess(x, g)), g])
    try {
      await store.setGuess(g)
      flash(t('Guess sealed 🔮'))
      return true
    } catch {
      setGuesses((list) => [...list.filter((x) => !sameGuess(x, g)), ...(before ? [before] : [])])
      flash(t("Couldn't save it. Check your connection."))
      return false
    }
  }

  async function judge(predictionId: string, personId: string, verdict: Guess['verdict']) {
    const before = guesses.find((x) => sameGuess(x, { predictionId, personId }))
    if (!before) return
    // Tapping the same verdict again clears it
    const next = before.verdict === verdict ? null : verdict
    setGuesses((list) => list.map((x) => (sameGuess(x, before) ? { ...x, verdict: next } : x)))
    try {
      await store.judgeGuess(predictionId, personId, next)
    } catch {
      setGuesses((list) => list.map((x) => (sameGuess(x, before) ? before : x)))
      flash(t("Couldn't save it. Check your connection."))
    }
  }

  async function remove(p: Prediction) {
    const keep = guesses.filter((g) => g.predictionId === p.id)
    setPredictions((list) => list.filter((x) => x.id !== p.id))
    setGuesses((list) => list.filter((g) => g.predictionId !== p.id))
    try {
      await store.removePrediction(p.id)
      flash(t('Prediction removed'))
    } catch (e) {
      setPredictions((list) => [...list, p])
      setGuesses((list) => [...list, ...keep])
      flash((e as Error).message || t("Couldn't remove it. Check your connection."))
    }
  }

  return { predictions, guesses, predictOn, take, add, guess, judge, remove }
}

/** When logging an episode opens a prediction, say so once (with a button to the show). First run: just remember. */
export function useOpenedPredictions(predictions: Prediction[], watches: Watch[], onOpened: (p: Prediction) => void) {
  const cb = useRef(onOpened)
  useEffect(() => {
    cb.current = onOpened
  })
  useEffect(() => {
    if (!predictions.length || !watches.length) return
    const open = predictions.filter((p) => predictionOpen(p, watches))
    const seen = readOpened()
    if (!seen) return writeOpened(new Set(open.map((p) => p.id)))
    const fresh = open.filter((p) => !seen.has(p.id))
    if (!fresh.length) return
    fresh.forEach((p) => seen.add(p.id))
    writeOpened(seen)
    cb.current(fresh[0])
  }, [predictions, watches])
}
