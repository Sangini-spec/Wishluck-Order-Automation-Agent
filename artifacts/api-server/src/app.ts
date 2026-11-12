import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { ZodError } from "zod";
import { HttpError } from "./lib/db";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((req,res,next)=>{
  const origin=req.get("origin");
  if(origin&&!["GET","HEAD","OPTIONS"].includes(req.method)){
    const host=req.get("x-forwarded-host")||req.get("host");
    try{if(new URL(origin).host!==host){res.status(403).json({error:"Cross-origin state changes are not allowed."});return;}}catch{res.status(403).json({error:"Invalid origin."});return;}
  }
  next();
});
app.use(express.json({limit:"256kb",verify:(req,_res,buf)=>{(req as any).rawBody=buf;}}));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  if(res.headersSent)return;
  const status=error instanceof HttpError?error.status:error instanceof ZodError||error?.name==="ZodError"?400:error?.code==="P2025"?404:error?.code==="P2002"?409:500;
  if(status===500)logger.error({errorType:error?.name,code:error?.code},"Request failed");
  res.status(status).json({error:error instanceof HttpError?error.message:status===400?"Invalid request. Please check the required fields.":status===409?"A record with these identifiers already exists.":status===404?"Record not found.":"Unable to process this request. Please try again or contact support."});
});

export default app;
