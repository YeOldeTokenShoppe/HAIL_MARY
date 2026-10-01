// Presentation regressions: distinguish missing information from revealed zero.
// Run: node scripts/test-oil-survey.mjs
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/lib/oilSurvey.js',import.meta.url),'utf8');
const {surveyedLayer,surveyTotals}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
assert.equal(surveyedLayer(null,0,0,false),false,'No plot history means unknown, not dry');
assert.equal(surveyedLayer({currentOwnerId:'me'},0,0,false),false,'Ownership does not reveal layers');
assert.equal(surveyedLayer({drillDay:3},2,0,false),true,'Completed dry layer is known');
assert.equal(surveyedLayer({drillDay:3},3,0,false),false,'Layer below the drill remains unknown');
assert.equal(surveyedLayer({revealed:{15:0}},15,0,false),true,'Sparse revealed zero is known');
assert.equal(surveyedLayer({revealed:{15:0}},14,0,false),false,'Sparse reveals do not reveal adjacent layers');
assert.equal(surveyedLayer({wildcatTaken:{15:'me'}},15,0,false),true,'Dry wildcat exploration is known');
assert.equal(surveyedLayer(null,0,20,false),true,'Positive discovery is known');
assert.equal(surveyedLayer(null,0,0,true),true,'Revealed infernal pocket is known');
assert.equal(surveyedLayer(null,0,0,false,true),true,'Explicit admin full-field preview remains available');
const claims=[{x:0,y:0,total:0},{x:1,y:0,total:0},{x:2,y:0,total:12},{x:3,y:0,total:0},{x:4,y:0,total:0}];
const plots={'0_0':{currentOwnerId:'me'},'1_0':{revealed:{15:0}},'2_0':{drillDay:3,currentOwnerId:'rival'},'3_0':{hellLayers:{2:true}},'4_0':{wildcatTaken:{10:'me'}}};
assert.deepEqual(surveyTotals(claims,plots),{found:1,hell:1,claimed:2,dry:2,unexplored:1},'Tallies account for sparse exploration, ownership and hazards independently');
console.log('11 survey-state checks passed.');
