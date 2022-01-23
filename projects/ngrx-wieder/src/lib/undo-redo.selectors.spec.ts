import { identity } from "rxjs";
import { genId } from "./test-util/id";
import * as SegmentedStore from "./test-util/segmented-store";
import * as TestStore from "./test-util/store";
import { createHistorySelectors } from "./undo-redo.selectors";
import { DEFAULT_KEY, History, Step } from "./undo-redo.state";

describe("UndoRedo Selectors", () => {
  it("should select default history", () => {
    const {
      selectHistory,
      selectCanRedo,
      selectCanUndo,
    } = createHistorySelectors<TestStore.TestState, TestStore.TestState>(
      (state) => state
    );
    const todo: TestStore.Todo = {
      id: genId(),
      text: "Do laundry",
      checked: false,
    };
    const step: Step = {
      patches: {
        patches: [
          {
            op: "add",
            path: ["todos", 0],
            value: todo,
          },
        ],
        inversePatches: [
          { op: "replace", path: ["todos", "length"], value: 0 },
        ],
      },
      actions: [{ type: TestStore.addTodo.type }],
    };
    const undoableHistory: History = {
      undoable: [step],
      undone: [],
      mergeBroken: false,
    };
    expect(
      selectHistory().projector({
        todos: [todo],
        viewed: null,
        mood: 50,
        histories: {
          [DEFAULT_KEY]: undoableHistory,
        },
      })
    ).toEqual(undoableHistory);
    expect(selectCanUndo().projector(undoableHistory)).toBeTruthy();
    expect(selectCanRedo().projector(undoableHistory)).toBeFalsy();
    const redoableHistory: History = {
      undoable: [],
      undone: [step],
      mergeBroken: false,
    };
    expect(selectCanUndo().projector(redoableHistory)).toBeFalsy();
    expect(selectCanRedo().projector(redoableHistory)).toBeTruthy();
  });

  it("should support empty history", () => {
    const {
      selectHistory,
      selectCanRedo,
      selectCanUndo,
    } = createHistorySelectors<TestStore.TestState, TestStore.TestState>(
      identity
    );
    const state: TestStore.TestState = {
      ...TestStore.initialState,
      histories: {},
    };
    const history = selectHistory().projector(state);
    expect(history).toBeUndefined();
    expect(selectCanUndo().projector(history)).toBeFalsy();
    expect(selectCanRedo().projector(history)).toBeFalsy();
  });

  describe("with segmentation", () => {
    const state: SegmentedStore.TestState = {
      activeDocument: "a",
      documents: {
        a: { name: "Bill 2", content: "Total 100$" },
        b: { name: "Letter", content: "Dear ..." },
        c: { name: "Notes", content: "Write more tests" },
      },
      histories: {
        a: {
          undoable: [
            {
              patches: {
                patches: [
                  {
                    op: "replace",
                    path: ["documents", "a", "name"],
                    value: "Bill 2",
                  },
                ],
                inversePatches: [
                  {
                    op: "replace",
                    path: ["documents", "a", "name"],
                    value: "Bill",
                  },
                ],
              },
              actions: [{ type: "[Test] Name Change" }],
            },
          ],
          undone: [],
          mergeBroken: false,
        },
        b: {
          undoable: [],
          undone: [
            {
              patches: {
                patches: [
                  {
                    op: "replace",
                    path: ["documents", "b", "name"],
                    value: "Letter 2",
                  },
                ],
                inversePatches: [
                  {
                    op: "replace",
                    path: ["documents", "b", "name"],
                    value: "Letter",
                  },
                ],
              },
              actions: [{ type: "[Test] Name Change" }],
            },
          ],
          mergeBroken: false,
        },
      },
    };

    let selectors: ReturnType<typeof createHistorySelectors>;

    beforeEach(() => {
      selectors = createHistorySelectors<
        SegmentedStore.TestState,
        SegmentedStore.TestState
      >(identity, SegmentedStore.segmenter);
    });

    it("should select active history", () => {
      const history = selectors.selectHistory().projector(state);
      expect(history).toEqual(state.histories.a);
      expect(selectors.selectCanUndo().projector(history)).toBeTruthy();
      expect(selectors.selectCanRedo().projector(history)).toBeFalsy();
    });
    it("should allow key override", () => {
      const history = selectors.selectHistory({ key: "b" }).projector(state);
      expect(history).toEqual(state.histories.b);
      expect(selectors.selectCanUndo().projector(history)).toBeFalsy();
      expect(selectors.selectCanRedo().projector(history)).toBeTruthy();
    });
  });
});
