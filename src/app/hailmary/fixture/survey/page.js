"use client";

import {useMemo, useState} from 'react';
import OilSurveyPanel from '@/components/OilSurveyPanel';
import {THEMES} from '@/lib/hailmaryThemes';

// Local-only survey scenarios: no wallet, Firestore writes, or game actions.
export default function SurveyFixture() {
  const [themeKey,setThemeKey] = useState('parabolumDark');
  const [scenario,setScenario] = useState('sparse');
  const [selected,setSelected] = useState({x:5,y:8});
  const [open,setOpen] = useState(false);
  const [view,setView] = useState('surface');
  const [jump,setJump] = useState(false);
  const [notice,setNotice] = useState('');
  const theme = THEMES[themeKey];
  const field = useMemo(() => {
    const plots={}, claims=[], hellMap={}, grid=Array.from({length:10},()=>Array.from({length:10},()=>Array(20).fill(0)));
    for(let y=9;y>=0;y--) for(let x=0;x<10;x++) {
      const own=x===5&&y===8;
      const explored=scenario==='empty'?false:own||(scenario==='busy'&&(x+y)%3===0);
      const depth=explored?(own?11:3+(x+y)%12):0;
      const p={currentOwnerId:explored?(own?'me':'rival'):null,drillDay:depth,revealed:{},hellLayers:{},hellCapped:{}};
      let total=0;
      for(let z=0;z<depth;z++) {
        const oil=(own&&z===8)?524:(own&&z===7)?80:(scenario==='busy'&&(x+y+z)%7===0)?190:0;
        p.revealed[z]=oil; grid[x][y][z]=oil; total+=oil;
      }
      if(scenario==='busy'&&x===3&&y===9) {p.hellLayers[3]=true;hellMap['3_9_3']=true;p.hellCapped[3]=true;}
      plots[`${x}_${y}`]=p;claims.push({x,y,index:y*10+x,total});
    }
    // A sparse wildcat result outside any owned or fully drilled column.
    if(scenario==='busy') { plots['1_8'].revealed[15]=0; plots['1_8'].wildcatTaken={15:'me'}; }
    return {plots,claims,grid,hellMap};
  },[scenario]);
  return <main style={{minHeight:'100dvh',padding:24,background:theme.bg,color:theme.textStrong,fontFamily:'Arial,sans-serif'}}>
    <h1 style={{fontSize:20}}>Field survey fixture</h1>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:24}}>
      <label>Theme <select style={{background:theme.inputBg,color:theme.textStrong,padding:4}} aria-label="Theme" value={themeKey} onChange={e=>setThemeKey(e.target.value)}>{Object.keys(THEMES).map(k=><option key={k}>{k}</option>)}</select></label>
      <label>Field <select style={{background:theme.inputBg,color:theme.textStrong,padding:4}} aria-label="Field" value={scenario} onChange={e=>setScenario(e.target.value)}><option value="sparse">Sparse</option><option value="busy">Busy</option><option value="empty">Unexplored</option></select></label>
      <button style={{background:theme.inputBg,color:theme.textStrong,padding:4}} onClick={()=>{setJump(true);setView('surface');setOpen(true);}}>Try claim jump</button>
    </div>
    <div style={{width:360,maxWidth:'100%',border:`1px solid ${theme.border}`}}>
      <OilSurveyPanel theme={theme} open={open} view={view} onViewChange={setView}
        onOpen={v=>{setView(v);setOpen(true);}} onClose={()=>{setOpen(false);setJump(false);}}
        onCancelJump={()=>{setJump(false);setOpen(false);}}
        onOwnPlot={()=>setSelected({x:5,y:8})} onInspect={p=>setNotice(`Inspecting plot (${p.x+1}, ${p.y+1})`)}
        surfaceProps={{claimTotals:field.claims,maxClaimTotal:604,selectedClaimIndex:selected.y*10+selected.x,onSelectClaim:setSelected,allPlotsMap:field.plots,currentUserId:'me',numberOfDeposits:30,gridX:10,gridY:10,claimJumpMode:jump,onClaimJump:(x,y)=>{setSelected({x,y});setNotice(`Jump target (${x+1}, ${y+1})`);setJump(false);},gusherEvents:scenario==='busy'?[{col:5,row:8}]:[],plotsWithMessages:scenario==='busy'?{'3_9':true}:{}}}
        undergroundProps={{grid3D:field.grid,maxCellValue:524,sliceY:selected.y,selectedX:selected.x,onSelectRow:y=>setSelected(p=>({...p,y})),onSelectX:x=>setSelected(p=>({...p,x})),allPlotsMap:field.plots,hellMap:field.hellMap,currentUserId:'me',capDepth:10,ownCapDepth:15}} />
    </div>
    <p role="status">{notice}</p>
  </main>;
}
