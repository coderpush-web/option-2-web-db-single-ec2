'use client';
import { useState, useTransition } from 'react';

export function useActionState<State, Payload = FormData>(
  action: (state: Awaited<State>, payload: Payload) => Promise<State> | State,
  initialState: State,
  permalink?: string,
): [state: Awaited<State>, dispatch: (payload: Payload) => void, isPending: boolean] {
  const [state, setState] = useState<State>(initialState);
  const [isPending, startTransition] = useTransition();

  const formAction = (payload: Payload) => {
    startTransition(async () => {
      try {
        const result = await action(state, payload);
        if (result !== undefined && result !== null) {
          setState(result);
        }
      } catch (err: any) {
        if (err?.digest?.startsWith('NEXT_REDIRECT') || err?.message === 'NEXT_REDIRECT') {
          const parts = err.digest ? err.digest.split(';') : [];
          const redirectUrl = parts[2] || '/dashboard/invoices';
          window.location.href = redirectUrl;
          return;
        }
        console.error('Action error:', err);
      }
    });
  };

  return [state !== undefined && state !== null ? state : initialState, formAction, isPending];
}
