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
    expect(state.documents.A.name).toEqual("Bill 2");
    expect(state.documents.B.name).toEqual("Letter");
    expect(state.documents.C.name).toEqual("Notes");
    state = reducer(state, documentSwitch({ document: "B" }));
    expect(state.activeDocument).toEqual("B");
    expect(state.documents.A.name).toEqual("Bill 2");
    expect(state.documents.B.name).toEqual("Letter");
    expect(state.documents.C.name).toEqual("Notes");
    state = reducer(state, nameChange({ name: "Letter 2" }));
    expect(state.documents.A.name).toEqual("Bill 2");
    expect(state.documents.B.name).toEqual("Letter 2");
    expect(state.documents.C.name).toEqual("Notes");
    state = reducer(state, { type: "UNDO" });
    expect(state.documents.A.name).toEqual("Bill 2");
    expect(state.documents.B.name).toEqual("Letter");
    expect(state.documents.C.name).toEqual("Notes");
    state = reducer(state, { type: "UNDO" });
    expect(state.documents.A.name).toEqual("Bill 2");
    expect(state.documents.B.name).toEqual("Letter");
    expect(state.documents.C.name).toEqual("Notes");
    state = reducer(state, documentSwitch({ document: "A" }));
    expect(state.activeDocument).toEqual("A");
    state = reducer(state, { type: "UNDO" });
    expect(state.documents.A.name).toEqual("Bill");
    expect(state.documents.B.name).toEqual("Letter");
    expect(state.documents.C.name).toEqual("Notes");
    state = reducer(state, { type: "REDO" });
    expect(state.documents.A.name).toEqual("Bill 2");
    expect(state.documents.B.name).toEqual("Letter");
    expect(state.documents.C.name).toEqual("Notes");
  });

  it("should override segmentation", () => {
    const reducer = createReducer();
    let state = reducer(
      initialState,
      nameChangeForDoc({ name: "Personal Notes", [docOverrideProp]: "C" })
    );
    expect(state.documents.A.name).toEqual("Bill");
    expect(state.documents.B.name).toEqual("Letter");
    expect(state.documents.C.name).toEqual("Personal Notes");
    state = reducer(state, documentSwitch({ document: "C" }));
    expect(state.activeDocument).toEqual("C");
    state = reducer(state, { type: "UNDO" });
    expect(state.documents.A.name).toEqual("Bill");
    expect(state.documents.B.name).toEqual("Letter");
    expect(state.documents.C.name).toEqual("Notes");
  });
};

describe("Segmentation", () => {
  describe("OnReducer", () => test(createOnReducer));
  describe("SwitchReducer", () => test(createSwitchReducer));
});
