import { createSelector, Selector } from "@ngrx/store";
import { DEFAULT_KEY, HistoryKey, UndoRedoState } from "./undo-redo.state";

export type HistoryProps = { key: HistoryKey };

export const createHistorySelectors = <T, V extends UndoRedoState>(
  selector: Selector<T, V>
) => {
  const selectHistory = createSelector(
    selector,
    (state, { key }: HistoryProps = { key: DEFAULT_KEY }) =>
      state.histories[key]
  );
  const selectCanUndo = createSelector(selectHistory, (history) => {
    return history.undoable.length > 0;
  });
  const selectCanRedo = createSelector(selectHistory, (history) => {
    return history.undone.length > 0;
  });
  return {
    selectHistory,
    selectCanUndo,
    selectCanRedo,
  };
};
