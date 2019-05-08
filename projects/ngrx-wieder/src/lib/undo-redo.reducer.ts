import {Action, ActionReducer} from '@ngrx/store'
import {applyPatches} from 'immer'
import {fromNullable} from 'fp-ts/lib/Option'
import {defaultConfig, PatchActionReducer, Patches, WiederConfig} from './model'

const undoReducer = <T>(reducer: PatchActionReducer<T>, config: WiederConfig = {}): ActionReducer<T> => {

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
  const applyTracking = (state: T): T => {
    if (track) {
      return {
        ...state,
        canUndo: undoable.length > 0,
        canRedo: undone.length > 0
      }
    }
    return state
  }

  return (state: T, action) => {
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
        return applyTracking(reducer(state, action))
      }
      case breakMergeActionType: {
        mergeBroken = true
        return state
      }
      default: {
        if (isUndoable(action)) {
          return applyTracking(reducer(state, action, (patches, inversePatches) => {
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
          }))
        }
        return reducer(state, action)
      }
    }
  }
}

/**
 * Factory function for constructing an undoRedo meta-reducer.
 * @param config configuration to use for initialization
 */
export const undoRedo = (config?: WiederConfig) => <T>(reducer: PatchActionReducer<T>) => undoReducer(reducer, config)
