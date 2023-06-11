import { createAction, props, union } from "@ngrx/store";
import { produce, PatchListener } from "immer";
import {
  initialUndoRedoState,
  undoRedo,
  UndoRedoState,
} from "../../public-api";
import { WiederConfig } from "../config";
import { produceOn } from "../produce-on";

export interface Document {
  name: string;
  content: string;
}

export interface TestState extends UndoRedoState {
  activeDocument: string;
  documents: { [id: string]: Document };
}

export const initialState: TestState = {
  activeDocument: "a",
  documents: {
    a: {
      name: "Bill",
      content: "Total 100$",
    },
    b: {
      name: "Letter",
      content: "Dear ...",
    },
    c: {
      name: "Notes",
      content: "Write more tests",
    },
  },
  ...initialUndoRedoState,
};

export const activeDocument = (state: TestState): Document =>
  state.documents[state.activeDocument];

export const docOverrideProp = "targetDocument";

export const nameChange = createAction(
  "[Test] Name Change",
  props<{ name: string }>()
);
export const contentChange = createAction(
  "[Test] Content Change",
  props<{ content: string }>()
);
export const documentSwitch = createAction(
  "[Test] Document Switch",
  props<{ document: string }>()
);
export const nameChangeForDoc = createAction(
  "[Test] Name Change For Doc",
  props<{ name: string; [docOverrideProp]: string }>()
);
export const all = union({
  nameChange,
  nameChangeForDoc,
  contentChange,
  documentSwitch,
});
type Actions = typeof all;

export const config: WiederConfig = {
  allowedActionTypes: [
    nameChange.type,
    nameChangeForDoc.type,
    contentChange.type,
  ],
  segmentationOverride: (action) => action[docOverrideProp],
};

export const segmenter = (state: TestState) => state.activeDocument;

export const createOnReducer = () => {
  const { createSegmentedUndoRedoReducer } = undoRedo(config);
  return createSegmentedUndoRedoReducer(
    initialState,
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

export const createSwitchReducer = () => {
  const { wrapReducer } = undoRedo(config);
  return wrapReducer(
    (
      state = initialState,
      action: Actions,
      listener?: PatchListener
    ): TestState =>
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
