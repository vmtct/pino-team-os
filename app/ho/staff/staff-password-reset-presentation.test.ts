import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {StaffPasswordResetAction,StaffPasswordResetPreview} from "./StaffPasswordResetPresentation";
test("PAP-1144 PAP-2423 existing reset action reused without secret or transport in local preview",()=>{
 const html=renderToStaticMarkup(createElement(StaffPasswordResetPreview,{staffId:"STAFF-MOCK-001",email:"staff@example.invalid",eligible:true}));
 assert.match(html,/data-testid="ho-staff-password-reset-preview"/);
 assert.match(html,/class="secondary-btn">Reset password/);
 assert.doesNotMatch(html,/ho-reset-password-value|temporaryPassword|\/api\//);
 const denied=renderToStaticMarkup(createElement(StaffPasswordResetPreview,{staffId:"STAFF-MOCK-001",email:"staff@example.invalid",eligible:false}));
 assert.match(denied,/disabled="">Reset password/);
 assert.match(renderToStaticMarkup(createElement(StaffPasswordResetAction,{busy:true,onClick:()=>{}})),/disabled=""/);
});
