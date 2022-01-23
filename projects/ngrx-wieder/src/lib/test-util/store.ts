import { createAction, props, union, on } from "@ngrx/store";
import produce, { original, nothing, PatchListener } from "immer";
import {
  UndoRedoState,
  initialUndoRedoState,
  undoRedo,
} from "../../public-api";
import { defaultConfig } from "../config";
import { produceOn } from "../produce-on";
import { genId } from "./id";

export interface Todo {
  id: string;
  text: string;
  checked: boolean;
}

export interface TestState extends UndoRedoState {
  todos: Todo[];
  viewed?: Todo;
  mood: number;
}

export const initialState: TestState = {
  todos: [],
  viewed: null,
  mood: 20,
  ...initialUndoRedoState,
};

export const populatedState: TestState = {
  todos: [
    { id: genId(), text: "Travel", checked: true },
    { id: genId(), text: "Relax", checked: false },
    { id: genId(), text: "Work", checked: false },
  ],
  viewed: null,
  mood: 50,
  ...initialUndoRedoState,
};

export const addTodo = createAction(
  "[Test] Create Todo",
  props<{ id: string; text: string }>()
);
export const removeTodo = createAction(
  "[Test] Remove Todo",
  props<{ id: string }>()
);
export const viewTodo = createAction(
  "[Test] View Todo",
  props<{ id: string }>()
);
export const incrementMood = createAction("[Test] Increment Mood");
export const reset = createAction("[Test] Reset");
export const remove = createAction("[Test] Remove");
export const undo = createAction("UNDO");
export const redo = createAction("REDO");
export const all = union({
  addTodo,
  removeTodo,
  viewTodo,
  incrementMood,
  reset,
  remove,
});
type Actions = typeof all;

export const createOnReducer = (config = defaultConfig) => {
  const { createUndoRedoReducer } = undoRedo(config);
  return createUndoRedoReducer(
    initialState,
    on(addTodo, (state, action) => {
      state.todos.push({ id: action.id, text: action.text, checked: false });
      return state;
    }),
    on(removeTodo, (state, action) => {
      state.todos.splice(
        state.todos.findIndex((t) => t.id === action.id),
        1
      );
      return state;
    }),
    on(viewTodo, (state, action) => {
      state.viewed = state.todos.find((t) => t.id === action.id);
      return state;
    }),
    produceOn(incrementMood, (state) => {
      state.mood = Math.min(original(state).mood + 10, 100);
    }),
    on(reset, () => initialState),
    produceOn(remove, () => (nothing as unknown) as TestState)
  );
};

export const createSwitchReducer = (config = defaultConfig) => {
  const { wrapReducer } = undoRedo(config);
  return wrapReducer(
    (state = initialState, action: Actions, listener?: PatchListener): TestState =>
      produce(
        state,
        (next) => {
          switch (action.type) {
            case addTodo.type:
              next.todos.push({
                id: action.id,
                text: action.text,
                checked: false,
              });
              return;
            case removeTodo.type:
              next.todos.splice(
                next.todos.findIndex((t) => t.id === action.id),
                1
              );
              return;
            case viewTodo.type:
              next.viewed = next.todos.find((t) => t.id === action.id);
              return;
            case incrementMood.type:
              next.mood = Math.min(state.mood + 10, 100);
              return;
            case reset.type:
              return initialState;
            case remove.type:
              return nothing;
            default:
              return;
          }
        },
        listener
      )
  );
};
