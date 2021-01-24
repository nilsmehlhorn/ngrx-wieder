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
  const selectHistory = createSelector(
    selector,
    (
      state,
      { key }: HistoryProps = { key: segmenter(state) }
    ): History | undefined => state.histories[key]
  );
  const selectCanUndo = createSelector(selectHistory, (history) => {
    return history && history.undoable.length > 0;
  });
  const selectCanRedo = createSelector(selectHistory, (history) => {
    return history && history.undone.length > 0;
  });
  return {
    selectHistory,
    selectCanUndo,
    selectCanRedo,
  };
};
