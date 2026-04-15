// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDsxoyX3h_hDrq0-aLZeglKJtwangSZ7YY",
  authDomain: "stepup-tracking-aiagent.firebaseapp.com",
  projectId: "stepup-tracking-aiagent",
  storageBucket: "stepup-tracking-aiagent.firebasestorage.app",
  messagingSenderId: "991881910869",
  appId: "1:991881910969:web:b407c19841b3f558111968"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentGroup = null
let chart = null
let isAdmin = false

// ─── SHOW / HIDE PASSWORD ─────────────────────────────

function togglePw(inputId, icon) {
  const input = document.getElementById(inputId)
  if (input.type === 'password') {
    input.type = 'text'
    icon.innerText = '🙈'
  } else {
    input.type = 'password'
    icon.innerText = '👁️'
  }
}

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

  document.getElementById('navUpload').style.display = isAdmin ? 'block' : 'none'
  document.getElementById('navManage').style.display = isAdmin ? 'block' : 'none'

  loadAllData()
  showTab(isAdmin ? 'upload' : 'daily')
  loadLatestDay()
}

// ─── LOAD LATEST DAY ──────────────────────────────────

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
    data.push({
      name: p.name,
      steps: p.steps,
      points: p.pts !== undefined ? p.pts : 0,
      note: p.note || ''
    })
  })

  renderDaily(data, dateStr, dayName)
}

// ─── LOAD ALL DATA ────────────────────────────────────

async function loadAllData() {
  const groupSnap = await db.collection('groups').doc(currentGroup).get()
  const groupData = groupSnap.exists ? groupSnap.data() : {}
  let progress = Number(groupData.progress || 0)
  if (!Number.isFinite(progress) || progress < 0) progress = 0
  if (progress > 28) progress = 28
  document.getElementById('progressText').innerText =
    'Challenge Progress: ' + progress + ' / 28 Days Completed'
  document.getElementById('progressBar').style.width =
    Math.round((progress / 28) * 100) + '%'
  renderUploadedDates()
  renderWeekly()
  renderLastWeekLeaderboard()
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

// ─── SHARE CARD ───────────────────────────────────────

async function shareCard(cardId) {
  const card = document.getElementById(cardId)
  if (!card) return

  try {
    const btn = card.querySelector('button.secondary')
    if (btn) btn.style.display = 'none'

    const canvas = await html2canvas(card, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    })

    if (btn) btn.style.display = ''

    canvas.toBlob(async blob => {
      const file = new File([blob], 'scoreboard.png', { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '🏃 Family Step Challenge',
          text: 'Check out the latest scoreboard!'
        })
      } else {
        // Fallback for desktop — download image
        const link = document.createElement('a')
        link.download = 'scoreboard.png'
        link.href = canvas.toDataURL()
        link.click()
      }
    }, 'image/png')

  } catch (err) {
    console.error('Share failed:', err)
    alert('Could not share. Try downloading instead.')
  }
}

// ─── HELPER: CHECK IF REST WAS USED THIS WEEK ────────

async function hasRestBeenUsedThisWeek(name, uploadDate, challengeStart = null) {
  // Find Monday of the week for uploadDate
  const uploadDateObj = new Date(uploadDate)
  const dayOfWeek = uploadDateObj.getDay()
  
  // Calculate Monday of this week
  let mondayDate = new Date(uploadDateObj)
  if (dayOfWeek === 0) {
    // If today is Sunday, Monday is tomorrow, but we want last Monday (6 days ago)
    mondayDate.setDate(uploadDateObj.getDate() - 6)
  } else {
    // Otherwise, Monday is (dayOfWeek - 1) days ago
    mondayDate.setDate(uploadDateObj.getDate() - (dayOfWeek - 1))
  }
  
  // Scan history from Monday to today
  const historySnap = await db.collection('groups').doc(currentGroup)
    .collection('history').get()
  
  let restUsed = false
  historySnap.forEach(doc => {
    const docDate = new Date(doc.id)
    const withinChallenge = !challengeStart || doc.id >= challengeStart
    if (withinChallenge && docDate >= mondayDate && docDate <= uploadDateObj) {
      const entries = doc.data().entries || []
      const personEntry = entries.find(p => p.name === name)
      if (personEntry && personEntry.steps < 7000 && personEntry.note && personEntry.note.includes('Flexi Rest Day')) {
        restUsed = true
      }
    }
  })
  
  return restUsed
}

function setUploadModeUI() {
  const modeEl = document.getElementById('importMode')
  const dateEl = document.getElementById('dateInput')
  if (!modeEl || !dateEl) return

  const isSingle = modeEl.value === 'single'
  dateEl.disabled = !isSingle
  if (isSingle) {
    dateEl.removeAttribute('title')
  } else {
    dateEl.setAttribute('title', 'Date is auto-read from date columns in bulk mode')
  }
}

// ─── UPLOAD ───────────────────────────────────────────

function runAgent() {
  if (!isAdmin) {
    alert('You are in viewer mode. Login with password to edit.')
    return
  }

  const file = document.getElementById('fileInput').files[0]
  const date = document.getElementById('dateInput').value
  const importMode = document.getElementById('importMode').value

  if (!file) {
    alert('Upload a file')
    return
  }

  if (importMode === 'single' && !date) {
    alert('Select date for day-by-day upload')
    return
  }

  const reader = new FileReader()
  reader.onload = async function(e) {
    const data = new Uint8Array(e.target.result)
    const workbook = XLSX.read(data, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet)
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })

    if (importMode === 'single') {
      const canContinue = await prepareDateUpload(date)
      if (!canContinue) return
      await processRows(rows, date)
      return
    }

    const bulkMeta = extractBulkColumns(matrix)
    const dateColumns = bulkMeta.dateColumns
    if (dateColumns.length === 0) {
      alert('No date columns found. Make sure header row has real date columns (text date or Excel date cells).')
      return
    }

    if (bulkMeta.nameIndex < 0) {
      alert('Name column not found in file header. Please include a Name column.')
      return
    }

    let savedDays = 0
    for (const dateCol of dateColumns) {
      const dailyRows = buildRowsForDateFromMatrix(matrix, bulkMeta.nameIndex, dateCol.index)
      if (dailyRows.length === 0) continue

      const canContinue = await prepareDateUpload(dateCol.date)
      if (!canContinue) {
        alert('Bulk upload stopped.')
        return
      }

      const saved = await processRows(dailyRows, dateCol.date, { silentSuccess: true })
      if (!saved) {
        alert('Bulk upload stopped.')
        return
      }

      savedDays += 1
    }

    await loadAllData()
    await loadLatestDay()
    showTab('daily')
    alert(`✅ Bulk upload completed for ${savedDays} day(s).`)
  }
  reader.readAsArrayBuffer(file)
}

function parseStepsValue(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value).replace(/,/g, '').trim()
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDateYYYYMMDD(dateObj) {
  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, '0')
  const d = String(dateObj.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function excelSerialToDateString(serial) {
  if (!Number.isFinite(serial) || serial < 1) return null
  const parsed = XLSX.SSF.parse_date_code(serial)
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) return null
  return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
}

function headerValueToDateString(value) {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateYYYYMMDD(value)
  }

  if (typeof value === 'number') {
    return excelSerialToDateString(value)
  }

  const text = String(value).trim()
  if (!text || /^#+$/.test(text)) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text

  if (/^\d+(\.\d+)?$/.test(text)) {
    const asNumber = Number(text)
    const fromSerial = excelSerialToDateString(asNumber)
    if (fromSerial) return fromSerial
  }

  const parsedMs = Date.parse(text)
  if (!Number.isNaN(parsedMs)) {
    return formatDateYYYYMMDD(new Date(parsedMs))
  }

  return null
}

function extractBulkColumns(matrix) {
  const headerRow = Array.isArray(matrix) && matrix.length > 0 ? matrix[0] : []

  let nameIndex = -1
  for (let i = 0; i < headerRow.length; i++) {
    const headerText = String(headerRow[i] || '').trim().toLowerCase()
    if (headerText === 'name' || headerText.includes('name')) {
      nameIndex = i
      break
    }
  }

  const dateColumns = []
  for (let i = 0; i < headerRow.length; i++) {
    const dateText = headerValueToDateString(headerRow[i])
    if (!dateText) continue
    dateColumns.push({ index: i, date: dateText })
  }

  dateColumns.sort((a, b) => a.date.localeCompare(b.date))
  return { nameIndex, dateColumns }
}

function buildRowsForDateFromMatrix(matrix, nameIndex, dateColIndex) {
  const dailyRows = []
  if (!Array.isArray(matrix)) return dailyRows

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] || []
    const name = (row[nameIndex] || '').toString().trim()
    if (!name) continue

    dailyRows.push({
      Name: name,
      'Total Steps': parseStepsValue(row[dateColIndex])
    })
  }

  return dailyRows
}

async function prepareDateUpload(date) {
  const existing = await db
    .collection('groups').doc(currentGroup)
    .collection('history').doc(date).get()

  if (!existing.exists) return true

  if (!confirm(`Data for ${date} already exists. Overwrite it?`)) return false
  await reverseOldData(date)
  return true
}

function toDateOnlyString(d) {
  return d.toISOString().split('T')[0]
}

function plusDays(dateStr, daysToAdd) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + daysToAdd)
  return d
}

async function handleChallengeBoundary(uploadDate, membersMap, challengeStart) {
  if (!challengeStart) {
    return {
      cancelled: false,
      challengeStart: uploadDate,
      membersMap
    }
  }

  const start = new Date(challengeStart)
  const now = new Date(uploadDate)
  const dayNumber = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1

  if (dayNumber <= 28) {
    return {
      cancelled: false,
      challengeStart,
      membersMap
    }
  }

  const challengeEnd = toDateOnlyString(plusDays(challengeStart, 27))
  const shouldReset = confirm(
    `Previous 28-day challenge (${challengeStart} to ${challengeEnd}) is complete. Start new challenge from ${uploadDate}?`
  )

  if (!shouldReset) {
    return { cancelled: true, challengeStart, membersMap }
  }

  await saveChampion(membersMap, challengeStart, challengeEnd)

  const resetMembers = {}
  Object.keys(membersMap).forEach(name => {
    resetMembers[name] = { points: 0, weekly: 0, restUsed: false }
  })

  return {
    cancelled: false,
    challengeStart: uploadDate,
    membersMap: resetMembers
  }
}

async function processRows(rows, date, options = {}) {
  const silentSuccess = options.silentSuccess === true
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

  let challengeStart = groupData.challengeStart
  const boundaryResult = await handleChallengeBoundary(date, membersMap, challengeStart)
  if (boundaryResult.cancelled) return false
  challengeStart = boundaryResult.challengeStart
  membersMap = boundaryResult.membersMap

  // On Monday, reset the weekly step counter (not restUsed)
  if (day === 1) {
    for (let name in membersMap) {
      membersMap[name].weekly = 0
    }
  }

  for (const r of rows) {
    const name = (r['Name'] || '').toString().trim()
    const steps = parseStepsValue(r['Total Steps'])

    if (!name) continue

    if (!membersMap[name]) {
      membersMap[name] = { points: 0, weekly: 0, restUsed: false }
    }

    if (membersMap[name].restUsed === undefined) {
      membersMap[name].restUsed = false
    }

    let pts = 0
    let note = ''

    if (steps > 20000) {
      pts = 8
      note = '😂 Penalty: Over 20k steps (10pts - 2pts = 8pts)'
      penalties.push({ name, steps, date, note: '😂 Must complete penalty task! (Over 20k steps)' })

    } else if (steps < 7000) {
      // Scan history to check if rest was already used this week
      const restAlreadyUsed = await hasRestBeenUsedThisWeek(name, date, challengeStart)
      
      if (!restAlreadyUsed) {
        pts = 10
        note = '🛋️ Flexi Rest Day! First rest this week (+10 pts)'
        membersMap[name].restUsed = true
      } else {
        pts = 0
        note = '😴 Rest day already used this week (0 pts)'
      }

    } else if (day === 0 && steps >= 7000) {
      // Check if this person used a rest day this week
      const restWasUsedThisWeek = await hasRestBeenUsedThisWeek(name, date, challengeStart)
      
      if (!restWasUsedThisWeek) {
        // Only award Daily Walker if NO rest day was used
        pts = 8
        note = '🚶 Daily Walker! Walked every day this week (8 pts)'
        penalties.push({ name, steps, date, note: '🚶 Daily Walker — walked 7k+ every day including Sunday' })
      } else if (steps >= 10000) {
        // Even if rest day was used, 10k+ on Sunday gets Sweet Spot bonus
        pts = 10
        note = '🎯 10K Sweet Spot (+10 pts)'
      }
      // Otherwise pts stays 0 (walked 7-10k on Sunday with rest day used)
    } else if (day !== 0 && steps >= 10000) {
      pts = 10
      note = '🎯 10K Sweet Spot (+10 pts)'
    }

    membersMap[name].weekly += steps

    if (day === 0 && membersMap[name].weekly >= 70000) {
      membersMap[name].points += 10
      membersMap[name].weekly = 0
      note += ' 👑 Consistency Bonus! (+10 pts)'
    } else if (day === 0) {
      membersMap[name].weekly = 0
    }

    membersMap[name].points += pts

    historyEntries.push({ name, steps, pts, note })
    daily.push({ name, steps, points: pts, note })
  }

  const start = new Date(challengeStart)
  const now = new Date(date)
  let diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1
  if (diff < 0) diff = 0
  if (diff > 28) diff = 28

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
  if (!silentSuccess) {
    alert(`✅ Data for ${date} uploaded successfully!`)
  }

  return true
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

    let pts = p.pts !== undefined ? p.pts : 0
    if (p.pts === undefined) {
      if (steps > 20000) pts = 8
      else if (steps < 7000) {
        if (membersMap[name].restUsed) {
          pts = 10
          membersMap[name].restUsed = false
        }
      }
      else if (day === 0 && steps >= 7000) pts = 8
      else if (day !== 0 && steps >= 10000) pts = 10
    } else {
      if (steps < 7000 && pts === 10) {
        membersMap[name].restUsed = false
      }
    }

    membersMap[name].points -= pts
    if (day !== 0) {
      membersMap[name].weekly -= steps
      if (membersMap[name].weekly < 0) membersMap[name].weekly = 0
    }
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

async function saveChampion(membersMap, challengeStart, challengeEnd) {
  const standings = Object.keys(membersMap)
    .map(name => ({ name, points: membersMap[name].points || 0 }))
    .sort((a, b) => b.points - a.points)

  if (standings.length === 0) return

  const winner = standings[0]
  const docId = challengeStart

  await db.collection('groups').doc(currentGroup)
    .collection('champions').doc(docId).set({
      challengeStart,
      challengeEnd,
      winnerName: winner.name,
      winnerPoints: winner.points,
      standings,
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
    const standingsList = (d.standings || [])
      .map((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
        return `${medal} ${p.name} (${p.points}pts)`
      })
      .join('<br>')

    body.innerHTML += `
      <tr>
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

  const sorted = Object.entries(winsMap).sort((a, b) => b[1] - a[1])

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
  
  // Get this week's points from history
  const historySnap = await db.collection('groups').doc(currentGroup)
    .collection('history').get()
  
  const today = new Date()
  const dayOfWeek = today.getDay()
  let weekMonday = new Date(today)
  if (dayOfWeek === 0) {
    weekMonday.setDate(today.getDate() - 6)
  } else {
    weekMonday.setDate(today.getDate() - (dayOfWeek - 1))
  }
  
  const weekMondayStr = weekMonday.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]
  
  const weekPointsMap = {}
  historySnap.forEach(doc => {
    const docDate = doc.id
    if (docDate >= weekMondayStr && docDate <= todayStr) {
      const entries = doc.data().entries || []
      entries.forEach(entry => {
        const name = entry.name
        const pts = entry.pts || 0
        if (!weekPointsMap[name]) weekPointsMap[name] = 0
        weekPointsMap[name] += pts
      })
    }
  })
  
  arr.forEach(p => {
    p.weekPoints = weekPointsMap[p.name] || 0
  })
  
  arr.sort((a, b) => b.weekPoints - a.weekPoints || (b.weekly || 0) - (a.weekly || 0))
  const body = document.querySelector('#weeklyBoard tbody')
  body.innerHTML = ''
  arr.forEach((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1
    body.innerHTML += `
      <tr>
        <td>${medal}</td>
        <td>${p.name}</td>
        <td>${Number(p.weekly || 0).toLocaleString()}</td>
        <td>${p.weekPoints}</td>
      </tr>`
  })
}

async function renderLastWeekLeaderboard() {
  // Find the latest date in history
  const historySnap = await db.collection('groups').doc(currentGroup)
    .collection('history').orderBy('date', 'desc').get()
  
  if (historySnap.empty) {
    const body = document.querySelector('#lastWeekBoard tbody')
    body.innerHTML = `<tr><td colspan="4" style="color:gray;text-align:center">No data yet</td></tr>`
    return
  }

  // Get the most recent date
  const latestDateStr = historySnap.docs[0].id
  const latestDate = new Date(latestDateStr)
  const latestDayOfWeek = latestDate.getDay()
  
  // Calculate the Monday of the PREVIOUS week
  // First, get Monday of current week
  let thisWeekMonday = new Date(latestDate)
  if (latestDayOfWeek === 0) {
    // If today is Sunday, Monday was 6 days ago, so previous Monday was 13 days ago
    thisWeekMonday.setDate(latestDate.getDate() - 6)
  } else {
    // Otherwise, Monday is (dayOfWeek - 1) days ago
    thisWeekMonday.setDate(latestDate.getDate() - (latestDayOfWeek - 1))
  }
  
  // Get the Monday of the week before
  let lastWeekMonday = new Date(thisWeekMonday)
  lastWeekMonday.setDate(thisWeekMonday.getDate() - 7)
  
  // Calculate Sunday of last week
  let lastWeekSunday = new Date(lastWeekMonday)
  lastWeekSunday.setDate(lastWeekMonday.getDate() + 6)
  
  // Format dates as YYYY-MM-DD for comparison
  const lastMondayStr = lastWeekMonday.toISOString().split('T')[0]
  const lastSundayStr = lastWeekSunday.toISOString().split('T')[0]
  
  // Get all history docs
  const allHistorySnap = await db.collection('groups').doc(currentGroup)
    .collection('history').get()
  
  // Collect points and steps for each person from last week's Mon-Sun
  const lastWeekData = {}
  
  allHistorySnap.forEach(doc => {
    const docDate = doc.id
    // Check if date falls within last week's Monday to Sunday
    if (docDate >= lastMondayStr && docDate <= lastSundayStr) {
      const entries = doc.data().entries || []
      entries.forEach(entry => {
        const name = entry.name
        const pts = entry.pts || 0
        const steps = Number(entry.steps) || 0
        if (!lastWeekData[name]) lastWeekData[name] = { points: 0, steps: 0 }
        lastWeekData[name].points += pts
        lastWeekData[name].steps += steps
      })
    }
  })
  
  // Sort and render
  const sorted = Object.entries(lastWeekData)
    .map(([name, data]) => ({ name, points: data.points, steps: data.steps }))
    .sort((a, b) => b.points - a.points || b.steps - a.steps)
  
  const body = document.querySelector('#lastWeekBoard tbody')
  body.innerHTML = ''
  
  if (sorted.length === 0) {
    body.innerHTML = `<tr><td colspan="4" style="color:gray;text-align:center">No data for last week yet</td></tr>`
    return
  }
  
  sorted.forEach(({ name, points, steps }, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1
    body.innerHTML += `
      <tr>
        <td>${medal}</td>
        <td>${name}</td>
        <td>${steps.toLocaleString()}</td>
        <td style="font-weight:bold;color:green">${points}</td>
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
  const body = document.querySelector('#penaltyTable tbody')
  body.innerHTML = ''

  const penSnap = await db.collection('groups').doc(currentGroup)
    .collection('penalties').orderBy('date').get()

  const rows = []

  penSnap.forEach(doc => {
    const p = doc.data()
    rows.push({
      date: p.date,
      name: p.name,
      steps: p.steps,
      note: p.note || '😂 Must complete penalty task!'
    })
  })

  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="4" style="color:gray">No penalties yet 🎉</td></tr>`
    return
  }

  rows.sort((a, b) => a.date.localeCompare(b.date))

  rows.forEach(p => {
    body.innerHTML += `
      <tr>
        <td>${p.date}</td>
        <td>${p.name}</td>
        <td>${Number(p.steps).toLocaleString()}</td>
        <td>${p.note}</td>
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
    const pts = p.pts !== undefined ? p.pts : 0
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
          ticks: { padding: 15 }
        }
      },
      layout: {
        padding: { bottom: 15 }
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
  setUploadModeUI()
  const saved = sessionStorage.getItem('group')
  if (saved) {
    currentGroup = saved
    isAdmin = sessionStorage.getItem('isAdmin') === 'true'
    showApp()
  }
}