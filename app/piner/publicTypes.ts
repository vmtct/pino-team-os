// PAP-1800 · Sanitized public-only DTO. Never expose managed-learner or guardian fields.
export type PublicComment={id:string;author:string;body:string};
export type PublicPost={
 id:string;ownerId:"an"|"binh"|"mai";reactions:number;duration?:string;app:"hoi-hoa"|"piano";type:"photo"|"reel";visual:"flower"|"landscape"|"ceramic"|"abstract"|"keys"|"studio"|"music"|"concert";
 title:string;caption:string;date:string;alias:string;comments:PublicComment[];
 frames:PublicPost["visual"][];videoSrc:string|null;
};
