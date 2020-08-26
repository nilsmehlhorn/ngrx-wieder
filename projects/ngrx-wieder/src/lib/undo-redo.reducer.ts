import {Action, ActionReducer, INIT, On} from '@ngrx/store'
import produce, {applyPatches, enablePatches, Patch, PatchListener} from 'immer'
import {defaultConfig, PatchActionReducer, Patches, Segmenter, WiederConfig} from './model'

export interface UndoRedo {
  createUndoRedoReducer: <S, A extends Action = Action>(initialState: S, ...ons: On<S>[]) => ActionReducer<S, A>
  createSegmentedUndoRedoReducer: <S, A extends Action =
    Action>(initialState: S, segmenter: Segmenter<S>, ...ons: On<S>[]) => ActionReducer<S, A>
  wrapReducer: <S, A extends Action = Action>(reducer: PatchActionReducer<S, A>, segmenter?: Segmenter<S>) => ActionReducer<S, A>
}

export function undoRedo(config: WiederConfig = {}): UndoRedo {
  enablePatches()
  return {
    createUndoRedoReducer: <S>(initialState: S, ...ons: On<S>[]) =>
      create(initialState, ons, config),
    createSegmentedUndoRedoReducer: <S>(initialState: S, segmenter: Segmenter<S>, ...ons: On<S>[]) =>
      create(initialState, ons, config, segmenter),
    wrapReducer: (reducer, segmenter) => wrap(reducer, config, segmenter)
  }
}

function create<S, A extends Action = Action>(initialState: S, ons: On<S>[], config: WiederConfig, segmenter?: Segmenter<S>) {
  const map: { [key: string]: ActionReducer<S, A> } = {}
  for (const on of ons) {
    for (const type of on.types) {
      if (map[type]) {
        const existingReducer = map[type]
        map[type] = (state, action) => on.reducer(existingReducer(state, action), action)
      } else {
        map[type] = on.reducer
      }
    }
  }
  const reducer = ((state: S = initialState, action: A, listener: PatchListener) => {
    const r = map[action.type]
    if (r) {
      return produce(state, (draft: S) => r(draft, action), listener)
    }
    return state
  }) as PatchActionReducer<S, A>
  return wrap(reducer, config, segmenter)
}

type Key = string | number

type KeyMap<T> = {
  [id in string | number]: T
}
type Accessor<T> = [() => T, (t: T) => void]

interface Accessors {
  undoable: Accessor<Patches[]>
  undone: Accessor<Patches[]>
  lastAction: Accessor<Action>
  mergeBroken: Accessor<boolean>
}

const createPatchAccessor = (map: KeyMap<Patches[]>, key: Key): Accessor<Patches[]> => {
  return [
    () => {
      let patches = map[key]
      if (!patches) {
        patches = map[key] = []
      }
      return patches
    },
    (p: Patches[]) => map[key] = p
  ]
}

const createAccessor = <T>(map: KeyMap<T>, key: Key): Accessor<T> => {
  return [
    () => map[key],
    (t: T) => map[key] = t
  ]
}

const tracker = <S>(track: boolean) => {
  if (!track) {
    return (state: S) => state
  }
  return (state: S, accessors: Accessors): S => {
    const {undoable: [getUndoable], undone: [getUndone]} = accessors
    return {
      ...state,
      canUndo: getUndoable().length > 0,
      canRedo: getUndone().length > 0
    }
  }
}

function wrap<S, A extends Action = Action>(reducer: PatchActionReducer<S, A>, config: WiederConfig,
                                            segmenter: Segmenter<S> = () => 'DEFAULT') {
  const {
    allowedActionTypes,
    mergeActionTypes,
    mergeRules,
    maxBufferSize,
    undoActionType,
    redoActionType,
    breakMergeActionType,
    clearActionType,
    track,
    segmentationOverride
  } = {...defaultConfig, ...config}

  const undoableMap: KeyMap<Patches[]> = {}
  const undoneMap: KeyMap<Patches[]> = {}

  const lastActions: KeyMap<Action> = {}
  const mergeBrokens: KeyMap<boolean> = {}

  const isUndoable = (action: Action) => !allowedActionTypes.length ||
    allowedActionTypes.some(type => type === action.type)

  const shouldMerge = (a: Action, b: Action): boolean => {
    return a.type === b.type
      && (
        mergeActionTypes.includes(a.type)
        || (mergeRules[a.type]?.(a, b) ?? false)
      )
  }

  const applyTracking = tracker<S>(track)

  const recordPatches = (accessors: Accessors, action: Action, patches: Patch[], inversePatches: Patch[]) => {
    const {
      undoable: [getUndoable, setUndoable],
      undone: [getUndone, setUndone],
      lastAction: [getLastAction, setLastAction],
      mergeBroken: [getMergeBroken, setMergeBroken]
    } = accessors
    if (patches.length) {
      if (getLastAction() && !getMergeBroken() && shouldMerge(getLastAction(), action)) {
        setUndoable([
          {
            // merge patches for consecutive actions of same type
            patches: [...getUndoable()[0].patches, ...patches],
            inversePatches: [...inversePatches, ...getUndoable()[0].inversePatches]
          },
          ...getUndoable().slice(1)
        ])
      } else {
        setUndoable([
          // remember differences while dropping at buffer max-size
          {patches, inversePatches},
          ...getUndoable().slice(0, maxBufferSize - 1)
        ])
      }
      setUndone([]) // clear redo stack
      setLastAction(action)
      setMergeBroken(false)
    }
  }

  const segmentationKey = (state: S, action?: A): Key => {
    return (action && segmentationOverride(action)) || segmenter(state)
  }

  const resolveAccessors = (key: Key): Accessors => {
    return {
      undoable: createPatchAccessor(undoableMap, key),
      undone: createPatchAccessor(undoneMap, key),
      lastAction: createAccessor(lastActions, key),
      mergeBroken: createAccessor(mergeBrokens, key)
    }
  }

  return (state: S, action: A): S => {
    if (action.type === INIT) {
      // let reducer initialize state
      return reducer(state, action)
    }
    const key = segmentationKey(state, action)
    const accessors = resolveAccessors(key)
    const {
      undoable: [getUndoable, setUndoable],
      undone: [getUndone, setUndone],
      lastAction: [getLastAction, setLastAction],
      mergeBroken: [getMergeBroken, setMergeBroken]
    } = accessors
    switch (action.type) {
      case undoActionType: {
        const undoPatches = getUndoable().shift() // take patches from last (re)done action
        if (undoPatches) {
          // put patches on redo stack (Array.shift somehow breaks with AOT)
          setUndone([undoPatches].concat(getUndone()))
          return reducer(applyTracking(applyPatches(state, undoPatches.inversePatches), accessors), action) // reverse
        }
        return state
      }
      case redoActionType: {
        const redoPatches = getUndone().shift() // take patches from last undone action
        if (redoPatches) {
          // put patches on undo stack (Array.shift somehow breaks with AOT)
          setUndoable([redoPatches].concat(getUndoable()))
          return reducer(applyTracking(applyPatches(state, redoPatches.patches), accessors), action) // replay
        }
        return state
      }
      case clearActionType: {
        setUndone([])
        setUndoable([])
        setMergeBroken(false)
        setLastAction(undefined)
        return applyTracking(state, accessors)
      }
      case breakMergeActionType: {
        setMergeBroken(true)
        return state
      }
      default: {
        const undoable = isUndoable(action)
        const listener = undoable ?
          (patches, inversePatches) => recordPatches(accessors, action, patches, inversePatches)
          : undefined
        const nextState = reducer(state, action, listener)
        // due to segmentation override active patch-stack might be different
        const trackingKey = segmentationKey(nextState)
        const trackingAccessor = trackingKey !== key ? resolveAccessors(trackingKey) : accessors
        return applyTracking(nextState, trackingAccessor)
      }
    }
  }
}
