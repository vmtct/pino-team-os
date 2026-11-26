"use client";
/** PAP-2387 / PAP-2389 — canonical Parent live actor and Center binding. */
import {createContext,useContext} from "react";
import type {NativeParentLiveScope} from "./parent-native-data";
export const ParentLiveScope=createContext<NativeParentLiveScope|null>(null);
export const useParentLiveScope=()=>useContext(ParentLiveScope);
