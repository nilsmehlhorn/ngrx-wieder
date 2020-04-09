import {Action, ActionReducer, On} from '@ngrx/store'
import produce, {applyPatches, enablePatches, Patch, PatchListener} from 'immer'
import {fromNullable} from 'fp-ts/lib/Option'
import {defaultConfig, PatchActionReducer, Patches, WiederConfig} from './model'

export interface UndoRedo {
  createUndoRedoReducer: <S, A extends Action = Action>(initialState: S, ...ons: On<S>[]) => ActionReducer<S, A>
  wrapReducer: <S, A extends Action = Action>(reducer: PatchActionReducer<S, A>) => ActionReducer<S, A>
}

export function undoRedo(config: WiederConfig = {}): UndoRedo {
  enablePatches()
  return {
    createUndoRedoReducer: (initialState, ...ons) =>
      create(initialState, ons, config),
    wrapReducer: reducer => wrap(reducer, config)
  }
}

function create<S, A extends Action = Action>(initialState: S, ons: On<S>[], config: WiederConfig) {
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
  return wrap(reducer, config)
}

function wrap<S, A extends Action = Action>(reducer: PatchActionReducer<S, A>, config: WiederConfig) {
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

  let undoable: Patches[] = []
  let undone: Patches[] = []
  let lastAction: Action
  let mergeBroken = false

  const isUndoable = (action: Action) => !allowedActionTypes.length ||
    allowedActionTypes.some(type => type === action.type)
  const shouldMerge = (a: Action, b: Action): boolean => {
    return !mergeBroken && a.type === b.type
      && (
        mergeActionTypes.includes(a.type)
        || (fromNullable(mergeRules.get(a.type)).map(r => r(a, b)).getOrElse(false))
      )
  }
  const applyTracking = (state: S): S => {
    if (track) {
      return {
        ...state,
        canUndo: undoable.length > 0,
        canRedo: undone.length > 0
      }
    }
    return state
  }
  const recordPatches = (action: Action, patches: Patch[], inversePatches: Patch[]) => {
    if (patches.length) {
      undoable = fromNullable(lastAction)
        .filter(last => shouldMerge(last, action))
        .map(() => [
          {
            // merge patches for consecutive actions of same type
            patches: [...undoable[0].patches, ...patches],
            inversePatches: [...inversePatches, ...undoable[0].inversePatches]
          },
          ...undoable.slice(1)
        ])
        .getOrElse([
          // remember differences while dropping at buffer max-size
          {patches, inversePatches},
          ...undoable.slice(0, maxBufferSize - 1)
        ])
      undone = [] // clear redo stack
      lastAction = action // clear redo stack
      mergeBroken = false
    }
  }

  return (state: S, action: A): S => {
    switch (action.type) {
      case undoActionType: {
        return fromNullable(undoable.shift()) // take patches from last undone action
          .map(patches => {
            undone = [patches].concat(undone) // put patches on redo stack (Array.shift somehow breaks with AOT)
            return applyTracking(applyPatches(state, patches.inversePatches)) // reverse patches
          }).getOrElse(state)
      }
      case redoActionType: {
        return fromNullable(undone.shift()) // take patches from last undone action
          .map(patches => {
            undoable = [patches].concat(undoable) // put patches on undo stack (Array.shift somehow breaks with AOT)
            return applyTracking(applyPatches(state, patches.patches)) // reverse patches
          }).getOrElse(state)
      }
      case clearActionType: {
        undone = []
        undoable = []
        mergeBroken = false
        lastAction = null
        return applyTracking(state)
      }
      case breakMergeActionType: {
        mergeBroken = true
        return state
      }
      default: {
        const listener = isUndoable(action) ?
          (patches, inversePatches) => recordPatches(action, patches, inversePatches)
          : undefined
        return applyTracking(reducer(state, action, listener))
      }
    }
  }
}
