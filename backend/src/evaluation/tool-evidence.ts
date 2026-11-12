type Trace={toolName:string;status:string;output?:unknown};

/** Both tools read inventory. Require exact, successful stock evidence, not a tool-name shortcut. */
export function hasUnavailableStockEvidence(traces:Trace[],sku:string,size:string):boolean{
  return traces.some(trace=>{
    if(trace.status!=="SUCCESS"||!trace.output||typeof trace.output!=="object")return false;
    const output=trace.output as Record<string,any>;
    if(trace.toolName==="evaluate_return_eligibility"){
      return output.sku===sku&&output.requestedSize===size&&output.availableStock===0&&output.eligible===false;
    }
    if(trace.toolName==="check_inventory"){
      return Array.isArray(output.stock)&&output.stock.some((row:any)=>row.sku===sku&&row.size===size&&row.available===0);
    }
    return false;
  });
}
