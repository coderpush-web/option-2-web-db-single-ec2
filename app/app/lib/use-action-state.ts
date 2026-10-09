'use client';
import { useState, useTransition } from 'react';

export function useActionState<State, Payload = FormData>(
  action: (state: Awaited<State>, payload: Payload) => Promise<State> | State,
  initialState: State,
  permalink?: string,
): [state: Awaited<State>, dispatch: (payload: Payload) => void, isPending: boolean] {
  const [state, setState] = useState(initialState);
  const [isPending, startTransition] = useTransition();

  const formAction = (payload: Payload) => {
    startTransition(async () => {
      try {
        const result = await action(state, payload);
        setState(result);
      } catch (err) {
        console.error('Action error:', err);
      }
    });
  };

  return [state, formAction, isPending];
}
