// runyo — import-wizard state-machine hook. Bovenop de pure nav-reducers in
// importTypes.ts: React-state + schuif-animatie + transiente fase-state.
// De async-orkestratie (analyse/opslaan) leeft in ImportWizard (heeft de stores).

import { useState, useRef, useEffect, useCallback } from 'react'
import { Animated, AccessibilityInfo } from 'react-native'
import {
  navGo, navBack, navJumpBackTo, navRestart, currentStep,
  PHASE_OF, NO_BACK, NO_CLOSE,
  type Step, type WizardData, type DayMode,
} from './importTypes'

const TODAY_ISO = () => new Date().toISOString().slice(0, 10)

const INITIAL_DATA: WizardData = {
  source: 'pdf',
  link: '',
  fileB64: '',
  fileMime: '',
  fileName: '',
  startDate: TODAY_ISO(),
  dayMode: { mode: 'keep' },
  result: null,
  error: '',
}

export function useImportFlow() {
  const [hist, setHist] = useState<Step[]>(['source'])
  const dirRef = useRef(1)
  const [data, setData] = useState<WizardData>(INITIAL_DATA)

  // Transiente fase-state.
  const [aPct, setAPct] = useState(0)
  const [showCancel, setShowCancel] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [closing, setClosing] = useState(false)

  const step = currentStep(hist)
  const phaseIndex = PHASE_OF[step]
  const canBack = !NO_BACK[step]
  const canClose = !NO_CLOSE[step]

  // ── Schuif-animatie (alleen transform; reduced-motion = geen slide) ──────────
  const translateX = useRef(new Animated.Value(0)).current
  const reduceMotion = useRef(false)
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(v => { reduceMotion.current = v }).catch(() => {})
  }, [])
  useEffect(() => {
    if (reduceMotion.current) { translateX.setValue(0); return }
    translateX.setValue(dirRef.current * 28)
    const anim = Animated.spring(translateX, { toValue: 0, tension: 220, friction: 22, useNativeDriver: true })
    anim.start()
    return () => anim.stop()
  }, [hist, translateX])

  const patch = useCallback((next: Partial<WizardData>) => setData(d => ({ ...d, ...next })), [])

  const go = useCallback((next: Step) => { dirRef.current = 1; setHist(h => navGo(h, next)) }, [])
  const back = useCallback(() => { dirRef.current = -1; setHist(h => navBack(h)) }, [])
  const jumpBackTo = useCallback((id: Step) => { dirRef.current = -1; setHist(h => navJumpBackTo(h, id)) }, [])

  const restart = useCallback(() => {
    dirRef.current = -1
    setHist(navRestart())
    setData(INITIAL_DATA)
    setAPct(0); setShowCancel(false); setTimedOut(false); setSavedCount(0); setClosing(false)
  }, [])

  const setDayMode = useCallback((dayMode: DayMode) => patch({ dayMode }), [patch])

  return {
    step, phaseIndex, canBack, canClose,
    animStyle: { transform: [{ translateX }] },
    data, patch, setDayMode,
    go, back, jumpBackTo, restart,
    aPct, setAPct,
    showCancel, setShowCancel,
    timedOut, setTimedOut,
    savedCount, setSavedCount,
    closing, setClosing,
  }
}

export type ImportFlow = ReturnType<typeof useImportFlow>
