"use client";
import { createContext, type ReactNode } from "react";

/** Outer BO presentation only; never a module data or authorization context. */
export const BoApplicationShellContext = createContext<((id: string) => ReactNode) | null>(null);
