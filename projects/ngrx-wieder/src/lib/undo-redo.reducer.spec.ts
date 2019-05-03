import {ActionReducer, createAction, props, union} from '@ngrx/store'
import produce, {PatchListener} from 'immer'
import {undoRedo} from './undo-redo.reducer'

const id = () => Math.random().toString(36).substr(2, 9)

interface Todo {
  id: string,
  text: string,
  checked: boolean
}

interface TestState {
  todos: Todo[],
  viewed?: Todo
  mood: number
}

interface TrackingTestState extends TestState {
  canUndo: boolean
  canRedo: boolean
}

const initial: TestState = {
  todos: [],
  viewed: null,
  mood: 20
}

const populated: TestState = {
  todos: [
    {id: id(), text: 'Travel', checked: true},
    {id: id(), text: 'Relax', checked: false},
    {id: id(), text: 'Work', checked: false}
  ],
  viewed: null,
  mood: 50
}

const addTodo = createAction('[Test] Create Todo', props<{ text: string }>())
const removeTodo = createAction('[Test] Remove Todo', props<{ id: string }>())
const viewTodo = createAction('[Test] View Todo', props<{ id: string }>())
const incrementMood = createAction('[Test] Increment Mood')

const all = union({addTodo, removeTodo, viewTodo, incrementMood})
type Actions = typeof all

const testReducer = (state = initial, action: Actions, listener?: PatchListener): TestState =>
  produce(state, next => {
    switch (action.type) {
      case addTodo.type:
        next.todos.push({id: id(), text: action.text, checked: false})
        return
      case removeTodo.type:
        next.todos.splice(next.todos.findIndex(t => t.id === action.id), 1)
        return
      case viewTodo.type:
        next.viewed = next.todos.find(t => t.id === action.id)
        return
      case incrementMood.type:
        next.mood = Math.min(state.mood + 10, 100)
        return
      default:
        return
    }
  }, listener)

describe('UndoRedo Reducer', () => {

  it('should undo any action', () => {
    const redoReducer = undoRedo()(testReducer)
    const doneState = redoReducer(initial, addTodo({text: 'Do laundry'}))
    expect(doneState.todos.length).toBe(1)
    expect(doneState.todos[0].text).toEqual('Do laundry')
    expect(doneState.todos[0].checked).toBeFalsy()
    const undoneState = redoReducer(doneState, {type: 'UNDO'})
    expect(undoneState.todos.length).toBe(0)
  })

  it('should redo any action', () => {
    const redoReducer = undoRedo()(testReducer)
    const doneState = redoReducer(initial, addTodo({text: 'Do laundry'}))
    expect(doneState.todos.length).toBe(1)
    expect(doneState.todos[0].text).toEqual('Do laundry')
    expect(doneState.todos[0].checked).toBeFalsy()
    const undoneState = redoReducer(doneState, {type: 'UNDO'})
    expect(undoneState.todos.length).toBe(0)
    const redoneState = redoReducer(undoneState, {type: 'REDO'})
    expect(redoneState.todos.length).toBe(1)
    expect(redoneState.todos[0].text).toEqual('Do laundry')
  })

  describe('when initialized with allowed actions', () => {

    let redoReducer: ActionReducer<TestState>

    beforeEach(() => {
      redoReducer = undoRedo({
        allowedActionTypes: [
          addTodo.type,
          removeTodo.type
        ]
      })(testReducer)
    })

    it('should undo allowed actions', () => {
      const state = populated
      const removeId = state.todos[0].id
      const keepId = state.todos[1].id
      const doneState = redoReducer(state, removeTodo({id: removeId}))
      expect(doneState.todos.length).toEqual(2)
      expect(doneState.todos[0].text).toEqual('Relax')
      expect(doneState.todos[0].id).toEqual(keepId)
      const undoneState = redoReducer(doneState, {type: 'UNDO'})
      expect(undoneState.todos.length).toBe(3)
      expect(undoneState.todos[0].text).toEqual('Travel')
      expect(undoneState.todos[0].id).toEqual(removeId)
      expect(undoneState.todos[0].checked).toBeTruthy()
    })
    it('should redo allowed actions', () => {
      const state = populated
      const removeId = state.todos[0].id
      const keepId = state.todos[1].id
      const doneState = redoReducer(state, removeTodo({id: removeId}))
      expect(doneState.todos.length).toEqual(2)
      expect(doneState.todos[0].text).toEqual('Relax')
      expect(doneState.todos[0].id).toEqual(keepId)
      const undoneState = redoReducer(doneState, {type: 'UNDO'})
      expect(undoneState.todos.length).toBe(3)
      expect(undoneState.todos[0].text).toEqual('Travel')
      expect(undoneState.todos[0].id).toEqual(removeId)
      expect(undoneState.todos[0].checked).toBeTruthy()
      const redoneState = redoReducer(undoneState, {type: 'REDO'})
      expect(redoneState.todos.length).toEqual(2)
      expect(redoneState.todos[0].text).toEqual('Relax')
      expect(redoneState.todos[0].id).toEqual(keepId)
    })
    it('should not undo disallowed actions', () => {
      const state = populated
      const viewId = state.todos[1].id
      const doneState = redoReducer(state, viewTodo({id: viewId}))
      expect(doneState.viewed).toBeDefined()
      expect(doneState.viewed.id).toBe(viewId)
      const undoneState = redoReducer(doneState, {type: 'UNDO'})
      expect(undoneState).toEqual(doneState)
    })
    describe('when performing dis/allowed actions alternating', () => {
      let state: TestState
      let doneState: TestState
      beforeEach(() => {
        state = populated
        doneState = redoReducer(
          redoReducer(state, removeTodo({id: state.todos[0].id})),
          viewTodo({id: state.todos[1].id}))
      })
      it('should keep updates from disallowed actions upon undo', () => {
        const undoneState = redoReducer(doneState, {type: 'UNDO'})
        expect(undoneState.todos.length).toBe(3)
        expect(undoneState.todos[0].text).toEqual('Travel')
        expect(undoneState.todos[0].id).toEqual(state.todos[0].id)
        expect(undoneState.todos[0].checked).toBeTruthy()
        expect(doneState.viewed).toBeDefined()
        expect(doneState.viewed.id).toBe(state.todos[1].id)
      })
    })
  })

  it('should merge specified action types', () => {
    const redoReducer = undoRedo({
      mergeActionTypes: [incrementMood.type]
    })(testReducer)
    const doneState = redoReducer(redoReducer(redoReducer(initial,
      incrementMood()),
      incrementMood()),
      incrementMood())
    expect(doneState.mood).toEqual(50)
    const undoneState = redoReducer(doneState, {type: 'UNDO'})
    expect(undoneState.mood).toEqual(20)
  })

  it('should break merging upon break action', () => {
    const redoReducer = undoRedo({
      mergeActionTypes: [incrementMood.type]
    })(testReducer)
    const intersectedState = redoReducer(redoReducer(redoReducer(initial,
      incrementMood()),
      incrementMood()),
      {type: 'BREAK_MERGE'})
    expect(intersectedState.mood).toEqual(40)
    const doneState = redoReducer(redoReducer(redoReducer(intersectedState,
      incrementMood()),
      incrementMood()),
      incrementMood())
    expect(doneState.mood).toEqual(70)
    const undoneState = redoReducer(doneState, {type: 'UNDO'})
    expect(undoneState.mood).toEqual(40)
    const secondUndoneState = redoReducer(undoneState, {type: 'UNDO'})
    expect(secondUndoneState.mood).toEqual(20)
  })

  it('should merge actions based on merge rules', () => {
    let merge = true
    const redoReducer = undoRedo({
      mergeRules: new Map([
        [incrementMood.type, () => merge]
      ])
    })(testReducer)
    const intersectedState = redoReducer(redoReducer(redoReducer(initial,
      incrementMood()),
      incrementMood()),
      incrementMood())
    expect(intersectedState.mood).toEqual(50)
    merge = false
    const doneState = redoReducer(redoReducer(intersectedState,
      incrementMood()),
      incrementMood())
    expect(doneState.mood).toEqual(70)
    const undoneState = redoReducer(doneState, {type: 'UNDO'})
    expect(undoneState.mood).toEqual(60)
    const secondUndoneState = redoReducer(undoneState, {type: 'UNDO'})
    expect(secondUndoneState.mood).toEqual(50)
    const thirdUndoneState = redoReducer(secondUndoneState, {type: 'UNDO'})
    expect(thirdUndoneState.mood).toEqual(20)
  })

  it('should clear stack upon clear action', () => {
    const redoReducer = undoRedo()(testReducer)
    const doneState = redoReducer(initial, addTodo({text: 'Do laundry'}))
    expect(doneState.todos.length).toBe(1)
    expect(doneState.todos[0].text).toEqual('Do laundry')
    expect(doneState.todos[0].checked).toBeFalsy()
    const clearedState = redoReducer(doneState, {type: 'CLEAR'})
    const undoneState = redoReducer(clearedState, {type: 'UNDO'})
    expect(undoneState).toEqual(doneState)
  })

  describe('when initialized to track', () => {

    let redoReducer: ActionReducer<TrackingTestState>
    let state

    beforeEach(() => {
      redoReducer = undoRedo({
        track: true
      })(testReducer) as ActionReducer<TrackingTestState>
      state = {
        ...initial,
        canUndo: false,
        canRedo: false
      }
    })
    it('should track ability to undo', () => {
      const doneState = redoReducer(state, addTodo({text: 'Do laundry'}))
      expect(doneState.canUndo).toBeTruthy()
    })
    it('should track ability to redo', () => {
      const doneState = redoReducer(state, addTodo({text: 'Do laundry'}))
      expect(doneState.canUndo).toBeTruthy()
      const undoneState = redoReducer(doneState, {type: 'UNDO'})
      expect(undoneState.canUndo).toBeFalsy()
      expect(undoneState.canRedo).toBeTruthy()
    })
  })
})
