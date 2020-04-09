import {ActionCreator, ActionReducer, ActionType} from '@ngrx/store/src/models'
import {On} from '@ngrx/store'
import {Draft} from 'immer'

export interface ProduceOnReducer<S, C extends ActionCreator[], D = Draft<S>> {
  (state: D, action: ActionType<C[number]>): void | D
}

export function produceOn<C1 extends ActionCreator, S>(
  creator1: C1,
  reducer: ProduceOnReducer<S, [C1]>
): On<S>;
export function produceOn<C1 extends ActionCreator, C2 extends ActionCreator, S>(
  creator1: C1,
  creator2: C2,
  reducer: ProduceOnReducer<S, [C1, C2]>
): On<S>;
export function produceOn<C1 extends ActionCreator,
  C2 extends ActionCreator,
  C3 extends ActionCreator,
  S>(
  creator1: C1,
  creator2: C2,
  creator3: C3,
  reducer: ProduceOnReducer<S, [C1, C2, C3]>
): On<S>;
export function produceOn<C1 extends ActionCreator,
  C2 extends ActionCreator,
  C3 extends ActionCreator,
  C4 extends ActionCreator,
  S>(
  creator1: C1,
  creator2: C2,
  creator3: C3,
  creator4: C4,
  reducer: ProduceOnReducer<S, [C1, C2, C3, C4]>
): On<S>;
export function produceOn<C1 extends ActionCreator,
  C2 extends ActionCreator,
  C3 extends ActionCreator,
  C4 extends ActionCreator,
  C5 extends ActionCreator,
  S>(
  creator1: C1,
  creator2: C2,
  creator3: C3,
  creator4: C4,
  creator5: C5,
  reducer: ProduceOnReducer<S, [C1, C2, C3, C4, C5]>
): On<S>;
export function produceOn<C1 extends ActionCreator,
  C2 extends ActionCreator,
  C3 extends ActionCreator,
  C4 extends ActionCreator,
  C5 extends ActionCreator,
  C6 extends ActionCreator,
  S>(
  creator1: C1,
  creator2: C2,
  creator3: C3,
  creator4: C4,
  creator5: C5,
  creator6: C6,
  reducer: ProduceOnReducer<S, [C1, C2, C3, C4, C5, C6]>
): On<S>;
export function produceOn<C1 extends ActionCreator,
  C2 extends ActionCreator,
  C3 extends ActionCreator,
  C4 extends ActionCreator,
  C5 extends ActionCreator,
  C6 extends ActionCreator,
  C7 extends ActionCreator,
  S>(
  creator1: C1,
  creator2: C2,
  creator3: C3,
  creator4: C4,
  creator5: C5,
  creator6: C6,
  creator7: C7,
  reducer: ProduceOnReducer<S, [C1, C2, C3, C4, C5, C6, C7]>
): On<S>;
export function produceOn<C1 extends ActionCreator,
  C2 extends ActionCreator,
  C3 extends ActionCreator,
  C4 extends ActionCreator,
  C5 extends ActionCreator,
  C6 extends ActionCreator,
  C7 extends ActionCreator,
  C8 extends ActionCreator,
  S>(
  creator1: C1,
  creator2: C2,
  creator3: C3,
  creator4: C4,
  creator5: C5,
  creator6: C6,
  creator7: C7,
  creator8: C8,
  reducer: ProduceOnReducer<S, [C1, C2, C3, C4, C5, C6, C7, C8]>
): On<S>;
export function produceOn<C1 extends ActionCreator,
  C2 extends ActionCreator,
  C3 extends ActionCreator,
  C4 extends ActionCreator,
  C5 extends ActionCreator,
  C6 extends ActionCreator,
  C7 extends ActionCreator,
  C8 extends ActionCreator,
  C9 extends ActionCreator,
  S>(
  creator1: C1,
  creator2: C2,
  creator3: C3,
  creator4: C4,
  creator5: C5,
  creator6: C6,
  creator7: C7,
  creator8: C8,
  creator9: C9,
  reducer: ProduceOnReducer<S, [C1, C2, C3, C4, C5, C6, C7, C8, C9]>
): On<S>;
export function produceOn<C1 extends ActionCreator,
  C2 extends ActionCreator,
  C3 extends ActionCreator,
  C4 extends ActionCreator,
  C5 extends ActionCreator,
  C6 extends ActionCreator,
  C7 extends ActionCreator,
  C8 extends ActionCreator,
  C9 extends ActionCreator,
  C10 extends ActionCreator,
  S>(
  creator1: C1,
  creator2: C2,
  creator3: C3,
  creator4: C4,
  creator5: C5,
  creator6: C6,
  creator7: C7,
  creator8: C8,
  creator9: C9,
  creator10: C10,
  reducer: ProduceOnReducer<S, [C1, C2, C3, C4, C5, C6, C7, C8, C9, C10]>
): On<S>;
export function produceOn<S>(
  creator: ActionCreator,
  ...rest: (ActionCreator | ProduceOnReducer<S, [ActionCreator]>)[]
): On<S>;
export function produceOn<S>(...args: (ActionCreator | Function)[]): On<S> {
  const reducer = args.pop() as ActionReducer<S>
  const types = args.map((creator: ActionCreator) => creator.type)
  return {reducer, types}
}
