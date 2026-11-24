"use client";

import { useMe } from "./session";
import type { Me } from "./types";

/** Inside the dashboard the layout guarantees the user is loaded. */
export function useMeRequired(): Me {
  const { data } = useMe();
  return data as Me;
}
