'use client';

import {useMemo,useState} from 'react';

type View='teachers'|'assistants'|'coverage';
type LeaveState='none'|'reported';
type SupportState='none'|'requested';

const days=['T2','T3','T4','T5','T6'];

const teacherCommitments=[
  {path:'Little Piner',capability:'Early Years TE',staff:'Mai',day:'T2',classTime:'18:00–20:30',coverage:'18:00–20:30',note:'LPA + LPP Bridge',tone:'lp'},
  {path:'PianoHouse',capability:'Piano Core TE',staff:'Bảo',day:'T3',classTime:'18:00–19:30',coverage:'17:45–19:45',note:'Manager widened +15/+15',tone:'pi'},
  {path:'PianoHouse',capability:'Piano Core TE',staff:'Bảo',day:'T5',classTime:'19:30–21:00',coverage:'19:30–21:00',note:'Exact class alignment',tone:'pi'},
  {path:'ArtChitect',capability:'Creative Mentor',staff:'Vy',day:'T4',classTime:'18:00–20:30',coverage:'18:00–20:30',note:'Studio window',tone:'ac'},
];

const assistantWeek={
  T2:{ta:'Trang',rec:'Nhi'},
  T3:{ta:'An',rec:'Hân'},
  T4:{ta:'Trang',rec:'Nhi'},
  T5:{ta:'An',rec:'Hân'},
  T6:{ta:'Trang',rec:'Nhi'},
};

const dailyLanes=[
  {label:'Little Piner',meta:'Class · Bridge topology',start:20,width:48,tone:'lp'},
  {label:'PianoHouse',meta:'Class · Cohort A',start:20,width:30,tone:'pi'},
  {label:'ArtChitect',meta:'Studio window',start:20,width:48,tone:'ac'},
  {label:'TE · Mai',meta:'Early Years',start:20,width:48,tone:'te'},
  {label:'TE · Bảo',meta:'Piano Core',start:20,width:30,tone:'te'},
  {label:'TA · Trang',meta:'PA-ACA · full evening',start:10,width:70,tone:'pa'},
  {label:'Reception · Nhi',meta:'Reception-primary · conditional float',start:10,width:70,tone:'rec'},
];

export default function WorkforcePrototype(){
  const [view,setView]=useState<View>('teachers');
  const [leave,setLeave]=useState<LeaveState>('none');
  const [support,setSupport]=useState<SupportState>('none');

  const coverageState=useMemo(()=>{
    if(leave==='reported') return {label:'1 gap cần Manager xử lý',tone:'warn'};
    if(support==='requested') return {label:'1 support request đang chờ',tone:'info'};
    return {label:'Coverage đủ theo plan',tone:'ok'};
  },[leave,support]);

  return <div className="founder-page workforce-page">
    <header className="founder-header workforce-header">
      <div>
        <div className="eyebrow">Workforce prototype</div>
        <h1>Shift Management</h1>
        <p>TE theo lớp · chốt theo tháng. TA theo house · đăng ký theo tuần. Manager finalize.</p>
      </div>
      <span className="prototype-badge">Mock data · no writes</span>
    </header>

    <section className="workforce-principles" aria-label="Nguyên tắc scheduling">
      <div><span>TE</span><strong>Monthly</strong><small>class-oriented commitment</small></div>
      <div><span>TA</span><strong>Weekly</strong><small>17:30–21:00 · no split</small></div>
      <div><span>Manager</span><strong>Final authority</strong><small>system suggests, Manager decides</small></div>
      <div><span>Daily</span><strong>{coverageState.label}</strong><small>planning horizons merge here</small></div>
    </section>

    <div className="workforce-tabs" role="tablist" aria-label="Workforce views">
      <button className={view==='teachers'?'active':''} onClick={()=>setView('teachers')}>Monthly Teachers</button>
      <button className={view==='assistants'?'active':''} onClick={()=>setView('assistants')}>Weekly Assistants</button>
      <button className={view==='coverage'?'active':''} onClick={()=>setView('coverage')}>Daily Coverage</button>
    </div>

    {view==='teachers'&&<section className="workforce-stack">
      <div className="panel workforce-panel">
        <div className="workforce-panel-head">
          <div><span className="muted">Tháng 09 · prototype</span><h2>Teacher commitments</h2></div>
          <button className="button secondary" type="button">Collect TE availability</button>
        </div>
        <div className="teacher-table" role="table" aria-label="Monthly teacher commitments">
          <div className="teacher-row teacher-head" role="row"><span>Path</span><span>Recurring class</span><span>TE</span><span>Coverage</span><span>System signal</span></div>
          {teacherCommitments.map((item,index)=><div className="teacher-row" role="row" key={`${item.path}-${item.day}-${index}`}>
            <span><i className={`workforce-dot ${item.tone}`}/><b>{item.path}</b><small>{item.capability}</small></span>
            <span><b>{item.day} · {item.classTime}</b><small>{item.note}</small></span>
            <span><b>{item.staff}</b><small>Monthly commitment</small></span>
            <span><b>{item.coverage}</b><small>{item.coverage===item.classTime?'Aligned':'Manager adjusted'}</small></span>
            <span><em className={item.coverage===item.classTime?'signal-ok':'signal-note'}>{item.coverage===item.classTime?'Aligned':'Review only'}</em></span>
          </div>)}
        </div>
      </div>

      <div className="workforce-two-col">
        <div className="panel workforce-panel">
          <span className="muted">TE planning input</span><h2>Availability ≠ assignment</h2>
          <p className="workforce-copy">TE gửi recurring availability / preferred classes. System dùng để đề xuất. Manager vẫn là người chốt class coverage tháng.</p>
          <div className="availability-chips"><span>T3 evening ✓</span><span>T5 evening ✓</span><span>Piano preferred</span></div>
        </div>
        <div className="panel workforce-panel">
          <span className="muted">Alignment rule</span><h2>Suggest, don’t hard-block</h2>
          <div className="alignment-example"><div><small>Class</small><strong>18:00–19:30</strong></div><span>→</span><div><small>Manager final</small><strong>17:45–19:45</strong></div></div>
          <p className="workforce-copy">UI surface warning/scoring, nhưng không từ chối assignment chỉ vì rộng hơn class.</p>
        </div>
      </div>
    </section>}

    {view==='assistants'&&<section className="workforce-stack">
      <div className="panel workforce-panel">
        <div className="workforce-panel-head">
          <div><span className="muted">Tuần 3 · evening template</span><h2>Assistants · 17:30–21:00</h2></div>
          <span className="shift-rule">No split shift</span>
        </div>
        <div className="assistant-grid">
          <div className="assistant-corner"><small>Function</small><strong>Full evening</strong></div>
          {days.map(day=><div className="assistant-day" key={day}><strong>{day}</strong><small>17:30–21:00</small></div>)}
          <div className="assistant-label"><strong>TA</strong><small>PA-ACA · committed</small></div>
          {days.map(day=><div className="assistant-slot" key={`ta-${day}`}><span className="avatar">{assistantWeek[day as keyof typeof assistantWeek].ta.slice(0,1)}</span><strong>{assistantWeek[day as keyof typeof assistantWeek].ta}</strong><small>Final</small></div>)}
          <div className="assistant-label"><strong>Reception</strong><small>reception-primary</small></div>
          {days.map(day=><div className="assistant-slot reception" key={`rec-${day}`}><span className="avatar">{assistantWeek[day as keyof typeof assistantWeek].rec.slice(0,1)}</span><strong>{assistantWeek[day as keyof typeof assistantWeek].rec}</strong><small>Final</small></div>)}
        </div>
      </div>

      <div className="workforce-two-col">
        <div className="panel workforce-panel">
          <span className="muted">Staff request</span><h2>Request ≠ final assignment</h2>
          <div className="request-list"><span><b>Trang</b><small>Requested T2 · T4 · T6</small></span><em>3/3 assigned</em></div>
          <div className="request-list"><span><b>An</b><small>Requested T3 · T5 · T6</small></span><em>2/3 assigned</em></div>
        </div>
        <div className="panel workforce-panel">
          <span className="muted">Center baseline</span><h2>2 PA responsibilities</h2>
          <div className="baseline-bars"><div><b>TA / PA-ACA</b><span>Committed classroom capacity</span></div><div><b>PA-Reception</b><span>Reception primary · conditional float</span></div></div>
        </div>
      </div>
    </section>}

    {view==='coverage'&&<section className="workforce-stack">
      <div className="panel workforce-panel coverage-panel">
        <div className="workforce-panel-head">
          <div><span className="muted">T2 · Daily operational truth</span><h2>Coverage timeline</h2></div>
          <span className={`coverage-state ${coverageState.tone}`}>{coverageState.label}</span>
        </div>
        <div className="timeline-head"><span/><span>17:30</span><span>18:00</span><span>19:00</span><span>20:00</span><span>21:00</span></div>
        <div className="coverage-lanes">
          {dailyLanes.map((lane,index)=><div className="coverage-row" key={`${lane.label}-${index}`}>
            <div><strong>{lane.label}</strong><small>{lane.meta}</small></div>
            <div className="coverage-track"><span className={`coverage-bar ${lane.tone} ${leave==='reported'&&lane.label==='TE · Bảo'?'absent':''}`} style={{left:`${lane.start}%`,width:`${lane.width}%`}}>{leave==='reported'&&lane.label==='TE · Bảo'?'ABSENT':''}</span></div>
          </div>)}
        </div>
      </div>

      <div className="workforce-two-col">
        <div className="panel workforce-panel exception-card">
          <span className="muted">Reality divergence</span><h2>Report Leave</h2>
          <p className="workforce-copy">Assignment vẫn giữ nguyên. Absence ghi nhận thực tế; Manager resolve coverage riêng.</p>
          {leave==='none'?<button className="button" onClick={()=>setLeave('reported')}>Simulate TE leave</button>:<div className="exception-result"><strong>Bảo · Piano 18:00–19:30</strong><span>ABSENCE REPORTED</span><button type="button" onClick={()=>setLeave('none')}>Reset prototype</button></div>}
        </div>
        <div className="panel workforce-panel exception-card">
          <span className="muted">TE remains present</span><h2>Request TA Support</h2>
          <p className="workforce-copy">Support request là additional demand, không phải absence và không tự borrow Reception.</p>
          {support==='none'?<button className="button secondary" onClick={()=>setSupport('requested')}>Simulate support request</button>:<div className="exception-result support"><strong>Little Piner · D1/new learners</strong><span>WAITING FOR MANAGER</span><button type="button" onClick={()=>setSupport('none')}>Reset prototype</button></div>}
        </div>
      </div>

      {(leave==='reported'||support==='requested')&&<div className="panel manager-queue">
        <div><span className="muted">Manager queue</span><h2>Needs resolution</h2></div>
        {leave==='reported'&&<div className="manager-item"><span className="manager-icon">!</span><div><strong>Piano TE coverage gap</strong><small>Planned TE Bảo remains in history · occurrence marked absent</small></div><div className="manager-actions"><button>Assign replacement TE</button><button>Use fallback</button><button>Override</button></div></div>}
        {support==='requested'&&<div className="manager-item"><span className="manager-icon">+</span><div><strong>TA support requested</strong><small>Little Piner · TE remains present · Reception is not auto-borrowed</small></div><div className="manager-actions"><button>Assign TA capacity</button><button>Decline</button></div></div>}
      </div>}
    </section>}
  </div>;
}
