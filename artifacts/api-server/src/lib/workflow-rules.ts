import { prisma } from "./db";
export const handoverDefaults={
  handoverRefundThreshold:1500,handoverUnresolvedTurns:2,handoverToolFailures:2,handoverClarifications:2,
  handoverKeywords:["angry","furious","very upset","बहुत परेशान","गुस्सा","pareshan","third time"],
};
export async function workflowRules(){
  const s=await prisma.appSetting.findUniqueOrThrow({where:{key:"workflow"}});
  return {...handoverDefaults,...s.value as any};
}
export function detectLanguage(text:string,fallback="English"){
  if(/[\u0900-\u097f]/.test(text))return "Hindi";
  if(/\b(mera|bhai|kab|hai|haan|nahi|mujhe|mil|karo|chahiye|aayega|pareshan|dobara|phir)\b/i.test(text))return "Hinglish";
  if(/^\s*(yes|no|confirm|thanks|ok|okay|haan|ha)[.! ]*$/i.test(text))return fallback;
  return /[a-z]{3}/i.test(text)?"English":fallback;
}
export const say=(language:string,en:string,hi:string,hg:string)=>language==="Hindi"?hi:language==="Hinglish"?hg:en;
export function requestIntent(text:string,fallback="Other"){
  if(/ignore.{0,40}(?:instruction|rule)|system prompt|orders of.{0,25}(?:\d|98[xX])|show.{0,20}other customer/i.test(text))return "Unsafe request";
  if(/consumer court|legal action|real person|human|support person|bulk order|अदालत|इंसान/i.test(text))return "Human support";
  if(/which.*size.*buy|which.*size.*should|height|feet.*kg|size chart/i.test(text))return "Product help";
  if(/delivery failed|retry|reattempt|landmark|ndr|दोबारा डिलीवरी|फिर.*डिलीवरी/i.test(text))return "Failed delivery";
  if(/refund|रिफंड|पैसे वापस|paise.*wapas/i.test(text))return "Refund status";
  if(/exchange|size|tight|बदल|साइज़|साइज/i.test(text))return "Return / exchange";
  if(/return|वापस/i.test(text))return "Return";
  if(/cancel|रद्द/i.test(text))return "Cancellation";
  if(/address|phone|पता|फोन/i.test(text)&&/change|update|correct|instead|बदल|नया|new phone/i.test(text))return "Contact update";
  if(/cod|cash on delivery|कैश/i.test(text))return "COD";
  if(/policy|पॉलिसी|नीति|shipping fee/i.test(text))return "Policy";
  if(/product|kurta|tee|jeans|bag|कुर्ता|कीमत/i.test(text)&&!/order|ऑर्डर/i.test(text))return "Product help";
  if(/deliver|order|tracking|kab|ऑर्डर|डिलीवरी|\bWL\d{5}\b|\bEVAL-/i.test(text))return "Order tracking";
  return fallback;
}
export const unresolvedSignal=(text:string)=>/still.{0,25}(?:not|unresolved|wrong)|not.{0,12}(?:solved|fixed|resolved)|same (?:issue|problem)|again.{0,20}(?:wrong|problem)|abhi bhi|phir.*problem|अभी भी|नहीं हुआ|दोबारा.*समस्या/i.test(text);
export async function trackIssue(conversationId:string,text:string){
  const c=await prisma.conversation.findUniqueOrThrow({where:{id:conversationId}});
  const continuation=/^\s*(yes|yes please|no|confirm|haan|ha|हाँ|जी हाँ|nahi|नहीं)[.! ]*$/i.test(text)||/^\s*(?:WL\d{5}|WL-DEMO-[A-Z0-9-]+|EVAL-[A-Z0-9-]+)[, .]+(?:phone|registered)/i.test(text);
  const intent=continuation&&c.intent?c.intent:requestIntent(text,unresolvedSignal(text)?c.intent||"Other":"Other");
  const same=c.issueKey===intent;
  return prisma.conversation.update({where:{id:conversationId},data:{intent,issueKey:intent,
    unresolvedTurns:unresolvedSignal(text)?(same?c.unresolvedTurns:0)+1:same?c.unresolvedTurns:0,
    ...(!same?{toolErrorCount:0,clarificationTurns:0}:{})}});
}
