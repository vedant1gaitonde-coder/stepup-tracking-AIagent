// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDsxoyX3h_hDrq0-aLZeglKJtwangSZ7YY",
  authDomain: "stepup-tracking-aiagent.firebaseapp.com",
  projectId: "stepup-tracking-aiagent",
  storageBucket: "stepup-tracking-aiagent.firebasestorage.app",
  messagingSenderId: "991881910969",
  appId: "1:991881910969:web:b407c19841b3f558111968"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentGroup = null
let chart = null
let isAdmin = false

// ─── AUTH ─────────────────────────────────────────────

function switchAuth(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none'
  document.getElementById('signupForm').style.display = tab === 'signup' ? 'block' : 'none'
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'))
  event.target.classList.add('active')
}

async function signup() {
  const group = document.getElementById('signupGroup').value.trim()
  const password = document.getElementById('signupPassword').value.trim()
  const confirm = document.getElementById('signupConfirm').value.trim()
  const err = document.getElementById('signupError')

  if (!group || !password || !confirm) {
    err.innerText = 'Please fill all fields'
    return
  }
  if (password !== confirm) {
    err.innerText = 'Passwords do not match'
    return
  }
  if (password.length < 4) {
    err.innerText = 'Password must be at least 4 characters'
    return
  }

  try {
    const snap = await db.collection('groups').doc(group).get()
    if (snap.exists) {
      err.innerText = 'Group name already taken. Choose another.'
      return
    }
    await db.collection('groups').doc(group).set({
      password: password,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      challengeStart: null,
      progress: 0
    })
    err.style.color = 'green'
    err.innerText = '✅ Group created! Please login.'
    setTimeout(() => switchAuth('login'), 1500)
  } catch (e) {
    err.innerText = 'Error: ' + e.message
  }
}

async function login() {
  const group = document.getElementById('loginGroup').value.trim()
  const password = document.getElementById('loginPassword').value.trim()
  const err = document.getElementById('loginError')

  if (!group) {
    err.innerText = 'Please enter group name'
    return
  }

  try {
    const snap = await db.collection('groups').doc(group).get()
    if (!snap.exists) {
      err.innerText = 'Group not found'
      return
    }

    if (password === '') {
      // Viewer mode — no password needed
      currentGroup = group
      isAdmin = false
      sessionStorage.setItem('group', group)
      sessionStorage.setItem('isAdmin', 'false')
      showApp()
      return
    }

    if (snap.data().password !== password) {
      err.innerText = 'Wrong password'
      return
    }

    // Admin mode
    currentGroup = group
    isAdmin = true
    sessionStorage.setItem('group', group)
    sessionStorage.setItem('isAdmin', 'true')
    showApp()

  } catch (e) {
    err.innerText = 'Error: ' + e.message
  }
}

function logout() {
  sessionStorage.removeItem('group')
  sessionStorage.removeItem('isAdmin')
  currentGroup = null
  isAdmin = false
  document.getElementById('mainApp').style.display = 'none'
  document.getElementById('authPage').style.display = 'flex'
}

function showApp() {
  document.getElementById('authPage').style.display = 'none'
  document.getElementById('mainApp').style.display = 'block'
  document.getElementById('groupLabel').innerText = isAdmin
    ? '👑 ' + currentGroup
    : '👁️ ' + currentGroup + ' (Viewer)'

  // Hide admin-only tabs for viewers
  document.getElementById('navUpload').style.display = isAdmin ? 'block' : 'none'
  document.getElementById('navManage').style.display = isAdmin ? 'block' : 'none'

  loadAllData()
  showTab(isAdmin ? 'upload' : 'daily')
  loadLatestDay()
}

// Loads the most recently uploaded day's data into the Daily tab.
// This persists across days — it always shows the last uploaded entry
// until a newer file is uploaded.
async function loadLatestDay() {
  const snap = await db.collection('groups').doc(currentGroup)
    .collection('history').orderBy('date', 'desc').limit(1).get()

  if (snap.empty) return

  const latestDoc = snap.docs[0]
  const dateStr = latestDoc.id
  const entries = latestDoc.data().entries || []

  const dateObj = new Date(dateStr)
  const day = dateObj.getDay()
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day]

  const data = []
  entries.forEach(p => {
    let pts = 0
    let note = ''
    if (p.steps > 20000) {
      pts = 8
      note = '😂 Penalty: Over 20k steps (10pts - 2pts = 8pts)'
    } else if (day === 0 && p.steps < 7000) {
      pts = 10
      note = '😴 Lazy Sunday rule (+10 pts)'
    } else if (day === 0 && p.steps >= 7000) {
      pts = 8
      note = '🌞 Sunday walker! (10pts - 2pts = 8pts)'
    } else if (day !== 0 && p.steps >= 10000) {
      pts = 10
      note = '🎯 10K Sweet Spot (+10 pts)'
    }
    data.push({ name: p.name, steps: p.steps, points: pts, note })
  })

  renderDaily(data, dateStr, dayName)
}

// ─── LOAD ALL DATA ────────────────────────────────────

async function loadAllData() {
  const snap = await db.collection('groups').doc(currentGroup).get()
  const data = snap.data()
  const progress = data.progress || 0
  document.getElementById('progressText').innerText =
    'Challenge Progress: ' + progress + ' / 28 Days Completed'
  document.getElementById('progressBar').style.width =
    Math.round((progress / 28) * 100) + '%'
  renderUploadedDates()
  renderWeekly()
  renderMonth()
  renderTotalSteps()
  renderPenalties()
  populatePersonSelect()
  renderWinners()
  renderHallOfFame()
}

// ─── TAB SYSTEM ───────────────────────────────────────

function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => {
    t.style.display = 'none'
  })
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.remove('active')
  })
  document.getElementById(tabId).style.display = 'block'
  const navEl = document.querySelector(`[onclick="showTab('${tabId}')"]`)
  if (navEl) navEl.classList.add('active')
}

// ─── UPLOAD ───────────────────────────────────────────

function runAgent() {
  if (!isAdmin) {
    alert('You are in viewer mode. Login with password to edit.')
    return
  }

  const file = document.getElementById('fileInput').files[0]
  const date = document.getElementById('dateInput').value

  if (!file || !date) {
    alert('Upload file and select date')
    return
  }

  const reader = new FileReader()
  reader.onload = async function(e) {
    const data = new Uint8Array(e.target.result)
    const workbook = XLSX.read(data, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet)

    const existing = await db
      .collection('groups').doc(currentGroup)
      .collection('history').doc(date).get()

    if (existing.exists) {
      if (!confirm(`Data for ${date} already exists. Overwrite it?`)) return
      await reverseOldData(date)
    }

    await processRows(rows, date)
  }
  reader.readAsArrayBuffer(file)
}

async function processRows(rows, date) {
  const day = new Date(date).getDay()
  const daily = []
  const historyEntries = []
  const penalties = []

  const groupSnap = await db.collection('groups').doc(currentGroup).get()
  const groupData = groupSnap.data()

  const membersSnap = await db
    .collection('groups').doc(currentGroup)
    .collection('members').get()

  let membersMap = {}
  membersSnap.forEach(doc => {
    membersMap[doc.id] = doc.data()
  })

  for (const r of rows) {
    const name = r['Name']
    const steps = Number(r['Total Steps'])

    if (!membersMap[name]) {
      membersMap[name] = { points: 0, weekly: 0 }
    }

    let pts = 0
    let note = ''

    if (steps > 20000) {
      pts = 8
      note = '😂 Penalty: Over 20k steps (10pts - 2pts = 8pts)'
      penalties.push({ name, steps, date })
    } else if (day === 0 && steps < 7000) {
      pts = 10
      note = '😴 Lazy Sunday rule (+10 pts)'
    } else if (day === 0 && steps >= 7000) {
      pts = 8
      note = '🌞 Sunday walker! (10pts - 2pts = 8pts)'
    } else if (day !== 0 && steps >= 10000) {
      pts = 10
      note = '🎯 10K Sweet Spot (+10 pts)'
    }

    membersMap[name].weekly += steps

    if (membersMap[name].weekly >= 70000) {
      membersMap[name].points += 10
      membersMap[name].weekly = 0
      note += ' 👑 Consistency Bonus! (+10 pts)'
    }

    membersMap[name].points += pts

    historyEntries.push({ name, steps })
    daily.push({ name, steps, points: pts, note })
  }

  let challengeStart = groupData.challengeStart
  if (!challengeStart) {
    challengeStart = date
  }

  const start = new Date(challengeStart)
  const now = new Date(date)
  let diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1
  if (diff < 0) diff = 0
  if (diff > 28) diff = 28

  if (diff >= 28) {
    if (confirm('28 day challenge complete! Start new challenge?')) {

      // ── Save the champion before resetting ──
      await saveChampion(membersMap, challengeStart, date)

      challengeStart = date
      diff = 1
      for (let name in membersMap) {
        membersMap[name] = { points: 0, weekly: 0 }
      }
    }
  }

  const batch = db.batch()

  const histRef = db.collection('groups').doc(currentGroup)
    .collection('history').doc(date)
  batch.set(histRef, { entries: historyEntries, date })

  for (let name in membersMap) {
    const memRef = db.collection('groups').doc(currentGroup)
      .collection('members').doc(name)
    batch.set(memRef, membersMap[name])
  }

  for (const p of penalties) {
    const penRef = db.collection('groups').doc(currentGroup)
      .collection('penalties').doc(`${date}_${p.name}`)
    batch.set(penRef, p)
  }

  const groupRef = db.collection('groups').doc(currentGroup)
  batch.update(groupRef, {
    progress: diff,
    challengeStart: challengeStart
  })

  await batch.commit()

  const uploadedDay = new Date(date).getDay()
  const uploadedDayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][uploadedDay]
  renderDaily(daily, date, uploadedDayName)
  await loadAllData()
  showTab('daily')
  alert(`✅ Data for ${date} uploaded successfully!`)
}

async function reverseOldData(date) {
  const snap = await db.collection('groups').doc(currentGroup)
    .collection('history').doc(date).get()
  if (!snap.exists) return

  const day = new Date(date).getDay()
  const entries = snap.data().entries

  const membersSnap = await db.collection('groups').doc(currentGroup)
    .collection('members').get()
  let membersMap = {}
  membersSnap.forEach(doc => {
    membersMap[doc.id] = doc.data()
  })

  for (const p of entries) {
    const name = p.name
    const steps = Number(p.steps)
    if (!membersMap[name]) continue
    let pts = 0
    if (steps > 20000) pts = 8
    else if (day === 0 && steps < 7000) pts = 10
    else if (day === 0 && steps >= 7000) pts = 8
    else if (day !== 0 && steps >= 10000) pts = 10
    membersMap[name].points -= pts
    membersMap[name].weekly -= steps
    if (membersMap[name].weekly < 0) membersMap[name].weekly = 0
  }

  const batch = db.batch()
  for (let name in membersMap) {
    const memRef = db.collection('groups').doc(currentGroup)
      .collection('members').doc(name)
    batch.set(memRef, membersMap[name])
  }
  await batch.commit()
}

// ─── DELETE DAY ───────────────────────────────────────

async function deleteDay() {
  if (!isAdmin) {
    alert('You are in viewer mode. Login with password to edit.')
    return
  }

  const date = document.getElementById('deleteDateInput').value
  if (!date) {
    alert('Select a date to delete')
    return
  }

  const snap = await db.collection('groups').doc(currentGroup)
    .collection('history').doc(date).get()
  if (!snap.exists) {
    alert('No data found for ' + date)
    return
  }

  if (!confirm(`Delete data for ${date}? Points will be reversed.`)) return

  await reverseOldData(date)

  await db.collection('groups').doc(currentGroup)
    .collection('history').doc(date).delete()

  const penSnap = await db.collection('groups').doc(currentGroup)
    .collection('penalties')
    .where('date', '==', date).get()
  const batch = db.batch()
  penSnap.forEach(doc => batch.delete(doc.ref))
  await batch.commit()

  // Recalculate progress from remaining history
  const remainingSnap = await db.collection('groups').doc(currentGroup)
    .collection('history').orderBy('date').get()

  let newProgress = 0
  let newChallengeStart = null

  if (!remainingSnap.empty) {
    const dates = []
    remainingSnap.forEach(doc => dates.push(doc.id))
    newChallengeStart = dates[0]
    const start = new Date(newChallengeStart)
    const last = new Date(dates[dates.length - 1])
    newProgress = Math.floor((last - start) / (1000 * 60 * 60 * 24)) + 1
    if (newProgress > 28) newProgress = 28
  }

  await db.collection('groups').doc(currentGroup).update({
    progress: newProgress,
    challengeStart: newChallengeStart
  })

  await loadAllData()
  await loadLatestDay()
  alert(`✅ Data for ${date} deleted!`)
}

// ─── SAVE CHAMPION ────────────────────────────────────

// Called when a 28-day challenge ends and the user confirms a new challenge.
// Saves the full final standings plus the winner to the 'champions' subcollection.
async function saveChampion(membersMap, challengeStart, challengeEnd) {
  // Build sorted standings array from membersMap
  const standings = Object.keys(membersMap)
    .map(name => ({ name, points: membersMap[name].points || 0 }))
    .sort((a, b) => b.points - a.points)

  if (standings.length === 0) return

  const winner = standings[0]

  // Document ID = challengeStart date so it's unique and chronological
  const docId = challengeStart

  await db.collection('groups').doc(currentGroup)
    .collection('champions').doc(docId).set({
      challengeStart,
      challengeEnd,
      winnerName: winner.name,
      winnerPoints: winner.points,
      standings,          // full ranked list saved for display
      savedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
}

// ─── RENDER WINNERS ───────────────────────────────────

async function renderWinners() {
  const snap = await db.collection('groups').doc(currentGroup)
    .collection('champions').orderBy('challengeStart').get()

  const body = document.querySelector('#winnersTable tbody')
  body.innerHTML = ''

  if (snap.empty) {
    body.innerHTML = `<tr><td colspan="5" style="color:gray;text-align:center">
      No completed challenges yet. Winners will appear here after the first 28-day challenge ends.
    </td></tr>`
    return
  }

  snap.forEach((doc, idx) => {
    const d = doc.data()
    const num = idx + 1

    // Build mini standings list for the "Full Standings" column
    const standingsList = (d.standings || [])
      .map((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
        return `${medal} ${p.name} (${p.points}pts)`
      })
      .join('<br>')

    body.innerHTML += `
      <tr style="${num === 1 ? '' : ''}">
        <td><strong>#${num}</strong></td>
        <td>${d.challengeStart} → ${d.challengeEnd}</td>
        <td style="font-weight:bold;color:#16a34a;font-size:15px">🏆 ${d.winnerName}</td>
        <td>${d.winnerPoints} pts</td>
        <td style="text-align:left;font-size:12px;line-height:1.8">${standingsList}</td>
      </tr>`
  })
}

// ─── RENDER HALL OF FAME ──────────────────────────────

async function renderHallOfFame() {
  const snap = await db.collection('groups').doc(currentGroup)
    .collection('champions').get()

  // Count wins per person
  const winsMap = {}
  snap.forEach(doc => {
    const winner = doc.data().winnerName
    if (!winner) return
    winsMap[winner] = (winsMap[winner] || 0) + 1
  })

  const body = document.querySelector('#hallOfFameTable tbody')
  body.innerHTML = ''

  if (Object.keys(winsMap).length === 0) {
    body.innerHTML = `<tr><td colspan="3" style="color:gray;text-align:center">
      No champions yet. Complete a 28-day challenge to unlock the Hall of Fame!
    </td></tr>`
    return
  }

  const sorted = Object.entries(winsMap)
    .sort((a, b) => b[1] - a[1])

  sorted.forEach(([name, wins], i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1
    const crown = wins >= 3 ? ' 👑' : wins >= 2 ? ' ⭐' : ''
    const highlight = i === 0 ? 'style="background:#fff9c4"' : ''
    body.innerHTML += `
      <tr ${highlight}>
        <td>${medal}</td>
        <td style="font-weight:bold">${name}${crown}</td>
        <td style="font-size:16px;font-weight:bold;color:#16a34a">${wins} 🏆</td>
      </tr>`
  })
}

// ─── RENDER FUNCTIONS ─────────────────────────────────

async function renderUploadedDates() {
  const snap = await db.collection('groups').doc(currentGroup)
    .collection('history').orderBy('date').get()
  const list = document.getElementById('uploadedDates')
  list.innerHTML = ''
  snap.forEach(doc => {
    const li = document.createElement('li')
    li.innerText = doc.id
    list.appendChild(li)
  })
}

function renderDaily(data, dateStr, dayName) {
  // Update the card heading to show which date is displayed
  const heading = document.querySelector('#daily .card h2')
  if (heading) {
    heading.innerText = dateStr
      ? `📅 Daily Scoreboard — ${dateStr} (${dayName})`
      : '📅 Daily Scoreboard'
  }

  const body = document.querySelector('#dailyBoard tbody')
  body.innerHTML = ''
  data.sort((a, b) => b.steps - a.steps)
  data.forEach((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1
    const color = p.points < 0 ? 'color:red' : p.points > 0 ? 'color:green' : ''
    body.innerHTML += `
      <tr>
        <td>${medal}</td>
        <td>${p.name}</td>
        <td>${Number(p.steps).toLocaleString()}</td>
        <td style="${color}">${p.points > 0 ? '+' : ''}${p.points}</td>
        <td>${p.note}</td>
      </tr>`
  })
}

async function renderWeekly() {
  const snap = await db.collection('groups').doc(currentGroup)
    .collection('members').get()
  let arr = []
  snap.forEach(doc => {
    arr.push({ name: doc.id, ...doc.data() })
  })
  arr.sort((a, b) => b.weekly - a.weekly)
  const body = document.querySelector('#weeklyBoard tbody')
  body.innerHTML = ''
  arr.forEach((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1
    body.innerHTML += `
      <tr>
        <td>${medal}</td>
        <td>${p.name}</td>
        <td>${Number(p.weekly || 0).toLocaleString()}</td>
        <td>${p.points || 0}</td>
      </tr>`
  })
}

async function renderMonth() {
  const membersSnap = await db.collection('groups').doc(currentGroup)
    .collection('members').get()

  const historySnap = await db.collection('groups').doc(currentGroup)
    .collection('history').get()

  const totalStepsMap = {}
  historySnap.forEach(doc => {
    const entries = doc.data().entries || []
    entries.forEach(p => {
      if (!totalStepsMap[p.name]) totalStepsMap[p.name] = 0
      totalStepsMap[p.name] += Number(p.steps)
    })
  })

  let arr = []
  membersSnap.forEach(doc => {
    arr.push({
      name: doc.id,
      points: doc.data().points || 0,
      totalSteps: totalStepsMap[doc.id] || 0
    })
  })

  arr.sort((a, b) => b.points - a.points || b.totalSteps - a.totalSteps)

  const body = document.querySelector('#monthBoard tbody')
  body.innerHTML = ''
  arr.forEach((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1
    const trophy = i === 0 ? '🏆' : ''
    body.innerHTML += `
      <tr ${i === 0 ? 'style="background:#fff9c4"' : ''}>
        <td>${medal}</td>
        <td>${p.name} ${trophy}</td>
        <td>${p.points}</td>
      </tr>`
  })
}

async function renderTotalSteps() {
  const snap = await db.collection('groups').doc(currentGroup)
    .collection('history').get()
  const totals = {}
  snap.forEach(doc => {
    const entries = doc.data().entries || []
    entries.forEach(p => {
      if (!totals[p.name]) totals[p.name] = 0
      totals[p.name] += Number(p.steps)
    })
  })
  const body = document.querySelector('#totalStepsTable tbody')
  body.innerHTML = ''
  Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, total]) => {
      body.innerHTML += `
        <tr>
          <td>${name}</td>
          <td>${total.toLocaleString()}</td>
        </tr>`
    })
}

async function renderPenalties() {
  const snap = await db.collection('groups').doc(currentGroup)
    .collection('penalties').orderBy('date').get()
  const body = document.querySelector('#penaltyTable tbody')
  body.innerHTML = ''
  if (snap.empty) {
    body.innerHTML = `<tr><td colspan="4" style="color:gray">No penalties yet 🎉</td></tr>`
    return
  }
  snap.forEach(doc => {
    const p = doc.data()
    body.innerHTML += `
      <tr>
        <td>${p.date}</td>
        <td>${p.name}</td>
        <td>${Number(p.steps).toLocaleString()}</td>
        <td>😂 Must complete penalty task!</td>
      </tr>`
  })
}

async function populatePersonSelect() {
  const snap = await db.collection('groups').doc(currentGroup)
    .collection('members').get()
  const select = document.getElementById('personSelect')
  select.innerHTML = ''
  snap.forEach(doc => {
    const opt = document.createElement('option')
    opt.value = doc.id
    opt.text = doc.id
    select.appendChild(opt)
  })
}

async function showHistory() {
  const date = document.getElementById('historyDate').value
  if (!date) {
    alert('Select a date')
    return
  }
  const snap = await db.collection('groups').doc(currentGroup)
    .collection('history').doc(date).get()
  const body = document.querySelector('#historyTable tbody')
  body.innerHTML = ''
  if (!snap.exists) {
    alert('No data for ' + date)
    return
  }
  const day = new Date(date).getDay()
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day]
  document.getElementById('historyDayLabel').innerText = `${date} (${dayName})`
  const entries = snap.data().entries
  entries.forEach(p => {
    let pts = 0
    if (p.steps > 20000) pts = 8
    else if (day === 0 && p.steps < 7000) pts = 10
    else if (day === 0 && p.steps >= 7000) pts = 8
    else if (day !== 0 && p.steps >= 10000) pts = 10
    const color = pts > 0 ? 'color:green' : pts < 0 ? 'color:red' : ''
    body.innerHTML += `
      <tr>
        <td>${p.name}</td>
        <td>${Number(p.steps).toLocaleString()}</td>
        <td style="${color}">${pts > 0 ? '+' : ''}${pts}</td>
      </tr>`
  })
}

async function generateChart() {
  const person = document.getElementById('personSelect').value
  const snap = await db.collection('groups').doc(currentGroup)
    .collection('history').orderBy('date').get()
  const labels = []
  const data = []
  snap.forEach(doc => {
    labels.push(doc.id)
    const entry = (doc.data().entries || []).find(p => p.name === person)
    data.push(entry ? Number(entry.steps) : 0)
  })
  if (chart) chart.destroy()
  chart = new Chart(document.getElementById('stepChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: person + ' Daily Steps',
        data,
        borderColor: 'green',
        backgroundColor: 'rgba(0,128,0,0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      scales: {
        y: {
          min: 0,
          ticks: {
            padding: 15
          }
        }
      },
      layout: {
        padding: {
          bottom: 15
        }
      }
    }
  })
}

async function resetAll() {
  if (!isAdmin) {
    alert('You are in viewer mode. Login with password to edit.')
    return
  }

  if (!confirm('Reset entire challenge? This cannot be undone.')) return

  const collections = ['history', 'members', 'penalties']
  for (const col of collections) {
    const snap = await db.collection('groups').doc(currentGroup)
      .collection(col).get()
    const batch = db.batch()
    snap.forEach(doc => batch.delete(doc.ref))
    await batch.commit()
  }

  await db.collection('groups').doc(currentGroup).update({
    progress: 0,
    challengeStart: null
  })

  await loadAllData()
  alert('✅ Challenge reset!')
}

// ─── INIT ─────────────────────────────────────────────

window.onload = function() {
  const saved = sessionStorage.getItem('group')
  if (saved) {
    currentGroup = saved
    isAdmin = sessionStorage.getItem('isAdmin') === 'true'
    showApp()
  }
}