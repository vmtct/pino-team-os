import { Client } from "@notionhq/client";
let client:Client|null=null;
export function notion(){if(!process.env.NOTION_TOKEN)throw new Error("Missing NOTION_TOKEN");client??=new Client({auth:process.env.NOTION_TOKEN});return client;}
export function dbId(name:keyof NodeJS.ProcessEnv){const value=process.env[name];if(!value)throw new Error(`Missing ${name}`);return value;}
