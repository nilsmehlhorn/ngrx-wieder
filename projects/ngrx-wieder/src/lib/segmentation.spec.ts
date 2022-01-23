import { Action, ActionReducer } from "@ngrx/store";
import {
  createOnReducer,
  createSwitchReducer,
  docOverrideProp,
  documentSwitch,
  initialState,
  nameChange,
  nameChangeForDoc,
  TestState,
} from "./test-util/segmented-store";

const test = (createReducer: () => ActionReducer<TestState, Action>) => {
  it("should undo by segmentation", () => {
    const reducer = createReducer();
    let state = reducer(initialState, nameChange({ name: "Bill 2" }));
    expect(state.documents.a.name).toEqual("Bill 2");
    expect(state.documents.b.name).toEqual("Letter");
    expect(state.documents.c.name).toEqual("Notes");
    state = reducer(state, documentSwitch({ document: "b" }));
    expect(state.activeDocument).toEqual("b");
    expect(state.documents.a.name).toEqual("Bill 2");
    expect(state.documents.b.name).toEqual("Letter");
    expect(state.documents.c.name).toEqual("Notes");
    state = reducer(state, nameChange({ name: "Letter 2" }));
    expect(state.documents.a.name).toEqual("Bill 2");
    expect(state.documents.b.name).toEqual("Letter 2");
    expect(state.documents.c.name).toEqual("Notes");
    state = reducer(state, { type: "UNDO" });
    expect(state.documents.a.name).toEqual("Bill 2");
    expect(state.documents.b.name).toEqual("Letter");
    expect(state.documents.c.name).toEqual("Notes");
    state = reducer(state, { type: "UNDO" });
    expect(state.documents.a.name).toEqual("Bill 2");
    expect(state.documents.b.name).toEqual("Letter");
    expect(state.documents.c.name).toEqual("Notes");
    state = reducer(state, documentSwitch({ document: "a" }));
    expect(state.activeDocument).toEqual("a");
    state = reducer(state, { type: "UNDO" });
    expect(state.documents.a.name).toEqual("Bill");
    expect(state.documents.b.name).toEqual("Letter");
    expect(state.documents.c.name).toEqual("Notes");
    state = reducer(state, { type: "REDO" });
    expect(state.documents.a.name).toEqual("Bill 2");
    expect(state.documents.b.name).toEqual("Letter");
    expect(state.documents.c.name).toEqual("Notes");
  });

  it("should override segmentation", () => {
    const reducer = createReducer();
    let state = reducer(
      initialState,
      nameChangeForDoc({ name: "Personal Notes", [docOverrideProp]: "c" })
    );
    expect(state.documents.a.name).toEqual("Bill");
    expect(state.documents.b.name).toEqual("Letter");
    expect(state.documents.c.name).toEqual("Personal Notes");
    state = reducer(state, documentSwitch({ document: "c" }));
    expect(state.activeDocument).toEqual("c");
    state = reducer(state, { type: "UNDO" });
    expect(state.documents.a.name).toEqual("Bill");
    expect(state.documents.b.name).toEqual("Letter");
    expect(state.documents.c.name).toEqual("Notes");
  });
};

describe("Segmentation", () => {
  describe("OnReducer", () => test(createOnReducer));
  describe("SwitchReducer", () => test(createSwitchReducer));
});
