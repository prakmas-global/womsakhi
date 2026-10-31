"use client";
import {useCallback,useEffect} from "react";
import {apiClient} from "./api";
import {useResource} from "./use-resource";

export interface AccountUpi {upi_id:string;configured:boolean;existing_upi_ids:string[];updated_at?:string|null}
export const apiAccountUpi=(signal?:AbortSignal)=>apiClient.get<AccountUpi>("/me/payout/upi",{signal}).then(r=>r.data);
export const apiSaveAccountUpi=(upi_id:string)=>apiClient.put<AccountUpi>("/me/payout/upi",{upi_id}).then(r=>r.data);
export function useAccountUpi(){
 const resource=useResource<AccountUpi|null>(useCallback(signal=>apiAccountUpi(signal),[]),null);
 const refresh=resource.refetch;
 useEffect(()=>{const visible=()=>{if(document.visibilityState==="visible")refresh();};window.addEventListener("womsakhi:upi-updated",refresh);window.addEventListener("focus",visible);return()=>{window.removeEventListener("womsakhi:upi-updated",refresh);window.removeEventListener("focus",visible);};},[refresh]);
 return resource;
}
