// Public OpenAI standard token prices, verified 2026-11-12.
// This is an estimate, NOT the user's Replit credits invoice.
export const llmRateCard={model:"gpt-5.4-mini",inputUSDPerMillion:.75,outputUSDPerMillion:4.5,
  source:"https://developers.openai.com/api/docs/models/gpt-5.4-mini",verifiedAt:"2026-11-12",
  assumptions:"Standard uncached token pricing. Replit credits/markups, discounts, cache and tool charges are not inferred."};
export function estimateTokenCost(input:number,output:number){
  return Math.round((input*.75+output*4.5)/1e6*1e8)/1e8;
}
