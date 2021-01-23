import { Action, ActionReducer, createAction, props, union } from "@ngrx/store";
import produce, { PatchListener } from "immer";
import { WiederConfig } from "./config";
import { produceOn } from "./produce-on";
import { undoRedo } from "./undo-redo.reducer";
import { initialUndoRedoState, UndoRedoState } from "./undo-redo.state";

interface Document {
  name: string;
  content: string;
}

interface TestState extends UndoRedoState {
  activeDocument: string;
  documents: { [id: string]: Document };
}

const initial: TestState = {
  activeDocument: "A",
  documents: {
    A: {
      name: "Bill",
      content: "Total 100$",
    },
    B: {
      name: "Letter",
      content: "Dear ...",
    },
    C: {
      name: "Notes",
      content: "Write more tests",
    },
  },
  ...initialUndoRedoState,
};

const activeDocument = (state: TestState): Document =>
  state.documents[state.activeDocument];

const docOverrideProp = "targetDocument";

const nameChange = createAction(
  "[Test] Name Change",
  props<{ name: string }>()
);
const contentChange = createAction(
  "[Test] Content Change",
  props<{ content: string }>()
);
const documentSwitch = createAction(
  "[Test] Document Switch",
  props<{ document: string }>()
);
const nameChangeForDoc = createAction(
  "[Test] Name Change For Doc",
  props<{ name: string; [docOverrideProp]: string }>()
);
const all = union({
  nameChange,
  nameChangeForDoc,
  contentChange,
  documentSwitch,
});
type Actions = typeof all;

const config: WiederConfig = {
  allowedActionTypes: [
    nameChange.type,
    nameChangeForDoc.type,
    contentChange.type,
  ],
  segmentationOverride: (action) => action[docOverrideProp],
};

const segmenter = (state: TestState) => state.activeDocument;

const createOnReducer = () => {
  const { createSegmentedUndoRedoReducer } = undoRedo(config);
  return createSegmentedUndoRedoReducer(
    initial,
    segmenter,
    produceOn(nameChange, (state, action) => {
      activeDocument(state).name = action.name;
    }),
    produceOn(nameChangeForDoc, (state, action) => {
      state.documents[action[docOverrideProp]].name = action.name;
    }),
    produceOn(contentChange, (state, action) => {
      activeDocument(state).content = action.content;
    }),
    produceOn(documentSwitch, (state, action) => {
      state.activeDocument = action.document;
    })
  );
};

const createSwitchReducer = () => {
  const { wrapReducer } = undoRedo(config);
  return wrapReducer(
    (state = initial, action: Actions, listener?: PatchListener): TestState =>
      produce(
        state,
        (next) => {
          switch (action.type) {
            case nameChange.type:
              activeDocument(next).name = action.name;
              return;
            case nameChangeForDoc.type:
              next.documents[action[docOverrideProp]].name = action.name;
              return;
            case contentChange.type:
              activeDocument(next).content = action.content;
              return;
            case documentSwitch.type:
              next.activeDocument = action.document;
              return;
            default:
              return;
          }
        },
        listener
      ),
    segmenter
  );
};

const test = (createReducer: () => ActionReducer<TestState, Action>) => {
  it("should undo by segmentation", () => {
    const reducer = createReducer();
    let state = reducer(initial, nameChange({ name: "Bill 2" }));
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
      initial,
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
