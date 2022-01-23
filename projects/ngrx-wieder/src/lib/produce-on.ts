import {
  ActionCreator,
  ActionReducer,
  ActionType,
  ReducerTypes,
} from "@ngrx/store";
import { Draft } from "immer";

export type ProduceOnReducer<S, C extends ActionCreator[], D = Draft<S>> = (
  state: D,
  action: ActionType<C[number]>
) => void | D;

type ExtractActionTypes<Creators extends readonly ActionCreator[]> = {
  [Key in keyof Creators]: Creators[Key] extends ActionCreator<infer T>
    ? T
    : never;
};

export const produceOn = <S, Creators extends ActionCreator[]>(
  ...args: [...creators: Creators, reducer: ProduceOnReducer<S, Creators>]
): ReducerTypes<S, Creators> => {
  const reducer = args.pop() as ActionReducer<S>;
  const types = (((args as unknown) as Creators).map(
    (creator) => creator.type
  ) as unknown) as ExtractActionTypes<Creators>;
  return { reducer, types };
}
