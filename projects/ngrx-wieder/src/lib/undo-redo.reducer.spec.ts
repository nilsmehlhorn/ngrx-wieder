import { Action, ActionReducer } from "@ngrx/store";
import { WiederConfig } from "./config";
import { genId } from "./test-util/id";
import {
  addTodo,
  createOnReducer,
  createSwitchReducer,
  incrementMood,
  initialState,
  populatedState,
  redo,
  remove,
  removeTodo,
  reset,
  TestState,
  undo,
  viewTodo,
} from "./test-util/store";
import { DEFAULT_KEY, Step } from "./undo-redo.state";

const getStateWithoutHistories = ({ histories, ...state }: TestState) => state;

const expectToEqualWithoutHistory = (a: TestState, b: TestState) => {
  expect(getStateWithoutHistories(a)).toEqual(getStateWithoutHistories(b));
};

const test = (
  createReducer: (config?: WiederConfig) => ActionReducer<TestState, Action>
) => {
  it("should undo and redo any action", () => {
    const redoReducer = createReducer();
    const id = genId();
    const text = "Do laundry";
    const todo = { id, text, checked: false };
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
      actions: [{ type: addTodo.type }],
    };
    const doneState = redoReducer(initialState, addTodo({ id, text }));
    expect(doneState.todos).toEqual([todo]);
    expect(doneState.histories[DEFAULT_KEY]).toEqual({
      undoable: [step],
      undone: [],
      mergeBroken: false,
    });
    const undoneState = redoReducer(doneState, undo());
    expect(undoneState.todos).toEqual([]);
    expect(undoneState.histories[DEFAULT_KEY]).toEqual({
      undoable: [],
      undone: [step],
      mergeBroken: false,
    });
    const redoneState = redoReducer(undoneState, redo());
    expect(redoneState).toEqual(doneState);
  });

  it("should allow action payload in history", () => {
    const redoReducer = createReducer({ trackActionPayload: true });
    const id = genId();
    const text = "Do laundry";
    const todo = { id, text, checked: false };
    const doneState = redoReducer(initialState, addTodo({ id, text }));
    expect(doneState.todos).toEqual([todo]);
    expect(doneState.histories[DEFAULT_KEY]).toEqual({
      undoable: [
        {
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
          actions: [{ type: addTodo.type, id, text } as Action],
        },
      ],
      undone: [],
      mergeBroken: false,
    });
  });

  describe("when initialized with allowed actions", () => {
    let redoReducer: ActionReducer<TestState>;

    beforeEach(() => {
      redoReducer = createReducer({
        allowedActionTypes: [addTodo.type, removeTodo.type],
      });
    });

    it("should undo allowed actions", () => {
      const state = populatedState;
      const removeId = state.todos[0].id;
      const keepId = state.todos[1].id;
      const doneState = redoReducer(state, removeTodo({ id: removeId }));
      expect(doneState.todos.length).toEqual(2);
      expect(doneState.todos[0].text).toEqual("Relax");
      expect(doneState.todos[0].id).toEqual(keepId);
      const undoneState = redoReducer(doneState, undo());
      expect(undoneState.todos.length).toBe(3);
      expect(undoneState.todos[0].text).toEqual("Travel");
      expect(undoneState.todos[0].id).toEqual(removeId);
      expect(undoneState.todos[0].checked).toBeTruthy();
    });
    it("should redo allowed actions", () => {
      const state = populatedState;
      const removeId = state.todos[0].id;
      const keepId = state.todos[1].id;
      const doneState = redoReducer(state, removeTodo({ id: removeId }));
      expect(doneState.todos.length).toEqual(2);
      expect(doneState.todos[0].text).toEqual("Relax");
      expect(doneState.todos[0].id).toEqual(keepId);
      const undoneState = redoReducer(doneState, undo());
      expect(undoneState.todos.length).toBe(3);
      expect(undoneState.todos[0].text).toEqual("Travel");
      expect(undoneState.todos[0].id).toEqual(removeId);
      expect(undoneState.todos[0].checked).toBeTruthy();
      const redoneState = redoReducer(undoneState, redo());
      expect(redoneState.todos.length).toEqual(2);
      expect(redoneState.todos[0].text).toEqual("Relax");
      expect(redoneState.todos[0].id).toEqual(keepId);
    });
    it("should not undo disallowed actions", () => {
      const state = populatedState;
      const viewId = state.todos[1].id;
      const doneState = redoReducer(state, viewTodo({ id: viewId }));
      expect(doneState.viewed).toBeDefined();
      expect(doneState.viewed.id).toBe(viewId);
      const undoneState = redoReducer(doneState, undo());
      expect(undoneState).toEqual(doneState);
    });
    describe("when performing dis/allowed actions alternating", () => {
      let state: TestState;
      let doneState: TestState;
      beforeEach(() => {
        state = populatedState;
        doneState = redoReducer(
          redoReducer(state, removeTodo({ id: state.todos[0].id })),
          viewTodo({ id: state.todos[1].id })
        );
      });
      it("should keep updates from disallowed actions upon undo", () => {
        const undoneState = redoReducer(doneState, undo());
        expect(undoneState.todos.length).toBe(3);
        expect(undoneState.todos[0].text).toEqual("Travel");
        expect(undoneState.todos[0].id).toEqual(state.todos[0].id);
        expect(undoneState.todos[0].checked).toBeTruthy();
        expect(doneState.viewed).toBeDefined();
        expect(doneState.viewed.id).toBe(state.todos[1].id);
      });
    });
  });

  it("should merge specified action types", () => {
    const redoReducer = createReducer({
      mergeActionTypes: [incrementMood.type],
    });
    const doneState = redoReducer(
      redoReducer(redoReducer(initialState, incrementMood()), incrementMood()),
      incrementMood()
    );
    expect(doneState.mood).toEqual(50);
    const undoneState = redoReducer(doneState, undo());
    expect(undoneState.mood).toEqual(20);
  });

  it("should break merging upon break action", () => {
    const redoReducer = createReducer({
      mergeActionTypes: [incrementMood.type],
    });
    const intersectedState = redoReducer(
      redoReducer(redoReducer(initialState, incrementMood()), incrementMood()),
      { type: "BREAK_MERGE" }
    );
    expect(intersectedState.mood).toEqual(40);
    const doneState = redoReducer(
      redoReducer(
        redoReducer(intersectedState, incrementMood()),
        incrementMood()
      ),
      incrementMood()
    );
    expect(doneState.mood).toEqual(70);
    const undoneState = redoReducer(doneState, undo());
    expect(undoneState.mood).toEqual(40);
    const secondUndoneState = redoReducer(undoneState, undo());
    expect(secondUndoneState.mood).toEqual(20);
  });

  it("should merge actions based on merge rules", () => {
    let merge = true;
    const redoReducer = createReducer({
      mergeRules: {
        [incrementMood.type]: () => merge,
      },
    });
    const intersectedState = redoReducer(
      redoReducer(redoReducer(initialState, incrementMood()), incrementMood()),
      incrementMood()
    );
    expect(intersectedState.mood).toEqual(50);
    merge = false;
    const doneState = redoReducer(
      redoReducer(intersectedState, incrementMood()),
      incrementMood()
    );
    expect(doneState.mood).toEqual(70);
    const undoneState = redoReducer(doneState, undo());
    expect(undoneState.mood).toEqual(60);
    const secondUndoneState = redoReducer(undoneState, undo());
    expect(secondUndoneState.mood).toEqual(50);
    const thirdUndoneState = redoReducer(secondUndoneState, undo());
    expect(thirdUndoneState.mood).toEqual(20);
  });

  it("should clear stack upon clear action", () => {
    const redoReducer = createReducer();
    const id = genId();
    const doneState = redoReducer(
      initialState,
      addTodo({ id, text: "Do laundry" })
    );
    const {
      histories: doneStateHistory,
      ...doneStateWithoutHistory
    } = doneState;
    expect(doneState.todos.length).toBe(1);
    expect(doneState.todos[0].text).toEqual("Do laundry");
    expect(doneState.todos[0].checked).toBeFalsy();
    const clearedState = redoReducer(doneState, { type: "CLEAR" });
    const undoneState = redoReducer(clearedState, undo());
    const {
      histories: undoneStateHistory,
      ...undoneStateWithoutHistory
    } = undoneState;
    expect(undoneStateWithoutHistory).toEqual(doneStateWithoutHistory);
  });

  it("should handle state replacement", () => {
    const redoReducer = createReducer();
    const id = genId();
    const doneState = redoReducer(
      initialState,
      addTodo({ id, text: "Do laundry" })
    );
    expect(doneState.todos.length).toBe(1);
    expect(doneState.todos[0].text).toEqual("Do laundry");
    expect(doneState.todos[0].checked).toBeFalsy();
    const replacedState = redoReducer(doneState, reset);
    expectToEqualWithoutHistory(replacedState, initialState);
    const undoneState = redoReducer(replacedState, undo());
    expectToEqualWithoutHistory(undoneState, doneState);
  });

  it("should handle state removal", () => {
    const redoReducer = createReducer();
    const id = genId();
    const doneState = redoReducer(
      initialState,
      addTodo({ id, text: "Do laundry" })
    );
    expect(doneState.todos.length).toBe(1);
    expect(doneState.todos[0].text).toEqual("Do laundry");
    expect(doneState.todos[0].checked).toBeFalsy();
    const replacedState = redoReducer(doneState, remove);
    expect(Object.keys(getStateWithoutHistories(replacedState)).length).toBe(0);
    const undoneState = redoReducer(replacedState, undo());
    expectToEqualWithoutHistory(undoneState, doneState);
  });
};

describe("UndoRedo Reducer", () => {
  describe("OnReducer", () => test(createOnReducer));
  describe("SwitchReducer", () => test(createSwitchReducer));
});
