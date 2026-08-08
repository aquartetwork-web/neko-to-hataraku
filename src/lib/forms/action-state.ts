export type FormActionState = {
  error: string | null;
  message: string | null;
  reaction?: string | null;
};

export const INITIAL_FORM_ACTION_STATE: FormActionState = {
  error: null,
  message: null,
  reaction: null,
};
