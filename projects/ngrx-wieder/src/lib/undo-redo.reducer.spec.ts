import {ActionReducer, createAction, on, props, union} from '@ngrx/store'
import {undoRedo} from './undo-redo.reducer'
import {defaultConfig} from './model'
import {produceOn} from './produce-on'
import produce, {nothing, original, PatchListener} from 'immer'

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
const reset = createAction('[Test] Reset')
const remove = createAction('[Test] Remove')
const all = union({addTodo, removeTodo, viewTodo, incrementMood, reset, remove})
type Actions = typeof all

const createOnReducer = (config = defaultConfig) => {
  const {createUndoRedoReducer} = undoRedo(config)
  return createUndoRedoReducer(initial,
    on(addTodo, (state, action) => {
      state.todos.push({id: id(), text: action.text, checked: false})
      return state
    }),
    on(removeTodo, (state, action) => {
      state.todos.splice(state.todos.findIndex(t => t.id === action.id), 1)
      return state
    }),
    on(viewTodo, (state, action) => {
      state.viewed = state.todos.find(t => t.id === action.id)
      return state
    }),
    produceOn(incrementMood, state => {
      state.mood = Math.min(original(state).mood + 10, 100)
    }),
    on(reset, () => {
      return initial
    }),
    produceOn(remove, () => {
      return nothing as unknown as TestState
    })
  )
}

const createSwitchReducer = (config = defaultConfig) => {
  const {wrapReducer} = undoRedo(config)
  return wrapReducer((state = initial, action: Actions, listener?: PatchListener): TestState =>
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
        case reset.type:
          return initial
        case remove.type:
          return nothing
        default:
          return
      }
    }, listener))
}

const test = createReducer => {

  it('should undo any action', () => {
    const redoReducer = createReducer()
    const doneState = redoReducer(initial, addTodo({text: 'Do laundry'}))
    expect(doneState.todos.length).toBe(1)
    expect(doneState.todos[0].text).toEqual('Do laundry')
    expect(doneState.todos[0].checked).toBeFalsy()
    const undoneState = redoReducer(doneState, {type: 'UNDO'})
    expect(undoneState.todos.length).toBe(0)
  })

  it('should redo any action', () => {
    const redoReducer = createReducer()
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
      redoReducer = createReducer({
        allowedActionTypes: [
          addTodo.type,
          removeTodo.type
        ]
      })
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
    const redoReducer = createReducer({
      mergeActionTypes: [incrementMood.type]
    })
    const doneState = redoReducer(redoReducer(redoReducer(initial,
      incrementMood()),
      incrementMood()),
      incrementMood())
    expect(doneState.mood).toEqual(50)
    const undoneState = redoReducer(doneState, {type: 'UNDO'})
    expect(undoneState.mood).toEqual(20)
  })

  it('should break merging upon break action', () => {
    const redoReducer = createReducer({
      mergeActionTypes: [incrementMood.type]
    })
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
    const redoReducer = createReducer({
      mergeRules: new Map([
        [incrementMood.type, () => merge]
      ])
    })
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
    const redoReducer = createReducer()
    const doneState = redoReducer(initial, addTodo({text: 'Do laundry'}))
    expect(doneState.todos.length).toBe(1)
    expect(doneState.todos[0].text).toEqual('Do laundry')
    expect(doneState.todos[0].checked).toBeFalsy()
    const clearedState = redoReducer(doneState, {type: 'CLEAR'})
    const undoneState = redoReducer(clearedState, {type: 'UNDO'})
    expect(undoneState).toEqual(doneState)
  })

  it('should handle state replacement', () => {
    const redoReducer = createReducer()
    const doneState = redoReducer(initial, addTodo({text: 'Do laundry'}))
    expect(doneState.todos.length).toBe(1)
    expect(doneState.todos[0].text).toEqual('Do laundry')
    expect(doneState.todos[0].checked).toBeFalsy()
    const replacedState = redoReducer(doneState, reset)
    expect(replacedState).toEqual(initial)
    const undoneState = redoReducer(replacedState, {type: 'UNDO'})
    expect(undoneState).toEqual(doneState)
  })

  it('should handle state removal', () => {
    const redoReducer = createReducer()
    const doneState = redoReducer(initial, addTodo({text: 'Do laundry'}))
    expect(doneState.todos.length).toBe(1)
    expect(doneState.todos[0].text).toEqual('Do laundry')
    expect(doneState.todos[0].checked).toBeFalsy()
    const replacedState = redoReducer(doneState, remove)
    expect(replacedState).toBeUndefined()
    const undoneState = redoReducer(replacedState, {type: 'UNDO'})
    expect(undoneState).toEqual(doneState)
  })

  describe('when initialized to track', () => {

    let redoReducer: ActionReducer<TrackingTestState>
    let state

    beforeEach(() => {
      redoReducer = createReducer({
        track: true
      }) as ActionReducer<TrackingTestState>
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
}

describe('UndoRedo Reducer', () => {
  describe('OnReducer', () => test(createOnReducer))
  describe('SwitchReducer', () => test(createSwitchReducer))
})
