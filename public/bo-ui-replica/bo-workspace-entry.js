/* The approved mock baseline stays default; Core integration is an explicit separate entry. */
(async function(){
 'use strict';
 const query=new URLSearchParams(location.search),key=query.get('module');
 if(query.get('data')==='core'){
  document.querySelector('#list-screen h1').textContent=key==='classes'?'Classes':'Học viên';
  document.querySelector('.topbar-breadcrumb strong').textContent=key==='classes'?'Classes':'Học viên';
  document.querySelector('#table-count').textContent='Đang tải…';
  document.querySelector('#add-record').disabled=true;
  try{
   const adapter=await window.PinoBOCorePilot.create(key,window.fetch.bind(window));
   window.PinoBOPilotAdapters=Object.freeze({[key]:adapter});
  }catch(error){
   const cell=document.createElement('td');cell.colSpan=8;cell.textContent=error.message;cell.setAttribute('role','alert');
   const row=document.createElement('tr');row.append(cell);document.querySelector('#table-body').replaceChildren(row);
   document.querySelector('#table-count').textContent='Không thể tải dữ liệu';return;
  }
 }
 const script=document.createElement('script');script.src='./playground.js';document.body.append(script);
})();
