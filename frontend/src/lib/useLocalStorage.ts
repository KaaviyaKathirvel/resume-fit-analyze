import { useEffect, useState } from "react";

export function useLocalStorage(
  key: string,
  initial: string
): [string, (v: string) => void] {
  const [value, setValue] = useState<string>(() => {
    try {
      return localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch {
      /* storage unavailable — ignore */
    }
  }, [key, value]);

  return [value, setValue];
}
