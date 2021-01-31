import { Action, ActionReducer } from "@ngrx/store";
import { Patch, PatchListener } from "immer";

/**
 * Reducer extension for capturing patches from immer.
 */
export interface PatchActionReducer<S, A extends Action = Action>
  extends ActionReducer<S, A> {
  (state: S | undefined, action: A, patchListener: PatchListener):
    | S
    | undefined;
}

/**
 * Predicate for deciding whether differences from
 * two consecutive actions of the same type should be merged.
 */
export type MergeRule = (a: Action, b: Action) => boolean;

/**
 * Segmenter for resolving identifier of unique undo-redo stacks.
 */
export type Segmenter<S> = (state: S) => string | number;

/**
 * Configuration for undoRedo reducer.
 */
export interface WiederConfig {
  /**
   * How many state differences should be buffered in
   * either direction.
   */
  maxBufferSize?: number;
  /**
   * Types of actions to use for calculating patches
   * between states (leave empty to allow all actions).
   */
  allowedActionTypes?: string[];
  /**
   * Types of actions whose state difference should be
   * merged when they appear consecutively
   */
  mergeActionTypes?: string[];
  /**
   * Predicates for deciding whether differences from
   * two consecutive actions of the same type should be merged.
   */
  mergeRules?: { [key: string]: MergeRule };
  /**
   * Override for the undo action's type.
   */
  undoActionType?: string;
  /**
   * Override for the redo action's type.
   */
  redoActionType?: string;
  /**
   * Override for the break-merge action's type.
   */
  breakMergeActionType?: string;
  /**
   * Override for the clear action's type.
   */
  clearActionType?: string;
  /**
   * Override for active segmentation based on key resolved from action
   */
  segmentationOverride?: (action: Action) => string | number | undefined;
  /**
   * Whether the payload of all (true), none(false) or some (predicate) actions should be tracked in histories.
   */
  trackActionPayload?: boolean | ((action: Action) => boolean);
}

export const defaultConfig: WiederConfig = {
  allowedActionTypes: [],
  mergeActionTypes: [],
  mergeRules: {},
  maxBufferSize: 32,
  undoActionType: "UNDO",
  redoActionType: "REDO",
  breakMergeActionType: "BREAK_MERGE",
  clearActionType: "CLEAR",
  segmentationOverride: () => undefined,
  trackActionPayload: false,
};
