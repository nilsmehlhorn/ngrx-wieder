import {Action, ActionReducer, On} from '@ngrx/store'
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

type PatchMap = {
  [id in string | number]: Patches[]
}

type PatchAccessor = [() => Patches[], (patches: Patches[]) => void]

interface PatchAccessors {
  undoable: PatchAccessor
  undone: PatchAccessor
}

const patchAccessor = (map: PatchMap, key: Key): PatchAccessor => {
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

const tracker = <S>(track: boolean) => {
  if (!track) {
    return (state: S) => state
  }
  return (state: S, accessors: PatchAccessors): S => {
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
    track
  } = {...defaultConfig, ...config}

  const undoableMap: PatchMap = {}
  const undoneMap: PatchMap = {}

  let lastAction: Action
  let mergeBroken = false

  const isUndoable = (action: Action) => !allowedActionTypes.length ||
    allowedActionTypes.some(type => type === action.type)

  const shouldMerge = (a: Action, b: Action): boolean => {
    return !mergeBroken && a.type === b.type
      && (
        mergeActionTypes.includes(a.type)
        || (mergeRules.get(a.type) ? mergeRules.get(a.type)(a, b) : false)
      )
  }

  const applyTracking = tracker<S>(track)

  const recordPatches = (accessors: PatchAccessors, action: Action, patches: Patch[], inversePatches: Patch[]) => {
    const {
      undoable: [getUndoable, setUndoable],
      undone: [getUndone, setUndone]
    } = accessors
    if (patches.length) {
      if (lastAction && shouldMerge(lastAction, action)) {
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
      lastAction = action
      mergeBroken = false
    }
  }

  const patchAccessors = (state: S): PatchAccessors => {
    const key = segmenter(state)
    const undoableAccessor = patchAccessor(undoableMap, key)
    const undoneAccessor = patchAccessor(undoneMap, key)
    return {undoable: undoableAccessor, undone: undoneAccessor}
  }

  return (state: S, action: A): S => {
    if (!state) {
      // let reducer initialize state
      return reducer(state, action)
    }
    const accessors = patchAccessors(state)
    const {
      undoable: [getUndoable, setUndoable],
      undone: [getUndone, setUndone]
    } = accessors
    switch (action.type) {
      case undoActionType: {
        const undoPatches = getUndoable().shift() // take patches from last (re)done action
        if (undoPatches) {
          // put patches on redo stack (Array.shift somehow breaks with AOT)
          setUndone([undoPatches].concat(getUndone()))
          return applyTracking(applyPatches(state, undoPatches.inversePatches), accessors) // reverse
        }
        return state
      }
      case redoActionType: {
        const redoPatches = getUndone().shift() // take patches from last undone action
        if (redoPatches) {
          // put patches on undo stack (Array.shift somehow breaks with AOT)
          setUndoable([redoPatches].concat(getUndoable()))
          return applyTracking(applyPatches(state, redoPatches.patches), accessors) // replay
        }
        return state
      }
      case clearActionType: {
        setUndone([])
        setUndoable([])
        mergeBroken = false
        lastAction = null
        return applyTracking(state, accessors)
      }
      case breakMergeActionType: {
        mergeBroken = true
        return state
      }
      default: {
        const undoable = isUndoable(action)
        const listener = undoable ?
          (patches, inversePatches) => recordPatches(accessors, action, patches, inversePatches)
          : undefined
        const nextState = reducer(state, action, listener)
        // active patch-stack might have changed, segmentation change must not undoable
        const nextAccessors = undoable ? accessors : patchAccessors(nextState)
        return applyTracking(nextState, nextAccessors)
      }
    }
  }
}
