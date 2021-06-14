import { TestBed } from "@angular/core/testing";
import { ActionReducer, Action, StoreModule, Store } from "@ngrx/store";
import {
  TestState,
  initialState,
  createOnReducer,
  createSwitchReducer,
} from "./test-util/store";

interface RootState {
  rootSlice: TestState;
  feat: {
    featSlice: TestState;
  };
}

const test = (createReducer: () => ActionReducer<TestState, Action>) => {
  let store: Store<RootState>;
  beforeEach(() => {
    const rootReducers = {
      rootSlice: createReducer(),
    };
    const featReducers = {
      featSlice: createReducer(),
    };
    TestBed.configureTestingModule({
      imports: [
        StoreModule.forRoot(rootReducers),
        StoreModule.forFeature("feat", featReducers),
      ],
    });
    store = TestBed.inject(Store);
  });

  it("should startup store", (done) => {
    store.subscribe((state) => {
      expect(state).toEqual({
        rootSlice: initialState,
        feat: {
          featSlice: initialState,
        },
      });
      done();
    });
  });
};

describe("Integration", () => {
  describe("OnReducer", () => test(createOnReducer));
  describe("SwitchReducer", () => test(createSwitchReducer));
});
