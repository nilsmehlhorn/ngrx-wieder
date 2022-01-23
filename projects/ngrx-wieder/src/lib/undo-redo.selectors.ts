import { createSelector, Selector } from "@ngrx/store";
import { Segmenter } from "./config";
import {
  DEFAULT_KEY,
  History,
  HistoryKey,
  UndoRedoState,
} from "./undo-redo.state";

export type HistoryProps = { key: HistoryKey };

export const createHistorySelectors = <T, V extends UndoRedoState>(
  selector: Selector<T, V>,
  segmenter: Segmenter<V> = () => DEFAULT_KEY
) => {
  const selectHistory = (props?: HistoryProps) =>
    createSelector(
      selector,
      (state): History | undefined => state.histories[props?.key ?? segmenter(state)]
    );
  const selectCanUndo = (props?: HistoryProps) =>
    createSelector(
      selectHistory(props),
      (history) => history && history.undoable.length > 0
    );
  const selectCanRedo = (props?: HistoryProps) =>
    createSelector(
      selectHistory(props),
      (history) => history && history.undone.length > 0
    );
  return {
    selectHistory,
    selectCanUndo,
    selectCanRedo,
  };
};
