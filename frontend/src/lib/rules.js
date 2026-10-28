import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API } from "@/lib/sim";

const RulesCtx = createContext(null);
const POLL_MS = 2000;


export function RulesProvider({ children }) {
  const [state, setState] = useState({ rules: null, version: null, error: null });
  const ver = useRef(null);

  const load = useCallback(async (quiet) => {
    try {
      const { data } = await axios.get(`${API}/rules`);
      if (data.version !== ver.current) {
        if (ver.current != null && !quiet) toast.success("Rules config hot-reloaded");
        ver.current = data.version;
        setState({ rules: data.rules, version: data.version, error: null });
      }
    } catch (e) {
      setState((s) => ({ ...s, error: e.message }));
    }
  }, []);

  useEffect(() => {
    load(true);
    const id = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const save = useCallback(async (rules) => {
    const { data } = await axios.put(`${API}/rules`, { rules });
    ver.current = data.version;
    setState({ rules: data.rules, version: data.version, error: null });
    return data;
  }, []);

  return <RulesCtx.Provider value={{ ...state, save }}>{children}</RulesCtx.Provider>;
}

export const useRules = () => useContext(RulesCtx);
