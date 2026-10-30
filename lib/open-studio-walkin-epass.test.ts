import test from "node:test";
import assert from "node:assert/strict";
import {canExportWalkinEpass} from "./open-studio-walkin-epass";
import type {WalkinPass} from "./open-studio-walkin-bo-api";
const pass:WalkinPass={id:"pass-id",code:"PINO-OS-ABCDEF",status:"ASSIGNED",path_code:"LPA",parent_user_id:"parent-id",center_id:"center-a"};
test("only current-Center ASSIGNED real Parent/Path Pass can be exported as PNG",()=>{
 assert.equal(canExportWalkinEpass(pass,"center-a"),true);
 assert.equal(canExportWalkinEpass(pass,"center-b"),false);
 assert.equal(canExportWalkinEpass(pass,""),false);
 assert.equal(canExportWalkinEpass(null,"center-a"),false);
 assert.equal(canExportWalkinEpass({...pass,status:"CONSUMED"},"center-a"),false);
 assert.equal(canExportWalkinEpass({...pass,status:"REVOKED"},"center-a"),false);
 assert.equal(canExportWalkinEpass({...pass,status:"AVAILABLE"},"center-a"),false);
 assert.equal(canExportWalkinEpass({...pass,path_code:null},"center-a"),false);
 assert.equal(canExportWalkinEpass({...pass,parent_user_id:null},"center-a"),false);
 assert.equal(canExportWalkinEpass({...pass,code:""},"center-a"),false);
});
