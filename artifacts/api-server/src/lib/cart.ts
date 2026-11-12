import { prisma, HttpError } from "./db";
import { shippingFee, codEligibility } from "./policy";

const cartInclude={items:{include:{product:true}}} as const;
export const inr=(value:unknown)=>Math.round(Number(value)*100)/100;
export async function getCart(customerId:string){
  const cart=await prisma.cart.upsert({where:{customerId},update:{},create:{customerId},include:cartInclude});
  const inventory=await prisma.inventory.findMany({where:{sku:{in:cart.items.map(i=>i.sku)}}});
  const items=cart.items.map(i=>{
    const available=inventory.find(stock=>stock.sku===i.sku&&stock.size===i.size)?.available??0,unitPrice=inr(i.product.price);
    return {sku:i.sku,name:i.product.name,size:i.size,quantity:i.quantity,unitPrice,available,lineTotal:inr(unitPrice*i.quantity)};
  }).sort((a,b)=>a.sku.localeCompare(b.sku)||a.size.localeCompare(b.size));
  return {version:cart.version,items,subtotal:inr(items.reduce((n,i)=>n+i.lineTotal,0)),count:items.reduce((n,i)=>n+i.quantity,0)};
}
export async function changeCart(customerId:string,a:{sku:string;size:string;quantity:number;mode:"ADD"|"SET"}){
  if(!Number.isInteger(a.quantity)||a.quantity<0||a.quantity>10)throw new HttpError(400,"Choose a whole-number quantity from 0 to 10.");
  await prisma.$transaction(async t=>{
    await t.$queryRaw`SELECT id FROM "Customer" WHERE id=${customerId} FOR UPDATE`;
    const p=await t.product.findUnique({where:{sku:a.sku}});
    if(!p||!p.sizes.includes(a.size))throw new HttpError(400,"Choose a product and size from the catalogue.");
    const stock=await t.inventory.findUnique({where:{sku_size:{sku:a.sku,size:a.size}}});
    const cart=await t.cart.upsert({where:{customerId},update:{},create:{customerId}});
    const row=await t.cartItem.findUnique({where:{customerId_sku_size:{customerId,sku:a.sku,size:a.size}}});
    const quantity=a.mode==="ADD"?(row?.quantity||0)+a.quantity:a.quantity;
    if(quantity>10)throw new HttpError(400,"Maximum 10 units per size.");
    if(quantity>(stock?.available||0))throw new HttpError(409,"That size does not have enough stock.");
    if(quantity)await t.cartItem.upsert({where:{customerId_sku_size:{customerId,sku:a.sku,size:a.size}},create:{customerId,sku:a.sku,size:a.size,quantity},update:{quantity}});
    else if(row)await t.cartItem.delete({where:{customerId_sku_size:{customerId,sku:a.sku,size:a.size}}});
    await t.cart.update({where:{customerId},data:{version:{increment:1}}});
  });
  return getCart(customerId);
}
export type ShippingAddress={line1:string;line2?:string;landmark?:string;city:string;state:string;pincode:string;zone?:string;country?:string};
export async function checkoutQuote(customerId:string,a:{phone:string;address:ShippingAddress;paymentMethod:"COD"|"PREPAID"}){
  const cart=await getCart(customerId);
  if(!cart.items.length)throw new HttpError(409,"Your cart is empty.");
  for(const i of cart.items)if(i.quantity>i.available)throw new HttpError(409,`${i.name} in size ${i.size} no longer has enough stock. Update your cart.`);
  const pin=await prisma.pincodeServiceability.findUnique({where:{pincode:a.address.pincode}});
  if(!pin)throw new HttpError(400,"We cannot confirm delivery to this pincode. Choose a listed serviceable pincode or contact support.");
  const shipping=shippingFee(cart.subtotal),cod=a.paymentMethod==="COD"?49:0,total=inr(cart.subtotal+shipping+cod);
  const decision=a.paymentMethod==="COD"?codEligibility(total,pin.codAvailable):{eligible:true,reason:"Prepaid shipping is available at this pincode."};
  return {subtotal:cart.subtotal,shippingFee:shipping,codFee:cod,total,eligible:decision.eligible,reason:decision.reason,cartVersion:cart.version,items:cart.items,demoPayment:true};
}
