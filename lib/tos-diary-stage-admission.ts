/** PAP-1400 / PAP-727: client-only *presentation* admission for a staged Diary writer.
 * Never a Core authorization or a Class Opening event.
 *
 * A positive compile-time Staging flag PLUS exact canonical Staging hostname is
 * mandatory. Neither user input nor a local query string can enable it.
 * Core still enforces Staff, Center, Class occurrence, Student and Mission.
 */
export function isDiaryStagingWriterHost(buildFlag:boolean,hostname:string):boolean {
 return buildFlag===true&&hostname.toLowerCase()==="tos.staging.pinohouse.art";
}
