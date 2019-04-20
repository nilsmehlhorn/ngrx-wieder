ngrx-wieder is a lightweight yet configurable solution for implementing undo-redo in Angular apps on top of [NgRx](https://ngrx.io/).
It's based on [immer](https://github.com/immerjs/immer) hence the name wieder (German for: again)

## Prerequisites

Make sure you're using immer to update your NgRx (sub-)state.

## Installation

Install via
```
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
```
const reducer = (state: State, action: Actions): State =>
  produce(state, nextState => {
    switch (action.type) {
    /* action handling */
    }
  })
```

**After**
```
const reducer = (state: State, action: Actions, patchListener?: PatchListener): State =>
  produce(state, nextState => {
    switch (action.type) {
    /* action handling */
    }
  }, patchListener)
```

Next you'll configure the undo-redo behaviour by instantiating `undoRedo` and wrapping
your custom reducer inside the `undoable` meta-reducer.

```
import {undoRedo} from 'ngrx-wieder'

const undoable = undoRedo({
  allowedActionTypes: [
    ActionTypes.Add,
    ActionTypes.Remove,
    ActionTypes.Select
  ]
})

// wrap reducer inside meta-reducer to make it undoable
const undoableReducer = undoable(reducer)

// wrap into exported function to keep Angular AOT working
export function myReducer(state = initialState, action: Actions) {
  return undoableReducer(state, action)
}
```

Then whenever you'd like to undo or redo one of the passed `allowedActionTypes` simply dispatch
the corresponding actions:
```
this._store.dispatch({{ type: 'UNDO' }})
this._store.dispatch({{ type: 'REDO' }})
```

### Configuration

| Option | Default | Description
|:---  |:--- | :---
| `allowedActionTypes`| `[]` |Actions applicable for being undone/redon (leave empty to allow all actions)
| `mergeActionTypes`| `[]` | Types of actions whose state difference should be merged when they appear consecutively
| `mergeRules`| `new Map()` |Predicates for deciding whether differences from consecutive actions of the same type should be merged
| `maxBufferSize`| `32` | How many state differences should be buffered in either direction
| `undoActionType`| `'UNDO'` | Override for the undo action's type
| `redoActionType`| `'REDO'` | Override for the redo action's type
| `confirmMergeActionType`| `'CONFIRM_MERGE'` |Override for the confirm-merge action's type.
| `clearActionType`| `'CLEAR'` | Override for the clear action's type
| `track`| `false` | Whether ability for undo/redo should be tracked in the state through properties `canUndo` and `canRedo`

### Dealing with consecutive changes

*todo*
