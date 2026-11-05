import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleForgotPassword,type StaffPasswordRecoveryEnv} from './staff-password-recovery-handler';
test('staging recovery blocks before token issuance, provider access or recipient disclosure',async()=>{
 let accessed=0;
 const env={APP_ENV:'staging',get PINO_STAFF_PASSWORD_CORE(){accessed++;throw new Error('token issue forbidden');},get PINO_STAFF_PASSWORD_EMAIL(){accessed++;throw new Error('provider access forbidden');}} as unknown as StaffPasswordRecoveryEnv;
 const response=await handleForgotPassword(new Request('https://example.invalid/api/staff-auth/forgot-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'fixture@example.invalid'})}),env);
 assert.equal(response.status,503);assert.equal(accessed,0);assert.equal((await response.text()).includes('fixture@example.invalid'),false);
});
