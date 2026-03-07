let db = JSON.parse(localStorage.getItem("stepDB")) || {}
let historyDB = JSON.parse(localStorage.getItem("historyDB")) || {}

let startDate = localStorage.getItem("challengeStart")
let progress = localStorage.getItem("challengeProgress") || 0

let chart

window.onload = loadSavedData

function loadSavedData(){

document.getElementById("progressText").innerText =
"Challenge Progress: " + progress + " / 28 Days Completed"

renderUploadedDates()
populatePersonSelect()
renderTotalSteps()

if(Object.keys(db).length > 0){

renderWeekly()
renderMonth()

}

}

function renderUploadedDates(){

let list = document.getElementById("uploadedDates")

list.innerHTML=""

Object.keys(historyDB).sort().forEach(date=>{

let li = document.createElement("li")
li.innerText = date
list.appendChild(li)

})

}

function populatePersonSelect(){

let select = document.getElementById("personSelect")

select.innerHTML=""

let names = new Set()

Object.values(historyDB).forEach(day=>{

day.forEach(p=> names.add(p.name))

})

names.forEach(n=>{

let opt = document.createElement("option")
opt.value=n
opt.text=n
select.appendChild(opt)

})

}

function runAgent(){

const file = document.getElementById("fileInput").files[0]
const date = document.getElementById("dateInput").value

if(!file || !date){

alert("Upload file and select date")
return

}

if(!startDate){

startDate = date
localStorage.setItem("challengeStart",startDate)

}

updateProgress(date)
checkReset(date)

const reader = new FileReader()

reader.onload = function(e){

const data = new Uint8Array(e.target.result)
const workbook = XLSX.read(data,{type:'array'})
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet)

processRows(rows,date)

}

reader.readAsArrayBuffer(file)

}

function processRows(rows,date){

let day = new Date(date).getDay()

let daily = []

historyDB[date] = []

rows.forEach(r=>{

let name = r["Name"]
let steps = r["Total Steps"]

historyDB[date].push({name,steps})

if(!db[name]){

db[name] = {points:0,weekly:0}

}

let pts = 0
let note = ""

if(steps > 20000){

pts = 10
note = "Punishment: Over 20k steps"

}
else if(day != 0 && steps > 10000){

pts = 10
note = "10k rule"

}
else if(day == 0 && steps < 7000){

pts = 10
note = "Sunday rule"

}

db[name].weekly += steps

if(db[name].weekly >= 70000){

db[name].points += 10
db[name].weekly = 0

}

db[name].points += pts

daily.push({name,steps,points:pts,note})

})

localStorage.setItem("stepDB",JSON.stringify(db))
localStorage.setItem("historyDB",JSON.stringify(historyDB))

renderUploadedDates()
populatePersonSelect()
renderTotalSteps()

renderDaily(daily)
renderWeekly()
renderMonth()

}

function renderDaily(data){

let body = document.querySelector("#dailyBoard tbody")
body.innerHTML=""

data.sort((a,b)=>b.steps-a.steps)

data.forEach((p,i)=>{

body.innerHTML+=

`<tr>
<td>${i+1}</td>
<td>${p.name}</td>
<td>${p.steps}</td>
<td>${p.points}</td>
<td>${p.note}</td>
</tr>`

})

}

function renderWeekly(){

let arr=[]

for(let name in db){

arr.push({name,steps:db[name].weekly,points:db[name].points})

}

arr.sort((a,b)=>b.steps-a.steps)

let body=document.querySelector("#weeklyBoard tbody")
body.innerHTML=""

arr.forEach((p,i)=>{

body.innerHTML+=

`<tr>
<td>${i+1}</td>
<td>${p.name}</td>
<td>${p.steps}</td>
<td>${p.points}</td>
</tr>`

})

}

function renderMonth(){

let arr=[]

for(let name in db){

arr.push({name,points:db[name].points})

}

arr.sort((a,b)=>b.points-a.points)

let body=document.querySelector("#monthBoard tbody")
body.innerHTML=""

arr.forEach((p,i)=>{

body.innerHTML+=

`<tr>
<td>${i+1}</td>
<td>${p.name}</td>
<td>${p.points}</td>
</tr>`

})

}

function showHistory(){

let date = document.getElementById("historyDate").value
let body=document.querySelector("#historyTable tbody")
body.innerHTML=""

if(!historyDB[date]){

alert("No data for this date")
return

}

historyDB[date].forEach(p=>{

body.innerHTML+=

`<tr>
<td>${p.name}</td>
<td>${p.steps}</td>
</tr>`

})

}

function generateChart(){

let person=document.getElementById("personSelect").value

let labels=[]
let data=[]

Object.keys(historyDB).sort().forEach(date=>{

labels.push(date)

let entry = historyDB[date].find(p=>p.name==person)

data.push(entry ? entry.steps : 0)

})

if(chart) chart.destroy()

chart = new Chart(document.getElementById("stepChart"),{

type:'line',

data:{
labels:labels,
datasets:[{
label:person + " Daily Steps",
data:data,
borderWidth:2
}]
}

})

}

function renderTotalSteps(){

let totals={}

Object.values(historyDB).forEach(day=>{

day.forEach(p=>{

if(!totals[p.name]) totals[p.name]=0
totals[p.name]+=Number(p.steps)

})

})

let body=document.querySelector("#totalStepsTable tbody")
body.innerHTML=""

for(let name in totals){

body.innerHTML+=

`<tr>
<td>${name}</td>
<td>${totals[name]}</td>
</tr>`

}

}

function updateProgress(date){

let start=new Date(startDate)
let now=new Date(date)

let diff=Math.floor((now-start)/(1000*60*60*24))+1

if(diff<0) diff=0
if(diff>28) diff=28

progress = diff

localStorage.setItem("challengeProgress",progress)

document.getElementById("progressText").innerText =
"Challenge Progress: "+progress+" / 28 Days Completed"

}

function checkReset(date){

let start=new Date(startDate)
let now=new Date(date)

let diff=(now-start)/(1000*60*60*24)

if(diff>=28){

db={}
historyDB={}
progress=0

localStorage.setItem("stepDB",JSON.stringify(db))
localStorage.setItem("historyDB",JSON.stringify(historyDB))
localStorage.setItem("challengeProgress",progress)

startDate=date
localStorage.setItem("challengeStart",date)

alert("New 4 week challenge started")

}

}

function resetAll(){

if(!confirm("Reset entire challenge?")) return

localStorage.clear()

location.reload()

}