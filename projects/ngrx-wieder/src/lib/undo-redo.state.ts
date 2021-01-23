import { Action } from "@ngrx/store";
import { Patch } from "immer";

export interface Patches {
  patches: Patch[];
  inversePatches: Patch[];
}

export type Step = {
  patches: Patches;
  action: Action;
};

export type History = {
  undoable: Step[];
  undone: Step[];
  mergeBroken: boolean;
};

export type HistoryKey = string | number;

export type Histories = {
  [id in HistoryKey]: History;
};

export type UndoRedoState = {
  histories: Histories;
};

export const initialUndoRedoState: UndoRedoState = {
  histories: {},
};

export const DEFAULT_KEY: HistoryKey = "DEFAULT";
