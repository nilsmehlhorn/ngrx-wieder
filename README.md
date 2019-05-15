[![npm-badge](https://img.shields.io/npm/v/ngrx-wieder.svg?style=flat-square)](https://www.npmjs.com/package/ngrx-wieder)

ngrx-wieder is a lightweight yet configurable solution for implementing undo-redo in Angular apps on top of [NgRx](https://ngrx.io/).
It's based on [immer](https://github.com/immerjs/immer) hence the name wieder (German for: again)

⚡ [Example StackBlitz](https://stackblitz.com/edit/ngrx-wieder-app)

## Prerequisites

Make sure you're using immer to update your NgRx (sub-)state.

## Installation

Install via
```bash
npm i -S ngrx-wieder
```

**Peer-dependencies**:
- @angular/common
- @angular/core
- @ngrx/store
- immer

## Usage

ngrx-wieder works by recording patches from immer and applying
them based on dispatch of actions for perfoming undo and redo.
Therefore the reducer on which you want to apply the undo-redo feature
has to update the NgRx state through immer. In order to let
ngrx-wieder record the changes your reducer has to be adapted
so that it can forward the patches from immer:

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
your custom reducer inside the `undoable` meta-reducer.

```ts
import {undoRedo} from 'ngrx-wieder'

// wrap reducer inside meta-reducer to make it undoable
const undoableReducer = undoRedo({
  allowedActionTypes: [
    ActionTypes.Add,
    ActionTypes.Remove,
    ActionTypes.Select
  ]
})(reducer)

// wrap into exported function to keep Angular AOT working
export function myReducer(state = initialState, action: Actions) {
  return undoableReducer(state, action)
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
