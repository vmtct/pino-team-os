/** PAP-1956 isolated host contract. Not mounted until shared host source admission.
 * Deliberately no dependency on host-boundary.ts or the historical fixture.
 */
const canonical="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const adjustment=new RegExp("^/api/bo/workforce/payroll/periods/("+canonical+")/staff/("+canonical+")/financial-adjustments$");
const fixedPeriod="01a171ed-eb78-7941-b1de-dd4c020457b7";
const fixedStaff="01a18a28-6d8e-7db7-acbb-a18a942a5e72";
export function matchesProductPayrollAdjustmentPath(pathname:string):boolean{
 const match=adjustment.exec(pathname);
 return !!match&&match[0]===pathname&&!(match[1]===fixedPeriod&&match[2]===fixedStaff);
}