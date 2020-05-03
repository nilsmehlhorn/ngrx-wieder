import {undoRedo} from './undo-redo.reducer'
import {createAction, props, union} from '@ngrx/store'
import {produceOn} from './produce-on'
import produce, {PatchListener} from 'immer'

interface Document {
  name: string
  content: string
}

interface TestState {
  activeDocument: string
  documents: { [id: string]: Document }
  canUndo: boolean
  canRedo: boolean
}

const initial: TestState = {
  activeDocument: 'A',
  documents: {
    A: {
      name: 'Bill',
      content: 'Total 100$'
    },
    B: {
      name: 'Letter',
      content: 'Dear ...'
    },
    C: {
      name: 'Notes',
      content: 'Write more tests'
    }
  },
  canUndo: false,
  canRedo: false
}

const activeDocument = (state: TestState): Document => state.documents[state.activeDocument]

const nameChange = createAction('[Test] Name Change', props<{ name: string }>())
const contentChange = createAction('[Test] Content Change', props<{ content: string }>())
const documentSwitch = createAction('[Test] Document Switch', props<{ document: string }>())
const all = union({nameChange, contentChange, documentSwitch})
type Actions = typeof all

const config = {
  allowedActionTypes: [
    nameChange.type,
    contentChange.type
  ],
  track: true
}

const segmenter = state => state.activeDocument

const createOnReducer = () => {
  const {createSegmentedUndoRedoReducer} = undoRedo(config)
  return createSegmentedUndoRedoReducer(initial, segmenter,
    produceOn(nameChange, (state, action) => {
      activeDocument(state).name = action.name
    }),
    produceOn(contentChange, (state, action) => {
      activeDocument(state).content = action.content
    }),
    produceOn(documentSwitch, (state, action) => {
      state.activeDocument = action.document
    })
  )
}

const createSwitchReducer = () => {
  const {wrapReducer} = undoRedo(config)
  return wrapReducer((state = initial, action: Actions, listener?: PatchListener): TestState =>
    produce(state, next => {
      switch (action.type) {
        case nameChange.type:
          activeDocument(next).name = action.name
          return
        case contentChange.type:
          activeDocument(next).content = action.content
          return
        case documentSwitch.type:
          next.activeDocument = action.document
          return
        default:
          return
      }
    }, listener), segmenter)
}

const test = createReducer => {

  it('should undo by segmentation', () => {
    const reducer = createReducer()
    let state = reducer(initial, nameChange({name: 'Bill 2'}))
    expect(state.documents.A.name).toEqual('Bill 2')
    expect(state.documents.B.name).toEqual('Letter')
    expect(state.documents.C.name).toEqual('Notes')
    expect(state.canUndo).toBeTruthy()
    expect(state.canRedo).toBeFalsy()
    state = reducer(state, documentSwitch({document: 'B'}))
    expect(state.activeDocument).toEqual('B')
    expect(state.documents.A.name).toEqual('Bill 2')
    expect(state.documents.B.name).toEqual('Letter')
    expect(state.documents.C.name).toEqual('Notes')
    expect(state.canUndo).toBeFalsy()
    expect(state.canRedo).toBeFalsy()
    state = reducer(state, nameChange({name: 'Letter 2'}))
    expect(state.documents.A.name).toEqual('Bill 2')
    expect(state.documents.B.name).toEqual('Letter 2')
    expect(state.documents.C.name).toEqual('Notes')
    expect(state.canUndo).toBeTruthy()
    expect(state.canRedo).toBeFalsy()
    state = reducer(state, {type: 'UNDO'})
    expect(state.documents.A.name).toEqual('Bill 2')
    expect(state.documents.B.name).toEqual('Letter')
    expect(state.documents.C.name).toEqual('Notes')
    expect(state.canUndo).toBeFalsy()
    expect(state.canRedo).toBeTruthy()
    state = reducer(state, {type: 'UNDO'})
    expect(state.documents.A.name).toEqual('Bill 2')
    expect(state.documents.B.name).toEqual('Letter')
    expect(state.documents.C.name).toEqual('Notes')
    expect(state.canUndo).toBeFalsy()
    expect(state.canRedo).toBeTruthy()
    state = reducer(state, documentSwitch({document: 'A'}))
    expect(state.activeDocument).toEqual('A')
    expect(state.canUndo).toBeTruthy()
    expect(state.canRedo).toBeFalsy()
    state = reducer(state, {type: 'UNDO'})
    expect(state.documents.A.name).toEqual('Bill')
    expect(state.documents.B.name).toEqual('Letter')
    expect(state.documents.C.name).toEqual('Notes')
    expect(state.canUndo).toBeFalsy()
    expect(state.canRedo).toBeTruthy()
  })
}

describe('Segmentation', () => {
  describe('OnReducer', () => test(createOnReducer))
  describe('SwitchReducer', () => test(createSwitchReducer))
})
