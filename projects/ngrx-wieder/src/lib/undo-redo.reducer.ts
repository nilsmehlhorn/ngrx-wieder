import { Action, ActionReducer, INIT, On } from "@ngrx/store";
import produce, { applyPatches, enablePatches, PatchListener } from "immer";
import {
  defaultConfig,
  PatchActionReducer,
  Segmenter,
  WiederConfig,
} from "./config";
import { DEFAULT_KEY, History, HistoryKey, Step, UndoRedoState } from "./undo-redo.state";

export interface UndoRedo {
  createUndoRedoReducer: <S extends UndoRedoState, A extends Action = Action>(
    initialState: S,
    ...ons: On<S>[]
  ) => ActionReducer<S, A>;
  createSegmentedUndoRedoReducer: <
    S extends UndoRedoState,
    A extends Action = Action
  >(
    initialState: S,
    segmenter: Segmenter<S>,
    ...ons: On<S>[]
  ) => ActionReducer<S, A>;
  wrapReducer: <S extends UndoRedoState, A extends Action = Action>(
    reducer: PatchActionReducer<S, A>,
    segmenter?: Segmenter<S>
  ) => ActionReducer<S, A>;
}

export function undoRedo(config: WiederConfig = {}): UndoRedo {
  enablePatches();
  return {
    createUndoRedoReducer: <S extends UndoRedoState>(
      initialState: S,
      ...ons: On<S>[]
    ) => create(initialState, ons, config),
    createSegmentedUndoRedoReducer: <S extends UndoRedoState>(
      initialState: S,
      segmenter: Segmenter<S>,
      ...ons: On<S>[]
    ) => create(initialState, ons, config, segmenter),
    wrapReducer: (reducer, segmenter) => wrap(reducer, config, segmenter),
  };
}

function create<S extends UndoRedoState, A extends Action = Action>(
  initialState: S,
  ons: On<S>[],
  config: WiederConfig,
  segmenter?: Segmenter<S>
) {
  const map: { [key: string]: ActionReducer<S, A> } = {};
  for (const on of ons) {
    for (const type of on.types) {
      if (map[type]) {
        const existingReducer = map[type];
        map[type] = (state, action) =>
          on.reducer(existingReducer(state, action), action);
      } else {
        map[type] = on.reducer;
      }
    }
  }
  const reducer = ((
    state: S = initialState,
    action: A,
    listener: PatchListener
  ) => {
    const r = map[action.type];
    if (r) {
      return produce(state, (draft: S) => r(draft, action), listener);
    }
    return state;
  }) as PatchActionReducer<S, A>;
  return wrap(reducer, config, segmenter);
}

function wrap<S extends UndoRedoState, A extends Action = Action>(
  reducer: PatchActionReducer<S, A>,
  config: WiederConfig,
  segmenter: Segmenter<S> = () => DEFAULT_KEY
) {
  const {
    allowedActionTypes,
    mergeActionTypes,
    mergeRules,
    maxBufferSize,
    undoActionType,
    redoActionType,
    breakMergeActionType,
    clearActionType,
    segmentationOverride,
  } = { ...defaultConfig, ...config };

  const isUndoable = (action: Action) =>
    !allowedActionTypes.length ||
    allowedActionTypes.some((type) => type === action.type);

  const shouldMerge = (a: Action, b: Action): boolean => {
    return (
      a.type === b.type &&
      (mergeActionTypes.includes(a.type) ||
        (mergeRules[a.type]?.(a, b) ?? false))
    );
  };

  const segmentationKey = (state: S, action?: A): HistoryKey => {
    return (action && segmentationOverride(action)) || segmenter(state);
  };

  return (state: S, action: A): S => {
    if (action.type === INIT) {
      // let reducer initialize state
      return reducer(state, action);
    }
    const key = segmentationKey(state, action);
    const history = state.histories[key] || {undoable: [], undone: [], mergeBroken: false};
    switch (action.type) {
      case undoActionType: {
        const [undoStep, ...remainingUndoable] = history.undoable;
        if (undoStep) {
          const prependedUndone = [undoStep, ...history.undone];
          const undoneState: S = {
            ...applyPatches(state, undoStep.patches.inversePatches),
            histories: {
              ...state.histories,
              [key]: {
                ...history,
                undoable: remainingUndoable,
                undone: prependedUndone,
              },
            },
          };
          return reducer(undoneState, action);
        }
        return state;
      }
      case redoActionType: {
        const [redoStep, ...remainingUndone] = history.undone;
        if (redoStep) {
          const prependedUndoable = [redoStep, ...history.undoable];
          const redoneState: S = {
            ...applyPatches(state, redoStep.patches.patches),
            histories: {
              ...state.histories,
              [key]: {
                ...history,
                undoable: prependedUndoable,
                undone: remainingUndone,
              },
            },
          };
          return reducer(redoneState, action);
        }
        return state;
      }
      case clearActionType: {
        return {
          ...state,
          histories: {
            ...state.histories,
            [key]: {
              undoable: [],
              undone: [],
              mergeBroken: false,
            },
          },
        };
      }
      case breakMergeActionType: {
        return {
          ...state,
          histories: {
            ...state.histories,
            [key]: {
              ...history,
              mergeBroken: true,
            },
          },
        };
      }
      default: {
        let listener: PatchListener | undefined;
        let patchedHistory: History;
        if (isUndoable(action)) {
          listener = (patches, inversePatches) => {
            const [lastStep, ...otherSteps] = history.undoable;
            let undoable: Step[];
            if (patches.length) {
              if (
                lastStep?.action &&
                !history.mergeBroken &&
                shouldMerge(lastStep.action, action)
              ) {
                undoable = [
                  {
                    patches: {
                      // merge patches for consecutive actions of same type
                      patches: [...lastStep.patches.patches, ...patches],
                      inversePatches: [
                        ...inversePatches,
                        ...lastStep.patches.inversePatches,
                      ],
                    },
                    action,
                  },
                  ...otherSteps,
                ];
              } else {
                undoable = [
                  // remember differences while dropping at buffer max-size
                  { patches: { patches, inversePatches }, action },
                  ...history.undoable.slice(0, maxBufferSize - 1),
                ];
              }
              patchedHistory = {
                undoable,
                undone: [], // clear redo stack
                mergeBroken: false,
              };
            }
          };
        }
        const nextState = reducer(state, action, listener);
        if (patchedHistory) {
          return {
            ...nextState,
            histories: {
              ...state.histories,
              [key]: patchedHistory,
            },
          };
        }
        return nextState;
      }
    }
  };
}
