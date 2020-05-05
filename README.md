[![npm-badge](https://img.shields.io/npm/v/ngrx-wieder.svg?style=flat-square)](https://www.npmjs.com/package/ngrx-wieder)
&nbsp;
[![travis-badge](https://img.shields.io/travis/nilsmehlhorn/ngrx-wieder/master.svg?style=flat-square)](https://travis-ci.org/nilsmehlhorn/ngrx-wieder)
&nbsp;
[![codecov-badge](https://codecov.io/gh/nilsmehlhorn/ngrx-wieder/branch/master/graph/badge.svg)](https://codecov.io/gh/nilsmehlhorn/ngrx-wieder)

ngrx-wieder is a lightweight yet configurable solution for implementing undo-redo in Angular apps on top of [NgRx](https://ngrx.io/).
It's based on [immer](https://immerjs.github.io/immer/docs/introduction) hence the name wieder (German for: again)

⚡ [Example StackBlitz](https://stackblitz.com/github/nilsmehlhorn/ngrx-wieder-example)

## Prerequisites

Make sure you're using [immer](https://github.com/immerjs/immer) to update your NgRx (sub-)state. That means you're using mutating APIs to update the state while immer provides a new state behind the scenes. If you're just starting out, install immer with this command:

```bash
npm i immer
```

## Installation

Install this library with the following command:

```bash
npm i ngrx-wieder
```

## Usage

Firstly, you'll initialize ngrx-wieder and optionally pass a custom config. It'll return an object with the function `createUndoRedoReducer` which you can use just like [createReducer](https://ngrx.io/guide/store/reducers#creating-the-reducer-function) from NgRx, however, `state` inside `on` will be a immer draft of the last state. If you'd rather not return the `state` in each on-reducer, you can use `produceOn` instead.

**Tip**: Inside `on` or `produceOn` you can access the original state of an immer.js draft, therefore the last state, with the [original function](https://immerjs.github.io/immer/docs/original).

```ts
import {undoRedo, produceOn} from 'ngrx-wieder'

// initialize ngrx-wieder with custom config
const {createUndoRedoReducer} = undoRedo({
  allowedActionTypes: [
    Actions.addTodo,
    Actions.removeTodo,
    Actions.toggleTodo
  ]
})

const reducer = createUndoRedoReducer(initialState,
    on(Actions.addTodo, (state, {text}) => {
      state.todos.push({id: nextId(), text, checked: false})
      return state
    }),
    on(Actions.toggleTodo, (state, {id}) => {
      const todo = state.todos.find(t => t.id === id)
      todo.checked = !todo.checked
      return state
    }),
    produceOn(Actions.removeTodo, (state, {id}) => {
      state.todos.splice(state.todos.findIndex(t => t.id === id), 1)
    }),
)

// wrap into exported function to keep Angular AOT working
export function appReducer(state, action) {
  return reducer(state, action)
}
```

Then whenever you'd like to undo or redo one of the passed `allowedActionTypes` simply dispatch
the corresponding actions:
```ts
this.store.dispatch({ type: 'UNDO' })
this.store.dispatch({ type: 'REDO' })
```

### Configuration

| Option | Default | Description
|:---  |:--- | :---
| `allowedActionTypes`| `[]` |Actions applicable for being undone/redone (leave empty to allow all actions)
| `mergeActionTypes`| `[]` | Types of actions whose state difference should be merged when they appear consecutively
| `mergeRules`| `new Map()` |Predicates for deciding whether differences from consecutive actions of the same type should be merged
| `maxBufferSize`| `32` | How many state differences should be buffered in either direction
| `undoActionType`| `'UNDO'` | Override for the undo action's type
| `redoActionType`| `'REDO'` | Override for the redo action's type
| `breakMergeActionType`| `'BREAK_MERGE'` | Override for the break-merge action's type.
| `clearActionType`| `'CLEAR'` | Override for the clear action's type
| `track`| `false` | Whether ability for undo/redo should be tracked in the state through properties `canUndo` and `canRedo`

### Dealing with consecutive changes

Sometimes you want to enable undo/redo in broader chunks than the ones you actually use for
transforming your state. Take a range input for example:

```ts
@Component({
  selector: 'my-slider',
  template: `
    <input #rangeIn type="range" id="rangeIn" min="0" max="10" step="1" 
      (change)="rangeChange()" (input)="rangeInput(rangeIn.value)">
  `
})
export class SliderComponent {

  // ...

  rangeChange() {
    this.store.dispatch({ type: 'BREAK_MERGE' })
  }

  rangeInput(count: number) {
    this.store.dispatch(new CountChange({ count })
  }
}
```

The method `rangeInput` will be called for any step that the slider is moved by the user. This method
may also dispatch an action to update the state and thus display the result of moving the slider.
When the user now wants to revert changing the range input, he'd have to retrace every single step that
he moved the slider. Instead a more expectable redo behaviour would place the slider back where the
user picked it up before. 

To facilitate this you can specify the `CountChange` action as an action
whose state changes are merged consecutively by passing its type to the configuration property 
`mergeActionTypes` (you can even get more fine grained by using predicates through the `mergeRules` property).

In order to break the merging at some point you can dispatch a special action of type `BREAK_MERGE`.
A good place to do this for the range input would be inside the change input - which is called when the user drops the range knob (this is also covered in the [example](https://stackblitz.com/edit/ngrx-wieder-app)).

### Clearing the undo/redo stack

You can clear the stack for undoable and redoable actions by dispatching a special clearing action:
```ts
this.store.dispatch({ type: 'CLEAR' })
```

### Switch-based Reducers

ngrx-wieder works by recording patches from immer and applying them based on dispatch of actions for perfoming undo and redo. While `createUndoRedoReducer` handles interaction with immer, this is not possible when you're using a reducer that is based on a switch-statement. In that case the reducer on which you want to apply the undo-redo feature has to update the NgRx state directly through immer. In order to let ngrx-wieder record the changes your reducer has to be adapted so that it can forward the patches from immer:

**Before**
```ts
import {produce} from 'immer'

const reducer = (state: State, action: Actions): State =>
  produce(state, nextState => {
    switch (action.type) {
    /* action handling */
    }
  })
```

**After**
```ts
import {produce, PatchListener} from 'immer'

const reducer = (state: State, action: Actions, patchListener?: PatchListener): State =>
  produce(state, nextState => {
    switch (action.type) {
    /* action handling */
    }
  }, patchListener)
```

Next you'll configure the undo-redo behaviour by instantiating `undoRedo` and wrapping
your custom reducer with the `wrapReducer` function:

```ts
import {undoRedo} from 'ngrx-wieder'

// initialize ngrx-wieder
const {wrapReducer} = undoRedo({
  allowedActionTypes: [
    Actions.addTodo,
    Actions.removeTodo,
    Actions.toggleTodo
  ]
})

// wrap reducer inside meta-reducer to make it undoable
const undoableReducer = wrapReducer(reducer)

// wrap into exported function to keep Angular AOT working
export function myReducer(state = initialState, action) {
  return undoableReducer(state, action)
}
```

### Segmentation

Segmentation provides distinct undo-redo stacks for multiple instances of the same kind of state. For example, this allows you to implement an application that can have multiple documents open at the same time in multiple tabs as illustrated by this state:

```typescript
interface State {
  activeDocument: string
  documents: { [id: string]: Document }
  canUndo: boolean
  canRedo: boolean
}
```

Now, when the user is viewing one document, he probably doesn't want to undo changes in a different one. In order to make this work, you need to inform ngrx-wieder about your segmentation by using `createSegmentedUndoRedoReducer` providing a segmenter. Note that any actions that change the result of the segmenter must not be undoable (here it's `documentSwitch`). Moreover, when tracking is active, `canUndo` and `canRedo` will reflect the active undo-redo stack.

```typescript
// helper function for manipulating active document in reducer
const activeDocument = (state: TestState): Document => state.documents[state.activeDocument]

const {createSegmentedUndoRedoReducer} = undoRedo({
    allowedActionTypes: [
     nameChange.type
    ],
    track: true
})

const reducer = createSegmentedUndoRedoReducer(initialState,
    state => state.activeDocument, // segmenter identifying undo-redo stack
    produceOn(nameChange, (state, action) => {
      activeDocument(state).name = action.name
    }),
    produceOn(documentSwitch, (state, action) => {
      state.activeDocument = action.document
    })
)
```

When you're using a switch-based reducer, simply pass the segmenter as a second argument to `wrapReducer`:

```typescript
const {wrapReducer} = undoRedo({...})
const reducer = (state = initialState, action: Actions, listener?: PatchListener): State =>
    produce(state, next => {
        switch (action.type) {
          case nameChange.type:
            activeDocument(next).name = action.name
            return
          case documentSwitch.type:
            next.activeDocument = action.document
            return
        }
    }, listener)
return wrapReducer(reducer, state => state.activeDocument)
```
